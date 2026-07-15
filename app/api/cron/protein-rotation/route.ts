import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { petName, iGa } from '@/lib/korean'

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
 *   3. 분석 페이지 재방문 ↑ → 레시피 비교 + 구독 유지율 ↑
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
    // 카피 — 내부 영어(rotation·variety·risk·라인) 제거. 보호자가 읽는 말로.
    const title = `${iGa(petName(dog.name))} 벌써 ${sub.total_deliveries}번째 박스예요`
    const body =
      cycle === 1
        ? '한 가지 단백질만 오래 먹으면 그 단백질에 예민해질 수 있어요. 다음 박스엔 다른 레시피도 한번 섞어볼까요?'
        : '슬슬 다른 단백질도 맛보여 줄 때예요. 어떤 레시피가 맞을지 같이 골라봐요.'

    try {
      await pushToUser(
        sub.user_id,
        {
          title,
          body,
          // 레시피 비교(/compare)는 앱 분석 페이지 안에서만 연다(사장님
          // 2026-07-15) → 알림은 그 분석 페이지로 보낸다. 예전엔 /compare 로
          // 직행시켜 웹에서 열면 갈 곳 없는 화면이 떴다.
          url: `/dogs/${sub.dog_id}/analysis`,
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
