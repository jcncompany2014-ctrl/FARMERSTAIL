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
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { trialPricing, type TrialState } from '@/lib/payments/trial'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import Link from 'next/link'
import {
  CreditCard,
  Pause,
  Play,
  SkipForward,
  X,
  AlertTriangle,
  Check,
  Loader2,
  PackageOpen,
  SlidersHorizontal,
  CookingPot,
  Truck,
  Home,
} from 'lucide-react'
import FreshRatioSheet from '@/components/subscription/FreshRatioSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { petName, iGa } from '@/lib/korean'
import {
  nextShipDate,
  nextCycleDate,
  weekdayKo,
  resumeShipDate,
  chargeDateFor,
  paidBoxShipIso,
  CHARGE_BEFORE_SHIP_DAYS,
  STOP_TIMING_COPY,
  type ChargeTiming,
} from '@/lib/shipping-schedule'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import {
  subscriptionState,
  SUB_STATE_LABEL,
  SUB_STATE_TONE,
  type SubLike,
} from '@/lib/subscription-state'
import {
  trackSubscriptionPaused,
  trackSubscriptionResumed,
  trackSubscriptionCancelled,
} from '@/lib/analytics'
import { generateFallbackCustomerKey } from '@/lib/v3-helpers/subscriptions'
import { billingMethodSummary } from '@/lib/payments/billing-methods'
import './subscription.css'
import { todayKstIsoDate, addDaysKst } from '@/lib/datetime-kst'

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

/** yyyy-mm-dd → "8월 4일 (화)". */
function dateLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일 (${weekdayKo(iso)})`
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
  /** 체험단 가격표 — 있으면 금액 표시가 체험가로 바뀐다 (청구와 같은 판정) */
  trial?: TrialState | null
  /** 구독별 다음 결제액(서버가 청구와 같은 resolveAutoDiscount 로 계산 — 이벤트·이웃·등급·서포터즈 전부) */
  chargePreview?: Record<string, { chargeAmount: number; label: string | null }> | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [subs, setSubs] = useState<DogSub[]>(initialSubs)
  const [busy, setBusy] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  // 화식 비율 변경 (2026-07-31) — 이 화면 docstring 이 역할에 '화식비율' 을
  // 적어 두고도 실물이 없었다. 웹(/account/subscriptions)과 **같은 시트·같은 API**.
  const [ratioId, setRatioId] = useState<string | null>(null)

  const name = petName(dogName)
  // 해지된 것만 남았으면 '다시 시작' 안내가 주인공 — 살아있는 구독만 위로.
  const live = subs.filter((s) => s.status !== 'cancelled')
  const past = subs.filter((s) => s.status === 'cancelled')

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

  /** 건너뛰기 — 다음 배송을 한 번 미룬다(2주). 화요일은 유지된다. */
  async function skip(sub: DogSub) {
    setBusy(sub.id)
    // 기준은 '예정된 배송일'이지 오늘이 아니다. 예전엔 null 이면 오늘로 폴백해
    // 목요일 배송일 같은 게 생겼다(2026-07-15 실측).
    // 마감은 결제 시점별(서포터즈 체험 구간 일요일·일반 금요일 밤, 2026-10-02).
    const base = sub.next_delivery_date ?? nextShipDate(undefined, chargeTiming ?? 'before_cooking')
    const next = nextCycleDate(base)
    if ((await moveNextDate(sub.id, sub.next_delivery_date ?? null, next)) === 'ok') {
      // 결제된 이번 박스는 그대로 나간다(사장님 2026-10-01 "그대로 발송") — 미룬 건 그다음 박스다.
      toast.success(
        inProgress[sub.id]
          ? `이번 박스는 그대로 보내드리고, 그다음 박스를 ${dateLabel(next)}로 미뤘어요.`
          : `다음 배송을 ${dateLabel(next)}로 미뤘어요.`,
      )
    }
    setBusy(null)
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
    setBusy(null)
  }

  async function resume(sub: DogSub) {
    setBusy(sub.id)
    // 재개하면 다음 화요일부터. '오늘 + 14일' 로 잡으면 오늘 요일로 어긋난다.
    // 단 아직 오지 않은 원래 배송일이 있으면 그대로 — 앞당기면 한 주 만에 또 결제된다(2026-09-28).
    const next = resumeShipDate(sub.next_delivery_date, undefined, chargeTiming ?? 'before_cooking')
    if (await patch(sub.id, { status: 'active', next_delivery_date: next })) {
      trackSubscriptionResumed({ subscriptionId: sub.id })
      toast.success(`${dateLabel(next)}부터 다시 보내드릴게요.`)
    }
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
        <EmptyStart name={name} startHref={startHref} />
      </div>
    )
  }

  return (
    <div className="sub-page">
      {live.map((sub) => (
        <SubCard
          trial={trial}
          timing={chargeTiming}
          inProgress={!!inProgress[sub.id]}
          paidAt={inProgressPaidAt[sub.id] ?? null}
          dogPhoto={dogPhoto}
          preview={chargePreview?.[sub.id] ?? null}
          key={sub.id}
          sub={sub}
          name={name}
          busy={busy === sub.id}
          onCard={() => goCard(sub)}
          onSkip={() => skip(sub)}
          onPause={() => pause(sub)}
          onResume={() => resume(sub)}
          onCancel={() => setCancelId(sub.id)}
          onRatio={() => setRatioId(sub.id)}
        />
      ))}

      {live.length === 0 && <EmptyStart name={name} startHref={startHref} />}

      {past.length > 0 && (
        <details className="sub-past">
          <summary>지난 정기배송 {past.length}건</summary>
          {past.map((sub) => (
            <div className="sub-past-row" key={sub.id}>
              <span>{sub.created_at.slice(0, 10).replace(/-/g, '.')} 신청</span>
              <span>
                {sub.total_deliveries > 0
                  ? `${sub.total_deliveries}회 배송 후 해지`
                  : '신청 취소'}
              </span>
            </div>
          ))}
        </details>
      )}

      {/* 화식 비율 시트 — 웹(/account/subscriptions)과 **같은 컴포넌트·같은 API**.
          시트는 --fd-* 토큰만 쓰고, 아래 래퍼가 그걸 앱 v3 값으로 스왑한다.
          (복사본을 만들면 금액을 보여주는 곳이 둘이 된다.) */}
      {ratioId && (
        <>
          <div className="sub-scrim" onClick={() => setRatioId(null)} />
          <div
            className="sub-sheet"
            style={
              {
                '--fd-pine': 'var(--ink)',
                '--fd-muted': 'var(--muted)',
                '--fd-line': 'var(--rule)',
                '--fd-coral': 'var(--terracotta)',
                '--fd-coral-text': 'var(--terracotta)',
                '--fd-offwhite': 'var(--bg-2)',
                '--fd-r-row': '4px',
              } as React.CSSProperties
            }
          >
            <FreshRatioSheet
              subscriptionId={ratioId}
              onClose={() => setRatioId(null)}
              onChanged={({ ratio, amount }) => {
                toast.success('화식 비율을 바꿨어요')
                // ★즉시 반영 (사장님 제보 2026-08-24): subs 는 useState(initialSubs)
                //   라 router.refresh() 가 내려준 새 props 로는 **갱신되지 않는다**
                //   (useState 는 최초 1회만 초기화). 시트가 돌려준 서버 확정값을
                //   로컬 state 에 직접 반영 — pause/cancel(아래 setSubs)과 같은 패턴.
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
          </div>
        </>
      )}

      {cancelId && (
        <CancelSheet
          name={name}
          started={(subs.find((s) => s.id === cancelId)?.total_deliveries ?? 0) > 0}
          paidBoxInProgress={!!inProgress[cancelId]}
          busy={busy === cancelId}
          onClose={() => setCancelId(null)}
          onConfirm={() => cancel(cancelId)}
        />
      )}
    </div>
  )
}

// ── 구독 카드 (2026-10-01 사장님 B안 — 한 장 요약 + 큰 버튼) ──────────────────────────────────
//
// 사장님 "이 일반 결제 화면이 너무 별로야 강력하게 업그레이드" → B안(시안 두 개 중) 선택.
//  · 맨 위 한 장: 강아지 · 금액 · 결제일 · 하루 약 얼마 · 박스 여정(결제 → 조리 → 발송 → 도착).
//  · 함께한 박스: 몇 번째인지 동그라미로.
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
  return a.slice(5, 7) === b.slice(5, 7) ? `${md(a)}~${Number(b.slice(8, 10))}` : `${md(a)}~${md(b)}`
}

/**
 * 박스 여정 4단계 — 결제 시점에 따라 순서가 다르다.
 *  · 조리 직전 결제: 결제(토 아침) → 조리(토·일) → 발송(화) → 도착
 *  · 발송일 결제(서포터즈 체험 구간): 조리(토·일) → 결제(화 아침) → 발송(화) → 도착
 * 도착은 지역에 따라 하루~이틀이라 날짜 없이 '발송 후 1~2일'로만 말한다(shipTimingLabel 원칙).
 */
function boxSteps(shipIso: string, timing: ChargeTiming, charged: boolean, today: string): Step[] {
  const cookStart = addDaysKst(shipIso, -CHARGE_BEFORE_SHIP_DAYS)
  const cookEnd = addDaysKst(shipIso, -(CHARGE_BEFORE_SHIP_DAYS - 1))
  const chargeIso = chargeDateFor(shipIso, timing)
  // 도착은 지역·택배사 사정이라 요일을 약속하지 않는다(사장님 2026-10-01 "수요일 도착이라는 말을 쓰지 말고").
  const arriveEnd = addDaysKst(shipIso, 2)
  const pay: Step = {
    key: 'pay',
    label: '결제',
    when: `${md(chargeIso)} ${weekdayKo(chargeIso)} 아침`,
    done: charged,
  }
  const cook: Step = {
    key: 'cook',
    label: '조리',
    when: mdRange(cookStart, cookEnd),
    done: today > cookEnd,
  }
  const ship: Step = { key: 'ship', label: '발송', when: `${md(shipIso)} ${weekdayKo(shipIso)}`, done: today > shipIso }
  const arrive: Step = {
    key: 'arrive',
    label: '도착',
    when: '발송 후 1~2일',
    done: today > arriveEnd,
  }
  return timing === 'ship_day' ? [cook, pay, ship, arrive] : [pay, cook, ship, arrive]
}

const STEP_ICON: Record<string, typeof CreditCard> = {
  pay: CreditCard,
  cook: CookingPot,
  ship: Truck,
  arrive: Home,
}

function SubCard({
  sub,
  name,
  dogPhoto,
  trial,
  timing,
  inProgress,
  paidAt,
  preview,
  busy,
  onCard,
  onSkip,
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
  /** 그 결제된 박스의 결제 시각. 모르면 null(옛 계산 next − 14). */
  paidAt: string | null
  preview: { chargeAmount: number; label: string | null } | null
  busy: boolean
  onCard: () => void
  onSkip: () => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onRatio: () => void
}) {
  const state = subscriptionState(sub)
  // 라벨·톤은 lib/subscription-state 정본 — 화면마다 다른 이름을 붙이지 않는다.
  const meta = { label: SUB_STATE_LABEL[state], tone: SUB_STATE_TONE[state] }
  const recipes = sub.subscription_items.map((i) => i.product_name.replace(/\s*\([^)]*\)\s*$/, '')).join(' · ')
  const today = todayKstIsoDate()

  const method = billingMethodSummary({
    registered: !!sub.has_billing_key,
    brand: sub.billing_card_brand,
    last4: sub.billing_card_last4,
  })

  // 금액 — 서버 미리보기(청구와 같은 함수)가 우선, 없으면 서포터즈 판정으로 대신한다.
  const tpRaw = trialPricing(trial, sub.total_amount)
  const shown = preview ? preview.chargeAmount : tpRaw ? tpRaw.chargeAmount : sub.total_amount
  const discounted = shown !== sub.total_amount

  // 결제일 — next_delivery_date 는 **발송일**이고, 결제일은 결제 시점으로 정한다(2026-10-01).
  const nextShip = sub.next_delivery_date
  const chargeIso = nextShip && timing ? chargeDateFor(nextShip, timing) : null
  /**
   * ★지난 날짜를 "결제 예정" 이라 부르지 않는다 (2026-08-07). 결제가 한 번 미끄러지면
   *  next_delivery_date 가 갱신되지 않은 채 과거로 흘러간다.
   */
  const overdue = chargeIso != null && chargeIso < today
  const when =
    state === 'active' && chargeIso
      ? overdue
        ? `${dateLabel(chargeIso)} 결제 예정이었어요 · 확인 중`
        : `${dateLabel(chargeIso)} 결제`
      : state === 'paused'
        ? '일시정지 중 · 다시 시작하면 다음 발송일부터'
        : state === 'needs_card'
          ? '결제수단을 등록하면 첫 배송일이 정해져요'
          : nextShip
            ? `다음 발송 ${dateLabel(nextShip)}`
            : '2주에 한 번'
  // 결제 시점을 모르는 활성 구독 — 결제 요일 대신 발송일만.
  const whenText = state === 'active' && !chargeIso && nextShip ? `다음 발송 ${dateLabel(nextShip)}` : when
  // 하루 약 얼마 — 2주(14일)치 한 박스. 100원 체험가처럼 작은 금액엔 의미가 없어 뺀다.
  const perDay = shown >= 1000 ? Math.round(shown / 14 / 10) * 10 : null

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
    ? boxSteps(journeyShip, timing ?? 'ship_day', inProgress, today).filter((st) => timing || st.key !== 'pay')
    : []
  const currentIdx = steps.findIndex((st) => !st.done)

  // 함께한 박스 — total_deliveries 는 결제 성공마다 오른다. 10칸(도장판과 같은 단위)으로 보여준다.
  const boxes = sub.total_deliveries
  const dots = Math.max(8, Math.min(10, boxes + 2))
  const filled = boxes % 10 === 0 && boxes > 0 ? 10 : boxes % 10

  const skipTo = nextShip ? nextCycleDate(nextShip) : null

  return (
    <section className={'sub-card is-' + meta.tone}>
      {/* ── 머리: 누구의 정기배송인지 ── */}
      <div className="sub-head">
        <span className="sub-avatar" aria-hidden>
          {dogPhoto ? (
            <Image src={dogPhoto} alt="" fill sizes="48px" className="object-cover" unoptimized />
          ) : (
            name.slice(0, 1)
          )}
        </span>
        <span className="sub-head-text">
          <span className="sub-head-name">{name} 정기배송</span>
          <span className="sub-head-sub">
            {[recipes || '레시피 정보 없음', sub.fresh_ratio != null ? freshTierLabel(sub.fresh_ratio) : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className={'sub-state is-' + meta.tone}>{meta.label}</span>
      </div>

      {/* ── 금액 = 주인공 ── */}
      <span className="sub-amount">
        {discounted && (
          <span className="sub-won" style={{ textDecoration: 'line-through', opacity: 0.55, marginRight: 6 }}>
            {sub.total_amount.toLocaleString('ko-KR')}원
          </span>
        )}
        {shown.toLocaleString('ko-KR')}
        <span className="sub-won">원</span>
      </span>
      <p className="sub-when">
        {whenText}
        {perDay && state === 'active' ? ` · 하루 약 ${perDay.toLocaleString('ko-KR')}원` : ''}
      </p>

      {/* 결제 실패만 경고로 — 놓치면 배송이 멈춘다. */}
      {state === 'card_failed' && (
        <p className="sub-warn">
          <AlertTriangle size={16} strokeWidth={2.4} />
          <span>
            결제가 되지 않았어요. 결제수단을 다시 등록하면 이어져요.
            {sub.last_failed_charge_reason ? ` (${sub.last_failed_charge_reason})` : ''}
          </span>
        </p>
      )}

      {/* ── 박스 여정 ── */}
      {steps.length > 0 && (
        <div className="sub-journey" aria-label={inProgress ? '이번 박스 진행' : '다음 박스 일정'}>
          <p className="sub-journey-title">{inProgress ? '이번 박스' : '다음 박스'}</p>
          <ol className="sub-steps" style={{ '--n': steps.length } as React.CSSProperties}>
            {steps.map((st, i) => {
              const Icon = STEP_ICON[st.key] ?? Check
              const cls = st.done ? 'is-done' : i === currentIdx ? 'is-now' : ''
              return (
                <li key={st.key} className={'sub-step ' + cls}>
                  <span className="sub-step-dot">
                    {st.done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} strokeWidth={2.2} />}
                  </span>
                  <span className="sub-step-label">{st.label}</span>
                  <span className="sub-step-when">{st.when}</span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {/* ── 함께한 박스 ── */}
      {(state === 'active' || state === 'paused') && (
        <div className="sub-boxes">
          <div className="sub-boxes-row">
            <span className="sub-kicker">함께한 박스</span>
            <span className="sub-boxes-count">
              {boxes > 0 ? `${boxes}번째 박스까지 받았어요` : '첫 박스를 준비하고 있어요'}
            </span>
          </div>
          <div className="sub-dots" aria-hidden>
            {Array.from({ length: dots }, (_, i) => (
              <span
                key={i}
                className={'sub-dot' + (i < filled ? ' is-on' : i === filled && state === 'active' ? ' is-next' : '')}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 관리 — 상태별로 '할 수 있는 것'만 ── */}
      {busy && (
        <p className="sub-busy-line">
          <Loader2 size={16} strokeWidth={2.4} className="animate-spin" /> 처리하고 있어요
        </p>
      )}

      {(state === 'needs_card' || state === 'card_failed') && (
        <button type="button" className="sub-btn is-primary" onClick={onCard}>
          <CreditCard size={18} strokeWidth={2.4} />
          {state === 'card_failed' ? '결제수단 다시 등록' : '결제수단 등록하고 시작'}
        </button>
      )}

      {state === 'paused' && (
        <button type="button" className="sub-btn is-primary" onClick={onResume} disabled={busy}>
          <Play size={18} strokeWidth={2.4} />
          다시 시작
        </button>
      )}

      {state === 'active' && (
        <div className="sub-tiles">
          <button type="button" className="sub-tile" onClick={onSkip} disabled={busy}>
            <SkipForward size={22} strokeWidth={2.2} />
            <span className="sub-tile-label">2주 미루기</span>
            {/* 결제된 이번 박스는 그대로 나간다(사장님 2026-10-01) — 미루는 건 그다음 박스라는 걸 타일에서 말한다. */}
            <span className="sub-tile-sub">
              {skipTo ? (inProgress ? `그다음 박스를 ${md(skipTo)}로` : `${md(skipTo)} 발송으로`) : '다음 박스를 2주 뒤로'}
            </span>
          </button>
          <button type="button" className="sub-tile" onClick={onPause} disabled={busy}>
            <Pause size={22} strokeWidth={2.2} />
            <span className="sub-tile-label">일시정지</span>
            <span className="sub-tile-sub">다시 시작할 때까지</span>
          </button>
          {/* 화식 비율 — 금액이 함께 바뀌므로 진행 중인 구독에만. 시트가 세 티어 금액을 보여주고 서버가 계산·저장. */}
          <button type="button" className="sub-tile" onClick={onRatio} disabled={busy}>
            <SlidersHorizontal size={22} strokeWidth={2.2} />
            <span className="sub-tile-label">화식 비율</span>
            <span className="sub-tile-sub">
              {sub.fresh_ratio != null ? `지금 ${freshTierLabel(sub.fresh_ratio)}` : '비율 바꾸기'}
            </span>
          </button>
          {/* ★ 정상 구독에도 결제수단 교체를 준다 (2026-07-30) — 카드가 만료되기 **전에** 바꿀 수 있게. */}
          <button type="button" className="sub-tile" onClick={onCard} disabled={busy}>
            <CreditCard size={22} strokeWidth={2.2} />
            <span className="sub-tile-label">결제수단</span>
            <span className="sub-tile-sub">{method}</span>
          </button>
        </div>
      )}

      {state !== 'cancelled' && (
        <button type="button" className="sub-cancel" onClick={onCancel} disabled={busy}>
          {/* 결제 이력이 없으면 '해지'가 아니라 '취소'다 (사장님 2026-07-30). */}
          {sub.total_deliveries > 0 ? '정기배송 해지' : '정기배송 신청 취소'}
        </button>
      )}

      <p className="sub-foot">
        {state === 'active'
          ? `${iGa(name)} 먹는 속도에 맞춰 다음 결제 전까지 미루거나 멈출 수 있어요. ${STOP_TIMING_COPY}`
          : state === 'needs_card'
            ? '등록 전까지는 아무것도 결제되지 않아요. 위약금도 없어요.'
            : '다음 결제 전까지 바꾸거나 그만둘 수 있어요. 위약금은 없어요.'}
      </p>
    </section>
  )
}

// ── 빈 상태 ─────────────────────────────────────────────────────────────────

function EmptyStart({ name, startHref }: { name: string; startHref: string }) {
  return (
    <section className="sub-empty">
      <PackageOpen size={22} strokeWidth={1.8} />
      <h2>{name}의 정기배송이 아직 없어요</h2>
      <p>
        분석 결과에 맞춘 레시피로 2주마다 보내드려요. 다음 결제 전까지 미루거나
        그만둘 수 있어요.
      </p>
      <Link href={startHref} className="sub-btn is-primary">
        정기배송 시작하기
      </Link>
    </section>
  )
}

// ── 해지 확인 ───────────────────────────────────────────────────────────────

/**
 * 파괴적 확인 시트.
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
  paidBoxInProgress: boolean
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  // 파괴적 다이얼로그 — Esc 닫기 + 포커스 트랩 + 스크롤 락 + 닫을 때 포커스 복귀
  // (2026-07-17 a11y). 마운트=열림이므로 open:true.
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalA11y({ open: true, onClose, containerRef: dialogRef })
  return (
    <>
      <div className="sub-scrim" onClick={onClose} />
      <div ref={dialogRef} className="sub-sheet" role="dialog" aria-modal="true">
        <button
          type="button"
          className="sub-sheet-x"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
        <h3>정말 {started ? '해지' : '취소'}할까요?</h3>
        <p>
          {started
            ? paidBoxInProgress
              ? `이미 결제된 박스는 조리가 시작돼 그대로 보내드려요. 해지하면 그다음 박스부터 배송과 결제가 멈춰요. ${name}의 기록과 분석은 그대로 남아 있고, 나중에 다시 시작할 수 있어요.`
              : `해지하면 ${name}의 다음 박스부터 배송과 결제가 멈춰요. 지금까지의 기록과 분석은 그대로 남아 있고, 나중에 다시 시작할 수 있어요.`
            : `아직 결제된 게 없어서 그냥 없어져요. ${name}의 기록과 분석은 그대로 남아 있고, 나중에 다시 신청할 수 있어요.`}
        </p>
        <div className="sub-sheet-btns">
          <button type="button" className="sub-btn" onClick={onClose}>
            그냥 둘게요
          </button>
          <button
            type="button"
            className="sub-btn is-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={13} strokeWidth={2.4} className="animate-spin" />
            ) : (
              <>
                <Check size={13} strokeWidth={2.6} />
                {started ? '해지하기' : '취소하기'}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
