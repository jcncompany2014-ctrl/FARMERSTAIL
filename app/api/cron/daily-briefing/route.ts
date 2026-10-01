import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { countPushTargets, pushToUser } from '@/lib/push'
import { todayKstIsoDate, addDaysKst } from '@/lib/datetime-kst'
import { weekdayOf, SHIP_WEEKDAY, CHARGE_BEFORE_SHIP_DAYS, chargeDateFor, paidBoxShipIso } from '@/lib/shipping-schedule'
import { findMissedCrons, type CronEntry } from '@/lib/cron-watchdog'
import { cronLabel } from '@/lib/cron-labels'
import vercelConfig from '@/vercel.json'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { scaleWarnings } from '@/lib/ops/scale-watch'
import { getChargeTimings } from '@/lib/payments/charge-timing'

/**
 * 다가오는 발송일(화요일) — **마감 리드타임 없이**. nextShipDate 는 '지금 주문하면
 * 언제 받나'(리드타임 4일 포함)라 월요일에 다음주를 가리킨다. 브리핑이 원하는 건
 * '눈앞의 화요일에 몇 박스 나가나'이므로 순수 다음 화요일을 쓴다(최종감사 #11).
 */
function upcomingShipDate(fromIso: string): string {
  return addDaysKst(fromIso, (SHIP_WEEKDAY - weekdayOf(fromIso) + 7) % 7 || 7)
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
 * 대시보드 '처리 대기' 와 같은 쿼리(미발송·배송지연·카드재등록·결제실패·환불대기·품절). 앞에는 눈앞의
 * 발송 화요일 박스 수를 붙인다 — 화요일 = 오늘 나갈 박스, 토요일 = 오늘 결제·조리 시작분, 그 밖 = 다음 발송분.
 * 전부 0 이면 "오늘 처리할 일 없어요 ☀️" 로 보낸다 — 조용한 것도 정보다.
 *
 * # 딥링크
 * url='/admin' — 앱(Capacitor)에서 알림을 누르면 어드민이 그대로 열린다.
 * (앱은 www.farmerstail.kr 을 감싸므로 admin 경로도 앱 안에서 동작한다.)
 *
 * # 스케줄
 * vercel.json cron `40 0 * * *` (UTC 00:40 = KST 09:40) — 청구 크론(UTC 00:10) **뒤**라 그날 결제 실패가
 * 바로 들어간다(2026-09-24: 예전 09:00 은 청구 전이라 실패가 하루 늦게 알려졌다).
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
  const isShipDay = weekdayOf(today) === SHIP_WEEKDAY // 화요일 = 발송일
  const isCookDay = weekdayOf(addDaysKst(today, CHARGE_BEFORE_SHIP_DAYS)) === SHIP_WEEKDAY // 토요일 = 일반 고객 결제·조리 시작
  const shipIso = isShipDay ? today : upcomingShipDate(today) // 눈앞의 발송 화요일

  const [
    paidPreparing,
    shippingStuck,
    cardRenewal,
    failedCharge,
    refundsPending,
    refundsStuck,
    stockOut,
    unreadCs,
    shipSubs,
    chargedToday, chargeFailedToday,
    cronErrors,
  ] = await Promise.all([
    supabase
      .from('orders')
      // ★부분환불 주문도 발송 대상이다(규칙42). 건수가 아니라 행을 받아 박스마다 발송일(화)을 따진다(아래 paidBoxShipIso).
      //  예전엔 '결제 후 24시간+'를 미발송으로 셌는데, 토요일 결제분은 화요일 발송이라 일~화 매주 거짓 경보였다.
      .select('id, subscription_id, paid_at, created_at')
      .in('payment_status', PAID_STATUSES)
      .eq('order_status', 'preparing')
      .limit(PAID_PREPARING_LIMIT),
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
    // ★환불 대기는 payment_refund_queue 가 정본이다 (2026-09-25 3차 점검).
    //   예전엔 refunds.status='pending' 을 셌는데, refunds 는 성공한 환불만 적는
    //   원장이라(쓰는 곳 둘 다 'succeeded') 이 숫자는 **항상 0** 이었다. 실제로
    //   막힌 환불(고객 돈이 묶인 것)은 여기 안 나왔다.
    supabase
      .from('payment_refund_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('payment_refund_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'permanently_failed'),
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
    // ★눈앞의 발송 화요일(shipIso)에 next_delivery_date 가 남아 있는 = **아직 결제 안 된** 구독.
    //   (최종감사 #11, 2026-07-29) 청구 크론은 성공분의 next_delivery_date 를 곧바로 +14 로 민다 —
    //   그래서 이 목록엔 결제된 박스가 없다. 결제된 박스는 위 paidPreparing(결제됨 + 발송 대기
    //   주문)에서 센다. 2026-10-01 부터 일반 고객은 토요일에 결제되므로 토~화엔 그 박스들이
    //   여기서 빠진다 — 예전처럼 이 숫자를 '다음 발송'으로 쓰면 일·월요일에 대부분이 사라졌다.
    //   남은 건 결제일이 아직인 것(서포터즈 화요일 결제분, 수~금의 토요일 결제분)이거나
    //   결제일이 지났는데 결제가 안 된 것이다 — 아래에서 구독별 결제일(chargeDateFor)로 가른다.
    //   청구 크론과 같은 대상 조건(활성 · 카드 있음 · 재등록 불필요).
    supabase
      .from('subscriptions')
      .select('id, user_id')
      .eq('status', 'active')
      .eq('requires_billing_key_renewal', false)
      .not('billing_key', 'is', null)
      .eq('next_delivery_date', shipIso)
      .limit(PAID_PREPARING_LIMIT),
    // 토요일 줄(오늘 결제·조리 시작)용 — 오늘 청구 크론이 성공·실패로 끝낸 회차.
    //   scheduled_for = 청구 크론 실행일(일반 = 토요일, 서포터즈 = 화요일).
    supabase
      .from('subscription_charges')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_for', today)
      .eq('status', 'succeeded'),
    supabase
      .from('subscription_charges')
      .select('id', { count: 'exact', head: true })
      .eq('scheduled_for', today)
      .eq('status', 'failed'),
    // ★24시간 안에 **실패로 끝난** 자동작업 (2026-09-25 3차 점검). 워치독(아래)은
    //   '기록이 있나'만 봐서 실패 기록도 '돌았음'으로 쳤다 — 화요일 청구 크론이 500
    //   이어도 이 브리핑은 조용했다. 실패 메일(ops-digest)은 08:00 이라 그다음 날이다.
    supabase
      .from('cron_health')
      .select('path')
      .eq('status', 'error')
      .gte('executed_at', oneDayAgo)
      .limit(500),
  ])

  // ★조회 실패를 0건으로 접지 않는다(2026-08-05 병렬 감사).
  //   전에는 `r.count ?? 0` 하나로 끝나서, DB 가 흔들린 아침엔 미발송·결제
  //   실패·환불 대기가 전부 0 으로 접혀 사장님 폰에 **"오늘 처리할 일이
  //   없어요 ☀️"** 가 갔다. 발송일(화) 아침 브리핑이 유일한 운영 신호인데
  //   그게 거짓말을 하면 하루가 통째로 날아간다. 규칙1 그대로다.
  //   못 센 항목이 있으면 브리핑 맨 위에 그렇게 적는다 — 사람은 "0"과
  //   "못 셌음"을 구분해야 판단할 수 있다.
  const countFailures: string[] = []
  const nOf =(label: string, r: { count: number | null; error?: unknown }) => {
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

  // 실패로 끝난 자동작업 — 결제·발송이 멈춘 것일 수 있어 맨 위.
  if (cronErrors.error) {
    countFailures.push(`자동작업 실패 기록: ${cronErrors.error.message}`)
  } else {
    const failedPaths = [
      ...new Set(((cronErrors.data ?? []) as Array<{ path: string }>).map((r) => r.path)),
    ]
    if (failedPaths.length > 0) {
      items.unshift(
        `🚨 실패한 자동작업 ${failedPaths.length}개: ${failedPaths
          .slice(0, 4)
          .map((c) => cronLabel(c))
          .join(', ')}${failedPaths.length > 4 ? ' 외' : ''}`,
      )
    }
  }

  // ── 박스 집계 (2026-10-01 일정 변경: 목 원료 주문 → 금 입고·손질 → 토·일 조리 → 월 포장 → 화 발송) ──
  // 결제 시점이 고객마다 다르다 — 일반 = 발송 3일 전 토요일 09:10(조리 직전), 서포터즈 체험 구간 = 발송일(화)
  // 09:10. 그래서 한 화요일의 박스 = ① 이미 결제된 박스(결제됨 + 발송 대기 주문, 발송일이 그 화요일)
  // + ② 결제일이 아직 안 온 구독. 결제일이 지났는데 결제가 안 된 구독은 박스로 세지 않고 따로 경고한다.
  // 모든 조회 실패는 countFailures 로 — 0박스로 접지 않는다(규칙1).
  type PaidRow = { id: string; subscription_id: string | null; paid_at: string | null; created_at: string }
  let paidRows: PaidRow[] = []
  if (paidPreparing.error) {
    countFailures.push(`발송 대기 주문: ${paidPreparing.error.message}`)
  } else {
    paidRows = (paidPreparing.data ?? []) as PaidRow[]
    // 상한에 닿으면 일부만 센 것이다 — 조용히 잘린 숫자를 '전부'라고 말하지 않는다.
    if (paidRows.length >= PAID_PREPARING_LIMIT) countFailures.push(`발송 대기 주문: ${PAID_PREPARING_LIMIT}건 넘어 일부만 셈`)
  }
  // 박스의 발송일을 따지려면 그 구독의 지금 next_delivery_date 가 필요하다(해지·정지된 구독 포함).
  const nextBySub = new Map<string, string | null>()
  const paidSubIds = [...new Set(paidRows.map((o) => o.subscription_id).filter((x): x is string => !!x))]
  if (paidSubIds.length > 0) {
    const { data: paidSubs, error: paidSubsErr } = await supabase
      .from('subscriptions')
      .select('id, next_delivery_date')
      .in('id', paidSubIds)
    // 실패하면 결제일 기준 첫 화요일로만 판정한다(paidBoxShipIso 의 폴백) — 늦게 성공한 박스가
    // 미발송으로 잘못 잡힐 수 있으므로 '못 셌음'으로도 알린다.
    if (paidSubsErr) countFailures.push(`발송 대기 주문의 구독: ${paidSubsErr.message}`)
    for (const s of (paidSubs ?? []) as Array<{ id: string; next_delivery_date: string | null }>) {
      nextBySub.set(s.id, s.next_delivery_date)
    }
  }
  let paidForShip = 0
  let overdueUnshipped = 0
  const paidForShipSubIds = new Set<string>()
  for (const o of paidRows) {
    const boxShip = paidBoxShipIso(
      o.subscription_id ? (nextBySub.get(o.subscription_id) ?? null) : null,
      o.paid_at ?? o.created_at,
    )
    if (boxShip < today) {
      overdueUnshipped++
    } else if (boxShip === shipIso) {
      paidForShip++
      if (o.subscription_id) paidForShipSubIds.add(o.subscription_id)
    }
  }
  // ② 아직 결제 안 된 구독 — 결제일이 남았나, 지났나.
  let toCharge = 0
  let notCharged = 0
  if (shipSubs.error) {
    countFailures.push(`발송 예정 구독: ${shipSubs.error.message}`)
  } else {
    // 결제됐는데 청구 크론의 날짜 밀기가 실패한 구독은 ①에서 이미 셌다 — 두 번 세지 않는다.
    const pending = ((shipSubs.data ?? []) as Array<{ id: string; user_id: string }>).filter(
      (s) => !paidForShipSubIds.has(s.id),
    )
    const timings = pending.length > 0 ? await getChargeTimings(pending.map((s) => s.user_id)) : null
    if (pending.length > 0 && !timings) countFailures.push('결제 시점(서포터즈 여부): 조회 실패')
    for (const s of pending) {
      // 결제 시점을 모르면 가장 늦은 결제일(발송일)로 본다 — 서포터즈를 '결제 실패'로 단정하지 않는다.
      //   그 대신 일반 고객의 토요일 실패가 '결제 예정'으로 보일 수 있어, 위에서 '못 셌음'을 띄운다.
      const timing = timings?.get(s.user_id) ?? 'ship_day'
      // 09:40 브리핑은 09:10 청구 뒤다 — 결제일이 오늘이거나 지났는데 남아 있으면 결제가 안 된 것이다.
      if (chargeDateFor(shipIso, timing) > today) toCharge++
      else notCharged++
    }
  }

  // 발송 관련이 제일 위 — 화요일 아침엔 이게 오늘의 일이다.
  // ★발송일엔 **결제된 박스만** 박스로 센다 (2026-09-25 3차 점검의 원칙 그대로). 결제일이 지났는데 화요일
  //   날짜에 남은 구독은 청구가 실패·건너뛴 것이다 — 예전엔 그걸 더해 "오늘 발송 5박스"라고 했고, 피킹
  //   리스트도 같은 건을 보내게 했다. 남은 건은 따로 경고한다.
  const shipMd = `${Number(shipIso.slice(5, 7))}/${Number(shipIso.slice(8, 10))}`
  if (isShipDay) {
    if (paidForShip > 0) items.push(`📦 오늘 발송 ${paidForShip}박스`)
    if (notCharged > 0) {
      items.push(`⛔ 오늘 청구 안 된 ${notCharged}건 — 보내지 마세요(피킹 리스트 확인)`)
    }
  } else {
    // 토요일 = 일반 고객 결제·조리 시작일. 오늘 09:10 청구 크론이 낸 결과를 그대로 말한다.
    if (isCookDay) {
      const okToday = nOf('오늘 결제 성공', chargedToday)
      const ngToday = nOf('오늘 결제 실패', chargeFailedToday)
      if (okToday + ngToday > 0) {
        items.push(`🍳 오늘 결제·조리 시작: ${okToday}박스 결제${ngToday > 0 ? ` · 실패 ${ngToday}건` : ''}`)
      }
    }
    const upcoming = paidForShip + toCharge
    if (upcoming > 0) {
      const parts = [
        paidForShip > 0 ? `결제 완료 ${paidForShip}` : null,
        toCharge > 0 ? `결제 예정 ${toCharge}` : null,
      ].filter(Boolean)
      items.push(`📦 다음 발송(${shipMd} 화) ${upcoming}박스 — ${parts.join(' · ')}`)
    }
    if (notCharged > 0) {
      // 토요일 실패분은 일요일 09:10 재시도가 성공하면 일요일 조리분에 들어간다 — 판정은 피킹 리스트가 정본.
      items.push(`⛔ ${shipMd} 발송분 중 결제 안 된 ${notCharged}건 — 결제 전엔 조리·발송하지 마세요(피킹 리스트 확인)`)
    }
  }
  // ★미발송 = **발송 화요일이 지났는데** 아직 안 나간 결제 박스(2026-10-01). 예전 기준(결제 후 24시간+)은
  //   토요일 결제분을 일~화 내내 '미발송'으로 울렸다 — 매주 오는 경보는 아무도 안 읽는다. 화요일 09:40
  //   브리핑에선 오늘 나갈 박스가 아직 미발송이 아니다(수요일 아침부터 잡힌다).
  if (overdueUnshipped > 0) items.push(`🚚 발송일 지난 미발송 ${overdueUnshipped}건`)
  const cStuck = nOf('배송 지연', shippingStuck)
  if (cStuck > 0) items.push(`⏳ 배송 지연 ${cStuck}건`)
  const cFailed = nOf('결제 실패', failedCharge)
  if (cFailed > 0) items.push(`💳 결제 실패 ${cFailed}건`)
  const cRenewal = nOf('카드 재등록 대기', cardRenewal)
  if (cRenewal > 0) items.push(`🔁 카드 재등록 대기 ${cRenewal}건`)
  const cRefund = nOf('환불 대기', refundsPending)
  if (cRefund > 0) items.push(`↩️ 환불 대기 ${cRefund}건`)
  const cRefundStuck = nOf('환불 최종 실패', refundsStuck)
  if (cRefundStuck > 0) items.push(`🚨 환불 최종 실패 ${cRefundStuck}건 — 수동 환불 필요`)
  const cCs = nOf('답장 대기', unreadCs)
  if (cCs > 0) items.push(`✉️ 답장 대기 ${cCs}건`)
  const cStock = nOf('품절', stockOut)
  if (cStock > 0) items.push(`📉 품절 ${cStock}개`)

  // 규모 경보 — 조용히 깨지는 처리 한도에 다가가면 미리(lib/ops/scale-watch, 2026-09-26 점검 6차).
  //   맨 뒤에 둔다: 오늘 할 일은 아니고, 몇 주 안에 손봐야 할 일이다.
  {
    const oneYearAgo = new Date(nowMs - 365 * 24 * 60 * 60 * 1000).toISOString()
    const [subsN, formulasN, paidN, ledgerN] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .not('billing_key', 'is', null),
      supabase.from('dog_formulas').select('id', { count: 'exact', head: true }),
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('payment_status', PAID_STATUSES),
      supabase
        .from('payment_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneYearAgo),
    ])
    const orNull = (label: string, r: { count: number | null; error: { message: string } | null }) => {
      if (r.error) {
        countFailures.push(`규모(${label}): ${r.error.message}`)
        return null
      }
      return r.count ?? 0
    }
    const warnings = scaleWarnings({
      activeBilledSubs: orNull('활성 구독', subsN),
      formulas: orNull('처방', formulasN),
      paidOrders: orNull('결제 주문', paidN),
      ledgerRows365d: orNull('결제 원장', ledgerN),
    })
    if (warnings.length > 0) {
      items.push(`📈 규모 경보(처리 한도 전에 개선 필요): ${warnings.join(' / ')}`)
    }
  }

  // 못 센 항목은 맨 앞에 — 아래 숫자가 전부가 아닐 수 있다는 걸 먼저 말한다.
  if (countFailures.length > 0) {
    items.unshift(`⚠️ ${countFailures.length}개 항목을 못 셌어요(어드민에서 직접 확인 필요)`)
  }

  const title = isShipDay
    ? '오늘은 발송일이에요 📦'
    : isCookDay
      ? '오늘은 결제·조리 시작일이에요 🍳'
      : '오늘의 운영 브리핑'
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

  // ★관리자는 있는데 실제 발송이 0건 — 이것도 실패다(2026-09-15).
  //   위의 "수신자 0명" 방어는 관리자 **판정**이 깨진 경우만 잡았다. 그 다음
  //   단계, 관리자 계정에 푸시 토큰이 없어 보낼 기기가 없는 경우는 sent=0 인
  //   채 초록으로 빠져나갔고, 그 상태로 2026-09-03 부터 13일간 매일 허공에
  //   쐈다(사장님: "알림이 한 번도 안 울렸다"). 같은 병을 한 층 앞에서만 막은
  //   것이다. 이제 0건이면 크론을 빨간불로 끝내고 Sentry 로 사장님 메일까지
  //   보낸다 — 사장님이 알림을 켜기 전까지 매일 울린다. 그게 의도다.
  if (sent === 0) {
    // 토큰이 없어 못 보낸 것과, 토큰은 있는데 APNs/FCM 이 거부한 것은 처방이 다르다
    // (2026-09-16 점검 — 전자는 "앱에서 알림 켜기", 후자는 키·환경 점검).
    const devices = await countPushTargets(targets.map((a) => a.id))
    const reason = devices > 0 ? 'push_delivery_failed' : 'no_push_targets'
    Sentry.captureMessage(
      devices > 0
        ? `[daily-briefing] 관리자 ${targets.length}명·기기 ${devices}대인데 발송 0건 — APNs/FCM 전송 실패. Sentry 의 push.native.send_failed 이벤트를 볼 것.`
        : `[daily-briefing] 관리자 ${targets.length}명에게 발송 0건 — 관리자 계정에 푸시 토큰이 없다. 앱 → 마이페이지 → 알림 설정에서 켜야 한다.`,
      'warning',
    )
    return NextResponse.json(
      { ok: false, reason, at: 'daily-briefing', admins: targets.length, devices, sent: 0 },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    date: today,
    isShipDay,
    isCookDay,
    shipDate: shipIso,
    admins: targets.length,
    sent,
    items,
  })
}

/** 결제됨 + 발송 대기 주문을 한 번에 읽는 상한. 닿으면 '못 셌음'으로 알린다(조용히 잘린 숫자 금지). */
const PAID_PREPARING_LIMIT = 2000

