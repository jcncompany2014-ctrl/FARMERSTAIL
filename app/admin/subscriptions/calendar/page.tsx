import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminTabs, Hl, Em, LoadError } from '@/components/admin/ui'
import { SUBS_TABS } from '@/components/admin/tabGroups'
import { todayKstIsoDate, addDaysKst } from '@/lib/datetime-kst'
import {
  CHARGE_BEFORE_SHIP_DAYS,
  chargeDateFor,
  chargeTimingFor,
  weekdayOf,
  type ChargeTiming,
  paidBoxShipIso,
} from '@/lib/shipping-schedule'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { advanceTrialState, type TrialState } from '@/lib/payments/trial'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * /admin/subscriptions/calendar — 정기배송 일정 캘린더 뷰.
 *
 * 동선
 * ────
 * 한 달 그리드. 각 날짜 셀에 **그날 발송(화)할 박스**를 chip 으로 표시하고, 결제일(일반 = 발송 3일 전
 * 토요일, 서포터즈 체험 구간 = 발송일)엔 '💳 결제 N건'을 붙인다(2026-10-01 일정 변경 — 토·일 조리 →
 * 월 포장 → 화 발송). chip 클릭 → 해당 구독 상세 (관리자 row 편집).
 *
 * 박스는 두 종류다:
 *  · 결제 완료(결제됨 + 발송 대기 주문) — 지금 조리·포장 중인 박스. 청구 크론이 결제 직후 그 구독의
 *    next_delivery_date 를 다음 주기로 밀기 때문에, next_delivery_date 만 보면 토요일 결제 뒤 이번 주
 *    화요일 칸에서 박스가 사라졌다. 결제된 주문을 따로 읽어 그 박스의 발송일 칸에 붙인다.
 *  · 결제 전 — next_delivery_date 부터 14일씩.
 *
 * URL `?ym=YYYY-MM` 으로 월 이동. 미지정 시 이번 달.
 *
 * 이 페이지는 server component — 빠른 SSR 로 한 번에 그리드를 그린다. 인터랙션
 * (월 이동) 은 a 태그 + URL 갱신.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '정기배송 캘린더 | Admin',
  robots: { index: false, follow: false },
}

type SearchParamsT = Promise<{ ym?: string; day?: string }>

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function parseYm(ym: string | undefined): { year: number; month: number } {
  // YYYY-MM. invalid → 이번달(**KST** — 서버는 UTC 라 KST 새벽엔 전달로 보였다, 2026-09-26).
  const [ty, tm] = todayKstIsoDate().split('-').map(Number) as [number, number]
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return { year: ty, month: tm }
  }
  const [y, m] = ym.split('-').map(Number) as [number, number]
  if (m < 1 || m > 12) return { year: ty, month: tm }
  return { year: y, month: m }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 칸에 놓인 박스의 종류 — paid = 결제 완료(조리·포장 중) · pending = 결제 전 · paused = 일시정지. */
type BoxMark = { box: 'paid' | 'pending' | 'paused'; chargeIso: string | null; shipIso: string }

/** 'yyyy-mm-dd' → '10/3(토)'. 문자열 그대로 — 서버(UTC)·기기 시간대를 타지 않는다. */
function mdW(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${WEEK_LABELS[weekdayOf(iso)]})`
}

/** chip 둘째 줄 — 그 박스가 지금 어디쯤인지. */
function boxLabel(it: BoxMark, today: string): string {
  if (it.box === 'paid') return it.shipIso < today ? '결제됨 · 발송일 지남' : '결제 완료 · 조리·포장'
  if (it.box === 'paused') return '일시정지'
  // 결제 전인데 결제일이 없다 = 카드 없음·재등록 필요 — 청구 크론이 건너뛴다.
  return it.chargeIso ? `결제 ${mdW(it.chargeIso)}` : '결제 안 됨(카드 확인)'
}

function chipCls(it: BoxMark, today: string): string {
  if (it.box === 'paid') {
    return it.shipIso < today ? 'bg-red-600/15 text-red-700' : 'bg-sky-600/15 text-sky-800'
  }
  if (it.box === 'paused') return 'bg-amber-500/15 text-amber-600'
  return 'bg-emerald-600/15 text-emerald-700'
}

export default async function SubscriptionsCalendarPage({
  searchParams,
}: {
  searchParams: SearchParamsT
}) {
  const { ym, day: dayParam } = await searchParams
  const { year, month } = parseYm(ym)

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0) // 다음 달 0일 = 이번 달 마지막 일
  const startKey = `${year}-${pad(month)}-01`
  const endKey = `${year}-${pad(month)}-${pad(monthEnd.getDate())}`

  const supabase = await createClient()
  const todayKey = todayKstIsoDate()
  // 결제일이 이번 달인 회차까지 보려면 발송일은 달 끝 + 3일까지 읽어야 한다
  // (다음 달 1~3일 화요일 발송분 = 이번 달 토요일 결제).
  const shipLimit = addDaysKst(endKey, CHARGE_BEFORE_SHIP_DAYS)

  // 활성 + paused 구독 모두 표시 (paused 는 다음 발송 예정인지 본 후 dim 으로).
  // 규칙1 — error 를 버리면 조회 실패가 "이번 달 배송 없음" 빈 달력으로 보인다.
  // ★이번 달 안의 **모든** 발송 회차를 그린다 (2026-09-26 출시 전 점검 5차).
  //   예전엔 next_delivery_date 한 칸만 봐서 격주 두 번째 회차(+14일)가 빠졌고, 일시정지·
  //   카드 없는 구독까지 '예정'으로 셌다 — 이 숫자로 원물을 발주하면 틀린다.
  //   그래서 달 끝(+3일) 이전이 다음 발송일인 구독을 가져와 14일씩 앞으로 늘린다.
  // ★결제됐고 아직 안 나간 박스(결제됨 + 발송 대기 주문)도 함께 읽는다 (2026-10-01) — 위 머리 주석.
  const SUB_COLS =
    'id, user_id, status, next_delivery_date, total_amount, recipient_name, has_billing_key, requires_billing_key_renewal, profiles(name, email), subscription_items(product_name, quantity)'
  const [{ data: subs, error: subsErr }, { data: paidOrders, error: paidErr }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(SUB_COLS)
      .lte('next_delivery_date', shipLimit)
      .in('status', ['active', 'paused'])
      .order('next_delivery_date', { ascending: true }),
    supabase
      .from('orders')
      .select('subscription_id, paid_at, created_at')
      .in('payment_status', [...PAID_STATUSES])
      .eq('order_status', 'preparing')
      .not('subscription_id', 'is', null)
      .limit(2000),
  ])

  type SubLite = {
    id: string
    user_id: string
    status: 'active' | 'paused' | 'cancelled' | string
    next_delivery_date: string | null
    total_amount: number | null
    recipient_name: string | null
    has_billing_key: boolean | null
    requires_billing_key_renewal: boolean | null
    profiles: { name: string | null; email: string | null } | null
    subscription_items: { product_name: string; quantity: number }[]
  }
  /** 칸에 놓이는 박스 하나. paid = 결제 완료(조리·포장 중) · pending = 결제 전 · paused = 일시정지(흐리게). */
  type DayItem = SubLite & BoxMark

  const subList = (subs ?? []) as unknown as SubLite[]
  const subById = new Map(subList.map((s) => [s.id, s]))

  // 결제된 박스의 구독이 위 목록 밖(다음 주기 날짜가 달 밖·해지)이면 따로 읽는다.
  type PaidRow = { subscription_id: string | null; paid_at: string | null; created_at: string }
  const paidRows = (paidOrders ?? []) as PaidRow[]
  const missingIds = [
    ...new Set(
      paidRows
        .map((o) => o.subscription_id)
        .filter((x): x is string => !!x && !subById.has(x)),
    ),
  ]
  let paidSubsErr: { message: string } | null = null
  if (missingIds.length > 0) {
    const { data: more, error: moreErr } = await supabase
      .from('subscriptions')
      .select(SUB_COLS)
      .in('id', missingIds)
    paidSubsErr = moreErr
    for (const s of (more ?? []) as unknown as SubLite[]) subById.set(s.id, s)
  }

  // 결제 시점 — 서포터즈 체험 구간(100원·반값)이 남아 있는 동안은 발송일(화) 결제, 그 뒤는 토요일 결제
  //   (lib/shipping-schedule chargeTimingFor). 회차는 결제마다 줄어들므로, 달력의 뒤 회차는 앞선 발송일의
  //   회차를 뺀 상태로 판정한다 — 청구 크론이 실행할 때마다 그 사용자의 그때 상태로 정하는 것과 같다
  //   (같은 화요일의 두 구독은 같은 결제일). subscription_trials 는 service_role 전용이다.
  const trialByUser = new Map<string, TrialState>()
  let trialLookupFailed = false
  const activeUserIds = [...new Set(subList.filter((s) => s.status === 'active').map((s) => s.user_id))]
  if (activeUserIds.length > 0) {
    try {
      const { data: trialRows, error: trialErr } = await createAdminClient()
        .from('subscription_trials')
        .select('user_id, cheap_remaining, half_remaining, cheap_price, half_rate')
        .in('user_id', activeUserIds)
      if (trialErr) trialLookupFailed = true
      for (const t of (trialRows ?? []) as Array<TrialState & { user_id: string }>) {
        trialByUser.set(t.user_id, t)
      }
    } catch {
      trialLookupFailed = true
    }
  }

  // 1) 결제된 박스 → 그 박스의 발송일 칸.
  const subsByDay = new Map<string, DayItem[]>()
  const push = (key: string, item: DayItem) => {
    const arr = subsByDay.get(key) ?? []
    arr.push(item)
    subsByDay.set(key, arr)
  }
  const paidShipsBySub = new Map<string, Set<string>>()
  let paidBoxCount = 0
  for (const o of paidRows) {
    const s = o.subscription_id ? subById.get(o.subscription_id) : undefined
    if (!s) continue
    const shipIso = paidBoxShipIso(s.next_delivery_date, o.paid_at ?? o.created_at)
    paidBoxCount += 1
    const set = paidShipsBySub.get(s.id) ?? new Set<string>()
    set.add(shipIso)
    paidShipsBySub.set(s.id, set)
    if (shipIso >= startKey && shipIso <= endKey) push(shipIso, { ...s, box: 'paid', chargeIso: null, shipIso })
  }

  // 2) 결제 전 회차 — next_delivery_date 부터 14일씩. 결제일은 구독마다(위 결제 시점).
  //    사용자별 결제 회차의 발송일 목록을 먼저 모은다(서포터즈 회차 소진 판정용).
  const isChargeable = (s: SubLite) =>
    s.status === 'active' && s.has_billing_key === true && s.requires_billing_key_renewal !== true
  const cyclesOf = (s: SubLite): string[] => {
    const out: string[] = []
    if (!s.next_delivery_date) return out
    for (let d = s.next_delivery_date.slice(0, 10); d <= shipLimit; d = addDaysKst(d, 14)) {
      // 청구 크론의 날짜 밀기가 실패해 결제된 박스와 같은 날짜에 남은 회차는 두 번 세지 않는다.
      if (!paidShipsBySub.get(s.id)?.has(d)) out.push(d)
    }
    return out
  }
  const chargeShipsByUser = new Map<string, string[]>()
  for (const s of subList) {
    if (!isChargeable(s)) continue
    const arr = chargeShipsByUser.get(s.user_id) ?? []
    arr.push(...cyclesOf(s))
    chargeShipsByUser.set(s.user_id, arr)
  }
  const timingFor = (userId: string, shipIso: string): ChargeTiming => {
    const base = trialByUser.get(userId) ?? null
    const before = (chargeShipsByUser.get(userId) ?? []).filter((d) => d < shipIso).length
    return chargeTimingFor(advanceTrialState(base, before))
  }

  // 합계는 **결제일이 이번 달인, 결제될 회차만** — 활성 + 카드 있음 + 재등록 불필요.
  //   예전엔 발송일의 달로 묶었다 — 결제가 발송 3일 전 토요일로 옮겨 가면서 달 경계(1~3일 화요일)가 어긋났다.
  let monthTotalCount = 0
  let monthTotalRevenue = 0
  const chargesByDay = new Map<string, number>()
  for (const s of subList) {
    if (!s.next_delivery_date) continue
    const first = s.next_delivery_date.slice(0, 10)
    if (s.status !== 'active') {
      // 일시정지는 달력에 흐리게만 — 청구·발송 안 된다.
      if (first >= startKey && first <= endKey) push(first, { ...s, box: 'paused', chargeIso: null, shipIso: first })
      continue
    }
    const chargeable = isChargeable(s)
    for (const d of cyclesOf(s)) {
      const chargeIso = chargeable ? chargeDateFor(d, timingFor(s.user_id, d)) : null
      if (d >= startKey && d <= endKey) push(d, { ...s, box: 'pending', chargeIso, shipIso: d })
      if (chargeIso && chargeIso >= startKey && chargeIso <= endKey) {
        monthTotalCount += 1
        monthTotalRevenue += s.total_amount ?? 0
        chargesByDay.set(chargeIso, (chargesByDay.get(chargeIso) ?? 0) + 1)
      }
    }
  }
  // 칸 안 순서 — 결제 완료(지금 조리·포장 중) → 결제 전 → 일시정지.
  const BOX_ORDER = { paid: 0, pending: 1, paused: 2 } as const
  for (const arr of subsByDay.values()) arr.sort((a, b) => BOX_ORDER[a.box] - BOX_ORDER[b.box])

  // 그리드 셀 — 첫 주의 빈 칸 + 마지막 주의 빈 칸 채워서 7×N 격자.
  const firstWeekday = monthStart.getDay() // 0 = 일
  const daysInMonth = monthEnd.getDate()
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  type Cell = {
    date: string | null
    day: number | null
    isToday: boolean
    isWeekend: boolean
    items: DayItem[]
    charges: number
  }

  const cells: Cell[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayOfMonth = i - firstWeekday + 1
    if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
      cells.push({
        date: null,
        day: null,
        isToday: false,
        isWeekend: false,
        items: [],
        charges: 0,
      })
    } else {
      const key = `${year}-${pad(month)}-${pad(dayOfMonth)}`
      const weekday = (firstWeekday + dayOfMonth - 1) % 7
      cells.push({
        date: key,
        day: dayOfMonth,
        isToday: key === todayKey,
        isWeekend: weekday === 0 || weekday === 6,
        items: subsByDay.get(key) ?? [],
        charges: chargesByDay.get(key) ?? 0,
      })
    }
  }

  // 월별 합계는 위 회차 전개에서 계산했다(결제일이 이번 달인 결제 전 회차만, 구독가 기준).

  // prev/next 월 계산
  const prevYm = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`
  const nextYm = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`

  return (
    <div>
      {/* 대개편 v2 T1 — 정기배송 그룹 탭 (뒤로가기 링크는 탭으로 대체·헤더 zinc 통일) */}
      <AdminTabs tabs={SUBS_TABS} active="/admin/subscriptions/calendar" />
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight">
            배송 캘린더
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            <Hl>앞으로 나갈 배송을 달력으로</Hl> 봐요 (토·일 조리 → 월 포장 →{' '}
            <Em>화요일 발송</Em>). 박스는 발송일(화) 칸에, 결제는 결제일 칸에 💳로 보여요 — 일반 고객은
            발송 3일 전 토요일 아침, 서포터즈 체험 구간은 발송일 아침에 결제돼요. — 이번 달 결제될 회차{' '}
            {monthTotalCount}건 · 합계(할인 전 구독가) {monthTotalRevenue.toLocaleString('ko-KR')}원
            {paidBoxCount > 0 ? ` · 결제 완료·발송 대기 ${paidBoxCount}박스` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/subscriptions/calendar?ym=${prevYm}`}
            className="p-2 rounded-lg border border-border hover:bg-secondary/50 transition"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" strokeWidth={2} />
          </Link>
          <h2
            className="font-bold tracking-tight text-xl text-foreground min-w-[140px] text-center"
            style={{ letterSpacing: '0.02em' }}
          >
            {year}.{pad(month)}
          </h2>
          <Link
            href={`/admin/subscriptions/calendar?ym=${nextYm}`}
            className="p-2 rounded-lg border border-border hover:bg-secondary/50 transition"
            aria-label="다음 달"
          >
            <ChevronRight className="w-4 h-4 text-foreground" strokeWidth={2} />
          </Link>
          <Link
            href="/admin/subscriptions/calendar"
            className="ml-2 px-3 py-2 rounded-lg border border-border text-[11px] hover:bg-secondary/50 transition"
          >
            오늘
          </Link>
        </div>
      </div>

      {subsErr && (
        <div className="mb-4">
          <LoadError
            what="배송 일정"
            hint="달력이 비어 보여도 배송이 없는 게 아니에요 — 조회가 실패했어요. 새로고침해 주세요."
          />
        </div>
      )}
      {(paidErr || paidSubsErr) && (
        <div className="mb-4">
          <LoadError
            what="결제된 박스(발송 대기)"
            hint="이미 결제돼 조리·포장 중인 박스가 달력에서 빠졌을 수 있어요(토요일 결제분은 그 주 화요일 칸에 보여야 해요). 새로고침해 주세요."
          />
        </div>
      )}
      {trialLookupFailed && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900">
          서포터즈 정보를 불러오지 못해 결제일을 모두 일반 고객 기준(발송 3일 전 토요일)으로 셌어요 — 서포터즈 체험 구간은 실제로 발송일(화)에 결제돼요. 새로고침해 주세요.
        </p>
      )}

      {/* 캘린더 그리드 */}
      <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEK_LABELS.map((label, i) => (
            <div
              key={label}
              className={`px-3 py-2 text-[10px] font-bold text-center ${
                i === 0
                  ? 'text-destructive'
                  : i === 6
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7">
          {cells.map((c, idx) => {
            const weekday = idx % 7
            const dayColor =
              weekday === 0
                ? 'var(--adm-destructive)'
                : weekday === 6
                  ? 'var(--adm-primary)'
                  : 'var(--adm-foreground)'
            return (
              <div
                key={idx}
                className={`relative min-h-[110px] border-r border-b border-border p-2 ${
                  c.isToday ? 'bg-primary/5' : ''
                } ${c.date === null ? 'bg-secondary/60' : ''}`}
                style={{
                  borderRight:
                    weekday === 6 ? 'none' : '1px solid var(--adm-border)',
                }}
              >
                {c.day !== null && (
                  <>
                    <div
                      className={`text-[12px] font-mono tabular-nums ${
                        c.isToday ? 'font-bold' : ''
                      }`}
                      style={{
                        color: c.isToday ? 'var(--adm-primary)' : dayColor,
                      }}
                    >
                      {c.day}
                      {c.isToday && (
                        <span className="ml-1 inline-flex items-center text-[8px] font-bold px-1 rounded bg-primary text-white">
                          오늘
                        </span>
                      )}
                    </div>
                    {/* 결제일 표시 — 이 날 09:10 청구 크론이 결제할 회차 수(결제 전 회차만). */}
                    {c.charges > 0 && (
                      <div className="mt-1 text-[10px] font-bold text-violet-700">
                        💳 결제 {c.charges}건
                      </div>
                    )}
                    <div className="mt-1 space-y-1">
                      {c.items.slice(0, 3).map((it) => (
                        <Link
                          key={`${it.id}-${it.box}`}
                          href={`/admin/subscriptions?focus=${it.id}`}
                          className={`block text-[10px] px-1.5 py-1 rounded transition hover:opacity-80 ${chipCls(it, todayKey)}`}
                          title={`${it.recipient_name ?? '수령인 미지정'} · ${boxLabel(it, todayKey)} · ${(it.subscription_items ?? []).map((x) => `${x.product_name}×${x.quantity}`).join(', ')}`}
                        >
                          <div className="font-bold truncate">
                            {it.recipient_name ??
                              it.profiles?.name ??
                              '수령인 미지정'}
                          </div>
                          <div className="truncate opacity-80">
                            {boxLabel(it, todayKey)}
                          </div>
                        </Link>
                      ))}
                      {/* 계획 A-F6 — 3개 넘게 있으면 잘려서 안 보였다. 클릭하면
                          아래 '그날 전체' 목록으로(같은 페이지 ?day= 분기). */}
                      {c.items.length > 3 && c.date && (
                        <Link
                          href={`/admin/subscriptions/calendar?ym=${year}-${pad(month)}&day=${c.date}#day-detail`}
                          className="block text-[10px] font-bold text-primary px-1.5 hover:underline"
                        >
                          +{c.items.length - 3}건 더 보기
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 계획 A-F6 — 그날 전체 배송 목록. 셀은 3개까지만 보여줘서 나머지가
          안 보이던 문제 해결. 이미 가져온 subsByDay 를 재사용(추가 쿼리 없음). */}
      {dayParam && (
        <section
          id="day-detail"
          className="mt-6 rounded-xl border border-border bg-card shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-bold text-foreground">
                {dayParam} 배송 전체
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                이 날짜에 나갈 정기배송 {(subsByDay.get(dayParam) ?? []).length}
                건이에요.
                {(chargesByDay.get(dayParam) ?? 0) > 0 &&
                  ` 이 날 결제될 회차는 ${chargesByDay.get(dayParam)}건이에요(💳).`}
              </p>
            </div>
            <Link
              href={`/admin/subscriptions/calendar?ym=${year}-${pad(month)}`}
              className="text-[11px] font-bold text-muted-foreground hover:text-foreground shrink-0"
            >
              닫기 ✕
            </Link>
          </div>
          {(subsByDay.get(dayParam) ?? []).length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              이 날짜에 예정된 배송이 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(subsByDay.get(dayParam) ?? []).map((it) => (
                <li key={`${it.id}-${it.box}`} className="py-2.5">
                  <Link
                    href={`/admin/subscriptions?focus=${it.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 hover:opacity-80"
                  >
                    <span className="text-[13px] font-bold text-foreground">
                      {it.recipient_name ?? it.profiles?.name ?? '수령인 미지정'}
                    </span>
                    {/* 박스 상태 — 결제 완료(조리·포장 중) · 결제일 · 일시정지(2026-10-01). */}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${chipCls(it, todayKey)}`}>
                      {boxLabel(it, todayKey)}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {(it.subscription_items ?? [])
                        .map((x) => `${x.product_name}×${x.quantity}`)
                        .join(', ') || '구성 미등록'}
                    </span>
                    <span className="ml-auto text-[12px] font-bold text-foreground tabular-nums">
                      {(it.total_amount ?? 0).toLocaleString()}원
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 범례 */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-sky-600" />
          결제 완료(조리·포장 중)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-emerald-600" />
          결제 전(구독 중)
        </span>
        <span className="inline-flex items-center gap-1.5">💳 결제일</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-amber-500" />
          일시정지
        </span>
        <span className="ml-auto text-[10px] font-mono">
          {startKey} ~ {endKey}
        </span>
      </div>
    </div>
  )
}
