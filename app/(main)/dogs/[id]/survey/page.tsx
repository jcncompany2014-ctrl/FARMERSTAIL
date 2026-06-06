// audit #109: server-side 인증 + dogId 검증. 이전엔 client 가 useEffect 에서
// supabase.auth.getUser() 후 미인증 시 router.push('/login') → UI flash + history
// pollution. 서버에서 redirect 하면 빈 surface 없이 깔끔.
//
// audit #100 / #101 partial: page.tsx server component 화 (Next 16 params Promise).
// 실제 survey 흐름 (8 step state, autosave) 은 SurveyClient.tsx 그대로 — #96
// step 별 dynamic import 분할은 별도 sprint.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { weightFromRER } from '@/lib/v3-helpers/analysis-view'
import SurveyClient from './SurveyClient'

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=/dogs/${id}/survey`)
  }

  // dog 소유 검증 — 다른 사용자 dogId 로 진입 시 /dogs 로.
  // 체중 + 측정시각도 함께 (B1: 30일 락 우회용 "중요 정보 변경" 감지).
  const { data: dog } = await supabase
    .from('dogs')
    .select('id, weight, weight_measured_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!dog) {
    redirect('/dogs')
  }

  // R80-P1 + B1: 재분석 30일 제한 — Anthropic 비용 폭주 차단.
  // 마지막 분석 후 30일 이내면 기본적으로 새 설문을 막고 분석 페이지로 redirect.
  // 6개월(180일) 후 cron 이 자동으로 재진단 푸시 알림 발송.
  //
  // 단(B1, 2026-06-06): 체중/질병 같은 "중요 정보"가 마지막 분석 이후 실제로
  // 바뀐 경우엔 30일 안이라도 재분석을 허용한다. 잘못 입력한 체중(예: 4kg →
  // 14kg)에 추천이 30일간 고정되는 문제 방지. 단순 새로고침 남발은 변경 신호가
  // 없으면 계속 차단된다.
  const { data: lastAnalysis } = await supabase
    .from('analyses')
    .select('id, created_at, rer')
    .eq('dog_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastAnalysis?.created_at) {
    // 서버 컴포넌트 — Date.now() 는 impure 로 막혀 new Date() 사용.
    const lastMs = new Date(lastAnalysis.created_at).getTime()
    const ageDays = (new Date().getTime() - lastMs) / (1000 * 60 * 60 * 24)

    if (ageDays < 30) {
      let materialChange = false

      // 1) 체중 변경 — (a) 분석 이후 재측정됐거나, (b) 현재 체중이 분석 당시
      //    체중(RER 역산)과 15%+ & 0.3kg+ 차이(큰 오입력/실제 변화). 0.3kg 절대
      //    가드는 토이견에서 역산 오차로 인한 오탐 방지.
      const measuredAt = dog.weight_measured_at
      if (measuredAt && new Date(measuredAt).getTime() > lastMs) {
        materialChange = true
      } else if (dog.weight && lastAnalysis.rer && lastAnalysis.rer > 0) {
        const analysisWeight = weightFromRER(lastAnalysis.rer)
        const absDiff = Math.abs(dog.weight - analysisWeight)
        if (analysisWeight > 0 && absDiff > 0.3 && absDiff / analysisWeight > 0.15) {
          materialChange = true
        }
      }

      // 2) 질병 변경 — 마지막 분석 이후 추가된 복용 약물(= 새 건강 이슈).
      //    dog_medications 는 generated types 미포함 → cast. 실패 시 무시.
      if (!materialChange) {
        try {
          const medsClient = supabase.from('dog_medications' as never) as unknown as {
            select: (cols: string) => {
              eq: (col: string, val: string) => {
                eq: (col: string, val: string) => {
                  order: (
                    col: string,
                    opts: { ascending: boolean },
                  ) => {
                    limit: (n: number) => Promise<{
                      data: { created_at: string }[] | null
                    }>
                  }
                }
              }
            }
          }
          const { data: meds } = await medsClient
            .select('created_at')
            .eq('dog_id', id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
          const medAt = meds?.[0]?.created_at
          if (medAt && new Date(medAt).getTime() > lastMs) {
            materialChange = true
          }
        } catch {
          /* dog_medications 미존재/쿼리 실패 — 체중 신호만으로 판단 */
        }
      }

      if (!materialChange) {
        // 변경 없음 → 30일 락 유지. 최신 분석 페이지로 안내(토스트는 그 페이지).
        const daysLeft = Math.ceil(30 - ageDays)
        redirect(`/dogs/${id}/analysis?from=survey_blocked&days=${daysLeft}`)
      }
      // 변경 감지 → 통과(재분석 진행).
    }
  }

  return <SurveyClient dogId={id} />
}
