import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { pushToUser } from '@/lib/push'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { weekdayOf, SHIP_WEEKDAY } from '@/lib/shipping-schedule'
import { findMissedCrons, type CronEntry } from '@/lib/cron-watchdog'
import { cronLabel } from '@/lib/cron-labels'
import vercelConfig from '@/vercel.json'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'

/**
 * 다가오는 발송일(화요일) — **마감 리드타임 없이**. nextShipDate 는 '지금 주문하면
 * 언제 받나'(리드타임 2일 포함)라 월요일에 다음주를 가리킨다. 브리핑이 원하는 건
 * '눈앞의 화요일에 몇 박스 나가나'이므로 순수 다음 화요일을 쓴다(최종감사 #11).
 */
function upcomingShipDate(fromIso: string): string {
  const gap = (SHIP_WEEKDAY - weekdayOf(fromIso) + 7) % 7 || 7
  const d = new Date(fromIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + gap)
  return d.toISOString().slice(0, 10)
}

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
    chargedToday,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      // ★부분환불 주문도 발송 대상이다(규칙42) — 'paid' 단독이면 사장님
      //  하루 한 번뿐인 운영 신호(미발송 큐)에서 그 박스가 빠진다.
      .in('payment_status', PAID_STATUSES)
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
    // ★최종감사 #11 (2026-07-29): 이 카운트가 정작 발송일 아침에 틀렸다.
    //   ① 화요일 09시 브리핑은 04시 청구 크론이 성공분의 next_delivery_date 를
    //      이미 +14 로 밀어낸 **뒤**라, '오늘 발송' = 청구 실패분만 세어졌다
    //      (구독 5명인 화요일에 "처리할 일 없어요 ☀️"). 성공 청구는
    //      subscription_charges(scheduled_for=오늘, succeeded)로 센다 —
    //      피킹 리스트의 chargedBumpDate 와 같은 논리.
    //   ② 월요일(원료 준비일)의 nextShipDate 는 마감 리드타임(2일) 때문에
    //      **다음주** 화요일을 가리켰다 — 내일 나갈 박스 대신 다음주 물량이
    //      와서 원료 준비 판단이 틀어진다. 리드타임 없는 '다가오는 화요일'로.
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .not('billing_key', 'is', null)
      .eq('next_delivery_date', isShipDay ? today : upcomingShipDate(today)),
    // 발송일엔 이미 청구 성공한 오늘 박스 수도 합산해야 한다(위 ① 참고).
    supabase
      .from('subscription_charges')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_for', today)
      .eq('status', 'succeeded'),
  ])

  // ★조회 실패를 0건으로 접지 않는다(2026-08-05 병렬 감사).
  //   전에는 `r.count ?? 0` 하나로 끝나서, DB 가 흔들린 아침엔 미발송·결제
  //   실패·환불 대기가 전부 0 으로 접혀 사장님 폰에 **"오늘 처리할 일이
  //   없어요 ☀️"** 가 갔다. 발송일(화) 아침 브리핑이 유일한 운영 신호인데
  //   그게 거짓말을 하면 하루가 통째로 날아간다. 규칙1 그대로다.
  //   못 센 항목이 있으면 브리핑 맨 위에 그렇게 적는다 — 사람은 "0"과
  //   "못 셌음"을 구분해야 판단할 수 있다.
  const countFailures: string[] = []
  const n = (r: { count: number | null }) => r.count ?? 0
  const nOf = (label: string, r: { count: number | null; error?: unknown }) => {
    const err = (r as { error?: { message?: string } | null }).error
    if (err) countFailures.push(`${label}: ${err.message ?? '조회 실패'}`)
    return r.count ?? 0
  }
  // ── 크론 워치독 (2026-07-29 최종감사 #10) ──────────────────────────
  // Vercel 이 크론을 조용히 거른다(청구 크론 30일 중 25일 실행 실측). 실행률
  // 자체는 코드로 못 고치므로, "어제 돌았어야 했는데 기록이 없는 자동작업"을
  // 매일 아침 여기서 알린다. 창 = 지금-25h ~ 지금-1h (직전 1시간은 지터 유예,
  // 브리핑 자신도 이 유예 덕에 자기 자신을 오탐하지 않는다).
  let missedCrons: string[] = []
  try {
    const windowEnd = new Date(Date.now() - 60 * 60 * 1000)
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000)
    const { data: healthRows, error: healthRowsErr } = await supabase
      .from('cron_health')
      .select('path, executed_at')
      // 지터 허용치(3h)만큼 창보다 넓게 가져와야 경계 실행이 인정된다
      .gte('executed_at', new Date(windowStart.getTime() - 30 * 60 * 1000).toISOString())
      .limit(2000)
    // 실행 기록 조회가 실패하면 "빠진 크론 없음"이 되어 워치독이 무력화된다.
    // 이 블록은 try 안이라 흐름을 끊지 않고, 대신 못 봤다는 사실을 남긴다.
    if (healthRowsErr) {
      console.error('[daily-briefing] 크론 실행 기록 조회 실패:', healthRowsErr.message)
      countFailures.push(`크론 실행 기록: ${healthRowsErr.message}`)
    }
    missedCrons = findMissedCrons(
      (vercelConfig as { crons: CronEntry[] }).crons,
      (healthRows ?? []) as { path: string; executed_at: string }[],
      windowStart,
      windowEnd,
    )
  } catch {
    /* 워치독 실패가 브리핑 자체를 막으면 안 됨 — 이번 회차만 침묵 */
  }

  const items: string[] = []
  // 안 돈 자동작업이 제일 먼저 — 결제·발송이 멈춘 것일 수 있다.
  if (missedCrons.length > 0) {
    items.push(
      `🚨 어제 안 돈 자동작업 ${missedCrons.length}개: ${missedCrons
        .slice(0, 4)
        .map((c) => cronLabel(c))
        .join(', ')}${missedCrons.length > 4 ? ' 외' : ''}`,
    )
  }

  // 발송 관련이 제일 위 — 화요일 아침엔 이게 오늘의 일이다.
  const boxes = n(todayBoxes) + (isShipDay ? n(chargedToday) : 0)
  if (boxes > 0) {
    items.push(
      isShipDay ? `📦 오늘 발송 ${boxes}박스` : `📦 다음 발송 ${boxes}박스`,
    )
  }
  const cUnshipped = nOf('미발송', unshipped)
  if (cUnshipped > 0) items.push(`🚚 미발송 ${cUnshipped}건`)
  const cStuck = nOf('배송 지연', shippingStuck)
  if (cStuck > 0) items.push(`⏳ 배송 지연 ${cStuck}건`)
  const cFailed = nOf('결제 실패', failedCharge)
  if (cFailed > 0) items.push(`💳 결제 실패 ${cFailed}건`)
  const cRenewal = nOf('카드 재등록 대기', cardRenewal)
  if (cRenewal > 0) items.push(`🔁 카드 재등록 대기 ${cRenewal}건`)
  const cRefund = nOf('환불 대기', refundsPending)
  if (cRefund > 0) items.push(`↩️ 환불 대기 ${cRefund}건`)
  const cCs = nOf('답장 대기', unreadCs)
  if (cCs > 0) items.push(`✉️ 답장 대기 ${cCs}건`)
  const cStock = nOf('품절', stockOut)
  if (cStock > 0) items.push(`📉 품절 ${cStock}개`)

  // 못 센 항목은 맨 앞에 — 아래 숫자가 전부가 아닐 수 있다는 걸 먼저 말한다.
  if (countFailures.length > 0) {
    items.unshift(`⚠️ ${countFailures.length}개 항목을 못 셌어요(어드민에서 직접 확인 필요)`)
  }

  const title = isShipDay ? '오늘은 발송일이에요 📦' : '오늘의 운영 브리핑'
  const body =
    items.length > 0
      ? items.join(' · ')
      : // ★"할 일 없음"은 **전부 정상적으로 세어 0이었을 때만** 할 수 있는 말이다.
        //   못 센 게 있으면 위 unshift 로 items 가 비지 않으므로 여기 안 온다.
        '오늘 처리할 일이 없어요 ☀️ 편하게 시작하세요.'

  // admin 계정 전부(현재는 사장님 1명).
  // ★2026-09-01 — 예전엔 `profiles.role='admin'` 으로 찾았는데, 관리자 판정 정본은
  //   R101-C 이후 **app_metadata.role** 하나다(profiles fallback 은 self-elevation
  //   때문에 제거됐다). 실측 결과 profiles.role='admin' 은 0명이라 이 크론은
  //   29회 실행 동안 **전부 0명에게** 나갔고, 그런데도 success 로 집계됐다.
  const { data: admins, error: adminsErr } = await supabase.rpc('admin_user_ids')

  // 조회 실패를 0건으로 접지 않는다(2026-08-05 · 규칙1) — 접히면 "대상 없음"이
  // 되어 크론은 초록인데 아무 일도 안 한 것이 정상으로 기록된다.
  if (adminsErr) {
    console.error('[daily-briefing] 수신자 조회 실패:', adminsErr.message)
    return NextResponse.json(
      { ok: false, reason: 'lookup_failed', at: 'daily-briefing', error: adminsErr.message },
      { status: 500 },
    )
  }
  const targets = (admins ?? []) as Array<{ id: string }>
  // 수신자가 0명인 것도 실패다 — 관리자가 한 명도 없을 리 없으므로 판정이
  // 깨졌다는 뜻이다. 조용히 초록으로 넘어가면 또 29회를 허공에 쏜다.
  if (targets.length === 0) {
    console.error('[daily-briefing] 수신자 0명 — 관리자 판정이 깨졌다')
    return NextResponse.json(
      { ok: false, reason: 'no_admin_recipients', at: 'daily-briefing' },
      { status: 500 },
    )
  }
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
