'use client'

/**
 * SubscriptionsWebClient — /account/subscriptions 의 인터랙티브 본체 (FD 톤).
 *
 * 비즈니스 로직은 app 의 SubscriptionsClient(audit #101) 와 **동일** — 모든 액션은
 * RLS 보호 subscriptions 테이블 update + 카드재등록만 /subscribe/billing-auth
 * redirect. 위험한 KST 날짜 로직은 공용 헬퍼(lib/datetime-kst) 재사용이라 중복 0.
 * app client(폰프레임 v3) 는 손대지 않고, 웹 전용 FD UI 만 여기 별도로 둔다.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Pause,
  Play,
  RefreshCw,
  Bell,
  BellOff,
  AlertTriangle,
  CreditCard,
  Soup,
  X,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { todayKstIsoDate, addDaysKst, addMonthsKst } from '@/lib/datetime-kst'
import {
  trackSubscriptionPaused,
  trackSubscriptionResumed,
  trackSubscriptionCancelled,
} from '@/lib/analytics'
import {
  INTERVAL_LABELS,
  formatRetryAt,
  generateFallbackCustomerKey,
} from '@/lib/v3-helpers/subscriptions'
import type { Subscription } from '@/app/(main)/mypage/subscriptions/SubscriptionsClient'

type Props = {
  initialSubs: Subscription[]
  focusSubId: string | null
}

const STATUS_FD: Record<
  Subscription['status'],
  { label: string; color: string }
> = {
  active: { label: '구독 중', color: 'var(--fd-green)' },
  paused: { label: '일시정지', color: '#C28A2B' },
  cancelled: { label: '해지됨', color: 'var(--fd-muted)' },
}

const INTERVAL_OPTIONS = [1, 2, 4] as const

function formatKRW(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export default function SubscriptionsWebClient({ initialSubs, focusSubId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [subs, setSubs] = useState<Subscription[]>(initialSubs)
  const [editingInterval, setEditingInterval] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [cancelSubId, setCancelSubId] = useState<string | null>(null)

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
    const { data } = await supabase
      .from('subscriptions')
      .select('*, subscription_items(*), dogs(id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (data) setSubs(data as Subscription[])
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
    const update: Record<string, unknown> = weeks
      ? (() => {
          const sub = subs.find((s) => s.id === subId)
          const baseIso = sub?.next_delivery_date ?? todayKstIsoDate()
          return { next_delivery_date: addDaysKst(baseIso, weeks * 7) }
        })()
      : { status: 'paused' }
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
        `다음 배송을 ${weeks}주 미뤘어요. 정기배송 관리에서 되돌릴 수 있어요.`,
      )
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
        '카드 재등록이 필요해요. 결제 카드를 다시 등록한 뒤 자동으로 다시 시작돼요.',
      )
      setActionLoading(null)
      return
    }
    if (!sub.billing_card_last4) {
      toast.info('결제 카드 등록이 필요해요. 카드를 등록하면 정기배송이 시작돼요.')
      const customerKey = sub.billing_customer_key ?? generateFallbackCustomerKey()
      router.push(
        `/subscribe/billing-auth?subscriptionId=${sub.id}&customerKey=${encodeURIComponent(customerKey)}`,
      )
      setActionLoading(null)
      return
    }
    const todayIso = todayKstIsoDate()
    const isBoxSub = !!sub.dog_id && sub.coverage_weeks != null
    const nextIso = isBoxSub
      ? sub.coverage_weeks === 2
        ? addDaysKst(todayIso, 15)
        : addMonthsKst(todayIso, 1)
      : addDaysKst(todayIso, sub.interval_weeks * 7)
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: 'active', next_delivery_date: nextIso })
      .eq('id', subId)
      .eq('user_id', uid)
    if (error) {
      toast.error('다시 시작하지 못했어요. 잠시 후 다시 시도해 주세요')
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

  async function handleChangeInterval(subId: string, newInterval: number) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) {
      setActionLoading(null)
      return
    }
    const nextDate = addDaysKst(todayKstIsoDate(), newInterval * 7)
    const { error } = await supabase
      .from('subscriptions')
      .update({ interval_weeks: newInterval, next_delivery_date: nextDate })
      .eq('id', subId)
      .eq('user_id', uid)
    if (error) {
      toast.error('주기를 변경하지 못했어요. 잠시 후 다시 시도해 주세요')
      setActionLoading(null)
      return
    }
    setEditingInterval(null)
    await reload()
    setActionLoading(null)
  }

  if (subs.length === 0) {
    return (
      <div
        className="rounded-[14px] px-6 py-10 md:px-10 md:py-12 text-center"
        style={{ background: '#FFFFFF', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
      >
        <span
          className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-4"
          style={{ background: 'var(--fd-cream)' }}
        >
          <Soup className="w-6 h-6" strokeWidth={1.75} style={{ color: 'var(--fd-pine)' }} />
        </span>
        <div
          className="text-[17px] md:text-[19px]"
          style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}
        >
          아직 정기배송이 없어요
        </div>
        <p
          className="mt-3 text-[12.5px] md:text-[14px] leading-relaxed"
          style={{ color: 'var(--fd-muted)', maxWidth: 420, marginInline: 'auto' }}
        >
          2분 설문으로 우리 아이 맞춤 식단을 설계하고 정기배송을 시작해 보세요.
        </p>
        <a
          href="/start"
          className="mt-6 inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-[13px] font-bold transition hover:brightness-[0.94] active:scale-[0.98]"
          style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
        >
          맞춤 플랜 시작하기
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {subs.map((sub) => {
        const status = STATUS_FD[sub.status] || STATUS_FD.active
        const isActive = sub.status === 'active'
        const isPaused = sub.status === 'paused'
        const isCancelled = sub.status === 'cancelled'
        const needsRenewal = sub.requires_billing_key_renewal === true
        const hasFailureSignal =
          !isCancelled &&
          (needsRenewal || (sub.failed_charge_count ?? 0) > 0 || !!sub.next_retry_at)
        const isLoading = actionLoading === sub.id
        const isEditing = editingInterval === sub.id

        return (
          <div
            key={sub.id}
            id={`sub-${sub.id}`}
            className="rounded-[14px] overflow-hidden"
            style={{
              background: '#FFFFFF',
              boxShadow: `inset 0 0 0 1px ${needsRenewal ? 'var(--fd-coral)' : 'var(--fd-line)'}`,
              opacity: isCancelled ? 0.6 : 1,
            }}
          >
            {/* 상태 헤더 */}
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--fd-line)', background: 'var(--fd-offwhite)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: status.color }}
                />
                <span
                  className="text-[11px] font-bold uppercase tracking-wider shrink-0"
                  style={{ color: status.color }}
                >
                  {status.label}
                </span>
                {sub.dogs && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: 'var(--fd-cream)', color: 'var(--fd-pine)', fontWeight: 700 }}
                  >
                    🐶 {sub.dogs.name}
                  </span>
                )}
                {sub.coverage_weeks && (
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full shrink-0 truncate"
                    style={{ background: 'var(--fd-cream)', color: 'var(--fd-pine)', fontWeight: 700 }}
                  >
                    {sub.coverage_weeks === 2 ? '2주치 · 하이브리드' : '4주치 · 풀 화식'}
                  </span>
                )}
              </div>
              {sub.next_delivery_date && !isCancelled && (
                <span
                  className="text-[11px] font-mono shrink-0"
                  style={{ color: 'var(--fd-muted)', letterSpacing: '0.04em' }}
                >
                  {new Date(sub.next_delivery_date).toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                  })}{' '}
                  배송
                </span>
              )}
            </div>

            {/* 결제 실패 / 카드 재등록 배너 */}
            {hasFailureSignal && (
              <div
                className="px-5 py-3.5"
                style={{
                  borderBottom: '1px solid var(--fd-line)',
                  background: 'color-mix(in srgb, var(--fd-coral) 7%, transparent)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="w-4 h-4 shrink-0 mt-0.5"
                    strokeWidth={2.2}
                    style={{ color: 'var(--fd-coral)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-bold" style={{ color: 'var(--fd-coral-text)' }}>
                      {needsRenewal
                        ? '카드 정보를 다시 등록해 주세요'
                        : sub.next_retry_at
                          ? '결제가 일시 실패했어요'
                          : `결제 ${sub.failed_charge_count}회 실패`}
                    </div>
                    {sub.last_failed_charge_reason && (
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-muted)' }}>
                        {sub.last_failed_charge_reason}
                      </div>
                    )}
                    {sub.next_retry_at && !needsRenewal && (
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--fd-muted)' }}>
                        {formatRetryAt(sub.next_retry_at)} 재시도 예정
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleReRegisterCard(sub)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition hover:brightness-[0.94] active:scale-[0.98]"
                      style={{ background: 'var(--fd-coral)', color: '#FFFFFF' }}
                    >
                      <CreditCard className="w-3.5 h-3.5" strokeWidth={2.2} />
                      결제 카드 재등록
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 상품 라인 */}
            <div className="px-5 py-4 flex flex-col gap-3">
              {sub.subscription_items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span
                    className="relative w-11 h-11 rounded-[8px] overflow-hidden shrink-0"
                    style={{ background: 'var(--fd-cream)' }}
                  >
                    {it.product_image_url ? (
                      <Image
                        src={it.product_image_url}
                        alt={it.product_name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Soup className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--fd-muted)' }} />
                      </span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold truncate" style={{ color: 'var(--fd-pine)' }}>
                      {it.product_name}
                    </div>
                    <div className="text-[11.5px]" style={{ color: 'var(--fd-muted)' }}>
                      {formatKRW(it.unit_price)} · {it.quantity}개
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 메타 — 주기 / 금액 */}
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--fd-line)', background: 'var(--fd-offwhite)' }}
            >
              <span className="text-[12px]" style={{ color: 'var(--fd-muted)' }}>
                배송 주기{' '}
                <b style={{ color: 'var(--fd-pine)' }}>
                  {INTERVAL_LABELS[sub.interval_weeks] ?? `${sub.interval_weeks}주마다`}
                </b>
              </span>
              <span className="text-[13px] font-extrabold" style={{ color: 'var(--fd-pine)' }}>
                {formatKRW(sub.total_amount)}
              </span>
            </div>

            {/* 주기 변경 패널 */}
            {isEditing && !isCancelled && (
              <div className="px-5 py-3.5" style={{ borderTop: '1px solid var(--fd-line)' }}>
                <div className="text-[11.5px] font-bold mb-2" style={{ color: 'var(--fd-muted)' }}>
                  배송 주기 변경
                </div>
                <div className="flex gap-2">
                  {INTERVAL_OPTIONS.map((w) => {
                    const selected = sub.interval_weeks === w
                    return (
                      <button
                        key={w}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleChangeInterval(sub.id, w)}
                        className="flex-1 py-2.5 rounded-full text-[12.5px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                        style={
                          selected
                            ? { background: 'var(--fd-pine)', color: '#FFFFFF' }
                            : { background: 'transparent', color: 'var(--fd-pine)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }
                        }
                      >
                        {INTERVAL_LABELS[w]}
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setEditingInterval(null)}
                  className="mt-2 text-[11.5px] font-bold"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  닫기
                </button>
              </div>
            )}

            {/* 배송 알림 토글 */}
            {!isCancelled && (
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--fd-line)' }}
              >
                <div className="flex items-center gap-2">
                  {sub.reminder_enabled ? (
                    <Bell className="w-3.5 h-3.5" strokeWidth={2} style={{ color: 'var(--fd-pine)' }} />
                  ) : (
                    <BellOff className="w-3.5 h-3.5" strokeWidth={2} style={{ color: 'var(--fd-muted)' }} />
                  )}
                  <span className="text-[12px]" style={{ color: 'var(--fd-pine)' }}>
                    배송 전 알림
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sub.reminder_enabled}
                  onClick={() => handleToggleReminder(sub.id, !sub.reminder_enabled)}
                  className="relative w-10 h-6 rounded-full transition"
                  style={{ background: sub.reminder_enabled ? 'var(--fd-green)' : 'var(--fd-line)' }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{ left: 2, transform: sub.reminder_enabled ? 'translateX(16px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            )}

            {/* 액션 버튼들 */}
            {!isCancelled && (
              <div className="px-5 py-3.5 flex flex-wrap gap-2" style={{ borderTop: '1px solid var(--fd-line)' }}>
                {!isEditing && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => setEditingInterval(sub.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                    style={{ color: 'var(--fd-pine)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                    주기 변경
                  </button>
                )}
                {isActive && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handlePause(sub.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                    style={{ color: 'var(--fd-pine)', boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
                  >
                    <Pause className="w-3.5 h-3.5" strokeWidth={2} />
                    일시정지
                  </button>
                )}
                {isPaused && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleResume(sub.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'var(--fd-green)', color: '#FFFFFF' }}
                  >
                    <Play className="w-3.5 h-3.5" strokeWidth={2} />
                    다시 시작
                  </button>
                )}
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setCancelSubId(sub.id)}
                  className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition active:scale-[0.98] disabled:opacity-50"
                  style={{ color: 'var(--fd-muted)' }}
                >
                  해지
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* 해지 확인 모달 */}
      {cancelSubId && (
        <CancelModal
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
            void handlePause(id, 4)
          }}
        />
      )}
    </div>
  )
}

function CancelModal({
  loading,
  onClose,
  onConfirm,
  onPauseInstead,
  onSkipInstead,
}: {
  loading: boolean
  onClose: () => void
  onConfirm: () => void
  onPauseInstead: () => void
  onSkipInstead: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="정기배송 해지"
      style={{ background: 'rgba(22,20,15,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md rounded-t-[18px] md:rounded-[18px] p-6"
        style={{ background: '#FFFFFF' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div
            className="text-[18px]"
            style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}
          >
            정기배송을 해지할까요?
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 -m-1">
            <X className="w-5 h-5" strokeWidth={2} style={{ color: 'var(--fd-muted)' }} />
          </button>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: 'var(--fd-muted)' }}>
          해지하면 다음 배송이 진행되지 않아요. 잠시 쉬어가는 거라면 일시정지나
          건너뛰기를 추천드려요.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onSkipInstead}
            disabled={loading}
            className="flex items-center justify-between px-4 py-3 rounded-[10px] text-left transition active:scale-[0.99] disabled:opacity-50"
            style={{ boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
          >
            <span>
              <span className="block text-[13.5px] font-bold" style={{ color: 'var(--fd-pine)' }}>
                4주 건너뛰기
              </span>
              <span className="block text-[11.5px]" style={{ color: 'var(--fd-muted)' }}>
                다음 배송만 미루고 구독은 유지
              </span>
            </span>
            <ChevronRight className="w-4 h-4" strokeWidth={2} style={{ color: 'var(--fd-muted)' }} />
          </button>
          <button
            type="button"
            onClick={onPauseInstead}
            disabled={loading}
            className="flex items-center justify-between px-4 py-3 rounded-[10px] text-left transition active:scale-[0.99] disabled:opacity-50"
            style={{ boxShadow: 'inset 0 0 0 1px var(--fd-line)' }}
          >
            <span>
              <span className="block text-[13.5px] font-bold" style={{ color: 'var(--fd-pine)' }}>
                일시정지
              </span>
              <span className="block text-[11.5px]" style={{ color: 'var(--fd-muted)' }}>
                언제든 다시 시작할 수 있어요
              </span>
            </span>
            <ChevronRight className="w-4 h-4" strokeWidth={2} style={{ color: 'var(--fd-muted)' }} />
          </button>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="mt-4 w-full py-3 rounded-full text-[13px] font-bold transition active:scale-[0.99] disabled:opacity-50"
          style={{ color: 'var(--fd-coral-text)', boxShadow: 'inset 0 0 0 1px var(--fd-coral)' }}
        >
          {loading ? '해지하는 중…' : '네, 해지할게요'}
        </button>
      </div>
    </div>
  )
}
