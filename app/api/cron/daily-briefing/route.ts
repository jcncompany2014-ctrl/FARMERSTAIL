import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { pushToUser } from '@/lib/push'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { weekdayOf, nextShipDate } from '@/lib/shipping-schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/daily-briefing — 아침 운영 브리핑 (계획 A-F4).
 *
 * # 왜
 * 솔로 운영이라 "오늘 뭐부터 하지"를 알려면 admin 을 열어야 한다. 매일 아침
 * 처리 대기 요약을 **사장님 폰으로** 보내서, 열 일이 없으면 안 열어도 되게 한다.
 *
 * # 받는 사람
 * profiles.role = 'admin' 인 계정 전부(현재는 사장님). 고객에게는 절대 안 간다.
 *
 * # 알림 게이트
 * category 를 주지 않는다 — 운영 알림은 마케팅 선호도·조용시간에 걸리면 안 되기
 * 때문(1:1 CS 메시지와 같은 취급). 대신 하루 1회뿐이라 소음이 되지 않는다.
 *
 * # 내용
 * 대시보드 '처리 대기' 와 같은 쿼리(미발송·배송지연·카드재등록·결제실패·환불대기·
 * 품절). 화요일이면 그날 나갈 박스 수를 앞에 붙인다(발송일이라 제일 중요).
 * 전부 0 이면 "오늘 처리할 일 없어요 ☀️" 로 보낸다 — 조용한 것도 정보다.
 *
 * # 딥링크
 * url='/admin' — 앱(Capacitor)에서 알림을 누르면 어드민이 그대로 열린다.
 * (앱은 www.farmerstail.kr 을 감싸므로 admin 경로도 앱 안에서 동작한다.)
 *
 * # 스케줄
 * vercel.json cron `0 0 * * *` (UTC 00:00 = KST 09:00).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  return trackCron('daily-briefing', () => runDailyBriefing())
}

async function runDailyBriefing(): Promise<Response> {
  const supabase = createAdminClient()
  const nowMs = Date.now()
  const oneDayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString()
  const today = todayKstIsoDate()
  const isShipDay = weekdayOf(today) === 2 // 화요일 = 발송일

  const [
    unshipped,
    shippingStuck,
    cardRenewal,
    failedCharge,
    refundsPending,
    stockOut,
    unreadCs,
    todayBoxes,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .eq('order_status', 'preparing')
      .lt('created_at', oneDayAgo),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'shipping')
      .lt('shipped_at', sevenDaysAgo),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('requires_billing_key_renewal', true),
    supabase
      .from('subscription_charges')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('attempted_at', oneDayAgo),
    supabase
      .from('refunds')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('stock', 0),
    supabase
      .from('cs_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender', 'user')
      .is('read_at', null),
    // 오늘이 발송일이면 오늘 나갈 박스, 아니면 다음 발송일 박스 수.
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .not('billing_key', 'is', null)
      .eq('next_delivery_date', isShipDay ? today : nextShipDate(today)),
  ])

  const n = (r: { count: number | null }) => r.count ?? 0
  const items: string[] = []

  // 발송 관련이 제일 위 — 화요일 아침엔 이게 오늘의 일이다.
  const boxes = n(todayBoxes)
  if (boxes > 0) {
    items.push(
      isShipDay ? `📦 오늘 발송 ${boxes}박스` : `📦 다음 발송 ${boxes}박스`,
    )
  }
  if (n(unshipped) > 0) items.push(`🚚 미발송 ${n(unshipped)}건`)
  if (n(shippingStuck) > 0) items.push(`⏳ 배송 지연 ${n(shippingStuck)}건`)
  if (n(failedCharge) > 0) items.push(`💳 결제 실패 ${n(failedCharge)}건`)
  if (n(cardRenewal) > 0) items.push(`🔁 카드 재등록 대기 ${n(cardRenewal)}건`)
  if (n(refundsPending) > 0) items.push(`↩️ 환불 대기 ${n(refundsPending)}건`)
  if (n(unreadCs) > 0) items.push(`✉️ 답장 대기 ${n(unreadCs)}건`)
  if (n(stockOut) > 0) items.push(`📉 품절 ${n(stockOut)}개`)

  const title = isShipDay ? '오늘은 발송일이에요 📦' : '오늘의 운영 브리핑'
  const body =
    items.length > 0
      ? items.join(' · ')
      : '오늘 처리할 일이 없어요 ☀️ 편하게 시작하세요.'

  // admin 계정 전부(현재는 사장님 1명).
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  const targets = (admins ?? []) as Array<{ id: string }>
  let sent = 0
  for (const a of targets) {
    // category 미지정 = 선호도·조용시간 게이트 우회(운영 알림).
    const res = await pushToUser(a.id, { title, body, url: '/admin' })
    if (res.ok) sent += res.sent
  }

  return NextResponse.json({
    ok: true,
    date: today,
    isShipDay,
    admins: targets.length,
    sent,
    items,
  })
}
