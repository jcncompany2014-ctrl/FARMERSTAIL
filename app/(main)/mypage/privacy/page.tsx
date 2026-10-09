import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PrivacyView from './PrivacyView'

export const metadata: Metadata = {
  title: '내 데이터 (개인정보 열람권)',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * /mypage/privacy
 *
 * 개인정보보호법 제35조 (열람권) + 제36조 (정정·삭제) + 제37조 (처리정지) 명시.
 *
 * 화면 구성:
 *   1) "내 데이터 한눈에" — 카테고리별 row count (보유 항목 가시화)
 *   2) "JSON 다운로드" — /api/privacy/export 트리거
 *   3) "수정·삭제" — profile / addresses / dogs 등 편집 페이지로 직링크
 *   4) "처리정지·탈퇴" — /mypage/delete 안내
 *   5) "DPO 연락처" — 직접 문의가 필요할 때
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M15): 그리는 부분을 PrivacyView 로 뺐다(점검 화면이 예시 값으로 같은
 * 화면을 그린다). 그리고 폐지된 포인트(2026-07-16 전면 폐기)의 '포인트 이력' 개수를 목록에서 뺐다(앱시안 결정) —
 * 쌓일 곳이 없는 항목을 '가지고 있는 내 정보'로 세지 않는다. 내려받기 파일(/api/privacy/export)은 그대로다.
 */
export default async function PrivacyDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/privacy')

  // 카테고리별 row count — head:true 로 데이터 fetch 없이 카운트만.
  const counts = await Promise.all(
    [
      ['dogs', 'dogs'],
      ['surveys', 'surveys'],
      ['analyses', 'analyses'],
      ['weight_logs', 'weight_logs'],
      ['health_logs', 'health_logs'],
      ['dog_reminders', 'dog_reminders'],
      ['addresses', 'addresses'],
      ['orders', 'orders'],
      ['subscriptions', 'subscriptions'],
      ['consent_log', 'consent_log'],
    ].map(async ([table, label]) => {
      // audit #79: dynamic table 이름 → typed from() 호환 X. untyped cast.
      const { count } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (
              cols: string,
              opts: { count: 'exact'; head: boolean },
            ) => {
              eq: (c: string, v: string) => Promise<{ count: number | null }>
            }
          }
        }
      )
        .from(table!)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      return { label: label!, count: count ?? 0 }
    }),
  )

  // P13 — 현재 동의 단계 fetch
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('consent_level')
    .eq('id', user.id)
    .maybeSingle()
  const consentLevel = ((profileRow as { consent_level?: number } | null)
    ?.consent_level ?? 1) as 1 | 2 | 3 | 4

  return <PrivacyView counts={counts} consentLevel={consentLevel} />
}
