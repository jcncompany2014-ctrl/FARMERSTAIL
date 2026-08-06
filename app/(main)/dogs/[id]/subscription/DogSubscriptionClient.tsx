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
} from 'lucide-react'
import FreshRatioSheet from '@/components/subscription/FreshRatioSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { petName, iGa } from '@/lib/korean'
import { nextShipDate, nextCycleDate, weekdayKo } from '@/lib/shipping-schedule'
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
import { todayKstIsoDate } from '@/lib/datetime-kst'

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
  billing_key: string | null
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
  startHref,
}: {
  initialSubs: DogSub[]
  dogName: string
  startHref: string
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
    const base = sub.next_delivery_date ?? nextShipDate()
    const next = nextCycleDate(base)
    if (await patch(sub.id, { next_delivery_date: next })) {
      toast.success(`다음 배송을 ${dateLabel(next)}로 미뤘어요.`)
    }
    setBusy(null)
  }

  async function pause(sub: DogSub) {
    setBusy(sub.id)
    if (await patch(sub.id, { status: 'paused' })) {
      trackSubscriptionPaused({ subscriptionId: sub.id, reason: 'user_action' })
      toast.success('정기배송을 일시정지했어요. 언제든 다시 시작할 수 있어요.')
    }
    setBusy(null)
  }

  async function resume(sub: DogSub) {
    setBusy(sub.id)
    // 재개하면 다음 화요일부터. '오늘 + 14일' 로 잡으면 오늘 요일로 어긋난다.
    const next = nextShipDate()
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
              onChanged={() => {
                toast.success('화식 비율을 바꿨어요')
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
          busy={busy === cancelId}
          onClose={() => setCancelId(null)}
          onConfirm={() => cancel(cancelId)}
        />
      )}
    </div>
  )
}

// ── 구독 카드 ───────────────────────────────────────────────────────────────

function SubCard({
  sub,
  name,
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
  const recipes = sub.subscription_items.map((i) => i.product_name).join(' · ')

  const method = billingMethodSummary({
    registered: !!sub.billing_key,
    brand: sub.billing_card_brand,
    last4: sub.billing_card_last4,
  })

  /**
   * 금액 아래 한 줄 — 언제 무슨 일이 일어나는지.
   *
   * ★지난 날짜를 "결제 예정" 이라 부르지 않는다 (2026-08-07). 결제가 한 번
   *  미끄러지면 next_delivery_date 가 갱신되지 않은 채 과거로 흘러간다.
   */
  const overdue =
    sub.next_delivery_date != null &&
    sub.next_delivery_date < todayKstIsoDate()
  const when =
    state === 'active' && sub.next_delivery_date
      ? overdue
        ? `${dateLabel(sub.next_delivery_date)} 예정이었어요 · 확인 중`
        : `${dateLabel(sub.next_delivery_date)} 결제 예정`
      : state === 'paused'
        ? '일시정지 중 · 재개하면 다음 화요일부터'
        : sub.next_delivery_date
          ? `다음 배송 ${dateLabel(sub.next_delivery_date)}`
          : '2주에 한 번'

  /** 박스 내용 한 줄 — 옛 '받는 박스' + '화식 비율' 두 행을 합쳤다. */
  const boxLine = [recipes || '레시피 정보 없음']
    .concat(sub.fresh_ratio != null ? [freshTierLabel(sub.fresh_ratio)] : [])
    .join(' · ')

  /** 두 번째 줄 — 상태마다 지금 알아야 할 것 하나만. */
  const subLine =
    state === 'needs_card'
      ? '첫 배송은 결제수단 등록 후 정해져요'
      : [method, sub.total_deliveries > 0 ? `${sub.total_deliveries}번째 박스까지 받았어요` : null]
          .filter(Boolean)
          .join(' · ')

  return (
    <section className={'sub-card is-' + meta.tone}>
      {/* 상태 → 금액 → 언제. 위에서 아래로 한 번에 읽힌다.
          옛 구조는 배지와 금액을 좌우로 벌려놓고 그 아래 안내 상자 + label:값
          4행이 있었다 — 정보는 같은데 부피만 두 배였다(사장님 2026-07-30). */}
      <span className={'sub-state is-' + meta.tone}>{meta.label}</span>
      <span className="sub-amount">
        {sub.total_amount.toLocaleString('ko-KR')}
        <span className="sub-won">원</span>
      </span>
      <p className="sub-when">{when}</p>

      {/* 결제 실패만 경고로 남긴다 — 상자가 아니라 한 줄. */}
      {state === 'card_failed' && (
        <p className="sub-warn">
          <AlertTriangle size={13} strokeWidth={2.4} />
          <span>
            결제가 되지 않았어요. 결제수단을 다시 등록하면 이어져요.
            {sub.last_failed_charge_reason
              ? ` (${sub.last_failed_charge_reason})`
              : ''}
          </span>
        </p>
      )}

      <div className="sub-lines">
        <p>{boxLine}</p>
        {subLine && <p>{subLine}</p>}
      </div>

      {/* 액션 — 상태별로 '할 수 있는 것'만. 시작도 안 한 구독에 일시정지·
          건너뛰기를 주지 않는다(그게 이 화면의 옛 문제였다). */}
      <div className="sub-actions">
        {busy && (
          <span className="sub-busy">
            <Loader2 size={13} strokeWidth={2.4} className="animate-spin" />
          </span>
        )}

        {(state === 'needs_card' || state === 'card_failed') && (
          <button type="button" className="sub-btn is-primary" onClick={onCard}>
            <CreditCard size={13} strokeWidth={2.4} />
            {state === 'card_failed' ? '결제수단 다시 등록' : '결제수단 등록하고 시작'}
          </button>
        )}

        {state === 'active' && (
          <>
            <button type="button" className="sub-btn" onClick={onSkip} disabled={busy}>
              <SkipForward size={13} strokeWidth={2.4} />
              2주 미루기
            </button>
            <button type="button" className="sub-btn" onClick={onPause} disabled={busy}>
              <Pause size={13} strokeWidth={2.4} />
              일시정지
            </button>
            {/* 화식 비율 — 금액이 함께 바뀌므로 진행 중인 구독에만 준다.
                시트가 세 티어 금액을 다 보여주고, 계산·저장은 서버가 한다. */}
            <button type="button" className="sub-btn" onClick={onRatio} disabled={busy}>
              <SlidersHorizontal size={13} strokeWidth={2.4} />
              화식 비율
            </button>
            {/* ★ 정상 구독에도 결제수단 교체를 준다 (2026-07-30).
                예전엔 needs_card·card_failed 에서만 이 버튼이 떴다 — 즉 **카드가
                잘 걸린 사람은 카드를 바꿀 방법이 없었다.** 그런데 FAQ 는 "마이페이지
                → 정기배송에서 새 카드로 교체하면 다음 회차부터 새 카드로 결제돼요"
                라고 안내하고 있었다. 이동하는 화면(goCard)과 교체 로직은 이미 있어서
                진입점만 없던 상태였다 — 카드가 만료되기 **전에** 바꾸려는 사람이
                결제 실패를 기다려야 했다. */}
            <button type="button" className="sub-btn" onClick={onCard} disabled={busy}>
              <CreditCard size={13} strokeWidth={2.4} />
              결제수단 바꾸기
            </button>
          </>
        )}

        {state === 'paused' && (
          <button
            type="button"
            className="sub-btn is-primary"
            onClick={onResume}
            disabled={busy}
          >
            <Play size={13} strokeWidth={2.4} />
            다시 시작
          </button>
        )}

        {state !== 'cancelled' && (
          <button type="button" className="sub-btn is-quiet" onClick={onCancel} disabled={busy}>
            {/* 결제 이력이 없으면 '해지'가 아니라 '취소'다 — 멈출 게 없다
                (사장님 2026-07-30 "결제 전인데 왜 해지로 뜨는거야"). */}
            {sub.total_deliveries > 0 ? '해지' : '취소'}
          </button>
        )}
      </div>

      <p className="sub-foot">
        {state === 'active'
          ? `${iGa(name)} 먹는 속도에 맞춰 다음 결제 전까지 미루거나 멈출 수 있어요.`
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
  busy,
  onClose,
  onConfirm,
}: {
  name: string
  started: boolean
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
            ? `해지하면 ${name}의 다음 박스부터 배송과 결제가 멈춰요. 지금까지의 기록과 분석은 그대로 남아 있고, 나중에 다시 시작할 수 있어요.`
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
