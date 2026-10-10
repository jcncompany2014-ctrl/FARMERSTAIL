'use client'

/**
 * DogSubscriptionClient — 강아지 '구독' 탭 (앱 전용, 2026-07-16 전면 재작성).
 *
 * # 왜 새로 썼나 (사장님 "구독 관리 페이지 그냥 개구려 전부 제대로 리뉴얼해")
 * 이전엔 마이페이지(웹)용 SubscriptionsClient 를 dogId 스코프로 재사용했다.
 * 그러다 보니 이 화면에 웹 커머스 시절의 물건이 그대로 들어와 있었다:
 *  · **배송 주기 변경(매주 / 2주마다 / 4주마다)** — 우리 박스는 **14일치 고정**이다.
 *    매주로 바꾸면 음식이 두 배로 오고, 4주로 바꾸면 2주 뒤에 굶는다. 옛 낱개
 *    커머스 모델의 잔재라 통째로 뺐다(interval_weeks 는 2 하드코딩).
 *  · **카드도 등록 안 한 구독에 일시정지·건너뛰기 버튼**을 줬다. 시작도 안 한 걸
 *    멈출 수는 없다. 실제로 그래서 카드 없는 구독이 paused + 엉뚱한 배송일을
 *    갖게 됐다(2026-07-15 사장님 계정 실측).
 *
 * # 이 화면의 규칙
 * 상태마다 **할 수 있는 것만** 보여준다. 상태는 lib/subscription-state 가 판정.
 *  · needs_card   → 카드 등록 하나만. 나머지 액션 없음.
 *  · active       → 건너뛰기 · 일시정지 · **화식 비율** · 결제수단 교체 · 해지
 *                   (화식 비율은 2026-07-31 신설 — 이 파일 위쪽 역할 설명이
 *                    "건너뛰기·일시정지·해지·화식비율·결제수단 등록" 이라고
 *                    적고 있었는데 화식비율만 실물이 없었다. 웹 화면과 **같은
 *                    컴포넌트·같은 API** 를 쓴다: 금액을 보여주는 곳이 둘이 되면
 *                    갈라진다.)
 *  · paused       → 재개 · 해지
 *  · card_failed  → 카드 재등록 (배너)
 *  · cancelled    → 다시 시작
 *
 * # 날짜
 * 배송일은 전부 화요일이다(lib/shipping-schedule). 건너뛰기·재개가 날짜를 새로
 * 잡을 때 반드시 nextShipDate/nextCycleDate 를 쓴다 — 예전엔 '오늘 + 14일' 이라
 * 오늘이 목요일이면 배송일이 목요일이 됐다.
 *
 * # 2026-10-09 앱 새 디자인('A 포스터', 캔버스 AppSub · S01~S10)
 * 모양만 시안대로 바꿨다. 미루기·되돌리기(본 날짜 그대로일 때만 옮기는 CAS)·일시정지·재개·해지·카드 등록·
 * 화식 비율의 저장 로직과 판정은 한 줄도 바꾸지 않았다. 함께 들어간 결정(앱시안_결정할것.md):
 *  · 함께한 박스 → "함께한 지 N주째예요"(1번 확정 — 몇 번째 박스 대신). 박스 하나 = 2주치.
 *  · 해지 확인창은 "그냥 둘게요"를 진하게, "해지하기"는 빨간 테두리(13번).
 *  · 해지한 사람에겐 "지금은 쉬는 중이에요"(15번).
 *  · 일시정지·다시 시작에도 확인창(3번 '동작' — 예전엔 누르는 즉시 바뀌고 토스트만 떴다).
 *  · 금액 카드 색 = 박스 레시피 파우치 색(lib/design/pouch — 홈 '다음 정기배송' 카드와 같은 규칙).
 *  · 서포터즈 할인은 "서포터즈 혜택으로 N원 할인"(3번 '문구' — 할인 이름에 결제 금액이 섞여 헷갈렸다).
 *  · 결제 없이 해지된 신청서(카드 등록을 못 마쳐 자동 정리된 것)는 '지난 정기배송'에 띄우지 않는다
 *    (isSubscriptionVisibleToUser — 사장님 2026-07-22 "결제 완료·진행중인 것만", 정기배송 탭과 같은 기준).
 */

import { useId, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { trialPricing, type TrialState } from '@/lib/payments/trial'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import FreshRatioSheet from '@/components/subscription/FreshRatioSheet'
import DogPawMark from '@/components/DogPawMark'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { petName, iGa, waGwa } from '@/lib/korean'
import {
  nextShipDate,
  nextCycleDate,
  weekdayKo,
  resumeShipDate,
  chargeDateFor,
  paidBoxShipIso,
  undoSkipTarget,
  leadDaysFor,
  CHARGE_BEFORE_SHIP_DAYS,
  STOP_TIMING_COPY,
  type ChargeTiming,
} from '@/lib/shipping-schedule'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import {
  subscriptionState,
  isSubscriptionVisibleToUser,
  SUB_STATE_LABEL,
  type SubLike,
  type SubState,
} from '@/lib/subscription-state'
import {
  trackSubscriptionPaused,
  trackSubscriptionResumed,
  trackSubscriptionCancelled,
} from '@/lib/analytics'
import { generateFallbackCustomerKey } from '@/lib/v3-helpers/subscriptions'
import { billingMethodSummary } from '@/lib/payments/billing-methods'
import { V3 } from '@/lib/design/tokens'
import { RECIPE_COLOR } from '@/components/analysis/display'
import { boxRecipes, boxCardColors, boxCardFrame } from '@/lib/design/pouch'
import './subscription.css'
import { todayKstIsoDate, addDaysKst, kstDateOf } from '@/lib/datetime-kst'

export type DogSub = SubLike & {
  id: string
  interval_weeks: number
  total_deliveries: number
  total_amount: number
  fresh_ratio: number | null
  recipient_name: string | null
  address: string | null
  address_detail: string | null
  /** 등록 여부 정본. 카드번호(last4)는 토스페이 등록 시 안 온다. */
  has_billing_key: boolean
  billing_card_brand: string | null
  billing_card_last4: string | null
  billing_customer_key: string | null
  last_failed_charge_reason: string | null
  created_at: string
  subscription_items: { product_name: string; quantity: number }[]
}

/** 다음 결제 미리보기 — 서버가 청구와 같은 resolveAutoDiscount 로 계산(이벤트·이웃·등급·서포터즈 전부). */
export type ChargePreview = {
  chargeAmount: number
  label: string | null
  /** 할인 종류(trial_cheap·trial_half = 서포터즈). 없으면 서포터즈 판정으로 대신한다. */
  reason?: string | null
}

/** yyyy-mm-dd → "8월 4일 (화)". */
function dateLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일 (${weekdayKo(iso)})`
}

function krw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export default function DogSubscriptionClient({
  initialSubs,
  dogName,
  dogPhoto = null,
  startHref,
  trial = null,
  chargeTiming = null,
  inProgress = {},
  inProgressPaidAt = {},
  inTransit = {},
  paidStateUnknown = false,
  chargePreview = null,
}: {
  initialSubs: DogSub[]
  dogName: string
  dogPhoto?: string | null
  startHref: string
  /** 결제 시점(lib/shipping-schedule chargeTimingFor) — 서포터즈 체험 구간이면 발송일, 아니면 조리 직전 토요일. 모르면 null. */
  chargeTiming?: ChargeTiming | null
  /** 구독별 '결제됐지만 아직 안 나간 박스' 여부 — 박스 여정이 이번 박스를 보여준다. */
  inProgress?: Record<string, boolean>
  /** 그 박스의 결제 시각 — 이번 박스 발송일 정본(paidBoxShipIso). 결제 뒤 미루기에도 발송일이 맞다. */
  inProgressPaidAt?: Record<string, string>
  /** 보냈지만 아직 도착 전인 박스(배송 중 주문)가 있는 구독 — '받은 박스' 수에서 뺀다. */
  inTransit?: Record<string, boolean>
  /** 결제된 박스 조회 실패 — 시트 문구를 둘 다 참인 말로(10차 점검 D). */
  paidStateUnknown?: boolean
  /** 체험단 가격표 — 있으면 금액 표시가 체험가로 바뀐다 (청구와 같은 판정) */
  trial?: TrialState | null
  /** 구독별 다음 결제액(서버가 청구와 같은 resolveAutoDiscount 로 계산 — 이벤트·이웃·등급·서포터즈 전부) */
  chargePreview?: Record<string, ChargePreview> | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [subs, setSubs] = useState<DogSub[]>(initialSubs)
  const [busy, setBusy] = useState<string | null>(null)
  // 미루기·되돌리기 동시 실행 잠금 — 토스트 [되돌리기] 콜백은 렌더 당시 busy 를 보므로 ref 로 막는다(10차 D).
  const moveLockRef = useRef(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  // '2주 미루기' 확인 시트 — 한 번 누르면 바로 밀리던 것(2026-10-06 사장님 "실수로 건너뛰기해 버리면 할 수 있는 게 없더라").
  const [skipId, setSkipId] = useState<string | null>(null)
  // 일시정지·다시 시작 확인 시트(2026-10-09 앱시안 결정 3번 '동작') — 예전엔 누르는 즉시 바뀌고 토스트만 떴다.
  const [pauseId, setPauseId] = useState<string | null>(null)
  const [resumeId, setResumeId] = useState<string | null>(null)
  // 화식 비율 변경 (2026-07-31) — 이 화면 docstring 이 역할에 '화식비율' 을
  // 적어 두고도 실물이 없었다. 웹(/account/subscriptions)과 **같은 시트·같은 API**.
  const [ratioId, setRatioId] = useState<string | null>(null)

  const name = petName(dogName)
  // 해지된 것만 남았으면 '다시 시작' 안내가 주인공 — 살아있는 구독만 위로.
  const live = subs.filter((s) => s.status !== 'cancelled')
  // 지난 정기배송 — 결제 한 번 없이 해지된 신청서(카드 등록을 못 마쳐 자동 정리된 것)는 빼고(isSubscriptionVisibleToUser).
  const past = subs.filter((s) => s.status === 'cancelled' && isSubscriptionVisibleToUser(s))

  async function uid(): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return null
    }
    return user.id
  }

  /**
   * 건너뛰기 전용 — 화면이 본 발송일이 DB 에서도 그대로일 때만 옮긴다(2026-09-26 출시 전 점검 6차).
   * 화면을 열어 둔 사이 09:10 청구가 그 박스를 결제하고 날짜를 +14 로 옮기면, 옛 날짜 기준
   * 계산이 사실상 같은 날짜를 다시 써서 "미뤘어요"라고 말하는데 박스는 결제·발송됐다.
   * 'stale' 이면 최신 일정을 다시 불러온다.
   */
  async function moveNextDate(
    subId: string,
    seen: string | null,
    next: string,
  ): Promise<'ok' | 'stale' | 'error'> {
    const u = await uid()
    if (!u) return 'error'
    const q = supabase
      .from('subscriptions')
      .update({ next_delivery_date: next })
      .eq('id', subId)
      .eq('user_id', u)
    const { data, error } = await (
      seen ? q.eq('next_delivery_date', seen) : q.is('next_delivery_date', null)
    ).select('id')
    if (error) {
      toast.error('변경하지 못했어요. 잠시 후 다시 시도해 주세요')
      return 'error'
    }
    if (!data || data.length === 0) {
      // ★"불러왔어요"라고 말했으면 정말 불러온다(10차 점검 D, 2026-10-06). subs 는 useState(initialSubs) 라
      //   router.refresh() 의 새 props 로는 갱신되지 않는다 — 옛 날짜로 다시 CAS 를 걸어 계속 stale 이 됐다.
      //   그 행의 날짜·상태를 직접 다시 읽어 넣고, 결제된 박스 여부 같은 props 는 refresh 로 받는다.
      const { data: fresh, error: freshErr } = await supabase
        .from('subscriptions')
        .select('next_delivery_date, status')
        .eq('id', subId)
        .eq('user_id', u)
        .maybeSingle()
      if (!freshErr && fresh) {
        setSubs((prev) =>
          prev.map((s) =>
            s.id === subId
              ? { ...s, next_delivery_date: fresh.next_delivery_date, status: fresh.status as DogSub['status'] }
              : s,
          ),
        )
      }
      toast.info('배송 일정이 방금 바뀌었어요 — 최신 일정을 불러왔어요. 확인 후 다시 눌러 주세요.')
      router.refresh()
      return 'stale'
    }
    setSubs((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, next_delivery_date: next } : s)),
    )
    return 'ok'
  }

  async function patch(subId: string, update: Record<string, unknown>) {
    const u = await uid()
    if (!u) return false
    const { error } = await (
      supabase as unknown as {
        from: (t: string) => {
          update: (r: Record<string, unknown>) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => Promise<{ error: unknown }>
            }
          }
        }
      }
    )
      .from('subscriptions')
      .update(update)
      .eq('id', subId)
      .eq('user_id', u)
    if (error) {
      toast.error('변경하지 못했어요. 잠시 후 다시 시도해 주세요')
      return false
    }
    setSubs((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, ...(update as object) } : s)),
    )
    return true
  }

  function goCard(sub: DogSub) {
    const customerKey = sub.billing_customer_key ?? generateFallbackCustomerKey()
    router.push(
      `/subscribe/billing-auth?subscriptionId=${encodeURIComponent(
        sub.id,
      )}&customerKey=${encodeURIComponent(customerKey)}`,
    )
  }

  /** 결제됐고 아직 안 나간 박스의 발송일(이 구독). 없으면 null. */
  function paidShipOf(subId: string, nextIso: string | null): string | null {
    const paidAt = inProgressPaidAt[subId]
    return inProgress[subId] && paidAt ? paidBoxShipIso(nextIso, paidAt) : null
  }

  /** 건너뛰기 — 다음 배송을 한 번 미룬다(2주). 화요일은 유지된다. 확인 시트(SkipSheet)를 거쳐서만 온다. */
  async function skip(sub: DogSub) {
    // 같은 동작이 두 경로(시트 버튼·토스트 [되돌리기])에서 겹쳐 돌지 않게 — busy state 는 토스트 콜백에선 옛 값이다.
    if (moveLockRef.current) return
    moveLockRef.current = true
    setBusy(sub.id)
    // 기준은 '예정된 배송일'이지 오늘이 아니다. 예전엔 null 이면 오늘로 폴백해
    // 목요일 배송일 같은 게 생겼다(2026-07-15 실측).
    // 마감은 결제 시점별(서포터즈 체험 구간 일요일·일반 금요일 밤, 2026-10-02).
    const seen = sub.next_delivery_date ?? null
    const base = seen ?? nextShipDate(undefined, chargeTiming ?? 'before_cooking')
    const next = nextCycleDate(base)
    const result = await moveNextDate(sub.id, seen, next)
    // 결과와 상관없이 시트를 닫는다 — 시트가 열려 있으면 실패·'일정 바뀜' 안내(토스트)가 시트 뒤에 가려졌다(10차 D).
    setSkipId(null)
    if (result === 'ok') {
      // ★잘못 눌렀으면 바로 되돌린다(2026-10-06) — 원래 회차의 신청 마감 전일 때만(undoSkipTarget 정본).
      const undoTo = paidStateUnknown ? null : undoSkipTarget({
        nextDeliveryDate: next,
        today: todayKstIsoDate(),
        timing: chargeTiming,
        paidBoxShipIso: paidShipOf(sub.id, next),
      })
      // 결제된 이번 박스는 그대로 나간다(사장님 2026-10-01 "그대로 발송") — 미룬 건 그다음 박스다.
      toast.success(
        inProgress[sub.id]
          ? `이번 박스는 그대로 보내드리고, 그다음 박스를 ${dateLabel(next)}로 미뤘어요.`
          : `다음 배송을 ${dateLabel(next)}로 미뤘어요.`,
        undoTo
          ? { duration: 8000, action: { label: '되돌리기', onClick: () => void undoSkip(sub.id, next, undoTo) } }
          : undefined,
      )
    }
    setBusy(null)
    moveLockRef.current = false
  }

  /**
   * 미루기 되돌리기(2주 앞당기기) — 목적지는 undoSkipTarget 이 정한 날짜만(원래 회차 마감 전·결제된 박스와 안 겹침).
   * 화면이 본 날짜(fromIso)가 DB 에서도 그대로일 때만 옮긴다(moveNextDate CAS) — 그 사이 결제·변경이 있었으면 거절.
   */
  async function undoSkip(subId: string, fromIso: string, toIso: string) {
    if (moveLockRef.current) return
    // ★누르는 순간의 마감을 다시 본다(10차 D) — 버튼은 마지막 렌더 시각으로 계산돼, 앱을 금요일에 열어 두고
    //   토요일에 돌아오면 조리가 시작된 회차로 되돌릴 수 있었다.
    const stillOk = paidStateUnknown ? null : undoSkipTarget({
      nextDeliveryDate: fromIso,
      today: todayKstIsoDate(),
      timing: chargeTiming,
      paidBoxShipIso: paidShipOf(subId, fromIso),
    })
    if (stillOk !== toIso) {
      toast.info('신청 마감이 지나 이 박스는 되돌릴 수 없어요. 사정이 있으시면 1:1 문의로 알려 주세요.')
      router.refresh()
      return
    }
    moveLockRef.current = true
    setBusy(subId)
    if ((await moveNextDate(subId, fromIso, toIso)) === 'ok') {
      toast.success(`${dateLabel(toIso)} 발송으로 되돌렸어요.`)
    }
    setBusy(null)
    moveLockRef.current = false
  }

  async function pause(sub: DogSub) {
    setBusy(sub.id)
    if (await patch(sub.id, { status: 'paused' })) {
      trackSubscriptionPaused({ subscriptionId: sub.id, reason: 'user_action' })
      // 결제된 이번 박스는 그대로 나간다(사장님 2026-10-01). '언제든'은 고객 문구 금지어.
      toast.success(
        inProgress[sub.id]
          ? '이번 박스는 그대로 보내드리고, 그다음부터 쉬어 갈게요. 이 화면에서 다시 시작할 수 있어요.'
          : '정기배송을 일시정지했어요. 이 화면에서 다시 시작할 수 있어요.',
      )
    }
    // 결과와 상관없이 시트를 닫는다(미루기와 같은 이유 — 실패 안내가 시트에 가리지 않게).
    setPauseId(null)
    setBusy(null)
  }

  async function resume(sub: DogSub) {
    setBusy(sub.id)
    // 재개하면 다음 화요일부터. '오늘 + 14일' 로 잡으면 오늘 요일로 어긋난다.
    // 단 아직 오지 않은 원래 배송일이 있으면 그대로 — 앞당기면 한 주 만에 또 결제된다(2026-09-28).
    const next = resumeShipDate(sub.next_delivery_date, undefined, chargeTiming ?? 'before_cooking')
    // ★본 상태 그대로일 때만(11차 점검 A#10) — 오래 열어 둔 화면의 옛 날짜로 계산해, 그 사이 재개·결제·재정지가 있었으면
    //   결제된 박스 1주 뒤로 앞당겨 또 청구할 수 있었다. 일시정지 + 본 날짜가 그대로여야 쓴다.
    const u = await uid()
    if (!u) {
      setResumeId(null)
      setBusy(null)
      return
    }
    const q = supabase
      .from('subscriptions')
      .update({ status: 'active', next_delivery_date: next })
      .eq('id', sub.id)
      .eq('user_id', u)
      .eq('status', 'paused')
    const { data: resumed, error: resumeErr } = await (
      sub.next_delivery_date ? q.eq('next_delivery_date', sub.next_delivery_date) : q.is('next_delivery_date', null)
    ).select('id')
    if (resumeErr) {
      toast.error('변경하지 못했어요. 잠시 후 다시 시도해 주세요')
    } else if (!resumed || resumed.length === 0) {
      toast.info('정기배송 상태가 방금 바뀌었어요 — 화면을 새로 불러왔어요. 확인 후 다시 눌러 주세요.')
      router.refresh()
    } else {
      setSubs((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: 'active', next_delivery_date: next } : s)))
      trackSubscriptionResumed({ subscriptionId: sub.id })
      toast.success(`${dateLabel(next)}부터 다시 보내드릴게요.`)
    }
    setResumeId(null)
    setBusy(null)
  }

  async function cancel(subId: string) {
    setBusy(subId)
    const sub = subs.find((s) => s.id === subId)
    if (await patch(subId, { status: 'cancelled', next_delivery_date: null })) {
      trackSubscriptionCancelled({
        subscriptionId: subId,
        totalDeliveries: sub?.total_deliveries ?? 0,
      })
      setCancelId(null)
      toast.success(
        (sub?.total_deliveries ?? 0) > 0
          ? '정기배송을 해지했어요.'
          : '정기배송 신청을 취소했어요.',
      )
    }
    setBusy(null)
  }

  if (subs.length === 0) {
    return (
      <div className="sub-page">
        <EmptyStart name={name} startHref={startHref} resting={false} />
      </div>
    )
  }

  /** 시트에 보여 줄 금액 — 카드와 같은 판정(서버 미리보기 → 서포터즈 판정 → 저장 금액). */
  function shownAmount(s: DogSub): number {
    const pv = chargePreview?.[s.id]
    if (pv) return pv.chargeAmount
    const tp = trialPricing(trial, s.total_amount)
    return tp ? tp.chargeAmount : s.total_amount
  }

  return (
    <div className="sub-page">
      {live.map((sub) => (
        <SubCard
          trial={trial}
          timing={chargeTiming}
          inProgress={!!inProgress[sub.id]}
          inTransit={!!inTransit[sub.id]}
          paidUnknown={paidStateUnknown}
          paidAt={inProgressPaidAt[sub.id] ?? null}
          dogPhoto={dogPhoto}
          preview={chargePreview?.[sub.id] ?? null}
          key={sub.id}
          sub={sub}
          name={name}
          busy={busy === sub.id}
          onCard={() => goCard(sub)}
          onSkip={() => setSkipId(sub.id)}
          onUndo={(fromIso, toIso) => void undoSkip(sub.id, fromIso, toIso)}
          onPause={() => setPauseId(sub.id)}
          onResume={() => setResumeId(sub.id)}
          onCancel={() => setCancelId(sub.id)}
          onRatio={() => setRatioId(sub.id)}
        />
      ))}

      {live.length === 0 && <EmptyStart name={name} startHref={startHref} resting={past.length > 0} />}

      {past.length > 0 && (
        // 해지만 남았으면 펼쳐 둔다(시안 S02) — 살아 있는 구독이 있으면 접어 둔다.
        <details className="sub-past" open={live.length === 0}>
          <summary>
            지난 정기배송 {past.length}건
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 15l6-6 6 6" />
            </svg>
          </summary>
          {past.map((sub) => (
            <div className="sub-past-row" key={sub.id}>
              <span className="sub-past-date">{sub.created_at.slice(0, 10).replace(/-/g, '.')} 신청</span>
              <span className="sub-past-chip">
                {sub.total_deliveries > 0
                  ? `${sub.total_deliveries}회 배송 후 해지`
                  : '신청 취소'}
              </span>
            </div>
          ))}
        </details>
      )}

      {/* 화식 비율 시트 — 웹(/account/subscriptions)과 **같은 컴포넌트·같은 API**.
          앱은 variant="app" 으로 시안(S08) 모양만 바꾼다(복사본을 만들면 금액을 보여주는 곳이 둘이 된다). */}
      {ratioId && (
        <SheetFrame onClose={() => setRatioId(null)} label="화식 비율 바꾸기" className="is-ratio">
          <FreshRatioSheet
            variant="app"
            subscriptionId={ratioId}
            onClose={() => setRatioId(null)}
            onChanged={({ ratio, amount }) => {
              toast.success('화식 비율을 바꿨어요')
              // ★즉시 반영 (사장님 제보 2026-08-24): subs 는 useState(initialSubs)
              //   라 router.refresh() 가 내려준 새 props 로는 **갱신되지 않는다**
              //   (useState 는 최초 1회만 초기화). 시트가 돌려준 서버 확정값을
              //   로컬 state 에 직접 반영 — pause/cancel(위 setSubs)과 같은 패턴.
              setSubs((prev) =>
                prev.map((s) =>
                  s.id === ratioId
                    ? { ...s, fresh_ratio: ratio, total_amount: amount }
                    : s,
                ),
              )
              router.refresh()
            }}
          />
        </SheetFrame>
      )}

      {skipId &&
        (() => {
          const s = subs.find((x) => x.id === skipId)
          if (!s) return null
          const fromIso = s.next_delivery_date ?? nextShipDate(undefined, chargeTiming ?? 'before_cooking')
          return (
            <SkipSheet
              name={name}
              fromIso={fromIso}
              toIso={nextCycleDate(fromIso)}
              // 되돌릴 수 있는 마지막 날 = 원래 발송일의 신청 마감(일반 금요일·서포터즈 일요일).
              undoUntil={addDaysKst(fromIso, -leadDaysFor(chargeTiming ?? 'before_cooking'))}
              today={todayKstIsoDate()}
              paidBoxInProgress={paidStateUnknown ? null : !!inProgress[skipId]}
              busy={busy === skipId}
              onClose={() => setSkipId(null)}
              onConfirm={() => void skip(s)}
            />
          )
        })()}

      {pauseId &&
        (() => {
          const s = subs.find((x) => x.id === pauseId)
          if (!s) return null
          return (
            <PauseSheet
              paidBoxInProgress={paidStateUnknown ? null : !!inProgress[pauseId]}
              busy={busy === pauseId}
              onClose={() => setPauseId(null)}
              onConfirm={() => void pause(s)}
            />
          )
        })()}

      {resumeId &&
        (() => {
          const s = subs.find((x) => x.id === resumeId)
          if (!s) return null
          // 보여 주는 날짜는 재개 함수와 같은 계산(resumeShipDate). 실제 저장은 누르는 순간 다시 계산한다 —
          // 시트를 열어 둔 채 마감을 넘기면 더 늦은 날짜가 되고, 그 날짜는 완료 토스트가 말한다(앞당겨지는 일은 없다).
          const nextIso = resumeShipDate(s.next_delivery_date, undefined, chargeTiming ?? 'before_cooking')
          return (
            <ResumeSheet
              shipIso={nextIso}
              chargeIso={chargeTiming ? chargeDateFor(nextIso, chargeTiming) : null}
              amount={shownAmount(s)}
              busy={busy === resumeId}
              onClose={() => setResumeId(null)}
              onConfirm={() => void resume(s)}
            />
          )
        })()}

      {cancelId && (
        <CancelSheet
          name={name}
          started={(subs.find((s) => s.id === cancelId)?.total_deliveries ?? 0) > 0}
          paidBoxInProgress={paidStateUnknown ? null : !!inProgress[cancelId]}
          busy={busy === cancelId}
          onClose={() => setCancelId(null)}
          onConfirm={() => cancel(cancelId)}
        />
      )}
    </div>
  )
}

// ── 구독 카드 (2026-10-01 사장님 B안 → 2026-10-09 'A 포스터' 시안 AppSub) ────────────────────
//
// 사장님 "이 일반 결제 화면이 너무 별로야 강력하게 업그레이드" → B안(시안 두 개 중) 선택.
//  · 맨 위: 강아지 · 레시피 · 상태, 그 아래 금액 카드(도장 그림자) — 금액 · 결제일 · 하루 약 얼마.
//  · 박스 여정(결제 → 조리 → 발송 → 도착) · 함께한 지 몇 주째인지.
//  · 관리: 2×2 큰 버튼(부모님 세대 — 작은 버튼 줄은 누르기 어렵다) + 해지는 조용히.
// 일정은 lib/shipping-schedule 정본: 토·일 조리 → 월 포장 → 화 발송, 결제는 고객마다(chargeDateFor).
// 상태별로 '할 수 있는 것만' 보여주는 규칙(이 파일 상단)은 그대로다.

/** 단계 하나 — 날짜가 지났으면 끝난 단계. */
type Step = { key: string; label: string; when: string; done: boolean }

function md(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`
}

/** 날짜 범위를 짧게 — 같은 달이면 "10/10~11". 좁은 폰(320px)에서 네 칸이 겹치지 않게. */
function mdRange(a: string, b: string): string {
  // 달이 바뀌면 "10/31~11/1" 이 320px 칸(약 55px)에 안 들어가 "11/ | 1" 로 잘렸다(10차 D) — '~' 뒤에 줄바꿈 기회(ZWSP).
  return a.slice(5, 7) === b.slice(5, 7) ? `${md(a)}~${Number(b.slice(8, 10))}` : `${md(a)}~​${md(b)}`
}

/**
 * 박스 여정 4단계 — 결제 시점에 따라 순서가 다르다.
 *  · 조리 직전 결제: 결제(토 아침) → 조리(토·일) → 발송(화) → 도착
 *  · 발송일 결제(서포터즈 체험 구간): 조리(토·일) → 결제(화 아침) → 발송(화) → 도착
 * 도착은 지역에 따라 하루~이틀이라 날짜 없이 '발송 후 1~2일'로만 말한다(shipTimingLabel 원칙).
 */
function boxSteps(
  shipIso: string,
  timing: ChargeTiming,
  charged: boolean,
  today: string,
  /** 실제 결제된 날(KST) — 있으면 결제 단계에 이 날을 쓴다(10차 점검 A F8: 결제 시점이 바뀐 뒤·늦은 성공을 역산하면 틀린다). */
  paidDay: string | null = null,
): Step[] {
  const cookStart = addDaysKst(shipIso, -CHARGE_BEFORE_SHIP_DAYS)
  const cookEnd = addDaysKst(shipIso, -(CHARGE_BEFORE_SHIP_DAYS - 1))
  const chargeIso = chargeDateFor(shipIso, timing)
  // 도착은 지역·택배사 사정이라 요일을 약속하지 않는다(사장님 2026-10-01 "수요일 도착이라는 말을 쓰지 말고").
  const pay: Step = {
    key: 'pay',
    label: '결제',
    when: charged && paidDay ? `${md(paidDay)} ${weekdayKo(paidDay)}` : `${md(chargeIso)} ${weekdayKo(chargeIso)} 아침`,
    done: charged,
  }
  const cook: Step = {
    key: 'cook',
    label: '조리',
    when: mdRange(cookStart, cookEnd),
    done: today > cookEnd,
  }
  // ★발송·도착은 날짜로 '끝남'을 단정하지 않는다(10차 점검 D). 이 여정은 결제됐지만 아직 안 나간 박스(주문 preparing)
  //   이거나 결제 전 다음 박스만 그린다 — 실제로 나간 박스는 홈 박스 진행 카드(주문 상태 기준)가 맡는다. 화요일 발송이
  //   늦어진 박스에 날짜만 보고 ✓를 붙이면 "보냈다"고 거짓말하게 된다.
  const ship: Step = { key: 'ship', label: '발송', when: `${md(shipIso)} ${weekdayKo(shipIso)}`, done: false }
  const arrive: Step = {
    key: 'arrive',
    label: '도착',
    when: '발송 후 1~2일',
    done: false,
  }
  return timing === 'ship_day' ? [cook, pay, ship, arrive] : [pay, cook, ship, arrive]
}

/** 상태 칩 — 정기배송 탭(SubscriptionsSummaryView)과 같은 색 규칙, 이 화면은 한 단계 크게(시안 AppSub·S01·S03·S04). */
function StateChip({ state, label }: { state: SubState; label: string }) {
  return (
    <span className={'sub-chip is-' + state}>
      {state === 'paused' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="5" y="4" width="5" height="16" rx="1" />
          <rect x="14" y="4" width="5" height="16" rx="1" />
        </svg>
      )}
      {label}
    </span>
  )
}

const CardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <path d="M3 9.5h18" />
  </svg>
)

const CheckIcon = ({ size = 18, width = 2.6 }: { size?: number; width?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 4.5v15l12-7.5z" />
  </svg>
)

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="5" y="4" width="5" height="16" rx="1" />
    <rect x="14" y="4" width="5" height="16" rx="1" />
  </svg>
)

const SkipIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 5l9 7-9 7z" />
    <path d="M19 5v14" />
  </svg>
)

const Spinner = () => (
  // 스피너만 남으면 버튼 이름이 사라진다(스크린리더) — 10차 점검 D.
  <>
    <Loader2 size={18} strokeWidth={2.4} className="animate-spin" aria-hidden />
    <span className="sr-only">처리하고 있어요</span>
  </>
)

function SubCard({
  sub,
  name,
  dogPhoto,
  trial,
  timing,
  inProgress,
  inTransit,
  paidUnknown,
  paidAt,
  preview,
  busy,
  onCard,
  onSkip,
  onUndo,
  onPause,
  onResume,
  onCancel,
  onRatio,
}: {
  sub: DogSub
  name: string
  dogPhoto: string | null
  trial: TrialState | null
  /** 모르면 null — 결제 요일을 말하지 않고 발송일만 말한다. */
  timing: ChargeTiming | null
  /** 결제됐지만 아직 안 나간 박스가 있다(결제됨 + 발송 대기 주문). */
  inProgress: boolean
  /** 보냈지만 아직 도착 전인 박스가 있다(배송 중 주문). */
  inTransit: boolean
  /** 결제된 박스 조회 실패 — 되돌리기를 숨긴다. */
  paidUnknown: boolean
  /** 그 결제된 박스의 결제 시각. 모르면 null(옛 계산 next − 14). */
  paidAt: string | null
  preview: ChargePreview | null
  busy: boolean
  onCard: () => void
  onSkip: () => void
  /** 미루기 되돌리기 — fromIso(지금 다음 발송일) → toIso(undoSkipTarget). */
  onUndo: (fromIso: string, toIso: string) => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onRatio: () => void
}) {
  const state = subscriptionState(sub)
  // 라벨은 lib/subscription-state 정본 — 화면마다 다른 이름을 붙이지 않는다.
  const stateLabel = SUB_STATE_LABEL[state]
  const today = todayKstIsoDate()

  // 레시피 — 파우치 색 네모 + "닭고기·흑돼지"(시안). 순서·합치기는 lib/design/pouch 정본(홈 박스 카드와 같은 순서).
  const recipes = boxRecipes(sub.subscription_items.map((i) => ({ name: i.product_name, quantity: i.quantity })))
  const recipeText = recipes.label ? recipes.label.replace(/ 화식$/, '').replace(/ · /g, '·') : null
  const colors = boxCardColors(recipes.lines)

  const method = billingMethodSummary({
    registered: !!sub.has_billing_key,
    brand: sub.billing_card_brand,
    last4: sub.billing_card_last4,
  })

  // 금액 — 서버 미리보기(청구와 같은 함수)가 우선, 없으면 서포터즈 판정으로 대신한다.
  const tpRaw = trialPricing(trial, sub.total_amount)
  const shown = preview ? preview.chargeAmount : tpRaw ? tpRaw.chargeAmount : sub.total_amount
  const off = sub.total_amount - shown
  // 할인 한 줄 — 서포터즈는 "서포터즈 혜택으로 N원 할인"(앱시안 결정 3번: 예전 "서포터즈 100원 −N원"은 할인 이름에
  // 결제 금액이 섞여 헷갈렸다). 그 밖의 할인은 "이름 −금액". 비율(%)은 쓰지 않는다(브랜드 보이스). 정기배송 탭과 같은 말.
  const isTrialDiscount = preview
    ? preview.reason === 'trial_cheap' || preview.reason === 'trial_half' || (!preview.reason && !!tpRaw)
    : !!tpRaw
  const discountText =
    off > 0 ? (isTrialDiscount ? `서포터즈 혜택으로 ${krw(off)} 할인` : `${preview?.label ?? '할인'} −${krw(off)}`) : null

  // 결제일 — next_delivery_date 는 **발송일**이고, 결제일은 결제 시점으로 정한다(2026-10-01).
  const nextShip = sub.next_delivery_date
  const chargeIso = nextShip && timing ? chargeDateFor(nextShip, timing) : null
  /**
   * ★지난 날짜를 "결제 예정" 이라 부르지 않는다 (2026-08-07). 결제가 한 번 미끄러지면
   *  next_delivery_date 가 갱신되지 않은 채 과거로 흘러간다.
   */
  const overdue = chargeIso != null && chargeIso < today
  // 하루 약 얼마 — 2주(14일)치 한 박스. 100원 체험가처럼 작은 금액엔 의미가 없어 뺀다.
  const perDay = shown >= 1000 ? Math.round(shown / 14 / 10) * 10 : null
  const perDayText = perDay && state === 'active' ? ` · 하루 약 ${perDay.toLocaleString('ko-KR')}원` : ''

  // 금액 카드 아래 한 줄 — 진행 중이면 결제일(결제 시점을 모르면 발송일), 그 밖의 상태는 지금 무슨 상황인지.
  const whenNode: ReactNode =
    state === 'active'
      ? chargeIso
        ? overdue
          ? (
              <>
                <strong>{dateLabel(chargeIso)}</strong> 결제 예정이었어요 · 확인 중{perDayText}
              </>
            )
          : (
              <>
                <strong>{dateLabel(chargeIso)}</strong> 결제{perDayText}
              </>
            )
        : nextShip
          ? (
              <>
                다음 발송 <strong>{dateLabel(nextShip)}</strong>
                {perDayText}
              </>
            )
          : `2주에 한 번${perDayText}`
      : null
  const noteNode: ReactNode =
    state === 'paused' ? (
      <>
        <strong>일시정지 중이에요.</strong> 다시 시작하면 다음 발송일부터 보내드려요.
      </>
    ) : state === 'needs_card' ? (
      <>
        결제수단을 등록하면 <strong>첫 배송일이 정해져요.</strong>
      </>
    ) : state === 'card_failed' && nextShip ? (
      <>
        다음 발송 <strong>{dateLabel(nextShip)}</strong>
      </>
    ) : null

  // 박스 여정 — 결제됐지만 아직 안 나간 박스가 있으면 **이번 박스**, 아니면 다음 박스.
  //   이번 박스 발송일은 결제 시각 기준(paidBoxShipIso) — next − 14 만 보면 결제 뒤 '2주 미루기'에 2주 늦게 말한다.
  const journeyShip =
    state === 'active' && nextShip
      ? inProgress
        ? paidAt
          ? paidBoxShipIso(nextShip, paidAt)
          : addDaysKst(nextShip, -14)
        : nextShip
      : null
  // 결제 시점을 모르면 '결제' 단계를 빼고 조리 → 발송 → 도착만(결제 요일을 단정하지 않는다).
  const steps = journeyShip
    ? boxSteps(journeyShip, timing ?? 'ship_day', inProgress, today, inProgress && paidAt ? kstDateOf(paidAt) : null).filter((st) => timing || st.key !== 'pay')
    : []
  const currentIdx = steps.findIndex((st) => !st.done)

  // 함께한 박스 — total_deliveries 는 결제 성공마다 오른다. 10칸(도장판과 같은 단위)으로 보여준다.
  // ★결제만 되고 아직 안 나간 박스(inProgress)는 '받은' 수에서 뺀다(10차 점검 A F7) — 토요일 결제 직후부터
  //   "1번째 박스까지 받았어요"라고 하던 것. 같은 카드 위 여정은 그 박스를 조리 중으로 그린다.
  //   ★보냈지만 아직 도착 전인 박스(배송 중)도 뺀다(11차 점검 E) — 발송 처리 직후 "1번째 박스까지 받았어요".
  const boxes = Math.max(0, sub.total_deliveries - (inProgress ? 1 : 0) - (inTransit ? 1 : 0))
  const filled = boxes % 10 === 0 && boxes > 0 ? 10 : boxes % 10
  // 오고 있는 박스(결제됨·배송 중) 한 칸은 점선으로(시안 S05). 오고 있는 게 없으면 빈칸만(시안 AppSub).
  const comingIdx = state === 'active' && (inProgress || inTransit) && filled < 10 ? filled : -1
  // "함께한 지 N주째예요"(앱시안 결정 1번 — 몇 번째 박스 대신). 박스 하나 = 2주치.
  const withTitle =
    boxes > 0
      ? `함께한 지 ${boxes * 2}주째예요`
      : state === 'active'
        ? '첫 박스를 준비하고 있어요'
        : '아직 받은 박스가 없어요'

  const skipTo = nextShip ? nextCycleDate(nextShip) : null
  // 미룬 회차를 되돌릴 수 있으면 그 날짜 — 원래 회차 신청 마감 전·결제된 박스와 안 겹칠 때만(undoSkipTarget 정본).
  //   미루지 않았으면 늘 null 이라 버튼이 안 보인다.
  // ★결제된 박스를 모르면(조회 실패) 되돌리기를 보이지 않는다(11차 점검 A#6) — 늦게 결제된 박스 날짜로 되돌려 같은 박스를
  //   두 번 청구할 수 있다.
  const undoTo =
    state === 'active' && !paidUnknown
      ? undoSkipTarget({
          nextDeliveryDate: nextShip,
          today,
          timing,
          paidBoxShipIso: inProgress && paidAt && nextShip ? paidBoxShipIso(nextShip, paidAt) : null,
        })
      : null

  return (
    <section className={'sub-card is-' + state}>
      {/* ── 머리: 누구의 정기배송인지 ── */}
      <div className="sub-head">
        <span className="sub-avatar" aria-hidden>
          {dogPhoto ? (
            <Image src={dogPhoto} alt="" fill sizes="56px" className="object-cover" unoptimized />
          ) : (
            <DogPawMark size={24} color={V3.inkMute} />
          )}
        </span>
        <span className="sub-head-text">
          <h2 className="sub-head-name">{name} 정기배송</h2>
          <span className="sub-head-sub">
            {recipes.lines.length > 0 && (
              <span className="sub-squares" aria-hidden>
                {recipes.lines.map((l) => (
                  <span key={l} style={{ background: RECIPE_COLOR[l] }} />
                ))}
              </span>
            )}
            <span>
              {[recipeText || '레시피 정보 없음', sub.fresh_ratio != null ? freshTierLabel(sub.fresh_ratio) : null]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </span>
        <StateChip state={state} label={stateLabel} />
      </div>

      {/* 결제 실패만 경고로 — 놓치면 배송이 멈춘다. */}
      {state === 'card_failed' && (
        <div role="alert" className="sub-alert">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3.5L2.5 20h19z" />
            <path d="M12 10v4.5M12 17.2v.3" />
          </svg>
          <span className="sub-alert-text">
            <strong>결제가 되지 않았어요</strong>
            <span>
              결제수단을 다시 등록하면 이어져요.
              {sub.last_failed_charge_reason ? ` (${sub.last_failed_charge_reason})` : ''}
            </span>
          </span>
        </div>
      )}

      {/* ── 금액 = 주인공 (박스 레시피 파우치 색 + 도장 그림자) ── */}
      <section
        aria-label={state === 'active' ? '다음 결제' : '정기배송 금액'}
        className="sub-hero"
        style={{ ...boxCardFrame(colors), '--sub-hero-divider': colors.divider } as React.CSSProperties}
      >
        <span className="sub-hero-kicker">{state === 'active' ? '다음 결제' : '2주마다'}</span>
        <span className="sub-hero-amount">
          <span className="ft-num">{shown.toLocaleString('ko-KR')}</span>
          <span className="ft-poster">원</span>
        </span>
        {discountText && (
          <span className="sub-hero-discount">
            <s>{krw(sub.total_amount)}</s>
            <span className="sub-hero-discount-chip">{discountText}</span>
          </span>
        )}
        {whenNode && <span className="sub-hero-when">{whenNode}</span>}
        {noteNode && <span className="sub-hero-note">{noteNode}</span>}
      </section>

      {/* ── 박스 여정 ── */}
      {steps.length > 0 && (
        <section className="sub-journey" aria-label={inProgress ? '이번 박스 진행' : '다음 박스 일정'}>
          <h2>{inProgress ? '이번 박스' : '다음 박스'}</h2>
          <ol className="sub-steps" style={{ '--n': steps.length } as React.CSSProperties}>
            {steps.map((st, i) => {
              // 끝난 단계 = 꽉 찬 막대 + 회색 ✓. 지금 단계 = 이번 박스면 반 칸(진행 중), 다음 박스면 꽉 찬 칸(다음 차례).
              const cls = st.done ? 'is-done' : i === currentIdx ? (inProgress ? 'is-now' : 'is-next') : ''
              return (
                <li key={st.key} className={'sub-step ' + cls} aria-current={i === currentIdx ? 'step' : undefined}>
                  <span className="sub-step-bar" aria-hidden />
                  <span className="sub-step-label">
                    {st.done && <CheckIcon size={14} width={3.2} />}
                    {st.label}
                  </span>
                  <span className="sub-step-when">{st.when}</span>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {/* ── 함께한 박스 ── */}
      {(state === 'active' || state === 'paused') && (
        <section className="sub-with" aria-label="함께한 박스">
          <div className="sub-with-head">
            <span className="sub-with-kicker">{waGwa(name)}</span>
            <h2>{withTitle}</h2>
          </div>
          <div className="sub-with-row" aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={i < filled ? 'is-on' : i === comingIdx ? 'is-coming' : undefined} />
            ))}
          </div>
        </section>
      )}

      {/* ── 관리 — 상태별로 '할 수 있는 것'만 ── */}
      {busy && (
        <p className="sub-busy-line">
          <Loader2 size={16} strokeWidth={2.4} className="animate-spin" aria-hidden /> 처리하고 있어요
        </p>
      )}

      {(state === 'needs_card' || state === 'card_failed') && (
        <div className="sub-primary-wrap">
          <button type="button" className="sub-primary" onClick={onCard}>
            <CardIcon />
            {state === 'card_failed' ? '결제수단 다시 등록' : '결제수단 등록하고 시작'}
          </button>
        </div>
      )}

      {state === 'paused' && (
        <div className="sub-primary-wrap">
          <button type="button" className="sub-primary" onClick={onResume} disabled={busy}>
            <PlayIcon />
            다시 시작
          </button>
        </div>
      )}

      {state === 'active' && (
        <div className="sub-tiles" role="group" aria-label="바꾸기">
          <button type="button" className="sub-tile is-skip" onClick={onSkip} disabled={busy}>
            <span className="sub-tile-label">2주 미루기</span>
            {/* 결제된 이번 박스는 그대로 나간다(사장님 2026-10-01) — 미루는 건 그다음 박스라는 걸 타일에서 말한다. */}
            <span className="sub-tile-sub">
              {skipTo ? (inProgress ? `그다음 박스를 ${md(skipTo)}로` : `${md(skipTo)} 발송으로`) : '다음 박스를 2주 뒤로'}
            </span>
          </button>
          <button type="button" className="sub-tile is-pause" onClick={onPause} disabled={busy}>
            <span className="sub-tile-label">일시정지</span>
            <span className="sub-tile-sub">다시 시작할 때까지</span>
          </button>
          {/* 화식 비율 — 금액이 함께 바뀌므로 진행 중인 구독에만. 시트가 세 티어 금액을 보여주고 서버가 계산·저장. */}
          <button type="button" className="sub-tile is-ratio" onClick={onRatio} disabled={busy}>
            <span className="sub-tile-label">화식 비율</span>
            <span className="sub-tile-sub">
              {sub.fresh_ratio != null ? `지금 ${freshTierLabel(sub.fresh_ratio)}` : '비율 바꾸기'}
            </span>
          </button>
          {/* ★ 정상 구독에도 결제수단 교체를 준다 (2026-07-30) — 카드가 만료되기 **전에** 바꿀 수 있게. */}
          <button type="button" className="sub-tile is-card" onClick={onCard} disabled={busy}>
            <span className="sub-tile-label">결제수단</span>
            <span className="sub-tile-sub">{method}</span>
          </button>
        </div>
      )}

      {/* 미룬 박스 되돌리기 — 실수로 미뤄도 원래 회차 마감 전이면 고객이 스스로 되돌린다(2026-10-06). */}
      {undoTo && nextShip && (
        <div className="sub-undo-wrap">
          <button type="button" className="sub-undo" onClick={() => onUndo(nextShip, undoTo)} disabled={busy}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 14L4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
            미룬 박스 되돌리기 · {md(undoTo)} 발송으로
          </button>
        </div>
      )}

      <p className="sub-foot">
        {state === 'active'
          ? `${iGa(name)} 먹는 속도에 맞춰 다음 결제 전까지 미루거나 멈출 수 있어요. ${STOP_TIMING_COPY}`
          : state === 'needs_card'
            ? '등록 전까지는 아무것도 결제되지 않아요. 위약금도 없어요.'
            : '다음 결제 전까지 바꾸거나 그만둘 수 있어요. 위약금은 없어요.'}
      </p>

      {state !== 'cancelled' && (
        <button type="button" className="sub-cancel" onClick={onCancel} disabled={busy}>
          {/* 결제 이력이 없으면 '해지'가 아니라 '취소'다 (사장님 2026-07-30). */}
          {sub.total_deliveries > 0 ? '정기배송 해지' : '정기배송 신청 취소'}
        </button>
      )}
    </section>
  )
}

// ── 빈 상태 — 정기배송이 없거나, 해지해서 쉬는 중 (시안 S02) ───────────────────────────────────

function EmptyStart({ name, startHref, resting }: { name: string; startHref: string; resting: boolean }) {
  return (
    <section className="sub-empty" aria-labelledby="sub-empty-title">
      <span className="sub-empty-icon" aria-hidden>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8L12 4l8.5 4v8.5L12 20.5l-8.5-4z" />
          <path d="M3.5 8L12 12l8.5-4M12 12v8.5" />
          <path d="M7.7 6l8.6 4" />
        </svg>
      </span>
      {/* 해지한 사람에겐 "지금은 쉬는 중이에요"(앱시안 결정 15번) — '정기배송이 없어요'는 처음 오는 사람의 말이다. */}
      <h1 id="sub-empty-title">
        {resting ? (
          <>
            {name}의 정기배송은
            <br />
            지금 쉬는 중이에요
          </>
        ) : (
          <>
            {name}의 정기배송이
            <br />
            아직 없어요
          </>
        )}
      </h1>
      <p>
        {resting ? '다시 시작하면 ' : ''}분석 결과에 맞춘 레시피로 2주마다 보내드려요. 다음 결제 전까지 미루거나 그만둘
        수 있어요.
      </p>
      <Link href={startHref} className="sub-empty-cta">
        {resting ? '정기배송 다시 시작하기' : '정기배송 시작하기'}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </section>
  )
}

// ── 아래에서 올라오는 창 틀 (시안 S06·S08·S09·S10) ────────────────────────────────────────
//
// 예전 화식 비율 시트는 scrim + div 뿐이라 안드로이드 하드웨어 뒤로가기가 시트를 닫지 않고 **화면을 떠났다**
// (NativeShellBridge 의 일반 방어는 <dialog open> 만 찾는다). 스크롤 잠금·포커스 트랩·Esc 도 없었다(10차 점검 D).
// 이제 모든 시트가 이 틀 하나로 — Esc 닫기 + 포커스 트랩 + 스크롤 잠금 + 닫을 때 포커스 복귀(useModalA11y).
// 층 순서: 앱 헤더·탭바 40 < 시트 55·56 < 토스트 60(subscription.css).

function SheetFrame({
  onClose,
  labelledBy,
  label,
  className,
  children,
}: {
  onClose: () => void
  labelledBy?: string
  label?: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useModalA11y({ open: true, onClose, containerRef: ref })
  return (
    <>
      <div className="sub-scrim" onClick={onClose} />
      <div
        ref={ref}
        className={'sub-sheet' + (className ? ' ' + className : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
      >
        <span className="sub-sheet-grip" aria-hidden />
        {children}
      </div>
    </>
  )
}

function SheetHead({ id, onClose, big = false, children }: { id: string; onClose: () => void; big?: boolean; children: ReactNode }) {
  return (
    <div className={'sub-sheet-head' + (big ? ' is-big' : '')}>
      <h2 id={id}>{children}</h2>
      <button type="button" className="sub-sheet-x" onClick={onClose} aria-label="닫기">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}

// ── 미루기 확인 (2026-10-06) ─────────────────────────────────────────────────────
//
// 사장님 "우리 구독 실수로 건너뛰기해 버리면 할 수 있는 게 없더라". 박스가 2주치라 한 번 잘못 누르면 아이가 2주 동안
// 밥이 없다. 누르기 전에 무엇이 언제로 밀리는지 날짜로 보여주고, 언제까지 되돌릴 수 있는지 함께 말한다.
function SkipSheet({
  name,
  fromIso,
  toIso,
  undoUntil,
  today,
  paidBoxInProgress,
  busy,
  onClose,
  onConfirm,
}: {
  name: string
  /** 지금 다음 발송일(밀릴 박스). */
  fromIso: string
  /** 미룬 뒤 발송일. */
  toIso: string
  /** 되돌릴 수 있는 마지막 날(원래 발송일의 신청 마감). */
  undoUntil: string
  today: string
  /** null = 모름(조회 실패). */
  paidBoxInProgress: boolean | null
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  const canUndo = undoUntil >= today
  return (
    <SheetFrame onClose={onClose} labelledBy={titleId}>
      <SheetHead id={titleId} onClose={onClose}>
        {md(fromIso)} 박스를
        <br />
        {md(toIso)}로 미룰까요?
      </SheetHead>
      <div className="sub-move" aria-hidden>
        <span className="sub-move-from">
          <span className="sub-move-k">지금 발송일</span>
          <span className="sub-move-v">{dateLabel(fromIso)}</span>
        </span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        <span className="sub-move-to">
          <span className="sub-move-k">미룬 뒤</span>
          <span className="sub-move-v">{dateLabel(toIso)}</span>
        </span>
      </div>
      <p className="sub-sheet-body">
        {paidBoxInProgress
          ? `결제된 이번 박스는 그대로 보내드리고, 그다음 박스(${dateLabel(fromIso)} 발송)를 ${dateLabel(toIso)} 발송으로 미뤄요.`
          : paidBoxInProgress === null
            ? `${dateLabel(fromIso)} 발송 박스를 ${dateLabel(toIso)} 발송으로 미뤄요. 이미 결제된 박스가 있으면 그 박스는 그대로 보내드려요.`
            : `${dateLabel(fromIso)}에 보낼 박스를 ${dateLabel(toIso)}로 미뤄요. 그 사이 2주는 ${name}에게 박스가 가지 않고, 결제도 그만큼 뒤로 밀려요.`}
      </p>
      {canUndo && (
        <p className="sub-sheet-note">
          잘못 눌렀다면 <strong>{dateLabel(undoUntil)}까지</strong> 이 화면에서 되돌릴 수 있어요.
        </p>
      )}
      <div className="sub-sheet-btns">
        <button type="button" className="sub-sheet-btn is-line" onClick={onClose}>
          그대로 둘게요
        </button>
        <button type="button" className="sub-sheet-btn is-solid" onClick={onConfirm} disabled={busy}>
          {busy ? (
            <Spinner />
          ) : (
            <>
              <SkipIcon />
              2주 미루기
            </>
          )}
        </button>
      </div>
    </SheetFrame>
  )
}

// ── 일시정지·다시 시작 확인 (2026-10-09 앱시안 결정 3번 '동작') ─────────────────────────────
//
// 예전엔 누르는 즉시 바뀌고 토스트만 떴다. 일시정지는 결제·배송이 멈추고, 다시 시작은 다음 결제가 잡히는 일이라
// 누르기 전에 무엇이 언제 일어나는지 말한다. 저장 로직(pause·resume)은 그대로다.
function PauseSheet({
  paidBoxInProgress,
  busy,
  onClose,
  onConfirm,
}: {
  /** 결제됐지만 아직 안 나간 박스가 있다 — 그 박스는 그대로 보낸다(사장님 2026-10-01). null = 모름(조회 실패). */
  paidBoxInProgress: boolean | null
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  return (
    <SheetFrame onClose={onClose} labelledBy={titleId}>
      <SheetHead id={titleId} onClose={onClose}>
        일시정지할까요?
      </SheetHead>
      <p className="sub-sheet-body">
        {paidBoxInProgress ? (
          <>
            결제된 이번 박스는 그대로 보내드리고, <strong>그다음 박스부터 배송과 결제가 멈춰요.</strong>
          </>
        ) : paidBoxInProgress === null ? (
          <>
            <strong>다음 박스부터 배송과 결제가 멈춰요.</strong> 이미 결제된 박스가 있으면 그 박스는 그대로 보내드려요.
          </>
        ) : (
          <strong>다음 박스부터 배송과 결제가 멈춰요.</strong>
        )}{' '}
        이 화면에서 다시 시작하면 다음 발송일부터 보내드려요.
      </p>
      <div className="sub-sheet-btns">
        <button type="button" className="sub-sheet-btn is-line" onClick={onClose}>
          그대로 둘게요
        </button>
        <button type="button" className="sub-sheet-btn is-solid" onClick={onConfirm} disabled={busy}>
          {busy ? (
            <Spinner />
          ) : (
            <>
              <PauseIcon />
              일시정지
            </>
          )}
        </button>
      </div>
    </SheetFrame>
  )
}

function ResumeSheet({
  shipIso,
  chargeIso,
  amount,
  busy,
  onClose,
  onConfirm,
}: {
  /** 다시 시작하면 나갈 첫 박스의 발송일(resumeShipDate). */
  shipIso: string
  /** 그 박스의 결제일 — 결제 시점을 모르면 null(결제 요일을 단정하지 않는다). */
  chargeIso: string | null
  /** 그 결제의 금액 — 금액 카드와 같은 판정. */
  amount: number
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  return (
    <SheetFrame onClose={onClose} labelledBy={titleId}>
      <SheetHead id={titleId} onClose={onClose}>
        다시 시작할까요?
      </SheetHead>
      <p className="sub-sheet-body">
        {chargeIso ? (
          <>
            <strong>{dateLabel(chargeIso)} 아침</strong>에 {krw(amount)}이 결제되고,{' '}
            <strong>{dateLabel(shipIso)}</strong>에 보내드려요.
          </>
        ) : (
          <>
            <strong>{dateLabel(shipIso)} 발송분</strong>부터 다시 보내드려요. 결제 금액은 {krw(amount)}이에요.
          </>
        )}
      </p>
      <p className="sub-sheet-note">다시 시작한 뒤에도 다음 결제 전까지 미루거나 멈출 수 있어요.</p>
      <div className="sub-sheet-btns">
        <button type="button" className="sub-sheet-btn is-line" onClick={onClose}>
          그대로 둘게요
        </button>
        <button type="button" className="sub-sheet-btn is-solid" onClick={onConfirm} disabled={busy}>
          {busy ? (
            <Spinner />
          ) : (
            <>
              <PlayIcon />
              다시 시작
            </>
          )}
        </button>
      </div>
    </SheetFrame>
  )
}

// ── 해지 확인 ───────────────────────────────────────────────────────────────

/**
 * 파괴적 확인 시트. "그냥 둘게요"를 진하게, "해지하기"는 빨간 테두리(앱시안 결정 13번 — 실수로 누르기 쉬운 쪽을 약하게).
 *
 * @param started 결제 이력이 있는가(total_deliveries > 0). 없으면 '해지'가 아니라
 *   **'취소'** 로 말한다 — 결제된 게 없으니 "다음 박스부터 멈춰요" 가 성립하지
 *   않는다(사장님 2026-07-30).
 */
function CancelSheet({
  name,
  started,
  paidBoxInProgress,
  busy,
  onClose,
  onConfirm,
}: {
  name: string
  started: boolean
  /** 결제됐지만 아직 안 나간 박스가 있다 — 그 박스는 그대로 보낸다(2026-10-01 사장님 "그대로 발송, 자동 환불 없음"). */
  /** null = 모름(조회 실패). */
  paidBoxInProgress: boolean | null
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const titleId = useId()
  return (
    <SheetFrame onClose={onClose} labelledBy={titleId}>
      <SheetHead id={titleId} onClose={onClose} big>
        정말 {started ? '해지' : '취소'}할까요?
      </SheetHead>
      <p className="sub-sheet-body">
        {started ? (
          paidBoxInProgress ? (
            <>
              이미 결제된 박스는 맞춤으로 만들어 그대로 보내드려요. 해지하면 <strong>그다음 박스부터 배송과 결제가 멈춰요.</strong>{' '}
              {name}의 기록과 분석은 그대로 남아 있고, 나중에 다시 시작할 수 있어요.
            </>
          ) : paidBoxInProgress === null ? (
            <>
              해지하면 {name}의 <strong>다음 박스부터 배송과 결제가 멈춰요.</strong> 이미 결제된 박스가 있으면 그 박스는 그대로
              보내드려요. 기록과 분석은 그대로 남아 있어요.
            </>
          ) : (
            <>
              해지하면 {name}의 <strong>다음 박스부터 배송과 결제가 멈춰요.</strong> 지금까지의 기록과 분석은 그대로 남아 있고,
              나중에 다시 시작할 수 있어요.
            </>
          )
        ) : (
          <>
            <strong>아직 결제된 게 없어서 그냥 없어져요.</strong> {name}의 기록과 분석은 그대로 남아 있고, 나중에 다시 신청할 수
            있어요.
          </>
        )}
      </p>
      <div className="sub-sheet-btns">
        <button type="button" className="sub-sheet-btn is-solid" onClick={onClose}>
          그냥 둘게요
        </button>
        <button type="button" className="sub-sheet-btn is-danger" onClick={onConfirm} disabled={busy}>
          {busy ? (
            <Spinner />
          ) : (
            <>
              <CheckIcon />
              {started ? '해지하기' : '취소하기'}
            </>
          )}
        </button>
      </div>
    </SheetFrame>
  )
}
