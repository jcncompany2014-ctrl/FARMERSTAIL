'use client'

import { useEffect, useState } from 'react'
import { Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/Spinner'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import {
  resumeShipDate,
  chargeTimingFor,
  chargeDateFor,
  describeUpcomingBox,
  nextShipDate,
  weekdayKo,
  type ChargeTiming,
  type UpcomingBox,
} from '@/lib/shipping-schedule'
import { todayKstIsoDate, diffDaysKst, addDaysKst } from '@/lib/datetime-kst'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { AdminTabs, Hl, Em, FilterChip, LoadError } from '@/components/admin/ui'
import { Badge } from '@/components/adminui/badge'
import { SUBS_TABS } from '@/components/admin/tabGroups'
import { isLiveTrial, supporterViews, type SupporterView } from '@/lib/payments/trial-display'
import type { TrialState } from '@/lib/payments/trial'
import { subscriptionState, type SubState } from '@/lib/subscription-state'

type SubscriptionRow = {
  id: string
  /**
   * ★빌링키 **값** 은 브라우저로 내리지 않는다 (2026-08-08 보안 재감사).
   *
   * 이 화면은 `'use client'` 인데 `select('*')` 를 하고 있었다 — 즉
   * **전 고객의 `billing_key`·`billing_customer_key` 가 어드민 브라우저의
   * 네트워크 응답과 메모리에 통째로 올라갔다.** 어드민 기기 침해·악성 확장·
   * XSS 하나면 전 고객 결제 자격증명이 한 번에 나간다.
   *
   * 그런데 이 화면이 실제로 쓰는 건 `!!billing_key`(등록 여부) 하나뿐이다.
   * 20260808000000 이 홈 RPC 에서 이미 정한 패턴(`has_billing_key` 불리언)과
   * 같은 모양으로 맞춘다.
   */
  has_billing_key: boolean
  /**
   * 카드가 **영구 거절**되어 고객의 재등록이 필요한 상태. 청구 크론이 대상에서
   * 제외하는 기준이라(`.eq('requires_billing_key_renewal', false)`), 이 값을
   * 안 보면 "카드 있음"으로 오판해 청구되지 않을 구독에 배송일을 박게 된다.
   * 영구 거절 시에도 billing_key 는 남으므로 **billing_key 만으로는 판정 불가**.
   */
  requires_billing_key_renewal: boolean | null
  /** 연속 청구 실패 횟수 — 상태 판정(subscriptionState)의 '결제 실패' 축. */
  failed_charge_count: number | null
  user_id: string
  status: 'active' | 'paused' | 'cancelled'
  interval_weeks: number
  coverage_weeks: number | null
  fresh_ratio: number | null
  next_delivery_date: string | null
  total_deliveries: number
  recipient_name: string | null
  recipient_phone: string | null
  /** ★실제 컬럼명은 address/address_detail/zip — recipient_* 는 유령이었다
   *  (2026-08-08 캐스트 감사 #1). select('*') 시절엔 타입만 틀린 채 NULL 로
   *  보였는데, select 를 명시 목록으로 좁힌 커밋이 유령 이름을 문자열에
   *  옮겨 적어 PostgREST 42703 → 화면 전체가 LoadError 로 죽었다.
   *  캐스트(as unknown as)가 tsc 를 우회시켜 초록인 채 배포됐다. */
  address: string | null
  address_detail: string | null
  zip: string | null
  subtotal: number
  shipping_fee: number
  total_amount: number
  created_at: string
  dog_id: string | null
  dogs: { id: string; name: string } | null
  profiles: { name: string | null; email: string | null } | null
  subscription_items: {
    product_name: string
    product_image_url: string | null
    quantity: number
    unit_price: number
  }[]
}

const TABS = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '구독 중' },
  // 플랜은 골랐지만 카드 등록을 안 끝낸 구독 — 결제·배송일이 아직 없다(2026-10-01 사장님 "왜 다음 배송일이 안 떠").
  { value: 'needs_card', label: '카드 등록 전' },
  { value: 'paused', label: '일시정지' },
  { value: 'cancelled', label: '해지' },
  { value: 'upcoming', label: '📦 배송 예정' },
  // 서포터즈(체험단) — 결제 금액이 정가와 달라 따로 본다(사장님 2026-10-01 "확실하게 구분감 있게").
  { value: 'supporters', label: '서포터즈' },
]

// 색은 orders/refunds 와 같은 토큰 팔레트(2026-09-05 어드민 개편).
// ★키는 status 칸이 아니라 정본 판정(lib/subscription-state)이다 (2026-10-01).
//   status='active' 인데 카드가 없는 구독(플랜만 고르고 카드 등록을 안 끝냄)이 초록 '구독 중'으로 떠서,
//   사장님이 "왜 다음 배송일이 안 뜨냐"고 물었다 — 배송일은 카드 등록 때 잡힌다(billing-issue).
const STATUS_BADGE: Record<SubState, { label: string; cls: string }> = {
  active: { label: '구독 중', cls: 'bg-emerald-100 text-emerald-900 border-transparent' },
  needs_card: { label: '카드 등록 전', cls: 'bg-sky-100 text-sky-900 border-transparent' },
  card_failed: { label: '결제 실패', cls: 'bg-red-100 text-red-900 border-transparent' },
  paused: { label: '일시정지', cls: 'bg-amber-100 text-amber-900 border-transparent' },
  cancelled: { label: '해지', cls: 'bg-secondary text-secondary-foreground border-transparent' },
}

/** 화면이 읽을 상태 — status 칸 + 카드 등록·청구 실패를 합친 정본 판정. */
function stateOf(sub: SubscriptionRow): SubState {
  return subscriptionState({
    status: sub.status,
    has_billing_key: sub.has_billing_key,
    next_delivery_date: sub.next_delivery_date,
    failed_charge_count: sub.failed_charge_count ?? 0,
    requires_billing_key_renewal: !!sub.requires_billing_key_renewal,
  })
}


const PER_PAGE = 200

export default function AdminSubscriptionsPage() {
  const supabase = createClient()

  const [subs, setSubs] = useState<SubscriptionRow[]>([])
  const [loading, setLoading] = useState(true)
  // ★무제한 전체 조회 금지 (2026-08-08 성능 감사). 해지 이력까지 남는
  //  테이블이라 가입자 수만큼 큰다 — 200건씩 누적 로드 + '더 불러오기'.
  //  탭·검색은 지금처럼 클라이언트 필터라, 아래 미로드분 안내를 함께 둔다.
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  // ★조회 실패를 '구독 없음' 으로 보여주지 않는다 (AGENTS.md 규칙1).
  const [loadError, setLoadError] = useState(false)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  // 발송일 바꾸기 창(2026-10-06) — 고객이 실수로 미뤘다고 문의하면 사장님이 직접 고친다.
  const [shipDateSubId, setShipDateSubId] = useState<string | null>(null)
  // 서포터즈 도장(사용자 단위) — subscription_trials 는 service_role 전용이라 어드민 API 로 받는다.
  // 못 받으면 서포터즈도 정가로 보이므로 그 사실을 화면에 알린다(규칙1 — 실패를 '없음'으로 위장 금지).
  const [trials, setTrials] = useState<Map<string, TrialState>>(new Map())
  const [trialsError, setTrialsError] = useState(false)
  // 결제됐고 아직 안 나간 박스가 있는 구독(결제됨 + 발송 대기 주문) — 2026-10-01 일정 변경.
  //   일반 고객은 토요일에 결제되고 청구 크론이 그 즉시 next_delivery_date 를 다음 주기(+14)로 민다.
  //   이걸 모르면 토~화엔 사흘 뒤 나갈 박스가 '배송 예정'에서 빠지고 다음 주기 날짜만 보인다.
  const [paidBoxSubIds, setPaidBoxSubIds] = useState<Set<string>>(new Set())
  const [paidBoxError, setPaidBoxError] = useState(false)

  useEffect(() => {
    void loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    setLoading(true)
    // ★`select('*')` 금지 — 위 has_billing_key 주석 참조. 쓸 칸만 명시한다.
    //  `billing_key`·`billing_customer_key` 외에 `last_charge_lock_at`·
    //  `next_retry_at`·`last_failed_charge_code` 같은 서버 전용 칸도 함께
    //  빠진다(별표는 그것들까지 전부 내보냈다).
    const [{ data, error, count }, trialRes, paidRes] = await Promise.all([
      subsQuery().range(0, PER_PAGE - 1),
      fetch('/api/admin/trials')
        .then(async (r) =>
          r.ok ? ((await r.json()) as { ok?: boolean; trials?: Array<TrialState & { user_id: string }> }) : null,
        )
        .catch(() => null),
      // 결제 증거 = 결제됨(부분환불 포함) + 발송 대기 주문 — 피킹 리스트·ship-block 과 같은 기준.
      supabase
        .from('orders')
        .select('subscription_id')
        .in('payment_status', [...PAID_STATUSES])
        .eq('order_status', 'preparing')
        .not('subscription_id', 'is', null)
        .limit(2000),
    ])
    if (trialRes?.ok && Array.isArray(trialRes.trials)) {
      setTrials(new Map(trialRes.trials.map((t) => [t.user_id, t])))
      setTrialsError(false)
    } else {
      setTrialsError(true)
    }
    // 못 받으면 결제된 박스가 '결제 예정'처럼 보인다 — 화면에 알린다(규칙1).
    if (paidRes.error) {
      setPaidBoxError(true)
    } else {
      setPaidBoxError(false)
      setPaidBoxSubIds(
        new Set(
          ((paidRes.data ?? []) as Array<{ subscription_id: string | null }>)
            .map((o) => o.subscription_id)
            .filter((x): x is string => !!x),
        ),
      )
    }

    setLoadError(Boolean(error))
    // audit #79: generated row vs domain SubscriptionRow nullable 차이 — unknown cast.
    if (data) setSubs(data as unknown as SubscriptionRow[])
    else if (error) setSubs([])
    setTotalCount(count ?? null)
    setLoading(false)
  }

  function subsQuery() {
    return supabase
      .from('subscriptions')
      .select(
        'id, user_id, status, interval_weeks, coverage_weeks, fresh_ratio, ' +
          'next_delivery_date, total_deliveries, ' +
          'recipient_name, recipient_phone, address, ' +
          'address_detail, zip, subtotal, shipping_fee, ' +
          'total_amount, created_at, dog_id, requires_billing_key_renewal, failed_charge_count, ' +
          'billing_card_brand, has_billing_key, ' +
          'profiles(name, email), subscription_items(*), dogs(id, name)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
  }

  async function loadMore() {
    setLoadingMore(true)
    const { data, error } = await subsQuery().range(
      subs.length,
      subs.length + PER_PAGE - 1,
    )
    // 추가 로드 실패는 목록을 지우지 않는다 — 이미 보이는 것은 유효하다.
    if (!error && data) {
      setSubs((prev) => [...prev, ...(data as unknown as SubscriptionRow[])])
    }
    setLoadingMore(false)
  }

  // 필터링
  // ★KST 날짜(2026-10-01) — 예전엔 UTC(toISOString)라 KST 00~09시엔 '오늘'이 어제였다.
  const today = todayKstIsoDate()

  /**
   * 구독마다 '지금 말할 박스' — 발송일과 결제일(2026-10-01 일정 변경, 정본 describeUpcomingBox).
   * 결제 시점: 서포터즈 체험 구간(100원·반값)이면 발송일(화), 아니면 발송 3일 전 토요일(chargeTimingFor).
   * 서포터즈 정보를 못 받았으면 결제일을 단정하지 않는다(null) — 일시정지·해지는 결제가 안 일어나므로 null.
   */
  const boxOf = (s: SubscriptionRow): UpcomingBox | null =>
    describeUpcomingBox({
      nextDeliveryDate: s.next_delivery_date,
      timing: s.status === 'active' && !trialsError ? chargeTimingFor(trials.get(s.user_id)) : null,
      hasPaidPreparingOrder: paidBoxSubIds.has(s.id),
      today,
    })

  /**
   * '📦 배송 예정' = 오늘부터 7일 안에 나갈 박스.
   *  · 결제된 박스(결제됨 + 발송 대기)는 구독 상태와 무관하게 나가야 하므로 넣는다 — 발송일이 지났는데
   *    안 나간 것도 넣는다(놓치면 안 되는 박스). 해지돼 날짜가 지워진 구독도 결제된 박스가 있으면 넣는다.
   *  · 아직 결제 전인 박스는 활성 구독만 — 결제가 확인 안 된 것(결제일 지남)도 넣고 표에서 빨갛게 보인다.
   * 예전엔 next_delivery_date 만 봐서, 토요일 결제 뒤 날짜가 다음 주기로 밀린 박스가 토~화에 빠졌다.
   */
  const isUpcoming = (s: SubscriptionRow): boolean => {
    const box = boxOf(s)
    if (paidBoxSubIds.has(s.id)) return !box || diffDaysKst(box.shipIso, today) <= 7
    if (s.status !== 'active' || !box) return false
    const diff = diffDaysKst(box.shipIso, today)
    return diff >= 0 && diff <= 7
  }

  const filtered = subs.filter((s) => {
    // 탭 필터
    if (tab === 'upcoming') {
      if (!isUpcoming(s)) return false
    } else if (tab === 'supporters') {
      if (!isLiveTrial(trials.get(s.user_id))) return false
    } else if (tab === 'needs_card') {
      if (stateOf(s) !== 'needs_card') return false
    } else if (tab === 'active') {
      // '구독 중' = 실제로 결제·배송이 도는 것(카드 미등록은 '카드 등록 전' 탭).
      if (s.status !== 'active' || stateOf(s) === 'needs_card') return false
    } else if (tab !== 'all') {
      if (s.status !== tab) return false
    }
    // 검색
    if (search) {
      const q = search.toLowerCase()
      const name = (s.profiles?.name || '').toLowerCase()
      const email = (s.profiles?.email || '').toLowerCase()
      const recipient = (s.recipient_name || '').toLowerCase()
      const products = s.subscription_items.map(i => i.product_name.toLowerCase()).join(' ')
      if (!name.includes(q) && !email.includes(q) && !recipient.includes(q) && !products.includes(q)) return false
    }
    return true
  })

  // 서포터즈 — 구독별 실제 다음 결제 금액(청구와 같은 판정, lib/payments/trial-display).
  const supporter = supporterViews(subs, trials)
  const supporterCount = subs.filter((s) => isLiveTrial(trials.get(s.user_id))).length

  // 배송 예정 건수 — 탭과 같은 판정(isUpcoming).
  const upcomingCount = subs.filter(isUpcoming).length

  async function handleStatusChange(subId: string, newStatus: string) {
    // 해지는 되돌리기 어려운 조치 — 모바일 오터치 가드(2026-07-19 검수).
    // ★확인창에 **누구의** 구독인지·무엇이 사라지는지를 적는다(2026-09-28 점검 9차). 폰 카드 목록에서 작은 버튼이
    //   붙어 있어 다른 카드의 해지를 눌러도 "이 구독을" 만 보고 확인하게 됐다. 해지는 카드 정보가 지워지고(트리거)
    //   다시 켤 수 없다(부활 가드) — 고객이 새로 신청해야 한다.
    const target = subs.find((s) => s.id === subId)
    const who = target
      ? `${target.profiles?.name || target.recipient_name || '고객'}${target.dogs ? ` · 🐶 ${target.dogs.name}` : ''} · ${target.total_amount.toLocaleString()}원`
      : '이 구독'
    if (
      newStatus === 'cancelled' &&
      !confirm(
        `${who}\n\n이 구독을 해지할까요?\n· 다음 자동결제가 멈추고 등록된 카드 정보가 지워져요\n· 해지한 구독은 다시 켤 수 없어요(고객이 새로 신청해야 해요)`,
      )
    ) {
      return
    }
    if (
      newStatus === 'paused' &&
      !confirm(`${who}\n\n이 구독을 일시정지할까요? 다시 시작하기 전까지 결제·발송이 멈춰요.`)
    ) {
      return
    }
    setActionLoading(subId)
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'cancelled') {
      updates.next_delivery_date = null
    }
    if (newStatus === 'active') {
      const sub = subs.find(s => s.id === subId)
      // ★최종감사 #4 (2026-07-29): 카드 등록(billing_key) 여부를 반드시 본다.
      //   예전엔 무조건 다음 화요일을 박았는데, 카드 미등록 구독은 청구 크론이
      //   영원히 건너뛰므로(billing_key null 스킵) 그 날짜는 ① 고객 홈에 실제로
      //   오지 않을 배송일을 표시하고(절대 규칙: 카드 등록 전 = null 위반)
      //   ② 날짜가 과거로 밀리며 매주 피킹 리스트에 유령 박스로 계속 떴다.
      //   카드 미등록이면 null 유지 — 카드가 등록되는 순간 billing-issue 가
      //   첫 배송을 잡는 기존 흐름 그대로.
      /**
       * ★★ `requires_billing_key_renewal` 도 반드시 본다 (2026-07-31).
       *
       * 카드가 **영구 거절**되면 청구 크론은 status='paused' +
       * requires_billing_key_renewal=true 로 표시하는데, **billing_key 는 지우지
       * 않는다**(subscription-charge :878~900 — 지우는 코드가 없다). 그래서
       * `sub?.billing_key` 만 보면 "카드 있음"으로 판정돼 배송일이 박혔다.
       *
       * 그런데 청구 크론의 대상 조회는 `.eq('requires_billing_key_renewal', false)`
       * (:306) 라 그 구독을 **영원히 건너뛴다.** 결과:
       *   · 어드민 목록 = '구독 중'  · 피킹 리스트 = '발송일 아침 청구 예정'
       *   · 고객 앱 = '카드 실패'(subscription-state :46 이 이 플래그를 먼저 본다)
       *   · 실제 = 박스만 나가고 **결제는 0원**
       *
       * 플래그를 여기서 지우지 않는다 — 카드는 정말 죽었고, 되살릴 수 있는 건
       * 고객의 재등록(billing-issue)뿐이다. 대신 '카드 없음'과 **같은 취급**을
       * 해서 배송일을 잡지 않고, 사장님께 왜 그런지 알린다.
       * (이 두 칸은 화이트리스트 안이라 여기서 그대로 쓸 수 있다 — 규칙13.)
       */
      const cardUsable =
        !!sub?.has_billing_key && !sub?.requires_billing_key_renewal
      if (cardUsable) {
        // 배송 주기는 2주 하나로 고정 — 재개는 다음 화요일부터(2026-07-16).
        // 아직 오지 않은 원래 배송일은 그대로 — 정지했다 곧바로 재개해도 다음 청구가 앞당겨지지 않게(2026-09-28).
        // 마감은 결제 시점별 — 서포터즈 체험 구간 일요일·일반 금요일 밤(2026-10-02). 서포터즈 정보를 못 받았으면 일반.
        updates.next_delivery_date = resumeShipDate(
          sub?.next_delivery_date,
          undefined,
          sub && !trialsError ? chargeTimingFor(trials.get(sub.user_id)) : 'before_cooking',
        )
      } else {
        updates.next_delivery_date = null
        if (sub?.requires_billing_key_renewal) {
          alert(
            '이 구독은 카드가 영구 거절된 상태예요. 활성으로 되돌리더라도 고객이 ' +
              '결제수단을 다시 등록하기 전까지는 청구되지 않습니다 — 배송일을 ' +
              '잡지 않았어요. 박스가 나가지 않도록 피킹 리스트에도 뜨지 않습니다.',
          )
        }
      }
    }
    // audit #79: subscriptions update Record cast.
    // ★ error 를 받는다 (2026-07-31). 예전엔 `await ...` 로 결과를 버려서, 이
    //   조작이 실패해도 목록만 다시 그려지고 **사장님은 성공한 줄 알았다.**
    //   특히 2026-07-30 부터 subscriptions 는 4칸만 고객/관리자가 UPDATE 할 수
    //   있어(20260730000000), 잠긴 칸을 추가하면 여기서 조용히 실패한다.
    const { error: upErr } = await (supabase as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (
            c: string,
            v: string,
          ) => Promise<{ error: { message: string } | null }>
        }
      }
    })
      .from('subscriptions')
      .update(updates)
      .eq('id', subId)
    if (upErr) {
      alert(`상태를 바꾸지 못했어요: ${upErr.message}`)
      setActionLoading(null)
      return
    }
    await loadAll()
    setActionLoading(null)
  }

  /** 이 구독의 결제 시점 — 서포터즈 정보를 못 받았으면 null(결제일을 단정하지 않는다). */
  const timingOfSub = (s: SubscriptionRow): ChargeTiming | null =>
    trialsError ? null : chargeTimingFor(trials.get(s.user_id))

  /**
   * ★발송일 바꾸기 (2026-10-06 사장님 "실수로 건너뛰기해 버리면 할 수 있는 게 없더라").
   * 고객 화면의 되돌리기는 원래 회차 마감 전까지만 된다 — 그 뒤 문의가 오면 여기서 고친다.
   * 고를 수 있는 날짜는 ShipDateModal 이 정한다(신청 마감이 안 지난 화요일만 — 조리 중인 주에 끼우지 않는다).
   * 화면이 본 날짜가 DB 에서도 그대로일 때만 바꾼다 — 그 사이 청구 크론이 결제하며 날짜를 옮겼으면 거절.
   */
  async function handleShipDateChange(subId: string, toIso: string) {
    const target = subs.find((s) => s.id === subId)
    if (!target) return
    const who = `${target.profiles?.name || target.recipient_name || '고객'}${target.dogs ? ` · 🐶 ${target.dogs.name}` : ''}`
    const fromIso = target.next_delivery_date
    const timing = timingOfSub(target)
    const label = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${weekdayKo(iso)})`
    const chargeLine = timing
      ? `· 결제일: ${label(chargeDateFor(toIso, timing))} 아침${timing === 'ship_day' ? ' (서포터즈 — 발송일 결제)' : ''}`
      : '· 결제일: 서포터즈 정보를 못 받아 확인 못 함'
    const paidLine = paidBoxSubIds.has(subId)
      ? '\n· 이미 결제된 이번 박스는 그대로 나가요 — 바꾸는 건 그다음 박스예요'
      : ''
    if (
      !confirm(
        `${who}\n\n다음 발송일을 ${fromIso ? label(fromIso) : '(없음)'} → ${label(toIso)}로 바꿀까요?\n${chargeLine}${paidLine}`,
      )
    ) {
      return
    }
    setActionLoading(subId)
    const q = supabase.from('subscriptions').update({ next_delivery_date: toIso }).eq('id', subId)
    const { data: moved, error: upErr } = await (fromIso ? q.eq('next_delivery_date', fromIso) : q.is('next_delivery_date', null)).select('id')
    if (upErr) {
      alert(`발송일을 바꾸지 못했어요: ${upErr.message}`)
    } else if (!moved || moved.length === 0) {
      alert('그 사이 발송일이 바뀌었어요(결제·고객 변경). 목록을 새로 불러왔어요 — 확인 후 다시 해 주세요.')
    } else {
      setShipDateSubId(null)
    }
    await loadAll()
    setActionLoading(null)
  }

  return (
    <div>
      {/* 대개편 v2 T1 — 정기배송 그룹 탭 (구독|캘린더|자동결제) */}
      <AdminTabs tabs={SUBS_TABS} active="/admin/subscriptions" />
      {/* 헤더 — orders/refunds 와 같은 패턴(2026-09-05 어드민 개편) */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Repeat className="size-5 text-primary" strokeWidth={2} />
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              정기배송 관리
            </h1>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            <Hl>고객들의 정기배송(2주마다 · 토·일 조리 → 월 포장 → 화요일 발송)</Hl>을 조회·관리하는
            곳이에요. 결제는 일반 고객이 발송 3일 전 토요일 아침, 서포터즈 체험 구간은 발송일(화) 아침에
            자동으로 돌아가서,{' '}
            <Em>문제 있는 구독만</Em> 손보면 돼요.
            {/* ★조회가 실패했으면 "전체 0건" 이라고 말하지 않는다 — 배너 바로
                위에서 숫자가 거짓말하면 배너를 안 읽는다(2026-08-07). */}
            {loadError
              ? ' — 건수를 불러오지 못했어요'
              : ` — 전체 ${subs.length}건 · 활성 ${subs.filter((x) => x.status === 'active').length}`}
          </p>
        </div>
      </div>

      {/* 탭 + 검색 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map((t) => (
            <FilterChip
              key={t.value}
              onClick={() => setTab(t.value)}
              active={tab === t.value}
              label={t.label}
            >
              {t.value === 'upcoming' && upcomingCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                  {upcomingCount}
                </span>
              )}
              {t.value === 'supporters' && supporterCount > 0 && (
                <span className="ml-1 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] text-white">
                  {supporterCount}
                </span>
              )}
            </FilterChip>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="고객명 · 이메일 · 상품명"
          className="w-full rounded-full border border-input bg-card px-3 py-1.5 text-xs focus:border-primary focus:outline-none sm:w-56"
        />
      </div>

      {trialsError && !loading && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900">
          서포터즈 정보를 불러오지 못했어요 — 지금은 서포터즈 고객도 정가로 보여요. 새로고침해 주세요.
        </p>
      )}
      {paidBoxError && !loading && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900">
          결제된 박스(발송 대기) 정보를 불러오지 못했어요 — 토요일에 결제된 박스가 &lsquo;배송 예정&rsquo;에서 빠지고 다음 주기 날짜로 보일 수 있어요. 새로고침해 주세요.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Spinner size={16} />
          <span className="text-[12px]">불러오는 중...</span>
        </div>
      ) : loadError ? (
        <LoadError what="구독 목록" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
          {/* ★0건일 때가 안내가 가장 필요한 순간이다 (2026-08-08 재검증 2차 #4).
              총계보다 덜 불러온 상태의 0건은 "없다"가 아니라 "여기엔 없다"다 —
              옛 해지 건·오래된 고객은 최근 200건 밖에 있을 수 있다. */}
          {totalCount != null && subs.length < totalCount ? (
            <>
              <p>
                불러온 {subs.length}건(전체 {totalCount}건) 안에는 해당하는
                구독이 없어요.
              </p>
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="mt-4 rounded-full border border-input bg-card px-5 py-2.5 text-xs font-semibold transition hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {loadingMore
                  ? '불러오는 중...'
                  : `더 불러와서 다시 찾기 (${subs.length}/${totalCount})`}
              </button>
            </>
          ) : (
            '해당하는 구독이 없어요'
          )}
        </div>
      ) : (
        <>
          {/* ── 데스크톱: 테이블 ─────────────────────────────── */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground">
                    <th className="text-left px-4 py-2.5 font-medium">고객</th>
                    <th className="text-left px-4 py-2.5 font-medium">구성</th>
                    <th className="text-center px-4 py-2.5 font-medium">상태</th>
                    <th className="text-center px-4 py-2.5 font-medium">다음 발송 · 결제</th>
                    <th className="text-right px-4 py-2.5 font-medium">회당 금액</th>
                    <th className="text-center px-4 py-2.5 font-medium">누적</th>
                    <th className="text-center px-4 py-2.5 font-medium">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((sub) => (
                    <SubRow
                      key={sub.id}
                      sub={sub}
                      box={boxOf(sub)}
                      paidBox={paidBoxSubIds.has(sub.id)}
                      today={today}
                      supporter={supporter.get(sub.id) ?? null}
                      isSupporter={isLiveTrial(trials.get(sub.user_id))}
                      isLoading={actionLoading === sub.id}
                      onAction={handleStatusChange}
                      onShipDate={setShipDateSubId}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 모바일: 카드 리스트 (사장님 폰 운영 — 가로 스크롤 제거) ── */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((sub) => (
              <SubCard
                key={sub.id}
                sub={sub}
                box={boxOf(sub)}
                paidBox={paidBoxSubIds.has(sub.id)}
                today={today}
                supporter={supporter.get(sub.id) ?? null}
                isSupporter={isLiveTrial(trials.get(sub.user_id))}
                isLoading={actionLoading === sub.id}
                onAction={handleStatusChange}
                onShipDate={setShipDateSubId}
              />
            ))}
          </div>

          {shipDateSubId &&
            (() => {
              const s = subs.find((x) => x.id === shipDateSubId)
              if (!s) return null
              return (
                <ShipDateModal
                  sub={s}
                  timing={timingOfSub(s)}
                  paidBox={paidBoxSubIds.has(s.id)}
                  today={today}
                  isLoading={actionLoading === s.id}
                  onPick={(iso) => void handleShipDateChange(s.id, iso)}
                  onClose={() => setShipDateSubId(null)}
                />
              )
            })()}

          {totalCount != null && subs.length < totalCount && (
            <div className="mt-4 text-center">
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-full border border-input bg-card px-5 py-2.5 text-xs font-semibold transition hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {loadingMore
                  ? '불러오는 중...'
                  : `더 불러오기 (${subs.length}/${totalCount})`}
              </button>
              {search && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  검색은 불러온 {subs.length}건 안에서만 찾아요 — 못 찾으면 더
                  불러온 뒤 다시 검색해 주세요.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── 행 공통 조각 ──────────────────────────────────────────── */

function StatusBadge({ sub }: { sub: SubscriptionRow }) {
  const badge = STATUS_BADGE[stateOf(sub)]
  return (
    <Badge className={`gap-1 ${badge.cls}`}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {badge.label}
    </Badge>
  )
}

/** 'yyyy-mm-dd' → '10월 6일(화)'. 문자열 그대로 읽는다 — new Date() 는 기기 시간대를 타서 해외에선 하루 어긋난다. */
function mdKo(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일(${weekdayKo(iso)})`
}

/**
 * 다음 발송일 + 결제일 (2026-10-01 일정 변경 — 토·일 조리 → 월 포장 → 화 발송).
 * 결제일은 고객마다 다르다: 일반 = 발송 3일 전 토요일(조리 직전), 서포터즈 체험 구간 = 발송일(화).
 * 결제된 박스가 있으면 next_delivery_date(다음 주기)가 아니라 **지금 조리·포장 중인 박스**의 발송일을 말한다.
 * 카드 등록 전이면 빈칸('-') 대신 왜 없는지를 말한다(배송일은 카드 등록 때 잡힌다).
 */
function NextDelivery({
  sub,
  box,
  paidBox,
  today,
  layout,
}: {
  sub: SubscriptionRow
  box: UpcomingBox | null
  paidBox: boolean
  today: string
  layout: 'stack' | 'inline'
}) {
  if (!box) {
    // 해지로 날짜가 지워졌어도 결제된 박스는 나간다(결제 후 자동 환불 없음 — 사장님 2026-10-01).
    if (paidBox) return <span className="text-emerald-700">결제됨 · 발송 대기</span>
    if (stateOf(sub) === 'needs_card') {
      return <span className="text-[11px] font-normal text-muted-foreground">카드 등록 후 잡혀요</span>
    }
    return <>-</>
  }
  let charge: { text: string; cls: string } | null
  if (box.kind === 'in_progress') {
    charge =
      box.shipIso < today
        ? { text: '결제됨 · 발송일 지남 — 송장 확인', cls: 'text-destructive' }
        : { text: '결제 완료 · 조리·포장 중', cls: 'text-emerald-700' }
  } else if (box.kind === 'charge_check') {
    charge = { text: `결제 ${mdKo(box.chargeIso)} — 결제 확인 필요`, cls: 'text-destructive' }
  } else if (sub.requires_billing_key_renewal) {
    charge = { text: '카드 재등록 전엔 결제 안 됨', cls: 'text-destructive' }
  } else if (box.chargeIso) {
    charge = {
      text: `결제 ${box.chargeIso === today ? '오늘' : mdKo(box.chargeIso)} 예정`,
      cls: 'text-muted-foreground',
    }
  } else if (sub.status === 'active') {
    // 서포터즈 정보를 못 받았다 — 토요일·화요일 중 어느 쪽인지 단정하지 않는다.
    charge = { text: '결제일 확인 불가', cls: 'text-amber-700' }
  } else {
    charge = null // 일시정지 — 다시 시작하기 전엔 결제되지 않는다(상태 배지가 말한다).
  }
  const ship = `${mdKo(box.shipIso)} 발송`
  if (layout === 'inline') {
    return (
      <>
        {ship}
        {charge && <span className={`ml-1 text-[11px] font-semibold ${charge.cls}`}>· {charge.text}</span>}
      </>
    )
  }
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span>{ship}</span>
      {charge && <span className={`mt-0.5 text-[10px] font-semibold ${charge.cls}`}>{charge.text}</span>}
    </span>
  )
}

/** 서포터즈 배지 — 상태 배지(초록·노랑)와 겹치지 않는 보라. */
function SupporterBadge() {
  return <Badge className="border-transparent bg-violet-600 text-white">서포터즈</Badge>
}

/**
 * 금액 칸 — 서포터즈면 **실제 다음 결제 금액**을 크게, 정가는 취소선으로 작게, 남은 기간 한 줄.
 * 정가만 크게 보이면 100원 결제 고객이 51,500원 고객처럼 읽힌다(사장님 2026-10-01 캡처).
 */
function AmountCell({ sub, supporter }: { sub: SubscriptionRow; supporter: SupporterView | null }) {
  if (!supporter) {
    return <strong className="tabular-nums">{sub.total_amount.toLocaleString()}원</strong>
  }
  return (
    <span className="inline-flex flex-col items-end">
      <strong className="text-[15px] tabular-nums text-violet-700">
        {supporter.chargeAmount.toLocaleString()}원
      </strong>
      <span className="text-[10px] tabular-nums text-muted-foreground line-through">
        정가 {supporter.listAmount.toLocaleString()}원
      </span>
      <span className="mt-0.5 text-[10px] font-semibold text-violet-700">{supporter.caption}</span>
    </span>
  )
}

/**
 * 발송일 바꾸기 창 (2026-10-06) — 고를 수 있는 날짜는 **신청 마감이 안 지난 화요일** 8주치(결제 시점별 마감:
 * 일반 금요일 밤·서포터즈 일요일 — lib/shipping-schedule nextShipDate). 이미 조리가 시작된 주에 박스를 끼우면
 * 원료·조리가 없는데 결제만 되므로 선택지에서 뺀다. 각 날짜 옆에 그 회차의 결제일을 같이 보여준다.
 */
function ShipDateModal({
  sub,
  timing,
  paidBox,
  today,
  isLoading,
  onPick,
  onClose,
}: {
  sub: SubscriptionRow
  timing: ChargeTiming | null
  paidBox: boolean
  today: string
  isLoading: boolean
  onPick: (iso: string) => void
  onClose: () => void
}) {
  const first = nextShipDate(today, timing ?? 'before_cooking')
  const options = Array.from({ length: 8 }, (_, i) => addDaysKst(first, i * 7))
  const label = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${weekdayKo(iso)})`
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[14px] font-bold">
          발송일 바꾸기 · {sub.profiles?.name || sub.recipient_name || '고객'}
          {sub.dogs ? ` · 🐶 ${sub.dogs.name}` : ''}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          지금 다음 발송: {sub.next_delivery_date ? label(sub.next_delivery_date) : '없음'}
          {paidBox ? ' · 결제된 이번 박스는 그대로 나가요(바꾸는 건 그다음 박스)' : ''}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          조리가 시작된 주는 고를 수 없어요(신청 마감 {timing === 'ship_day' ? '일요일 · 서포터즈' : '금요일 밤'}).
          {timing == null ? ' 서포터즈 정보를 못 받아 결제일은 표시하지 않아요.' : ''}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {options.map((iso) => {
            const current = iso === sub.next_delivery_date
            return (
              <button
                key={iso}
                type="button"
                disabled={isLoading || current}
                onClick={() => onPick(iso)}
                className="rounded-lg border border-border px-2.5 py-2 text-left transition hover:border-primary disabled:opacity-50"
              >
                <span className="block text-[13px] font-bold">
                  {label(iso)} 발송{current ? ' · 지금' : ''}
                </span>
                {timing && (
                  <span className="block text-[11px] text-muted-foreground">결제 {label(chargeDateFor(iso, timing))}</span>
                )}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-full border border-border px-3 py-2 text-[12px] font-bold text-muted-foreground"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

/** 관리 버튼 — 이모지 단독(⏸▶✕) 대신 라벨 버튼(폰 오터치·의미 명확).
 *  정렬: 테이블 셀에선 중앙, 모바일 카드에선 좌측 — 카드 중앙 정렬은
 *  버튼이 붕 떠 보였다(2026-09-05 시각 QA). */
function RowActions({
  sub,
  isLoading,
  onAction,
  onShipDate,
  align = 'center',
}: {
  sub: SubscriptionRow
  isLoading: boolean
  onAction: (id: string, status: string) => void
  onShipDate: (id: string) => void
  align?: 'center' | 'start'
}) {
  if (sub.status === 'cancelled') return null
  // 발송일을 잡을 수 있는 구독만 — 카드 미등록·영구 거절은 날짜가 null 이어야 한다(카드 등록이 첫 배송을 잡는다).
  const canSetShipDate = !!sub.has_billing_key && !sub.requires_billing_key_renewal
  return (
    <div
      className={`flex flex-wrap gap-1.5 ${align === 'center' ? 'justify-center' : 'justify-start'}`}
    >
      {canSetShipDate && (
        <button
          onClick={() => onShipDate(sub.id)}
          disabled={isLoading}
          className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition disabled:opacity-50"
        >
          발송일
        </button>
      )}
      {/* 카드 등록 전엔 일시정지가 없다 — 시작도 안 한 구독을 멈추면 카드 없는 '유령 일시정지'가 생긴다
          (lib/subscription-state 문서, 2026-07-15 실측). 할 수 있는 건 해지·메시지뿐. */}
      {sub.status === 'active' && stateOf(sub) !== 'needs_card' && (
        <button
          onClick={() => onAction(sub.id, 'paused')}
          disabled={isLoading}
          className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50"
        >
          일시정지
        </button>
      )}
      {sub.status === 'paused' && (
        <button
          onClick={() => onAction(sub.id, 'active')}
          disabled={isLoading}
          className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50"
        >
          재개
        </button>
      )}
      <button
        onClick={() => onAction(sub.id, 'cancelled')}
        disabled={isLoading}
        className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition disabled:opacity-50"
      >
        해지
      </button>
      {/* 동선 단축 — 카드 문제·배송 문의 시 바로 1:1 메시지로. */}
      <a
        href={`/admin/users/${sub.user_id}/message`}
        className="rounded-full border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:border-ring hover:text-foreground"
      >
        메시지
      </a>
    </div>
  )
}

function SubRow({
  sub,
  box,
  paidBox,
  today,
  supporter,
  isSupporter,
  isLoading,
  onAction,
  onShipDate,
}: {
  sub: SubscriptionRow
  box: UpcomingBox | null
  paidBox: boolean
  today: string
  supporter: SupporterView | null
  isSupporter: boolean
  isLoading: boolean
  onAction: (id: string, status: string) => void
  onShipDate: (id: string) => void
}) {
  return (
    <tr
      className={`transition ${isSupporter ? 'bg-violet-50/70 hover:bg-violet-100/60' : 'hover:bg-secondary/50'} ${sub.status === 'cancelled' ? 'opacity-50' : ''}`}
      style={isSupporter ? { boxShadow: 'inset 3px 0 0 rgb(124 58 237)' } : undefined}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          {sub.profiles?.name || sub.recipient_name || '-'}
          {isSupporter && <SupporterBadge />}
        </div>
        <div className="text-[10px] text-muted-foreground">{sub.profiles?.email || ''}</div>
      </td>
      <td className="px-4 py-3">
        {sub.subscription_items.map((item, i) => (
          <div key={i} className="text-xs">
            {item.product_name} ×{item.quantity}
          </div>
        ))}
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {freshTierLabel(sub.fresh_ratio)}
          {sub.dogs ? ` · 🐶 ${sub.dogs.name}` : ''}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <StatusBadge sub={sub} />
      </td>
      <td className="px-4 py-3 text-center text-xs">
        <NextDelivery sub={sub} box={box} paidBox={paidBox} today={today} layout="stack" />
      </td>
      <td className="px-4 py-3 text-right text-xs font-bold tabular-nums">
        <AmountCell sub={sub} supporter={supporter} />
      </td>
      <td className="px-4 py-3 text-center text-xs">
        {sub.total_deliveries}회
      </td>
      <td className="px-4 py-3 text-center">
        <RowActions sub={sub} isLoading={isLoading} onAction={onAction} onShipDate={onShipDate} />
      </td>
    </tr>
  )
}

/** 모바일 카드 — 테이블과 같은 정보를 세로로. 가로 스크롤 없음. */
function SubCard({
  sub,
  box,
  paidBox,
  today,
  supporter,
  isSupporter,
  isLoading,
  onAction,
  onShipDate,
}: {
  sub: SubscriptionRow
  box: UpcomingBox | null
  paidBox: boolean
  today: string
  supporter: SupporterView | null
  isSupporter: boolean
  isLoading: boolean
  onAction: (id: string, status: string) => void
  onShipDate: (id: string) => void
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${isSupporter ? 'border-violet-300 bg-violet-50/70' : 'border-border bg-card'} ${sub.status === 'cancelled' ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-bold">
            {sub.profiles?.name || sub.recipient_name || '-'}
            {isSupporter && <SupporterBadge />}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {sub.profiles?.email || ''}
          </p>
        </div>
        <StatusBadge sub={sub} />
      </div>
      <div className="mt-2.5 text-[12px]">
        {sub.subscription_items.map((item, i) => (
          <div key={i}>
            {item.product_name} ×{item.quantity}
          </div>
        ))}
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {freshTierLabel(sub.fresh_ratio)}
          {sub.dogs ? ` · 🐶 ${sub.dogs.name}` : ''}
        </p>
      </div>
      {/* 발송일 + 결제일(2026-10-01) — 한 줄에 다 넣으면 폰에서 금액 칸과 겹쳐 두 줄로 나눴다. */}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2.5 text-[12px]">
        <span className="min-w-0 text-muted-foreground">
          <strong className="text-foreground">
            <NextDelivery sub={sub} box={box} paidBox={paidBox} today={today} layout="inline" />
          </strong>
          <span className="block text-[11px]">누적 {sub.total_deliveries}회</span>
        </span>
        <AmountCell sub={sub} supporter={supporter} />
      </div>
      <div className="mt-3">
        <RowActions sub={sub} isLoading={isLoading} onAction={onAction} onShipDate={onShipDate} align="start" />
      </div>
    </div>
  )
}
