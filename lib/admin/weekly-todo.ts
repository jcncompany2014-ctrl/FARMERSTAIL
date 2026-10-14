import { createAdminClient } from '@/lib/supabase/admin'
import { selectInChunks } from '@/lib/supabase/in-chunks'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { getChargeTimings } from '@/lib/payments/charge-timing'
import { isStoreOrderNumber } from '@/lib/store/order-number'
import { STORE_SHIP_WEEKDAYS } from '@/lib/store/shipping'
import { weekdayOf } from '@/lib/shipping-schedule'
import { withHonorific } from '@/lib/korean'
import { todayKstIsoDate, addDaysKst } from '@/lib/datetime-kst'
import { tossKeyStatus } from '@/lib/payments/key-mode'
import type { TrialState } from '@/lib/payments/trial'
import { approvalTimeLeft } from '@/lib/personalization/approval-deadline'
import { loadPackingWeek, packingProblemLines, PACKING_PROBLEM_LABEL, type PackingWeek } from '@/lib/admin/packing-week'
import { keyExpiryStates, describeKeyExpiry, type KeyExpiryState } from '@/lib/admin/key-expiry'
import {
  nextTrialTransitions,
  trialConsentState,
  TRIAL_PHASE_LABEL,
  TRIAL_CONSENT_CHANNEL_LABEL,
  type TrialTransition,
  type TrialConsentRow,
  type TrialConsentState,
} from '@/lib/admin/trial-transitions'
import {
  upcomingShipIso,
  weekAnchors,
  classifyPaidBoxes,
  classifyUnchargedSubs,
  cycleChargeResults,
  todayColumn,
  mdLabel,
  type PaidPrepRow,
  type ChargeAttempt,
} from '@/lib/admin/weekly-todo-core'

/**
 * '이번 주 할 일' 조회 — 어드민 홈 맨 위 칸과 아침 브리핑(daily-briefing)의 **같은 숫자** (2026-10-14 어드민 B2, 규칙249).
 *
 * 요일별:
 *  · 토 — 이번 발송분 결제(일반 = 토, 서포터즈 = 화) 성공·실패 + 이름, 아직 결제 전이면 예정.
 *  · 월 — 포장할 박스·확인 필요(사유별) — 포장 목록과 같은 정본 판정(lib/admin/packing-week → ship-block·computeBoxPlan).
 *  · 화 — 송장 안 넣은 박스 · 웹 가게 출고 대기 · 발송일 지난 미발송.
 *  · 늘 — 안 본 경보 · 카드 재등록 · 답 안 한 문의 · 레시피 동의 마감 임박(강아지·보호자 이름) · 서포터즈 다음 가격 전환과
 *        그 인상의 동의 기록(subscription_price_consents — A 갈래 표) ·
 *        외부 키 만료(B4) · 토스 라이브 전환.
 *
 * 조회는 service_role(브리핑 크론엔 로그인 쿠키가 없다 — AGENTS 규칙8). 화면은 관리자 확인 뒤에만 부른다.
 * 조회가 실패한 칸은 숫자 대신 '못 셈'(count: null)과 사유를 싣는다 — 0 으로 접지 않는다(규칙1).
 */

type Db = ReturnType<typeof createAdminClient>

export type TodoTone = 'ok' | 'info' | 'warn' | 'bad'

export type TodoLine = { text: string; href?: string }

export type TodoItem = {
  key: string
  title: string
  /** null = 못 셈(error 에 사유). */
  count: number | null
  unit: string
  summary: string
  tone: TodoTone
  href: string
  hrefLabel: string
  lines: TodoLine[]
  error?: string
}

export type TodoDayKey = 'sat' | 'mon' | 'tue' | 'always'

export type TodoDay = {
  key: TodoDayKey
  label: string
  dateIso: string | null
  isToday: boolean
  items: TodoItem[]
}

export type WeeklyTodoNumbers = {
  shipIso: string
  /** 결제된 박스(이번 발송일) · 결제 예정 · 결제일 지났는데 결제 안 됨 · 발송일 지난 미발송 · 이번 화요일까지 나갈 박스. */
  paidForShip: number
  toCharge: number
  notCharged: number
  overdueUnshipped: number
  dueToShip: number
  /** 이번 회차 결제 결과(토~화). */
  chargeOk: number
  chargeFailed: number
  cardRenewal: number
  csUnansweredUsers: number
  openAlerts: number
  consentImminent: number
  storeOutgoing: number
  trialTransitions: TrialTransition[]
  /** 가격 인상 동의 기록이 없는데 인상 결제일이 30일 안(또는 지남)인 서포터즈 수. 동의 표를 못 읽으면 0 + trialConsentKnown=false. */
  trialConsentUrgent: number
  trialConsentKnown: boolean
  keys: KeyExpiryState[]
  tossLive: boolean
  packing: PackingWeek
}

export type WeeklyTodo = {
  today: string
  shipIso: string
  saturday: string
  monday: string
  days: TodoDay[]
  numbers: WeeklyTodoNumbers
  /** 못 센 것 — 화면 맨 위·브리핑 맨 앞에 그대로. */
  failures: string[]
}

const LIMIT = 2000

export async function loadWeeklyTodo(db: Db = createAdminClient(), now: Date = new Date()): Promise<WeeklyTodo> {
  const today = todayKstIsoDate()
  const shipIso = upcomingShipIso(today)
  const { saturday, monday } = weekAnchors(shipIso)
  const failures: string[] = []

  const [
    paidPrepRes,
    shipSubsRes,
    chargesRes,
    renewalRes,
    csRes,
    alertsRes,
    pendingFormulasRes,
    trialsRes,
    keyRowsRes,
    priceConsentsRes,
  ] = await Promise.all([
    db
      .from('orders')
      .select('id, subscription_id, paid_at, created_at, order_number')
      .in('payment_status', PAID_STATUSES)
      .eq('order_status', 'preparing')
      .limit(LIMIT),
    // 이번 발송일에 날짜가 남아 있는 = 아직 결제 안 된 구독(청구 크론과 같은 대상 조건).
    db
      .from('subscriptions')
      .select('id, user_id')
      .eq('status', 'active')
      .eq('requires_billing_key_renewal', false)
      .not('billing_key', 'is', null)
      .eq('next_delivery_date', shipIso)
      .limit(LIMIT),
    db
      .from('subscription_charges')
      .select('subscription_id, status, attempted_at, scheduled_for, error_code')
      .gte('scheduled_for', saturday)
      .lte('scheduled_for', shipIso)
      .limit(LIMIT),
    db.from('subscriptions').select('id, user_id, dog_id').eq('requires_billing_key_renewal', true).limit(LIMIT),
    // 답 안 한 문의 = **사람 수**(문의함과 같은 단위).
    db.from('cs_messages').select('user_id').eq('sender', 'user').is('read_at', null).limit(500),
    db
      .from('admin_alerts')
      .select('id, message, last_seen_at', { count: 'exact' })
      .is('resolved_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(3),
    db
      .from('dog_formulas')
      .select('id, dog_id, user_id, cycle_number, proposed_at, formula')
      .eq('approval_status', 'pending_approval')
      .limit(500),
    db.from('subscription_trials').select('user_id, cheap_remaining, half_remaining, cheap_price, half_rate').limit(LIMIT),
    db.from('admin_key_expiry').select('key_name, set_on, expires_on'),
    // 서포터즈 가격 인상 동의(A 갈래 표, 마이그 20261014200000) — 유효한 기록만. 없으면 그 인상 회차 결제가 보류된다.
    db
      .from('subscription_price_consents')
      .select('user_id, rise, consented_on, channel, revoked_at')
      .is('revoked_at', null)
      .limit(LIMIT),
  ])

  // ── 화: 결제된 박스 · 발송일 지난 미발송 · 웹 가게 출고 ──
  type OrderRow = PaidPrepRow & { order_number: string | null }
  let orderRows: OrderRow[] = []
  if (paidPrepRes.error) failures.push(`발송 대기 주문: ${paidPrepRes.error.message}`)
  else {
    orderRows = (paidPrepRes.data ?? []) as OrderRow[]
    if (orderRows.length >= LIMIT) failures.push(`발송 대기 주문: ${LIMIT}건 넘어 일부만 셈`)
  }
  const subOrders = orderRows.filter((o) => !!o.subscription_id)
  const storeOutgoing = orderRows.filter((o) => !o.subscription_id && isStoreOrderNumber(o.order_number)).length
  const nextBySub = new Map<string, string | null>()
  const paidSubIds = [...new Set(subOrders.map((o) => o.subscription_id!))]
  if (paidSubIds.length > 0) {
    const { data, error } = await selectInChunks(paidSubIds, (chunk) =>
      db.from('subscriptions').select('id, next_delivery_date').in('id', chunk),
    )
    // 실패하면 결제일 기준 첫 화요일로만 판정한다(paidBoxShipIso 의 폴백) — '못 셈'으로도 알린다.
    if (error) failures.push(`발송 대기 주문의 구독: ${error.message}`)
    for (const s of (data ?? []) as Array<{ id: string; next_delivery_date: string | null }>) nextBySub.set(s.id, s.next_delivery_date)
  }
  const paid = classifyPaidBoxes(subOrders, nextBySub, shipIso, today)

  let toCharge = 0
  let notCharged = 0
  let notChargedSubIds: string[] = []
  if (shipSubsRes.error) failures.push(`발송 예정 구독: ${shipSubsRes.error.message}`)
  else {
    const pending = ((shipSubsRes.data ?? []) as Array<{ id: string; user_id: string }>).filter(
      (s) => !paid.paidForShipSubIds.has(s.id),
    )
    const timings = pending.length > 0 ? await getChargeTimings(pending.map((s) => s.user_id)) : null
    const u = classifyUnchargedSubs(pending, timings, shipIso, today)
    if (u.timingUnknown) failures.push('결제 시점(서포터즈 여부): 조회 실패')
    toCharge = u.toCharge
    notCharged = u.notCharged
    notChargedSubIds = u.notChargedSubIds
  }

  // ── 토: 이번 회차 결제 결과 ──
  let charge = { succeeded: [] as string[], failed: [] as Array<{ subscriptionId: string; errorCode: string | null }>, pending: [] as string[] }
  if (chargesRes.error) failures.push(`이번 회차 결제 기록: ${chargesRes.error.message}`)
  else charge = cycleChargeResults((chargesRes.data ?? []) as ChargeAttempt[])

  // ── 늘 ──
  const renewalRows = renewalRes.error ? [] : ((renewalRes.data ?? []) as Array<{ id: string; user_id: string; dog_id: string | null }>)
  if (renewalRes.error) failures.push(`카드 재등록 대기: ${renewalRes.error.message}`)
  const csUsers = csRes.error ? [] : [...new Set(((csRes.data ?? []) as Array<{ user_id: string }>).map((m) => m.user_id))]
  if (csRes.error) failures.push(`답 안 한 문의: ${csRes.error.message}`)
  const openAlerts = alertsRes.error ? null : (alertsRes.count ?? 0)
  if (alertsRes.error) failures.push(`경보함: ${alertsRes.error.message}`)

  type PendingFormula = { id: string; dog_id: string; user_id: string; cycle_number: number; proposed_at: string | null; formula: unknown }
  const pendingFormulas = pendingFormulasRes.error ? [] : ((pendingFormulasRes.data ?? []) as unknown as PendingFormula[])
  if (pendingFormulasRes.error) failures.push(`레시피 동의 대기: ${pendingFormulasRes.error.message}`)
  const imminent = pendingFormulas
    .map((f) => ({ f, left: approvalTimeLeft(f, now) }))
    .filter((x): x is { f: PendingFormula; left: NonNullable<ReturnType<typeof approvalTimeLeft>> } => !!x.left && x.left.imminent)
    .sort((a, b) => (a.left.deadlineIso < b.left.deadlineIso ? -1 : 1))

  // 서포터즈 다음 가격 전환 — 활성 구독 + 남은 회차(청구와 같은 판정).
  let transitions: TrialTransition[] = []
  if (trialsRes.error) failures.push(`서포터즈 상태: ${trialsRes.error.message}`)
  else {
    const trials = (trialsRes.data ?? []) as Array<TrialState & { user_id: string }>
    const trialUserIds = trials.map((t) => t.user_id)
    if (trialUserIds.length > 0) {
      const { data: tSubs, error: tSubsErr } = await selectInChunks(trialUserIds, (chunk) =>
        db
          .from('subscriptions')
          .select('id, user_id, dog_id, status, next_delivery_date, total_amount')
          .in('user_id', chunk)
          .eq('status', 'active'),
      )
      if (tSubsErr) failures.push(`서포터즈 구독: ${tSubsErr.message}`)
      else
        transitions = nextTrialTransitions(
          (tSubs ?? []) as Array<{ id: string; user_id: string; dog_id: string | null; status: string; next_delivery_date: string | null; total_amount: number }>,
          new Map(trials.map((t) => [t.user_id, t])),
        )
    }
  }
  // 전환마다 동의 상태 — 조회 실패면 '모름'(null)으로 두고 칸을 빨갛게(동의 없음으로도, 받음으로도 단정하지 않는다).
  if (priceConsentsRes.error) failures.push(`서포터즈 가격 인상 동의: ${priceConsentsRes.error.message}`)
  const consentRows = priceConsentsRes.error ? null : ((priceConsentsRes.data ?? []) as TrialConsentRow[])
  const consentOf = (t: TrialTransition): TrialConsentState | null => (consentRows ? trialConsentState(t, consentRows, today) : null)
  const consentUrgent = consentRows ? transitions.filter((t) => consentOf(t)?.status === 'urgent') : []

  let keys: KeyExpiryState[] = []
  if (keyRowsRes.error) failures.push(`외부 키 만료일: ${keyRowsRes.error.message}`)
  keys = keyExpiryStates(keyRowsRes.error ? [] : ((keyRowsRes.data ?? []) as Array<{ key_name: string; set_on: string | null; expires_on: string | null }>), today)
  const tossLive = tossKeyStatus(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY, process.env.TOSS_SECRET_KEY).isLive

  // ── 월: 포장(포장 목록과 같은 판정) ──
  const packing = await loadPackingWeek(db, shipIso, now).catch(
    (e: unknown): PackingWeek => ({ ok: false, shipDate: shipIso, error: e instanceof Error ? e.message : String(e) }),
  )
  if (!packing.ok) failures.push(`포장 목록: ${packing.error}`)

  // ── 이름(강아지 · 보호자님) — 사장님이 누구인지 바로 알게. ──
  const subIdsForNames = [
    ...charge.succeeded,
    ...charge.failed.map((x) => x.subscriptionId),
    ...notChargedSubIds,
  ]
  const subMeta = new Map<string, { user_id: string; dog_id: string | null }>()
  for (const r of renewalRows) subMeta.set(r.id, { user_id: r.user_id, dog_id: r.dog_id })
  const needSub = [...new Set(subIdsForNames)].filter((id) => !subMeta.has(id))
  if (needSub.length > 0) {
    const { data, error } = await selectInChunks(needSub, (chunk) => db.from('subscriptions').select('id, user_id, dog_id').in('id', chunk))
    if (error) failures.push(`이름(구독): ${error.message}`)
    for (const s of (data ?? []) as Array<{ id: string; user_id: string; dog_id: string | null }>) subMeta.set(s.id, { user_id: s.user_id, dog_id: s.dog_id })
  }
  const dogIds = new Set<string>()
  const userIds = new Set<string>()
  for (const m of subMeta.values()) {
    if (m.dog_id) dogIds.add(m.dog_id)
    userIds.add(m.user_id)
  }
  for (const x of imminent) {
    dogIds.add(x.f.dog_id)
    userIds.add(x.f.user_id)
  }
  for (const t of transitions) {
    if (t.dogId) dogIds.add(t.dogId)
    userIds.add(t.userId)
  }
  for (const u of csUsers) userIds.add(u)
  const [dogsRes, profsRes] = await Promise.all([
    selectInChunks([...dogIds], (chunk) => db.from('dogs').select('id, name').in('id', chunk)),
    selectInChunks([...userIds], (chunk) => db.from('profiles').select('id, name').in('id', chunk)),
  ])
  if (dogsRes.error || profsRes.error) failures.push(`이름: ${(dogsRes.error ?? profsRes.error)!.message}`)
  const dogName = new Map(((dogsRes.data ?? []) as Array<{ id: string; name: string | null }>).map((d) => [d.id, d.name?.trim() || '(이름 없음)']))
  const userName = new Map(((profsRes.data ?? []) as Array<{ id: string; name: string | null }>).map((p) => [p.id, withHonorific(p.name) || '보호자님']))
  const who = (dogId: string | null, userId: string | null) => {
    const d = dogId ? (dogName.get(dogId) ?? '강아지') : '강아지'
    const u = userId ? (userName.get(userId) ?? '보호자님') : '보호자님'
    return `${d} · ${u}`
  }
  // 구독 상세 화면은 따로 없다 — 그 고객 화면(구독·주문이 함께 보이는 곳)으로 보낸다.
  const subHref = (subId: string) => {
    const m = subMeta.get(subId)
    return m ? `/admin/users/${m.user_id}` : '/admin/subscriptions'
  }
  const whoSub = (subId: string) => {
    const m = subMeta.get(subId)
    return m ? who(m.dog_id, m.user_id) : `구독 ${subId.slice(0, 8)}`
  }

  const col = todayColumn(today)
  const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

  // ── 칸 만들기 ──
  const satItems: TodoItem[] = []
  const chargeCountable = !chargesRes.error
  satItems.push({
    key: 'charges',
    title: `이번 회차 결제 (일반 ${mdLabel(saturday)} · 서포터즈 ${mdLabel(shipIso)})`,
    count: chargeCountable ? charge.succeeded.length + charge.failed.length : null,
    unit: '건',
    summary: chargeCountable
      ? charge.succeeded.length + charge.failed.length === 0
        ? toCharge > 0
          ? `아직 결제 전 — 결제 예정 ${toCharge}건`
          : '이번 회차 결제 기록이 아직 없어요'
        : `성공 ${charge.succeeded.length} · 실패 ${charge.failed.length}${toCharge > 0 ? ` · 결제 예정 ${toCharge}` : ''}`
      : '결제 기록을 못 읽었어요',
    tone: !chargeCountable ? 'bad' : charge.failed.length > 0 ? 'bad' : charge.succeeded.length > 0 ? 'ok' : 'info',
    href: charge.failed.length > 0 ? '/admin/subscriptions/charges?status=failed' : '/admin/subscriptions/charges',
    hrefLabel: charge.failed.length > 0 ? '실패한 결제 보러 가기' : '자동결제 이력',
    lines: [
      ...charge.failed.map((x) => ({ text: `실패 — ${whoSub(x.subscriptionId)}${x.errorCode ? ` (${x.errorCode})` : ''}`, href: subHref(x.subscriptionId) })),
      ...charge.succeeded.map((id) => ({ text: `성공 — ${whoSub(id)}`, href: subHref(id) })),
    ],
    error: chargesRes.error?.message,
  })
  if (notCharged > 0) {
    satItems.push({
      key: 'not-charged',
      title: '결제일이 지났는데 결제 안 된 구독',
      count: notCharged,
      unit: '건',
      summary: '결제 전엔 조리·발송하지 마세요(포장 목록이 막아 둡니다)',
      tone: 'bad',
      href: `/admin/personalization/picking-list?date=${shipIso}`,
      hrefLabel: '포장 목록에서 확인',
      lines: notChargedSubIds.map((id) => ({ text: whoSub(id), href: subHref(id) })),
    })
  }

  const monItems: TodoItem[] = []
  if (packing.ok) {
    const reasons = packingProblemLines(packing.byProblem)
    monItems.push({
      key: 'packing',
      title: `${mdLabel(shipIso)} 발송분 포장`,
      count: packing.shippable,
      unit: '박스',
      summary: `포장할 박스 ${packing.shippable}${packing.problemBoxes > 0 ? ` · 확인 필요 ${packing.problemBoxes}` : ' · 확인 필요 없음'}${packing.alreadyShipped > 0 ? ` · 이미 보냄 ${packing.alreadyShipped}` : ''}`,
      tone: packing.problemBoxes > 0 ? 'warn' : packing.shippable > 0 ? 'info' : 'ok',
      href: `/admin/personalization/picking-list?date=${shipIso}`,
      hrefLabel: '포장 목록·라벨 인쇄로 가기',
      lines: [
        ...reasons.map((r) => ({ text: `확인 필요 — ${r.label} ${r.count}건` })),
        ...packing.list
          .filter((b) => b.problems.length > 0)
          .slice(0, 8)
          .map((b) => ({ text: `${b.dogName}: ${b.problems.map((p) => PACKING_PROBLEM_LABEL[p]).join(', ')}` })),
      ],
    })
  } else {
    monItems.push({
      key: 'packing',
      title: `${mdLabel(shipIso)} 발송분 포장`,
      count: null,
      unit: '박스',
      summary: '포장 목록을 계산하지 못했어요 — 포장 목록 화면에서 확인해 주세요',
      tone: 'bad',
      href: `/admin/personalization/picking-list?date=${shipIso}`,
      hrefLabel: '포장 목록으로 가기',
      lines: [],
      error: packing.error,
    })
  }

  const tueItems: TodoItem[] = []
  const ordersCountable = !paidPrepRes.error
  tueItems.push({
    key: 'tracking',
    title: '송장 안 넣은 박스',
    count: ordersCountable ? paid.dueToShip : null,
    unit: '박스',
    summary: ordersCountable
      ? paid.overdueUnshipped > 0
        ? `${mdLabel(shipIso)}까지 나갈 박스 ${paid.dueToShip} · 발송일 지난 미발송 ${paid.overdueUnshipped}`
        : `${mdLabel(shipIso)}까지 나갈 박스 ${paid.dueToShip}`
      : '발송 대기 주문을 못 읽었어요',
    tone: !ordersCountable || paid.overdueUnshipped > 0 ? 'bad' : paid.dueToShip > 0 ? 'info' : 'ok',
    href: '/admin/orders?status=preparing',
    hrefLabel: '송장 넣으러 가기',
    lines: [],
    error: paidPrepRes.error?.message,
  })
  tueItems.push({
    key: 'store',
    title: '웹 가게 출고 대기',
    count: ordersCountable ? storeOutgoing : null,
    unit: '건',
    summary: '화·목 출고 — 결제된 가게 주문',
    tone: !ordersCountable ? 'bad' : storeOutgoing > 0 ? 'info' : 'ok',
    href: '/admin/orders?status=preparing',
    hrefLabel: '가게 주문 보러 가기',
    lines: [],
  })

  const alwaysItems: TodoItem[] = []
  alwaysItems.push({
    key: 'alerts',
    title: '안 본 경보',
    count: openAlerts,
    unit: '건',
    summary:
      openAlerts === null
        ? '경보함을 못 읽었어요'
        : openAlerts > 0
          ? ((alertsRes.data ?? []) as Array<{ message: string }>)[0]?.message ?? ''
          : '처리할 경보가 없어요',
    tone: openAlerts === null ? 'bad' : openAlerts > 0 ? 'bad' : 'ok',
    href: '/admin/alerts',
    hrefLabel: '경보함으로 가기',
    lines: ((alertsRes.data ?? []) as Array<{ id: string; message: string }>).slice(1).map((a) => ({ text: a.message, href: '/admin/alerts' })),
    error: alertsRes.error?.message,
  })
  alwaysItems.push({
    key: 'card-renewal',
    title: '카드 재등록 대기',
    count: renewalRes.error ? null : renewalRows.length,
    unit: '건',
    summary: renewalRows.length > 0 ? '카드가 거절돼 결제가 멈춘 구독 — 고객이 카드를 바꾸면 자동으로 다시 결제돼요' : '없어요',
    tone: renewalRes.error ? 'bad' : renewalRows.length > 0 ? 'warn' : 'ok',
    href: '/admin/subscriptions',
    hrefLabel: '구독 보러 가기',
    lines: renewalRows.map((r) => ({ text: who(r.dog_id, r.user_id), href: `/admin/users/${r.user_id}` })),
    error: renewalRes.error?.message,
  })
  alwaysItems.push({
    key: 'cs',
    title: '답 안 한 문의',
    count: csRes.error ? null : csUsers.length,
    unit: '명',
    summary: csUsers.length > 0 ? '영업일 24시간 안에 답하기로 했어요' : '없어요',
    tone: csRes.error ? 'bad' : csUsers.length > 0 ? 'warn' : 'ok',
    href: '/admin/cs-inbox',
    hrefLabel: '문의함으로 가기',
    lines: csUsers.map((u) => ({ text: userName.get(u) ?? '보호자님', href: `/admin/users/${u}` })),
    error: csRes.error?.message,
  })
  alwaysItems.push({
    key: 'consent',
    title: '레시피 동의 마감 임박(48시간 안)',
    count: pendingFormulasRes.error ? null : imminent.length,
    unit: '건',
    summary: imminent.length > 0 ? '마감되면 이전 식단 그대로 나가요 — 필요하면 고객에게 알려 주세요' : '없어요',
    tone: pendingFormulasRes.error ? 'bad' : imminent.length > 0 ? 'warn' : 'ok',
    href: '/admin/personalization',
    hrefLabel: '레시피 승인 화면으로',
    lines: imminent.map((x) => ({
      text: `${who(x.f.dog_id, x.f.user_id)} — ${x.f.cycle_number}번째 박스 · ${x.left.label}`,
      href: `/admin/users/${x.f.user_id}`,
    })),
    error: pendingFormulasRes.error?.message,
  })
  const soonTransitions = transitions.filter((t) => t.chargeIso <= addDaysKst(today, 45))
  const consentText = (c: TrialConsentState | null): string => {
    if (!c) return '동의 기록 못 읽음'
    if (c.status === 'recorded') return `동의 받음(${mdLabel(c.consentedOn)} ${TRIAL_CONSENT_CHANNEL_LABEL[c.channel] ?? c.channel})`
    return c.status === 'urgent'
      ? `동의 기록 없음 — 결제 ${c.daysLeft <= 0 ? '날 지남' : `${c.daysLeft}일 전`}, 없으면 그 결제가 보류돼요`
      : '동의 기록 아직 없음'
  }
  const trialFailed = Boolean(trialsRes.error) || Boolean(priceConsentsRes.error)
  alwaysItems.push({
    key: 'trial',
    title: '서포터즈 다음 가격 전환 · 동의',
    count: trialsRes.error ? null : transitions.length,
    unit: '명',
    summary:
      transitions.length === 0
        ? '전환 예정 없음'
        : `가장 빠른 전환 ${mdLabel(transitions[0]!.chargeIso)} 결제 — ${TRIAL_PHASE_LABEL[transitions[0]!.phase]} → ${TRIAL_PHASE_LABEL[transitions[0]!.nextPhase]}${
            !consentRows ? ' · 동의 기록 못 읽음' : consentUrgent.length > 0 ? ` · 동의 없음 ${consentUrgent.length}명` : ''
          }`,
    tone: trialFailed || consentUrgent.length > 0 ? 'bad' : soonTransitions.length > 0 ? 'warn' : 'info',
    href: '/admin/trials',
    hrefLabel: '체험단 화면에서 동의 기록하기',
    lines: transitions.map((t) => ({
      text: `${who(t.dogId, t.userId)} — ${mdLabel(t.chargeIso)} 결제부터 ${TRIAL_PHASE_LABEL[t.nextPhase]}(${won(t.fromAmount)} → ${won(t.toAmount)})${t.fullChargeIso && t.nextPhase !== 'full' ? ` · 정가 ${mdLabel(t.fullChargeIso)}` : ''} · ${consentText(consentOf(t))}`,
      href: `/admin/users/${t.userId}`,
    })),
    error: trialsRes.error?.message ?? priceConsentsRes.error?.message,
  })
  const keyAttention = keys.filter((k) => k.tone !== 'ok')
  alwaysItems.push({
    key: 'keys',
    title: '외부 키 만료',
    count: keyRowsRes.error ? null : keyAttention.length,
    unit: '개',
    summary:
      keyAttention.length > 0
        ? describeKeyExpiry(keyAttention[0]!)
        : keys.map((k) => describeKeyExpiry(k)).join(' · '),
    tone: keyRowsRes.error ? 'bad' : keys.some((k) => k.tone === 'bad') ? 'bad' : keyAttention.length > 0 ? 'warn' : 'ok',
    href: '/admin/alerts#keys',
    hrefLabel: '설정일 적으러 가기',
    lines: [
      ...keys.map((k) => ({ text: describeKeyExpiry(k) })),
      { text: tossLive ? '토스 결제 키 — 라이브(실결제)' : '토스 결제 키 — 라이브 전환 안 됨(심사 중이면 정상)' },
    ],
    error: keyRowsRes.error?.message,
  })

  const days: TodoDay[] = [
    { key: 'sat', label: '토 · 결제', dateIso: saturday, isToday: col === 'sat' || col === 'sun', items: satItems },
    { key: 'mon', label: '월 · 포장', dateIso: monday, isToday: col === 'mon', items: monItems },
    { key: 'tue', label: '화 · 발송', dateIso: shipIso, isToday: col === 'tue', items: tueItems },
    { key: 'always', label: '늘 · 확인', dateIso: null, isToday: false, items: alwaysItems },
  ]

  return {
    today,
    shipIso,
    saturday,
    monday,
    days,
    failures,
    numbers: {
      shipIso,
      paidForShip: paid.paidForShip,
      toCharge,
      notCharged,
      overdueUnshipped: paid.overdueUnshipped,
      dueToShip: paid.dueToShip,
      chargeOk: charge.succeeded.length,
      chargeFailed: charge.failed.length,
      cardRenewal: renewalRows.length,
      csUnansweredUsers: csUsers.length,
      openAlerts: openAlerts ?? 0,
      consentImminent: imminent.length,
      storeOutgoing,
      trialTransitions: transitions,
      trialConsentUrgent: consentUrgent.length,
      trialConsentKnown: consentRows !== null,
      keys,
      tossLive,
      packing,
    },
  }
}

/**
 * 아침 브리핑에 덧붙일 줄 — 이번 주 할 일과 같은 숫자(이름은 넣지 않는다: 푸시는 폰 잠금 화면에 보인다).
 * 박스·결제 줄은 브리핑이 numbers 로 직접 만든다(규칙100 의 문장 구조 유지).
 */
export function briefingExtraLines(todo: WeeklyTodo): string[] {
  const n = todo.numbers
  const out: string[] = []
  const col = todayColumn(todo.today)
  if (n.openAlerts > 0) out.push(`🔔 경보함 안 본 경보 ${n.openAlerts}건`)
  for (const k of n.keys) if (k.tone === 'bad' || k.tone === 'warn') out.push(`🔑 ${describeKeyExpiry(k)}`)
  if ((col === 'mon' || col === 'tue') && n.packing.ok) {
    const reasons = packingProblemLines(n.packing.byProblem)
    out.push(
      `🏷 ${mdLabel(n.shipIso)} 포장 ${n.packing.shippable}박스${n.packing.problemBoxes > 0 ? ` · 확인 필요 ${n.packing.problemBoxes}(${reasons.slice(0, 2).map((r) => `${r.label} ${r.count}`).join(', ')})` : ''}`,
    )
  }
  if (n.consentImminent > 0) out.push(`🗳 레시피 동의 마감 임박 ${n.consentImminent}건`)
  const week = n.trialTransitions.filter((t) => t.chargeIso >= todo.today && t.chargeIso <= addDaysKst(todo.today, 7))
  if (week.length > 0) out.push(`💰 서포터즈 가격 전환 ${week.length}명(${mdLabel(week[0]!.chargeIso)} 결제부터)`)
  // 인상 동의 기록이 없으면 그 회차 결제가 보류된다(A 갈래) — 30일 전부터 매일 알린다. 못 읽었으면 그것도 알린다.
  if (!n.trialConsentKnown) out.push('✍️ 서포터즈 인상 동의 기록을 못 읽었어요')
  else if (n.trialConsentUrgent > 0) out.push(`✍️ 서포터즈 인상 동의 없음 ${n.trialConsentUrgent}명 — 없으면 그 회차 결제가 보류돼요`)
  // 웹 가게는 화·목 출고(lib/store/shipping STORE_SHIP_WEEKDAYS).
  if (STORE_SHIP_WEEKDAYS.includes(weekdayOf(todo.today)) && n.storeOutgoing > 0) out.push(`🛒 웹 가게 출고 ${n.storeOutgoing}건`)
  return out
}
