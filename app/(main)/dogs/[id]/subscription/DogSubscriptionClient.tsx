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
 *  · active       → 건너뛰기 · 일시정지 · 해지
 *  · paused       → 재개 · 해지
 *  · card_failed  → 카드 재등록 (배너)
 *  · cancelled    → 다시 시작
 *
 * # 날짜
 * 배송일은 전부 화요일이다(lib/shipping-schedule). 건너뛰기·재개가 날짜를 새로
 * 잡을 때 반드시 nextShipDate/nextCycleDate 를 쓴다 — 예전엔 '오늘 + 14일' 이라
 * 오늘이 목요일이면 배송일이 목요일이 됐다.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  CalendarDays,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { petName, iGa } from '@/lib/korean'
import { nextShipDate, nextCycleDate, weekdayKo } from '@/lib/shipping-schedule'
import {
  subscriptionState,
  type SubState,
  type SubLike,
} from '@/lib/subscription-state'
import {
  trackSubscriptionPaused,
  trackSubscriptionResumed,
  trackSubscriptionCancelled,
} from '@/lib/analytics'
import { generateFallbackCustomerKey } from '@/lib/v3-helpers/subscriptions'
import './subscription.css'

export type DogSub = SubLike & {
  id: string
  interval_weeks: number
  total_deliveries: number
  total_amount: number
  fresh_ratio: number | null
  recipient_name: string | null
  address: string | null
  address_detail: string | null
  billing_card_brand: string | null
  billing_card_last4: string | null
  billing_customer_key: string | null
  last_failed_charge_reason: string | null
  created_at: string
  subscription_items: { product_name: string; quantity: number }[]
}

const FRESH_LABEL: Record<number, string> = {
  30: '곁들임 (화식 30%)',
  60: '반반 (화식 60%)',
  100: '완전 화식',
}

/** yyyy-mm-dd → "8월 4일 (화)". */
function dateLabel(iso: string): string {
  return `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일 (${weekdayKo(iso)})`
}

const STATE_META: Record<SubState, { label: string; tone: string }> = {
  needs_card: { label: '시작 전', tone: 'wait' },
  active: { label: '구독 중', tone: 'on' },
  paused: { label: '일시정지', tone: 'wait' },
  card_failed: { label: '결제 실패', tone: 'bad' },
  cancelled: { label: '해지됨', tone: 'off' },
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
      toast.success('정기배송을 해지했어요.')
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
        />
      ))}

      {live.length === 0 && <EmptyStart name={name} startHref={startHref} />}

      {past.length > 0 && (
        <details className="sub-past">
          <summary>지난 정기배송 {past.length}건</summary>
          {past.map((sub) => (
            <div className="sub-past-row" key={sub.id}>
              <span>{sub.created_at.slice(0, 10).replace(/-/g, '.')} 신청</span>
              <span>{sub.total_deliveries}회 배송 후 해지</span>
            </div>
          ))}
        </details>
      )}

      {cancelId && (
        <CancelSheet
          name={name}
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
}: {
  sub: DogSub
  name: string
  busy: boolean
  onCard: () => void
  onSkip: () => void
  onPause: () => void
  onResume: () => void
  onCancel: () => void
}) {
  const state = subscriptionState(sub)
  const meta = STATE_META[state]
  const recipes = sub.subscription_items.map((i) => i.product_name).join(' · ')

  return (
    <section className={'sub-card is-' + meta.tone}>
      <header className="sub-card-head">
        <span className={'sub-badge is-' + meta.tone}>{meta.label}</span>
        <span className="sub-amount">{sub.total_amount.toLocaleString()}원</span>
      </header>

      {/* 결제 실패 — 가장 먼저, 가장 크게. 이걸 놓치면 배송이 멈춘다. */}
      {state === 'card_failed' && (
        <div className="sub-alert">
          <AlertTriangle size={14} strokeWidth={2.4} />
          <div>
            <b>카드 결제가 되지 않았어요.</b>
            <p>
              카드를 다시 등록하면 정기배송이 이어져요.
              {sub.last_failed_charge_reason
                ? ` (${sub.last_failed_charge_reason})`
                : ''}
            </p>
          </div>
        </div>
      )}

      {/* 시작 전 — 왜 아직 아무 일도 안 일어나는지 먼저 말한다. */}
      {state === 'needs_card' && (
        <div className="sub-alert is-wait">
          <CreditCard size={14} strokeWidth={2.4} />
          <div>
            <b>아직 시작 전이에요.</b>
            <p>
              카드를 등록하면 첫 배송일이 잡혀요. 등록 전까지는 아무것도 결제되지
              않아요.
            </p>
          </div>
        </div>
      )}

      <dl className="sub-facts">
        <div>
          <dt>
            <PackageOpen size={12} strokeWidth={2.2} />
            받는 박스
          </dt>
          <dd>{recipes || '레시피 정보 없음'}</dd>
        </div>
        {sub.fresh_ratio != null && (
          <div>
            <dt>화식 비율</dt>
            <dd>{FRESH_LABEL[sub.fresh_ratio] ?? `화식 ${sub.fresh_ratio}%`}</dd>
          </div>
        )}
        <div>
          <dt>
            <CalendarDays size={12} strokeWidth={2.2} />
            다음 배송
          </dt>
          <dd>
            {sub.next_delivery_date ? (
              <strong>{dateLabel(sub.next_delivery_date)}</strong>
            ) : (
              <span className="sub-dim">카드 등록 후 정해져요</span>
            )}
          </dd>
        </div>
        <div>
          <dt>결제 카드</dt>
          <dd>
            {sub.billing_card_last4 ? (
              `${sub.billing_card_brand ?? '카드'} ····${sub.billing_card_last4}`
            ) : (
              <span className="sub-dim">등록 전</span>
            )}
          </dd>
        </div>
        {sub.total_deliveries > 0 && (
          <div>
            <dt>지금까지</dt>
            <dd>{sub.total_deliveries}번째 박스까지 받았어요</dd>
          </div>
        )}
      </dl>

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
            {state === 'card_failed' ? '카드 다시 등록' : '카드 등록하고 시작'}
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
            해지
          </button>
        )}
      </div>

      <p className="sub-foot">
        {state === 'active'
          ? `${iGa(name)} 먹는 속도에 맞춰 언제든 미루거나 멈출 수 있어요.`
          : '언제든 바꾸거나 그만둘 수 있어요. 위약금은 없어요.'}
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
        분석 결과에 맞춘 레시피로 2주마다 보내드려요. 언제든 미루거나 그만둘 수
        있어요.
      </p>
      <Link href={startHref} className="sub-btn is-primary">
        정기배송 시작하기
      </Link>
    </section>
  )
}

// ── 해지 확인 ───────────────────────────────────────────────────────────────

function CancelSheet({
  name,
  busy,
  onClose,
  onConfirm,
}: {
  name: string
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <>
      <div className="sub-scrim" onClick={onClose} />
      <div className="sub-sheet" role="dialog" aria-modal="true">
        <button
          type="button"
          className="sub-sheet-x"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
        <h3>정말 해지할까요?</h3>
        <p>
          해지하면 {name}의 다음 박스부터 배송과 결제가 멈춰요. 지금까지의 기록과
          분석은 그대로 남아 있고, 나중에 다시 시작할 수 있어요.
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
                해지하기
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
