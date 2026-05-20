import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/protein-rotation
 *
 * Round D2 (2026-05-20): F4-1 단백질 4주 rotation 자동 추천.
 *
 * # 동작
 *   매주 1회 — 정기구독 4번째 박스 (또는 8/12/16...) 배송 직후 강아지의
 *   보호자에게 "다음 박스는 다른 단백질 어떠세요?" 푸시.
 *
 * # 효과
 *   1. 같은 단백질 장기간 → IgE 감작 risk ↑ — variety 가 알레르기 발현 ↓
 *   2. 단백질 라인 간 cross-trial → 자가품질 신호 (어느 단백질이 더 잘 맞나)
 *   3. /compare 페이지 traffic ↑ → 첫 박스 비교 + 정기구독 conversion ↑
 *
 * # 조건
 *   - status='active' 정기구독
 *   - total_deliveries > 0 AND total_deliveries % 4 == 0
 *   - last_delivery_date 가 최근 7일 이내 (배송 직후가 효과 최대)
 *   - 14일 spam 차단 — push_log category='marketing' AND title 패턴
 *
 * # 일정
 *   매주 화 KST 11시 (UTC 02:00). 첫 박스 체크인 (월 11시) 과 같은 슬롯
 *   피하기 위해 +1일.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('protein-rotation', () => runRotation())
}

async function runRotation(): Promise<Response> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any

  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString()
  const fourteenDaysAgo = new Date(now - 14 * 86_400_000).toISOString()

  // active 정기구독 + 최근 7일 배송 완료 + total_deliveries > 0.
  // total_deliveries % 4 == 0 은 JS 측에서 필터 (Supabase 모듈로 query 미지원).
  const { data: subsRaw } = await admin
    .from('subscriptions')
    .select('id, user_id, dog_id, total_deliveries, last_delivery_date')
    .eq('status', 'active')
    .gt('total_deliveries', 0)
    .gte('last_delivery_date', sevenDaysAgo.slice(0, 10))
    .limit(500)

  const subs = (subsRaw ?? []) as Array<{
    id: string
    user_id: string
    dog_id: string | null
    total_deliveries: number
    last_delivery_date: string | null
  }>

  // % 4 == 0 필터
  const targets = subs.filter((s) => s.total_deliveries % 4 === 0)

  let sent = 0
  let skipped = 0
  let skippedSpam = 0

  for (const sub of targets) {
    if (!sub.dog_id) {
      skipped += 1
      continue
    }

    // 14일 spam 차단
    const { count: recent } = await admin
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sub.user_id)
      .eq('category', 'marketing')
      .ilike('title', '%단백질%rotation%')
      .gt('sent_at', fourteenDaysAgo)
    if ((recent ?? 0) > 0) {
      skippedSpam += 1
      continue
    }

    // 강아지 이름 조회
    const { data: dogRow } = await admin
      .from('dogs')
      .select('name')
      .eq('id', sub.dog_id)
      .maybeSingle()
    const dog = dogRow as { name: string } | null
    if (!dog) {
      skipped += 1
      continue
    }

    const cycle = Math.floor(sub.total_deliveries / 4)
    const title = `${dog.name}이 ${sub.total_deliveries}번째 박스 — 단백질 rotation`
    const body =
      cycle === 1
        ? '4번째 박스 완료! 다음엔 다른 단백질도 시도해 보세요. variety 가 알레르기 risk 를 낮춰요.'
        : `${cycle}번째 rotation cycle. 다른 라인을 시도해 보시는 건 어떨까요?`

    try {
      await pushToUser(
        sub.user_id,
        {
          title,
          body,
          url: '/compare',
          tag: `protein-rotation-${sub.dog_id}-${sub.total_deliveries}`,
        },
        { category: 'marketing' },
      )
      sent += 1
    } catch {
      /* silent — 다음 cron 재시도 */
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: targets.length,
    sent,
    skipped,
    skipped_spam: skippedSpam,
  })
}
