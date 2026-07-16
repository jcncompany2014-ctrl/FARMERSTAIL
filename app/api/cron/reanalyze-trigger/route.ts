import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { isInventionEnabled } from '@/lib/invention-flags'
import { shouldReanalyze } from '@/lib/personalization/reanalyze-triggers'
import { stageFromKR } from '@/lib/nutrition'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/reanalyze-trigger — 발명 명세 6.7-(2) B-71 / B-76.
 *
 * 활성 dog 의 5조건 검사 → trigger 발생 시 push nudge 발송 ("새 분석을
 * 받아볼까요?").
 *
 * # 5 조건
 *  1. weight drift > 10%
 *  2. 측정 도구 업그레이드
 *  3. lifestage 변경
 *  4. 마지막 분석 12주 경과
 *  5. 사용자 요청
 *
 * # PCT flag 가드
 * counterfactual flag OFF 면 cron skip.
 */

const MAX_PER_RUN = 500

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  if (!isInventionEnabled('counterfactual')) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'INVENTION_COUNTERFACTUAL_DISABLED',
    })
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('reanalyze-trigger', async () => {
    const supabase = createAdminClient()

  // 분석 1건 이상 있는 dog 의 최신 analysis
  const { data: analyses } = await supabase
    .from('analyses')
    .select(
      'dog_id, user_id, rer, stage, created_at, dogs(weight, age_value, age_unit, birth_date)',
    )
    .order('created_at', { ascending: false })
    .limit(MAX_PER_RUN * 2)

  type Row = {
    dog_id: string
    user_id: string
    rer: number
    stage: string
    created_at: string
    dogs?:
      | {
          weight: number | null
          age_value: number | null
          age_unit: string | null
          birth_date: string | null
        }
      | Array<{
          weight: number | null
          age_value: number | null
          age_unit: string | null
          birth_date: string | null
        }>
      | null
  }
  const rows = (analyses ?? []) as Row[]

  // dog 별 최신 1건
  const seen = new Set<string>()
  const latest: Row[] = []
  for (const r of rows) {
    if (seen.has(r.dog_id)) continue
    seen.add(r.dog_id)
    latest.push(r)
    if (latest.length >= MAX_PER_RUN) break
  }

  // 측정 도구 업그레이드 신호 제거 (2026-07-16 포인트 전면 폐기).
  // 이 신호를 **포인트 원장**(reference_type='measurement_upgrade')에서 읽고 있었다.
  // 포인트 적립을 없앴으니 그 row 는 더 이상 안 쌓인다 → 영원히 0건인 조건.
  // 나머지 4조건(체중 drift·생애주기 변경·12주 경과·사용자 요청)은 그대로 작동한다.
  // 측정 도구 변경 자체는 dogs.weight_method 에 남으므로, 그걸로 다시 신호를 만들려면
  // '마지막 분석 이후 weight_method 가 바뀌었나' 를 보면 된다(추후).

  let triggered = 0
  let skipped = 0

  for (const r of latest) {
    const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs
    if (!dog) {
      skipped += 1
      continue
    }

    const lastStage =
      r.stage.includes('성장') ? 'puppy' :
      r.stage.includes('노령') ? 'senior' : 'adult'

    // current stage — 단순화: age_value 보고 추정 (정확한 로직은 nutrition.ts)
    const currentStage = stageFromKR(r.stage) // 같은 값일 수 있지만 helper 활용

    // RER = 70 × W^0.75 역산 — 사실 정답은 dogs.weight 직접 사용
    // 단순 비교: dog.weight 가 변했으면 drift
    const predicted = Math.pow(r.rer / 70, 4 / 3)
    const actual = dog.weight

    const decision = shouldReanalyze({
      lastAnalysisAt: r.created_at,
      predictedWeight: predicted,
      actualWeight: actual,
      hadMeasurementUpgrade: false,
      lastStage,
      currentStage,
      userRequested: false,
    })

    if (decision.trigger) {
      // push nudge — best effort, lazy import
      try {
        const { pushToUser } = await import('@/lib/push')
        const firstReason = decision.reasons[0]
        const reasonText: Record<string, string> = {
          weight_drift: '체중 변화가 커서',
          measurement_upgrade: '측정 도구가 정확해져서',
          stage_change: '라이프 스테이지가 바뀌어서',
          stale_12w: '마지막 분석이 12주 됐어서',
          user_request: '직접 요청하셔서',
        }
        await pushToUser(
          r.user_id,
          {
            title: '새 분석을 받아볼까요?',
            body: (firstReason ? reasonText[firstReason] : undefined) ?? '식단을 다시 점검할 시기예요',
            url: `/dogs/${r.dog_id}/survey`,
          },
          { category: 'order' }, // 정보성 — 빈도 제한 X
        )
      } catch {
        /* silent */
      }
      triggered += 1
    } else {
      skipped += 1
    }
  }

    return NextResponse.json({
      ok: true,
      candidates: latest.length,
      triggered,
      skipped,
    })
  })
}
