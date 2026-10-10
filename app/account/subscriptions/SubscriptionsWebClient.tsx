'use client'

/**
 * SubscriptionsWebClient — /account/subscriptions 의 인터랙티브 본체(모양 = 웹 시안 WEB-A23, 2026-10-10 웹 리뉴얼).
 *
 * 비즈니스 로직은 app 의 SubscriptionsClient(audit #101) 와 **동일** — 모든 액션은
 * RLS 보호 subscriptions 테이블 update + 카드재등록만 /subscribe/billing-auth
 * redirect. 위험한 KST 날짜 로직은 공용 헬퍼(lib/datetime-kst) 재사용이라 중복 0.
 * app client(폰프레임 v3) 는 손대지 않고, 웹 전용 FD UI 만 여기 별도로 둔다.
 */

import { useEffect, useRef, useState } from 'react'
import { trialPricing, type TrialState } from '@/lib/payments/trial'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Pause,
  Play,
  Bell,
  BellOff,
  CreditCard,
  Soup,
  X,
  ChevronRight,
  Undo2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  nextShipDate,
  nextCycleDate,
  resumeShipDate,
  describeUpcomingBox,
  undoSkipTarget,
  paidBoxShipIso,
  type ChargeTiming,
  type UpcomingBox,
  weekdayKo,
} from '@/lib/shipping-schedule'
import { pouchLineFromName } from '@/lib/design/pouch'
import { RECIPE_BAND } from '@/lib/store/catalog'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import {
  trackSubscriptionPaused,
  trackSubscriptionResumed,
  trackSubscriptionCancelled,
} from '@/lib/analytics'
import {
  formatRetryAt,
  generateFallbackCustomerKey,
} from '@/lib/v3-helpers/subscriptions'
import type { Subscription } from './types'
import {
  subscriptionState,
  isSubscriptionVisibleToUser,
  SUB_STATE_LABEL,
  type SubState,
} from '@/lib/subscription-state'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import FreshRatioSheet from '@/components/subscription/FreshRatioSheet'
import PriceChangeConsentModal, {
  type PriceChangeProposal,
} from './PriceChangeConsentModal'

type Props = {
  /** 체험단 가격표 — 금액 표시가 체험가로 바뀐다(청구와 같은 판정) */
  trial?: TrialState | null
  /**
   * 결제 시점(서버 getChargeTiming) — 일반 = 발송 3일 전 토요일, 서포터즈 체험 구간 = 발송일(2026-10-01).
   * null = 조회 실패(모름) → 결제 요일을 말하지 않고 발송일만 말한다.
   */
  chargeTiming?: ChargeTiming | null
  /** 결제됐고 아직 안 나간 박스(결제됨 + 발송 대기 주문)가 있는 구독 id. 조회 실패면 빈 목록. */
  paidPreparingSubIds?: string[]
  /** 구독 id → 그 결제된 박스의 결제 시각(이번 박스 발송일 정본 paidBoxShipIso). */
  paidPreparingAt?: Record<string, string>
  /** 결제된 박스 조회 실패 — 되돌리기를 숨긴다(11차 점검 A#6). */
  paidStateUnknown?: boolean
  initialSubs: Subscription[]
  focusSubId: string | null
  priceProposal: PriceChangeProposal | null
  /**
   * 앱(PWA/Capacitor) 컨텍스트 여부 — **서버가 계산해 내려준다.**
   * 클라이언트 훅(useIsAppContext)은 SSR·하이드레이션 시 null 이라, 첫 렌더에
   * 잘못된 링크가 잠깐 보였다가 바뀐다. 링크 목적지가 갈리는 값이라 그러면 안 된다.
   */
  isApp: boolean
}

// ★ status 컬럼이 아니라 subscriptionState() 로 판정 — '유령 활성'(카드 없이
//   status=active)을 '구독 중'으로 오표시하던 버그(사장님 2026-07-16) 차단.
//
// ★라벨은 lib/subscription-state 정본을 쓴다 (2026-08-07). 여기만 자체 맵을
//   갖고 있어서, 결제가 깨진 고객이 메일→웹("결제수단 재등록 필요")을 보고
//   앱을 열면("결제 확인 필요") 다른 문제인 줄 알았다. 결제 실패 메일의 CTA 가
//   규칙16 때문에 **의도적으로 웹**이라, 이 둘은 실제로 연달아 보인다.
//   색만 웹 시안(A23 — 구독 중 = 숲색, 결제 문제 = 빨강)으로 여기서 고른다.
const STATE_COLOR_WEB: Record<SubState, string> = {
  needs_card: '#B3261E',
  active: '#1D3B2F',
  paused: '#3D3D3D',
  card_failed: '#B3261E',
  cancelled: '#767676',
}


function formatKRW(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

/** yyyy-mm-dd → '10월 13일'. */
function kstMonthDay(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    // KST 고정 — 해외 기기(UTC 보다 늦은 시간대)에선 화요일 발송일이 월요일로 보였다.
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  })
}

/** yyyy-mm-dd → '10월 13일(화)' (KST). */
function kstMonthDayWd(iso: string): string {
  return `${kstMonthDay(iso)}(${weekdayKo(iso)})`
}

/**
 * 카드의 '다음 박스' 두 줄(큰 글씨 = 발송 · 작은 글씨 = 결제, 웹 시안 A23 2026-10-10) — 판정은 lib/shipping-schedule
 * describeUpcomingBox 정본(2026-10-01). 예전 한 줄 칩(scheduleChip)과 같은 판정·같은 말을 두 줄로 나눴다.
 * next_delivery_date 는 **발송일**이고, 결제일은 결제 시점으로 정한다(일반 = 조리 직전 토요일,
 * 서포터즈 체험 구간 = 발송일). 결제 시점을 모르면(chargeIso null) 결제 요일을 말하지 않는다.
 *  · in_progress — 결제됐고 아직 안 나간 박스. 정지 중이어도 결제된 박스는 나가므로 상태와 무관하게 말한다.
 *  · 정지 등 결제가 일어나지 않는 상태(live=false)면 다음 일정을 말하지 않는다 — 그 날짜는 다시 시작할 때의 기준일 뿐이다.
 *  · 지난 날짜를 "발송"이라 단정하지 않는다(2026-08-07) — 결제가 미끄러지면 날짜가 과거로 흘러간다.
 */
function scheduleLines(
  box: UpcomingBox | null,
  live: boolean,
  today: string,
): { label: string; main: string; sub: string | null } | null {
  if (!box) return null
  if (box.kind === 'in_progress') {
    return box.shipIso < today
      ? { label: '이번 박스', main: '발송 준비 중', sub: '결제 완료' }
      : { label: '이번 박스', main: `${kstMonthDayWd(box.shipIso)} 발송`, sub: '결제 완료' }
  }
  if (!live) return null
  if (box.kind === 'charge_check') return { label: '다음 박스', main: '결제 확인 중', sub: null }
  if (box.shipIso < today) return { label: '다음 박스', main: `${kstMonthDayWd(box.shipIso)} 예정`, sub: '확인 중' }
  if (!box.chargeIso) return { label: '다음 박스', main: `${kstMonthDayWd(box.shipIso)} 발송`, sub: null }
  if (box.chargeIso === box.shipIso) return { label: '다음 박스', main: `${kstMonthDayWd(box.shipIso)} 결제·발송`, sub: null }
  return { label: '다음 박스', main: `${kstMonthDayWd(box.shipIso)} 발송`, sub: `${kstMonthDayWd(box.chargeIso)} 결제` }
}

export default function SubscriptionsWebClient({
  initialSubs,
  focusSubId,
  priceProposal,
  isApp,
  trial = null,
  chargeTiming = null,
  paidPreparingSubIds = [],
  paidPreparingAt = {},
  paidStateUnknown = false,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [subs, setSubs] = useState<Subscription[]>(initialSubs)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cancelSubId, setCancelSubId] = useState<string | null>(null)
  // 화식 비율 변경 시트 (2026-07-31 신설) — 열려 있는 구독 id.
  const [ratioSubId, setRatioSubId] = useState<string | null>(null)

  // focus=id 진입 시 해당 카드로 스크롤 + 잠깐 하이라이트
  useEffect(() => {
    if (!focusSubId) return
    const el = document.getElementById(`sub-${focusSubId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const prev = el.style.boxShadow
    el.style.transition = 'box-shadow 0.25s ease-out'
    el.style.boxShadow = '0 0 0 2px var(--fd-coral), 0 0 0 5px var(--fd-offwhite)'
    const t = setTimeout(() => {
      el.style.boxShadow = prev
    }, 1800)
    return () => clearTimeout(t)
  }, [focusSubId])

  async function reload() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    // ★error 를 꺼낸다(규칙1) — 실패를 무시하면 액션 후 화면이 낡은 상태로
    //  남는데 사용자는 반영된 줄 안다(2026-08-08 diff 재검증).
    const { data, error: reloadErr } = await supabase
      .from('subscriptions')
      // ★`select('*')` 금지 (2026-08-08 보안 재감사) — 빌링키·서버 전용 칸이
      //  통째로 브라우저로 갔다. 카드 등록 여부는 has_billing_key 계산
      //  컬럼(20260808000100)으로 받는다.
      .select(
        'id, dog_id, status, interval_weeks, coverage_weeks, fresh_ratio, ' +
            'next_delivery_date, total_deliveries, ' +
            'total_amount, subtotal, shipping_fee, created_at, ' +
            'has_billing_key, billing_customer_key, billing_card_brand, ' +
            'billing_card_last4, failed_charge_count, next_retry_at, ' +
            'last_failed_charge_reason, requires_billing_key_renewal, reminder_enabled, ' +
            'subscription_items(*), dogs(id, name)',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    // has_billing_key 는 계산 컬럼이라 생성 타입에 없다(20260808000100).
    if (reloadErr) {
      toast.error('최신 상태를 불러오지 못했어요. 새로고침해 주세요.')
      return
    }
    if (data) setSubs(data as unknown as Subscription[])
  }

  async function requireUid(): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return null
    }
    return user.id
  }

  async function handlePause(subId: string, weeks?: 1 | 2 | 4) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) {
      setActionLoading(null)
      return
    }
    // 화면이 본 발송일 — 건너뛰기는 이 값이 DB 에서도 그대로일 때만 쓴다(아래 CAS).
    const seenNext = weeks
      ? (subs.find((s) => s.id === subId)?.next_delivery_date ?? null)
      : null
    const update: Record<string, unknown> = weeks
      ? (() => {
          // 선택한 주(週)만큼 미루기 — 화요일 보존(주 단위라 요일 불변). 기준이
          // 없으면 다음 화요일부터. weeks 를 nextCycleDate 에 반드시 넘긴다(안 넘기면
          // 항상 2주 폴백). 2026-07-18: 건너뛰기=**2주**로 앱과 통일(사장님) — 이전엔
          // 웹만 4주라 앱(2주)과 달랐고, 박스가 14일치라 4주 미루면 2주 굶었다.
          // 마감은 결제 시점별(서포터즈 체험 구간 일요일·일반 금요일 밤, 2026-10-02).
          const baseIso = seenNext ?? nextShipDate(undefined, chargeTiming ?? 'before_cooking')
          return { next_delivery_date: nextCycleDate(baseIso, weeks) }
        })()
      : { status: 'paused' }
    /**
     * ★건너뛰기는 화면이 본 날짜 그대로일 때만 (2026-09-26 출시 전 점검 6차).
     *   화면을 열어 둔 사이 09:10 청구가 그 박스를 결제하고 날짜를 +14 로 옮기면, 옛 날짜
     *   기준 계산이 사실상 같은 날짜를 다시 써서 "미뤘어요"라고 말하는데 박스는 결제·발송됐다.
     *   0행이면 최신 일정을 다시 불러 보여 준다.
     */
    if (weeks) {
      const q = supabase
        .from('subscriptions')
        .update({ next_delivery_date: update.next_delivery_date as string })
        .eq('id', subId)
        .eq('user_id', uid)
      const { data: moved, error: skipErr } = await (
        seenNext ? q.eq('next_delivery_date', seenNext) : q.is('next_delivery_date', null)
      ).select('id')
      if (skipErr) {
        toast.error('변경하지 못했어요. 잠시 후 다시 시도해 주세요')
        setActionLoading(null)
        return
      }
      if (!moved || moved.length === 0) {
        toast.info('배송 일정이 방금 바뀌었어요 — 최신 일정을 불러왔어요. 확인 후 다시 눌러 주세요.')
        await reload()
        setActionLoading(null)
        return
      }
      // ★잘못 눌렀으면 바로 되돌린다(2026-10-06 사장님) — 원래 회차 신청 마감 전일 때만(undoSkipTarget 정본).
      const movedTo = update.next_delivery_date as string
      const paidAt = paidPreparingAt[subId]
      const undoTo = paidStateUnknown ? null : undoSkipTarget({
        nextDeliveryDate: movedTo,
        today: todayKstIsoDate(),
        timing: chargeTiming,
        paidBoxShipIso: paidAt ? paidBoxShipIso(movedTo, paidAt) : null,
      })
      // 결제된 이번 박스는 그대로 나간다 — 미룬 건 그다음 박스다(앱 DogSubscriptionClient 와 같은 안내, 10차 E).
      toast.success(
        paidAt
          ? `이번 박스는 그대로 보내드리고, 그다음 박스를 ${weeks}주 미뤘어요.`
          : `다음 배송을 ${weeks}주 미뤘어요.`,
        undoTo
          ? { duration: 8000, action: { label: '되돌리기', onClick: () => void handleUndoSkip(subId, movedTo, undoTo) } }
          : undefined,
      )
      await reload()
      setActionLoading(null)
      return
    }
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ error: unknown }>
          }
        }
      }
    })
      .from('subscriptions')
      .update(update)
      .eq('id', subId)
      .eq('user_id', uid)
    if (error) {
      toast.error('변경하지 못했어요. 잠시 후 다시 시도해 주세요')
      setActionLoading(null)
      return
    }
    if (!weeks) {
      trackSubscriptionPaused({ subscriptionId: subId, reason: 'user_action' })
    } else {
      toast.success(
        `다음 배송을 ${weeks}주 미뤘어요.`,
      )
    }
    await reload()
    setActionLoading(null)
  }

  /**
   * 미루기 되돌리기(2주 앞당기기, 2026-10-06) — 목적지는 undoSkipTarget 이 정한 날짜만. 화면이 본 날짜(fromIso)가
   * DB 에서도 그대로일 때만 옮긴다(건너뛰기와 같은 CAS) — 그 사이 결제·변경이 있었으면 최신 일정을 다시 보여준다.
   */
  async function handleUndoSkip(subId: string, fromIso: string, toIso: string) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) {
      setActionLoading(null)
      return
    }
    // ★누른 순간 다시 판정한다(10차 점검 B·D) — 버튼은 화면을 연 시각 기준이라, 금요일에 열어 둔 화면으로
    //   토요일에 누르면 조리 합계에서 빠진 박스가 되살아났다. 앱(DogSubscriptionClient undoSkip)과 같은 처리.
    const paidAtNow = paidPreparingAt[subId]
    const stillTo = paidStateUnknown ? null : undoSkipTarget({
      nextDeliveryDate: fromIso,
      today: todayKstIsoDate(),
      timing: chargeTiming,
      paidBoxShipIso: paidAtNow ? paidBoxShipIso(fromIso, paidAtNow) : null,
    })
    if (stillTo !== toIso) {
      toast.info('신청 마감이 지나 이 박스는 되돌릴 수 없어요. 사정이 있으시면 1:1 문의로 알려 주세요.')
      await reload()
      setActionLoading(null)
      return
    }
    const { data: moved, error } = await supabase
      .from('subscriptions')
      .update({ next_delivery_date: toIso })
      .eq('id', subId)
      .eq('user_id', uid)
      .eq('next_delivery_date', fromIso)
      .select('id')
    if (error) {
      toast.error('변경하지 못했어요. 잠시 후 다시 시도해 주세요')
    } else if (!moved || moved.length === 0) {
      toast.info('배송 일정이 방금 바뀌었어요 — 최신 일정을 불러왔어요. 확인 후 다시 눌러 주세요.')
    } else {
      toast.success(`${kstMonthDay(toIso)} 발송으로 되돌렸어요.`)
    }
    await reload()
    setActionLoading(null)
  }

  async function handleResume(subId: string) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) {
      setActionLoading(null)
      return
    }
    const sub = subs.find((s) => s.id === subId)
    if (!sub) {
      setActionLoading(null)
      return
    }
    if (sub.requires_billing_key_renewal) {
      toast.info(
        '결제수단 재등록이 필요해요. 다시 등록하면 자동으로 다시 시작돼요.',
      )
      setActionLoading(null)
      return
    }
    // 등록 여부는 **billing_key** 로 본다. 카드번호(last4)로 판정하면 토스페이로
    // 등록한 고객은 카드번호가 없어서 영원히 '미등록'이 되고, 재개를 누를 때마다
    // 등록 화면으로 돌려보내진다 (2026-07-30 토스페이 추가 시 발견).
    if (!sub.has_billing_key) {
      toast.info('결제수단 등록이 필요해요. 등록하면 정기배송이 시작돼요.')
      const customerKey = sub.billing_customer_key ?? generateFallbackCustomerKey()
      router.push(
        `/subscribe/billing-auth?subscriptionId=${sub.id}&customerKey=${encodeURIComponent(customerKey)}`,
      )
      setActionLoading(null)
      return
    }
    // 재개하면 **다음 화요일**부터 (2026-07-16). 주기는 2주 하나로 고정 —
    // 박스가 14일치라 다른 주기는 성립하지 않는다.
    // 아직 오지 않은 원래 배송일은 그대로 — 앞당기면 한 주 만에 또 결제된다(2026-09-28).
    const nextIso = resumeShipDate(sub.next_delivery_date, undefined, chargeTiming ?? 'before_cooking')
    // ★본 상태 그대로일 때만(11차 점검 A#10) — 옛 화면의 날짜로 계산해 덮어쓰면 결제된 박스 1주 뒤로 앞당겨질 수 있었다.
    const resumeQ = supabase
      .from('subscriptions')
      .update({ status: 'active', next_delivery_date: nextIso })
      .eq('id', subId)
      .eq('user_id', uid)
      .eq('status', 'paused')
    const { data: resumed, error } = await (
      sub.next_delivery_date ? resumeQ.eq('next_delivery_date', sub.next_delivery_date) : resumeQ.is('next_delivery_date', null)
    ).select('id')
    if (error) {
      toast.error('다시 시작하지 못했어요. 잠시 후 다시 시도해 주세요')
      setActionLoading(null)
      return
    }
    if (!resumed || resumed.length === 0) {
      toast.info('정기배송 상태가 방금 바뀌었어요 — 최신 상태를 불러왔어요. 확인 후 다시 눌러 주세요.')
      await reload()
      setActionLoading(null)
      return
    }
    trackSubscriptionResumed({ subscriptionId: subId })
    await reload()
    setActionLoading(null)
  }

  async function performCancel(subId: string) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) {
      setActionLoading(null)
      return
    }
    const sub = subs.find((s) => s.id === subId)
    const { error } = await (supabase as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ error: unknown }>
          }
        }
      }
    })
      .from('subscriptions')
      .update({ status: 'cancelled', next_delivery_date: null })
      .eq('id', subId)
      .eq('user_id', uid)
    if (error) {
      toast.error('해지하지 못했어요. 잠시 후 다시 시도해 주세요')
      setActionLoading(null)
      return
    }
    trackSubscriptionCancelled({
      subscriptionId: subId,
      totalDeliveries: sub?.total_deliveries ?? 0,
    })
    setCancelSubId(null)
    await reload()
    setActionLoading(null)
  }

  async function handleToggleReminder(subId: string, enabled: boolean) {
    const uid = await requireUid()
    if (!uid) return
    const { error } = await supabase
      .from('subscriptions')
      .update({ reminder_enabled: enabled })
      .eq('id', subId)
      .eq('user_id', uid)
    if (error) toast.error('알림 설정을 변경하지 못했어요')
    await reload()
  }

  function handleReRegisterCard(sub: Subscription) {
    const customerKey = sub.billing_customer_key ?? generateFallbackCustomerKey()
    router.push(
      `/subscribe/billing-auth?subscriptionId=${encodeURIComponent(
        sub.id,
      )}&customerKey=${encodeURIComponent(customerKey)}`,
    )
  }

  // '결제 완료·진행중인 것만' 노출 — 카드도 안 걸고 해지된 유령 구독("0회 배송
  // 후 해지")은 숨긴다(사장님 2026-07-22). 판정은 subscription-state 정본.
  //
  // ★needs_card 는 숨기지 않는다(2026-08-05). 앱 화면은 2026-07-30 에 사장님
  //   제보로 이미 고쳤는데 **웹만 그대로였다** — 같은 규칙이 두 곳에 따로 있으면
  //   갈라진다는 이 저장소의 고질병이 또 나왔다.
  //   웹에서 생기던 일: 신청 후 토스 창을 닫으면 구독 행은 needs_card 로 남는데,
  //   /account/dogs 는 그걸 "구독 중"으로 세어 카드 링크를 "정기배송 관리"로
  //   바꾼다(신청 링크는 사라진다). 그런데 그 관리 화면이 needs_card 를 숨겨
  //   "아직 정기배송이 없어요" → 유일한 CTA 가 다시 /account/dogs.
  //   **완전한 순환**이고, 아래 '결제수단 등록하고 시작하기' 버튼은 정작 그게
  //   필요한 사람에게만 안 보이는 죽은 코드였다. 탈출구는 하루 1회 도는 정리
  //   크론뿐이라 최대 ~24시간 갇혔다.
  //   숨겨야 할 건 '유령'(cancelled + 0회)이지, 고객이 조치할 게 남은 구독이 아니다.
  const visibleSubs = subs.filter(
    (x) => isSubscriptionVisibleToUser(x) || subscriptionState(x) === 'needs_card',
  )

  if (visibleSubs.length === 0) {
    return (
      <div style={{ padding: '28px 20px', borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        <strong style={{ fontSize: 20, fontWeight: 800 }}>아직 정기배송이 없어요</strong>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: '#3D3D3D' }}>
          {isApp ? '우리 아이 맞춤 식단을 설계하고 정기배송을 시작해 보세요.' : '맞춤 정기배송은 앱에서 시작할 수 있어요. 웹에서는 레시피를 하나씩 살 수 있어요.'}
        </p>
        {/*
          ★로그인 상태(이 페이지는 auth 필수)라 비로그인 설문 퍼널 /start(→가입)로 보내면 안 됨(사장님 2026-07-23).
          앱은 우리 아이 허브 /dogs. 웹은 2026-10-10 웹 리뉴얼(기획서 D1)로 정기배송 신청이 앱으로 옮겨 갔다 → 앱 소개(/app).
          (/dogs 는 앱 전용 — 웹에서 누르면 앱 설치 안내로 튕긴다, 2026-07-31.)
        */}
        <Link
          href={isApp ? '/dogs' : '/app'}
          style={{
            marginTop: 8,
            height: 52,
            padding: '0 18px',
            borderRadius: 4,
            background: '#141414',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 17,
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          {isApp ? '우리 아이 식단 시작하기' : '앱에서 정기배송 시작하기'}
          <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
        </Link>
      </div>
    )
  }

  // 모양 = 웹 시안 WEB-A23(2026-10-10 웹 리뉴얼) — 먹색 2px 테 카드 · 상태 네모 · 다음 박스 큰 글씨 · 레시피 띠 썸네일 ·
  //   회색 띠(주기·금액) · 배송 전 알림 스위치 · 2열 버튼. 판정·동작은 그대로(위 핸들러들).
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {priceProposal && <PriceChangeConsentModal proposal={priceProposal} />}
      {visibleSubs.map((sub) => {
        const state = subscriptionState(sub)
        const box = describeUpcomingBox({
          nextDeliveryDate: sub.next_delivery_date,
          timing: chargeTiming,
          hasPaidPreparingOrder: paidPreparingSubIds.includes(sub.id),
          paidAt: paidPreparingAt[sub.id] ?? null,
          today: todayKstIsoDate(),
        })
        // 미룬 회차 되돌리기 목적지 — 원래 회차 신청 마감 전·결제된 박스와 안 겹칠 때만(undoSkipTarget, 2026-10-06).
        const subPaidAt = paidPreparingAt[sub.id]
        const undoTo =
          state === 'active' && !paidStateUnknown
            ? undoSkipTarget({
                nextDeliveryDate: sub.next_delivery_date,
                today: todayKstIsoDate(),
                timing: chargeTiming,
                paidBoxShipIso: subPaidAt ? paidBoxShipIso(sub.next_delivery_date, subPaidAt) : null,
              })
            : null
        const status = {
          label: SUB_STATE_LABEL[state],
          color: STATE_COLOR_WEB[state],
        }
        const isActive = state === 'active'
        const isPaused = state === 'paused'
        const isCancelled = state === 'cancelled'
        const needsCard = state === 'needs_card'
        const needsRenewal = sub.requires_billing_key_renewal === true
        const hasFailureSignal =
          !isCancelled &&
          (needsRenewal || (sub.failed_charge_count ?? 0) > 0 || !!sub.next_retry_at)
        const isLoading = actionLoading === sub.id
        const lines = isCancelled ? null : scheduleLines(box, isActive || state === 'card_failed', todayKstIsoDate())
        const tp = trialPricing(trial, sub.total_amount)

        return (
          <article
            key={sub.id}
            id={`sub-${sub.id}`}
            aria-label={sub.dogs ? `${sub.dogs.name} 정기배송` : '정기배송'}
            style={{
              border: `2px solid ${needsRenewal ? '#B3261E' : '#141414'}`,
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              opacity: isCancelled ? 0.6 : 1,
            }}
          >
            {/* 상태 · 아이 · 화식 비율 */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E5E5', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 16, fontWeight: 800, color: status.color }}>
                <span aria-hidden style={{ width: 10, height: 10, background: status.color }} />
                {status.label}
              </span>
              {sub.dogs && <span style={CHIP}>{sub.dogs.name}</span>}
              {sub.coverage_weeks && <span style={{ ...CHIP, fontWeight: 700, color: '#3D3D3D' }}>{freshTierLabel(sub.fresh_ratio)}</span>}
            </div>

            {/* 결제 실패 / 카드 재등록 */}
            {hasFailureSignal && (
              <div role="alert" style={{ padding: '14px 16px', borderBottom: '1px solid #E5E5E5', background: '#FDECEA', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontSize: 17, fontWeight: 800, color: '#8A1F11' }}>
                  {needsRenewal
                    ? '결제수단을 다시 등록해 주세요'
                    : sub.next_retry_at
                      ? '결제가 일시 실패했어요'
                      : `결제 ${sub.failed_charge_count}회 실패`}
                </strong>
                {sub.last_failed_charge_reason && <span style={{ fontSize: 15, color: '#3D3D3D' }}>{sub.last_failed_charge_reason}</span>}
                {sub.next_retry_at && !needsRenewal && <span style={{ fontSize: 15, color: '#3D3D3D' }}>{formatRetryAt(sub.next_retry_at)} 재시도 예정</span>}
                <button
                  type="button"
                  onClick={() => handleReRegisterCard(sub)}
                  style={{ ...BTN, marginTop: 6, alignSelf: 'flex-start', padding: '0 14px', border: 0, background: '#141414', color: '#FFFFFF' }}
                >
                  <CreditCard className="w-4 h-4" strokeWidth={2.2} />
                  결제 카드 재등록
                </button>
              </div>
            )}

            {/* 다음 박스 — 판정은 describeUpcomingBox 정본(scheduleLines) */}
            {lines && (
              <div style={{ padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 15, color: '#595959' }}>{lines.label}</span>
                <span className="d" style={{ fontSize: 28, lineHeight: 1.1 }}>
                  {lines.main}
                </span>
                {lines.sub && <span style={{ fontSize: 16, color: '#3D3D3D' }}>{lines.sub}</span>}
              </div>
            )}

            {/* 상품 라인 — 썸네일 위 레시피 띠(웹 레시피 색) */}
            <ul style={{ margin: 0, padding: '0 16px', listStyle: 'none', borderTop: lines ? '1px solid #E5E5E5' : 0, display: 'flex', flexDirection: 'column' }}>
              {sub.subscription_items.map((it, idx) => {
                const line = pouchLineFromName(it.product_name)
                return (
                  <li
                    key={idx}
                    style={{
                      padding: '12px 0',
                      borderBottom: idx < sub.subscription_items.length - 1 ? '1px solid #E5E5E5' : 0,
                      display: 'grid',
                      gridTemplateColumns: '52px 1fr',
                      columnGap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ position: 'relative', width: 52, height: 52, borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}>
                      {it.product_image_url ? (
                        <Image src={it.product_image_url} alt="" fill sizes="52px" style={{ objectFit: 'cover' }} />
                      ) : (
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Soup className="w-5 h-5" strokeWidth={1.5} color="#8A8A8A" />
                        </span>
                      )}
                      {line && <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: RECIPE_BAND[line] }} />}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 17, fontWeight: 800 }}>{it.product_name}</span>
                      <span style={{ fontSize: 15, color: '#595959' }}>
                        {formatKRW(it.unit_price)} · {it.quantity}개
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>

            {/* 주기 · 금액(체험단이면 체험가 — 청구와 같은 판정) */}
            <div style={{ padding: '12px 16px', background: '#F6F4F5', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 16, color: '#595959' }}>
                배송 주기 <strong style={{ color: '#141414', fontWeight: 800 }}>2주마다</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                {tp && <span style={{ fontSize: 15, color: '#767676', textDecoration: 'line-through' }}>{formatKRW(sub.total_amount)}</span>}
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span className="n" style={{ fontSize: 26 }}>
                    {(tp ? tp.chargeAmount : sub.total_amount).toLocaleString('ko-KR')}
                  </span>
                  <span className="d" style={{ fontSize: 16 }}>
                    원
                  </span>
                </span>
              </span>
            </div>

            {/* 배송 주기 변경 패널 제거 (2026-07-16) — 박스는 14일치 고정이라 매주로 바꾸면 음식이 두 배로 오고,
                4주로 바꾸면 2주 뒤에 굶는다. 옛 낱개 커머스 모델의 잔재. */}
            {/* 배송 전 알림 */}
            {!isCancelled && (
              <div style={{ minHeight: 60, padding: '0 16px', borderTop: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span id={`reminder-${sub.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
                  {sub.reminder_enabled ? <Bell className="w-4 h-4" strokeWidth={2} /> : <BellOff className="w-4 h-4" strokeWidth={2} color="#767676" />}
                  배송 전 알림
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sub.reminder_enabled}
                  aria-labelledby={`reminder-${sub.id}`}
                  onClick={() => handleToggleReminder(sub.id, !sub.reminder_enabled)}
                  style={{
                    width: 64,
                    height: 36,
                    padding: 3,
                    boxSizing: 'border-box',
                    border: 0,
                    borderRadius: 18,
                    background: sub.reminder_enabled ? '#141414' : '#BDBDBD',
                    display: 'flex',
                    justifyContent: sub.reminder_enabled ? 'flex-end' : 'flex-start',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 15, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </button>
              </div>
            )}

            {/* 동작 — 2열 */}
            {!isCancelled && (
              <div style={{ padding: '12px 16px 16px', borderTop: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {needsCard && (
                  <button
                    type="button"
                    onClick={() => handleReRegisterCard(sub)}
                    style={{ ...BTN, gridColumn: '1 / -1', border: 0, background: '#141414', color: '#FFFFFF' }}
                  >
                    결제수단 등록하고 시작하기
                  </button>
                )}
                {isActive && (
                  <button type="button" disabled={isLoading} onClick={() => handlePause(sub.id)} style={{ ...BTN, opacity: isLoading ? 0.5 : 1 }}>
                    <Pause className="w-4 h-4" strokeWidth={2} />
                    일시정지
                  </button>
                )}
                {isPaused && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleResume(sub.id)}
                    style={{ ...BTN, border: 0, background: '#141414', color: '#FFFFFF', opacity: isLoading ? 0.5 : 1 }}
                  >
                    <Play className="w-4 h-4" strokeWidth={2} />
                    다시 시작
                  </button>
                )}
                {/* 화식 비율 변경 (2026-07-31 신설) — 예전엔 신청할 때 고른 값을 영영 못 바꿔서, 올리고 싶은 사람도
                    낮추고 싶은 사람도 '해지 후 재신청' 말고는 길이 없었다(실제로는 그냥 해지로 끝난다). */}
                <button type="button" disabled={isLoading} onClick={() => setRatioSubId(sub.id)} style={{ ...BTN, opacity: isLoading ? 0.5 : 1 }}>
                  화식 비율
                </button>
                {/* 미룬 박스 되돌리기(2026-10-06) — 실수로 미뤄도 원래 회차 마감 전이면 스스로 되돌린다. */}
                {isActive && undoTo && sub.next_delivery_date && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleUndoSkip(sub.id, sub.next_delivery_date!, undoTo)}
                    style={{ ...BTN, gridColumn: '1 / -1', opacity: isLoading ? 0.5 : 1 }}
                  >
                    <Undo2 className="w-4 h-4" strokeWidth={2} />
                    미룬 박스 되돌리기 · {kstMonthDay(undoTo)} 발송
                  </button>
                )}
                {/* ★ 정상 구독에도 결제수단 교체 (2026-07-30). 예전엔 카드 미등록·실패 상태에서만 이 버튼이 떴다 —
                    **카드가 잘 걸린 사람은 카드를 바꿀 방법이 없었다.** */}
                {isActive && (
                  <button type="button" disabled={isLoading} onClick={() => handleReRegisterCard(sub)} style={{ ...BTN, opacity: isLoading ? 0.5 : 1 }}>
                    <CreditCard className="w-4 h-4" strokeWidth={2} />
                    결제수단 바꾸기
                  </button>
                )}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setCancelSubId(sub.id)}
                  style={{
                    ...BTN,
                    border: 0,
                    background: 'transparent',
                    color: '#595959',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  해지
                </button>
              </div>
            )}
          </article>
        )
      })}

      {/* 화식 비율 변경 — 금액이 함께 바뀌므로 시트가 세 티어 금액을 다 보여준다.
          계산·저장은 전부 서버(/api/subscriptions/[id]/fresh-ratio). */}
      {ratioSubId && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 16px', background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setRatioSubId(null)}
        >
          <div style={{ width: '100%', maxWidth: 448, borderRadius: 4, padding: 20, background: '#FFFFFF' }} onClick={(e) => e.stopPropagation()}>
            <FreshRatioSheet
              subscriptionId={ratioSubId}
              onClose={() => setRatioSubId(null)}
              onChanged={() => {
                toast.success('화식 비율을 바꿨어요')
                void reload()
              }}
            />
          </div>
        </div>
      )}

      {/* 해지 확인 */}
      {cancelSubId && (
        <CancelModal
          paidBoxShipIso={(() => {
            const s = subs.find((x) => x.id === cancelSubId)
            const b = s
              ? describeUpcomingBox({
                  nextDeliveryDate: s.next_delivery_date,
                  timing: chargeTiming,
                  hasPaidPreparingOrder: paidPreparingSubIds.includes(s.id),
                  paidAt: paidPreparingAt[s.id] ?? null,
                  today: todayKstIsoDate(),
                })
              : null
            return b?.kind === 'in_progress' ? b.shipIso : null
          })()}
          loading={actionLoading === cancelSubId}
          onClose={() => setCancelSubId(null)}
          onConfirm={() => void performCancel(cancelSubId)}
          onPauseInstead={() => {
            const id = cancelSubId
            setCancelSubId(null)
            void handlePause(id)
          }}
          onSkipInstead={() => {
            const id = cancelSubId
            setCancelSubId(null)
            void handlePause(id, 2)
          }}
        />
      )}
    </div>
  )
}

/** 동작 버튼(시안 A23) — 높이 48 · 먹색 1.5px 테 · 모서리 4. */
const BTN: React.CSSProperties = {
  height: 48,
  boxSizing: 'border-box',
  borderRadius: 4,
  border: '1.5px solid #141414',
  background: '#FFFFFF',
  color: '#141414',
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  cursor: 'pointer',
}

/** 머리 칩(아이 이름·화식 비율) — 회색 면 · 높이 28. */
const CHIP: React.CSSProperties = {
  height: 28,
  padding: '0 10px',
  borderRadius: 4,
  background: '#F6F4F5',
  fontSize: 15,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
}

function CancelModal({
  paidBoxShipIso,
  loading,
  onClose,
  onConfirm,
  onPauseInstead,
  onSkipInstead,
}: {
  /** 결제됐고 아직 안 나간 박스의 발송일 — 없으면(또는 모르면) null. */
  paidBoxShipIso: string | null
  loading: boolean
  onClose: () => void
  onConfirm: () => void
  onPauseInstead: () => void
  onSkipInstead: () => void
}) {
  // 파괴적 다이얼로그 a11y — Esc·포커스 트랩·스크롤 락·포커스 복귀(2026-07-17).
  const panelRef = useRef<HTMLDivElement>(null)
  useModalA11y({ open: true, onClose, containerRef: panelRef })
  const row: React.CSSProperties = {
    minHeight: 64,
    padding: '10px 14px',
    boxSizing: 'border-box',
    borderRadius: 4,
    border: '1.5px solid #141414',
    background: '#FFFFFF',
    fontFamily: 'inherit',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    cursor: 'pointer',
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="정기배송 해지"
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(20,20,20,0.4)' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        style={{ width: '100%', maxWidth: 480, boxSizing: 'border-box', borderRadius: '12px 12px 0 0', padding: '24px 20px calc(20px + env(safe-area-inset-bottom))', background: '#FFFFFF' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <strong className="d" style={{ fontSize: 26, fontWeight: 400, lineHeight: 1.2 }}>
            정기배송을 해지할까요?
          </strong>
          <button type="button" onClick={onClose} aria-label="닫기" style={{ width: 44, height: 44, margin: '-8px -8px 0 0', border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X className="w-5 h-5" strokeWidth={2.2} color="#141414" />
          </button>
        </div>
        {/* ★결제된 박스는 그대로 나간다(사장님 2026-10-01) — 일반 고객은 발송 3일 전 토요일에 결제되므로
            토~화 사이에 해지하면 그 박스는 이미 결제·조리 중이다. "다음 배송이 진행되지 않아요"는 그때 거짓이었다.
            결제된 박스를 모르면(조회 실패 포함) 두 경우 모두 참인 문장으로 말한다. */}
        <p style={{ margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>
          {paidBoxShipIso
            ? `이미 결제된 박스는 ${kstMonthDay(paidBoxShipIso)}에 그대로 보내드리고, 그다음 박스부터 결제와 배송이 멈춰요.`
            : '해지하면 다음 결제부터 결제와 배송이 멈춰요. 이미 결제된 박스가 있다면 그대로 보내드려요.'}{' '}
          잠시 쉬어가는 거라면 일시정지나 2주 미루기를 추천드려요.
        </p>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onSkipInstead} disabled={loading} style={{ ...row, opacity: loading ? 0.5 : 1 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 앱은 '2주 미루기' 였다 — 같은 동작을 두 이름으로 부르고 있어 FAQ 도 어느 쪽을 따라야 할지 갈렸다(2026-07-30 통일). */}
              <span style={{ fontSize: 17, fontWeight: 800, color: '#141414' }}>2주 미루기</span>
              <span style={{ fontSize: 15, color: '#595959' }}>
                {paidBoxShipIso ? '결제된 박스는 그대로 보내고, 그다음 박스만 미뤄요' : '다음 배송만 미루고 정기배송은 유지'}
              </span>
            </span>
            <ChevronRight className="w-4 h-4" strokeWidth={2.2} color="#141414" />
          </button>
          <button type="button" onClick={onPauseInstead} disabled={loading} style={{ ...row, opacity: loading ? 0.5 : 1 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#141414' }}>일시정지</span>
              <span style={{ fontSize: 15, color: '#595959' }}>원하실 때 다시 시작할 수 있어요</span>
            </span>
            <ChevronRight className="w-4 h-4" strokeWidth={2.2} color="#141414" />
          </button>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          style={{
            marginTop: 14,
            width: '100%',
            height: 52,
            borderRadius: 4,
            border: '1.5px solid #B3261E',
            background: '#FFFFFF',
            color: '#B3261E',
            fontFamily: 'inherit',
            fontSize: 17,
            fontWeight: 800,
            cursor: 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? '해지하는 중…' : '네, 해지할게요'}
        </button>
      </div>
    </div>
  )
}
