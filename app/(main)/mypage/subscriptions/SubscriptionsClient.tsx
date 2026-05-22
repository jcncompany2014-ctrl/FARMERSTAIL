'use client'

/**
 * SubscriptionsClient — v3 reskin (2026-05-22, R9-3).
 *
 * 비즈니스 로직(일시정지/재개/해지/주기변경/알림/카드재등록)은 audit #101 그대로.
 * 시각만 v3 톤 통일:
 *   - 카드: paperHi + 1px ink rule + radius 4
 *   - 상태 행: 컬러 bg 대신 Mono 상태 키커 + 점/Chip
 *   - 결제 실패 배너: accent / sale tint + AlertTriangle 유지
 *   - 액션 버튼: ink rule outline + 액센트 텍스트
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Repeat,
  Package,
  Soup,
  Check,
  Pause,
  Play,
  RefreshCw,
  Bell,
  BellOff,
  AlertTriangle,
  CreditCard,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  trackSubscriptionPaused,
  trackSubscriptionResumed,
  trackSubscriptionCancelled,
} from '@/lib/analytics'
import { V3, V3FontSize, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono, Modal } from '@/components/v3'

/**
 * billing-auth fallback customerKey 생성기 — module-scope.
 */
function generateFallbackCustomerKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

type SubscriptionItem = {
  product_name: string
  product_image_url: string | null
  quantity: number
  unit_price: number
}

export type Subscription = {
  id: string
  status: 'active' | 'paused' | 'cancelled'
  interval_weeks: number
  coverage_weeks: number | null
  next_delivery_date: string | null
  last_delivery_date: string | null
  total_deliveries: number
  subtotal: number
  shipping_fee: number
  total_amount: number
  recipient_name: string | null
  created_at: string
  reminder_enabled: boolean
  reminder_days_before: number
  dog_id: string | null
  dogs: { id: string; name: string } | null
  subscription_items: SubscriptionItem[]
  billing_card_brand: string | null
  billing_card_last4: string | null
  billing_customer_key: string | null
  failed_charge_count: number
  last_failed_charge_at: string | null
  last_failed_charge_reason: string | null
  last_failed_charge_code: string | null
  next_retry_at: string | null
  requires_billing_key_renewal: boolean
}

type StatusToken = 'sage' | 'yellow' | 'inkMute'
const STATUS_MAP: Record<Subscription['status'], { label: string; tone: StatusToken }> = {
  active: { label: '구독 중', tone: 'sage' },
  paused: { label: '일시정지', tone: 'yellow' },
  cancelled: { label: '해지됨', tone: 'inkMute' },
}

const INTERVAL_LABELS: Record<number, string> = {
  1: '매주',
  2: '2주마다',
  4: '4주마다',
}

type Props = {
  initialSubs: Subscription[]
  isNew: boolean
  focusSubId: string | null
}

export default function SubscriptionsClient({
  initialSubs,
  isNew,
  focusSubId,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [subs, setSubs] = useState<Subscription[]>(initialSubs)
  const [showNewBanner, setShowNewBanner] = useState(isNew)
  const [editingInterval, setEditingInterval] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  // R10-3b: browser confirm() 대체 — 해지 확인 modal 상태.
  const [cancelSubId, setCancelSubId] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) {
      const timer = setTimeout(() => setShowNewBanner(false), 4000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [isNew])

  useEffect(() => {
    if (!focusSubId) return
    const el = document.getElementById(`sub-${focusSubId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const prevShadow = el.style.boxShadow
    const prevTransition = el.style.transition
    el.style.transition = 'box-shadow 0.25s ease-out'
    el.style.boxShadow =
      `0 0 0 2px ${V3.accent}, 0 0 0 4px ${V3.paper}`
    const t = setTimeout(() => {
      el.style.boxShadow = prevShadow
      setTimeout(() => {
        el.style.transition = prevTransition
      }, 250)
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
    if (!uid) return
    const update: Record<string, unknown> = weeks
      ? (() => {
          const sub = subs.find((s) => s.id === subId)
          const base = sub?.next_delivery_date
            ? new Date(sub.next_delivery_date)
            : new Date()
          base.setDate(base.getDate() + weeks * 7)
          return {
            next_delivery_date: base.toISOString().split('T')[0],
          }
        })()
      : { status: 'paused' }
    await (supabase as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<unknown>
          }
        }
      }
    })
      .from('subscriptions')
      .update(update)
      .eq('id', subId)
      .eq('user_id', uid)
    if (!weeks) {
      trackSubscriptionPaused({ subscriptionId: subId, reason: 'user_action' })
    }
    await reload()
    setActionLoading(null)
  }

  async function handleResume(subId: string) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) return
    const sub = subs.find((s) => s.id === subId)
    if (!sub) return
    const nextDate = new Date()
    const isBoxSub = !!sub.dog_id && sub.coverage_weeks != null
    if (isBoxSub) {
      if (sub.coverage_weeks === 2) {
        nextDate.setDate(nextDate.getDate() + 15)
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1)
      }
    } else {
      nextDate.setDate(nextDate.getDate() + sub.interval_weeks * 7)
    }

    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        next_delivery_date: nextDate.toISOString().split('T')[0],
      })
      .eq('id', subId)
      .eq('user_id', uid)
    trackSubscriptionResumed({ subscriptionId: subId })
    await reload()
    setActionLoading(null)
  }

  /**
   * 해지 실행 — Modal 의 confirm 액션이 호출. 이전엔 browser confirm() 으로
   * 인라인 분기했지만 Modal 도입 후 분리.
   */
  async function performCancel(subId: string) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) {
      setActionLoading(null)
      return
    }
    const sub = subs.find((s) => s.id === subId)
    await (supabase as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<unknown>
          }
        }
      }
    })
      .from('subscriptions')
      .update({ status: 'cancelled', next_delivery_date: null })
      .eq('id', subId)
      .eq('user_id', uid)
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
    await supabase
      .from('subscriptions')
      .update({ reminder_enabled: enabled })
      .eq('id', subId)
      .eq('user_id', uid)
    await reload()
  }

  async function handleChangeReminderDays(subId: string, days: number) {
    const uid = await requireUid()
    if (!uid) return
    await supabase
      .from('subscriptions')
      .update({ reminder_days_before: days })
      .eq('id', subId)
      .eq('user_id', uid)
    await reload()
  }

  function handleReRegisterCard(sub: Subscription) {
    const customerKey = sub.billing_customer_key ?? generateFallbackCustomerKey()
    const url = `/subscribe/billing-auth?subscriptionId=${encodeURIComponent(
      sub.id,
    )}&customerKey=${encodeURIComponent(customerKey)}`
    router.push(url)
  }

  async function handleChangeInterval(subId: string, newInterval: number) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) return
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + newInterval * 7)

    await supabase
      .from('subscriptions')
      .update({
        interval_weeks: newInterval,
        next_delivery_date: nextDate.toISOString().split('T')[0],
      })
      .eq('id', subId)
      .eq('user_id', uid)

    setEditingInterval(null)
    await reload()
    setActionLoading(null)
  }

  return (
    <main style={{ padding: '24px 20px 128px' }}>
      <div className="max-w-md mx-auto">
        {/* Back link */}
        <Link
          href="/mypage"
          style={{
            fontSize: 11,
            color: V3.inkMute,
            textDecoration: 'none',
            fontWeight: V3FontWeight.semibold,
          }}
        >
          ← 내 정보
        </Link>

        {/* Heading */}
        <div style={{ marginTop: 14 }}>
          <Mono color="inkMute" size="xs" weight={500}>
            Subscriptions · 정기배송
          </Mono>
        </div>
        <h1
          className="flex items-center"
          style={{
            margin: '6px 0 0',
            gap: 8,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 28,
            color: V3.ink,
            letterSpacing: V3LetterSpacing.heading,
            lineHeight: 1,
          }}
        >
          <Repeat size={22} color={V3.sage} strokeWidth={2.2} />
          내 정기배송
        </h1>

        {showNewBanner && (
          <div
            style={{
              marginTop: 16,
              padding: '14px 16px',
              background: 'color-mix(in srgb, ' + V3.sage + ' 10%, transparent)',
              border: `1px solid ${V3.sage}`,
              borderRadius: V3Radius.sm,
            }}
          >
            <div
              className="flex items-center"
              style={{
                gap: 6,
                fontSize: 13,
                fontWeight: V3FontWeight.bold,
                color: V3.sage,
              }}
            >
              <Check size={16} strokeWidth={2.5} />
              정기배송이 신청되었어요!
            </div>
            <div
              style={{ fontSize: 11, color: V3.inkMute, marginTop: 4 }}
            >
              배송일 전에 안내 연락을 드릴게요.
            </div>
          </div>
        )}

        {subs.length === 0 ? (
          <div
            className="text-center"
            style={{
              marginTop: 32,
              borderRadius: V3Radius.sm,
              border: `1.5px dashed ${V3.rule}`,
              padding: '48px 20px',
              background: V3.paperHi,
            }}
          >
            <div
              className="mx-auto flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                marginBottom: 16,
              }}
            >
              <Package size={24} color={V3.inkMute} strokeWidth={1.3} />
            </div>
            <Mono color="sage" size="xxs" weight={600}>
              Start
            </Mono>
            <h3
              style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 18,
                color: V3.ink,
                letterSpacing: V3LetterSpacing.heading,
              }}
            >
              아직 신청한 정기배송이 없어요
            </h3>
            <p
              style={{
                fontSize: 12,
                color: V3.inkMute,
                marginTop: 8,
                lineHeight: 1.55,
                maxWidth: 260,
                marginInline: 'auto',
              }}
            >
              꾸준한 영양 공급, 더 저렴한 가격. 정기배송으로 시작해보세요
            </p>
            <Link
              href="/products"
              className="inline-flex items-center active:scale-[0.98] transition"
              style={{
                marginTop: 20,
                gap: 4,
                padding: '12px 24px',
                borderRadius: V3Radius.pill,
                fontSize: 12,
                fontWeight: V3FontWeight.bold,
                background: V3.ink,
                color: V3.paperHi,
                textDecoration: 'none',
              }}
            >
              제품 둘러보기
            </Link>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subs.map((sub) => {
              const status = STATUS_MAP[sub.status] || STATUS_MAP.active
              const isActive = sub.status === 'active'
              const isPaused = sub.status === 'paused'
              const isCancelled = sub.status === 'cancelled'
              const isEditing = editingInterval === sub.id
              const isLoading = actionLoading === sub.id

              const needsRenewal = sub.requires_billing_key_renewal === true
              const hasFailureSignal =
                !isCancelled &&
                (needsRenewal ||
                  (sub.failed_charge_count ?? 0) > 0 ||
                  !!sub.next_retry_at)

              const statusToneColor =
                status.tone === 'sage'
                  ? V3.sage
                  : status.tone === 'yellow'
                    ? V3.yellow
                    : V3.inkMute

              return (
                <div
                  key={sub.id}
                  id={`sub-${sub.id}`}
                  style={{
                    background: V3.paperHi,
                    border: `1px solid ${needsRenewal ? V3.sale : V3.rule}`,
                    borderRadius: V3Radius.sm,
                    overflow: 'hidden',
                    opacity: isCancelled ? 0.55 : 1,
                    transition: 'box-shadow 0.25s ease-out',
                  }}
                >
                  {/* Status header */}
                  <div
                    className="flex items-center justify-between"
                    style={{
                      padding: '10px 16px',
                      borderBottom: `1px solid ${V3.rule}`,
                      background: V3.paper,
                    }}
                  >
                    <div className="flex items-center" style={{ gap: 8, flex: 1, minWidth: 0 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          background: statusToneColor,
                        }}
                      />
                      <Mono color={status.tone} size="xxs" weight={700}>
                        {status.label}
                      </Mono>
                      {sub.dogs && (
                        <Link
                          href={`/dogs/${sub.dogs.id}`}
                          className="truncate"
                          style={{
                            fontSize: 10,
                            fontWeight: V3FontWeight.bold,
                            padding: '2px 8px',
                            borderRadius: V3Radius.pill,
                            background: V3.paperHi,
                            color: V3.ink,
                            border: `1px solid ${V3.rule}`,
                            textDecoration: 'none',
                          }}
                        >
                          🐶 {sub.dogs.name}
                        </Link>
                      )}
                      {sub.coverage_weeks && (
                        <span
                          className="truncate"
                          style={{
                            fontSize: 9.5,
                            fontWeight: V3FontWeight.bold,
                            padding: '2px 8px',
                            borderRadius: V3Radius.pill,
                            background: V3.paperHi,
                            color: V3.ink,
                            border: `1px solid ${V3.rule}`,
                          }}
                        >
                          {sub.coverage_weeks === 2
                            ? '2주치 · 하이브리드'
                            : '4주치 · 풀 화식'}
                        </span>
                      )}
                    </div>
                    {sub.next_delivery_date && (
                      <Mono
                        color="inkMute"
                        size="xxs"
                        weight={500}
                        letterSpacing="0.08em"
                      >
                        D ·{' '}
                        {new Date(sub.next_delivery_date).toLocaleDateString(
                          'ko-KR',
                          { month: 'long', day: 'numeric' }
                        )}
                      </Mono>
                    )}
                  </div>

                  {/* Failure signal banner */}
                  {hasFailureSignal && (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${needsRenewal ? V3.sale : V3.yellow}`,
                        background: needsRenewal
                          ? 'color-mix(in srgb, ' + V3.sale + ' 8%, transparent)'
                          : 'color-mix(in srgb, ' + V3.yellow + ' 12%, transparent)',
                      }}
                    >
                      <div className="flex items-start" style={{ gap: 8 }}>
                        <AlertTriangle
                          size={16}
                          color={needsRenewal ? V3.sale : V3.yellow}
                          strokeWidth={2.2}
                          style={{ marginTop: 2, flexShrink: 0 }}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: V3FontWeight.bold,
                              color: needsRenewal ? V3.sale : V3.ink,
                            }}
                          >
                            {needsRenewal
                              ? '카드 정보를 다시 등록해 주세요'
                              : sub.next_retry_at
                                ? '결제가 일시 실패했어요'
                                : `결제 ${sub.failed_charge_count}회 실패`}
                          </div>
                          {sub.last_failed_charge_reason && (
                            <div
                              style={{
                                fontSize: 11,
                                color: V3.inkMute,
                                marginTop: 2,
                                lineHeight: 1.4,
                              }}
                            >
                              사유: {sub.last_failed_charge_reason}
                            </div>
                          )}
                          {sub.next_retry_at && !needsRenewal && (
                            <div
                              className="inline-flex items-center"
                              style={{
                                fontSize: 10.5,
                                color: V3.inkMute,
                                marginTop: 4,
                                gap: 4,
                              }}
                            >
                              <Clock size={11} strokeWidth={2} />
                              {formatRetryAt(sub.next_retry_at)} 자동 재시도
                            </div>
                          )}
                        </div>
                        {(needsRenewal ||
                          (sub.failed_charge_count ?? 0) >= 2) && (
                          <button
                            type="button"
                            onClick={() => handleReRegisterCard(sub)}
                            disabled={isLoading}
                            className="shrink-0 inline-flex items-center transition disabled:opacity-50"
                            style={{
                              gap: 4,
                              padding: '6px 10px',
                              borderRadius: V3Radius.xs,
                              fontSize: 11,
                              fontWeight: V3FontWeight.bold,
                              color: V3.paperHi,
                              background: V3.sale,
                              border: 'none',
                            }}
                          >
                            <CreditCard size={12} strokeWidth={2.5} />
                            재등록
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card body */}
                  <div style={{ padding: '16px' }}>
                    {sub.subscription_items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center"
                        style={{ gap: 12, marginBottom: i < sub.subscription_items.length - 1 ? 8 : 0 }}
                      >
                        <div
                          className="relative overflow-hidden flex-shrink-0"
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: V3Radius.xs,
                            border: `1px solid ${V3.rule}`,
                            background: V3.paper,
                          }}
                        >
                          {item.product_image_url ? (
                            <Image
                              src={item.product_image_url}
                              alt={item.product_name}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Soup size={20} color={V3.inkMute} strokeWidth={1.5} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="truncate"
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: 13,
                              fontWeight: V3FontWeight.bold,
                              color: V3.ink,
                              letterSpacing: '-0.015em',
                            }}
                          >
                            {item.product_name}
                          </div>
                          <Mono
                            color="inkMute"
                            size="xxs"
                            weight={500}
                            letterSpacing="0.04em"
                            style={{ marginTop: 3, display: 'inline-block' }}
                          >
                            {item.unit_price.toLocaleString()}원 × {item.quantity}개
                          </Mono>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span
                            className="tabular-nums"
                            style={{
                              fontFamily: 'var(--font-sans)',
                              fontSize: 13,
                              fontWeight: V3FontWeight.black,
                              color: V3.accent,
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {(item.unit_price * item.quantity).toLocaleString()}원
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Meta strip */}
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: `1px solid ${V3.rule}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        fontSize: 11,
                      }}
                    >
                      <div className="flex justify-between">
                        <span style={{ color: V3.inkMute }}>배송 주기</span>
                        <span style={{ fontWeight: V3FontWeight.bold, color: V3.ink }}>
                          {INTERVAL_LABELS[sub.interval_weeks] ||
                            `${sub.interval_weeks}주마다`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: V3.inkMute }}>회당 결제</span>
                        <span style={{ fontWeight: V3FontWeight.bold, color: V3.ink }}>
                          {sub.total_amount.toLocaleString()}원
                          {sub.shipping_fee === 0 && (
                            <span style={{ marginLeft: 4, fontSize: 10, color: V3.sage }}>
                              (배송비 무료)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span style={{ color: V3.inkMute }}>누적 배송</span>
                        <span style={{ fontWeight: V3FontWeight.bold, color: V3.ink }}>
                          {sub.total_deliveries}회
                        </span>
                      </div>
                    </div>

                    {/* Interval edit panel */}
                    {isEditing && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: 12,
                          background: V3.paper,
                          borderRadius: V3Radius.sm,
                          border: `1px solid ${V3.rule}`,
                        }}
                      >
                        <Mono color="inkMute" size="xxs" weight={600}>
                          배송 주기 변경
                        </Mono>
                        <div className="grid grid-cols-3" style={{ gap: 8, marginTop: 8 }}>
                          {[1, 2, 4].map((w) => (
                            <button
                              key={w}
                              onClick={() => handleChangeInterval(sub.id, w)}
                              disabled={isLoading}
                              style={{
                                padding: '8px 0',
                                borderRadius: V3Radius.xs,
                                fontSize: 11,
                                fontWeight: V3FontWeight.bold,
                                border:
                                  sub.interval_weeks === w
                                    ? `1.5px solid ${V3.sage}`
                                    : `1px solid ${V3.rule}`,
                                background:
                                  sub.interval_weeks === w
                                    ? 'color-mix(in srgb, ' + V3.sage + ' 10%, transparent)'
                                    : V3.paperHi,
                                color: sub.interval_weeks === w ? V3.sage : V3.ink,
                                transition: 'all 160ms',
                              }}
                            >
                              {INTERVAL_LABELS[w]}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setEditingInterval(null)}
                          style={{
                            marginTop: 8,
                            width: '100%',
                            fontSize: 11,
                            color: V3.inkMute,
                            background: 'transparent',
                            border: 'none',
                          }}
                        >
                          취소
                        </button>
                      </div>
                    )}

                    {/* Reminder toggle */}
                    {!isCancelled && (
                      <div
                        style={{
                          marginTop: 14,
                          padding: '12px 14px',
                          background: V3.paper,
                          borderRadius: V3Radius.sm,
                          border: `1px solid ${V3.rule}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center" style={{ gap: 8 }}>
                            {sub.reminder_enabled ? (
                              <Bell size={14} color={V3.accent} strokeWidth={2} />
                            ) : (
                              <BellOff size={14} color={V3.inkMute} strokeWidth={2} />
                            )}
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: V3FontWeight.bold,
                                color: V3.ink,
                              }}
                            >
                              배송 알림
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              handleToggleReminder(sub.id, !sub.reminder_enabled)
                            }
                            disabled={isLoading}
                            className="relative inline-flex items-center disabled:opacity-50"
                            style={{
                              width: 36,
                              height: 20,
                              borderRadius: 10,
                              background: sub.reminder_enabled ? V3.sage : V3.rule,
                              border: 'none',
                              transition: 'background 160ms',
                            }}
                            aria-label="배송 알림 토글"
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: 2,
                                left: sub.reminder_enabled ? 18 : 2,
                                width: 16,
                                height: 16,
                                borderRadius: 8,
                                background: V3.paperHi,
                                transition: 'left 160ms',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                              }}
                            />
                          </button>
                        </div>
                        {sub.reminder_enabled && (
                          <div
                            className="flex items-center"
                            style={{ marginTop: 8, gap: 6 }}
                          >
                            <Mono color="inkMute" size="xxs" weight={500}>
                              D-
                            </Mono>
                            {[1, 2, 3, 5].map((d) => (
                              <button
                                key={d}
                                onClick={() =>
                                  handleChangeReminderDays(sub.id, d)
                                }
                                disabled={isLoading}
                                style={{
                                  width: 28,
                                  height: 24,
                                  borderRadius: V3Radius.xs,
                                  fontSize: 10,
                                  fontWeight: V3FontWeight.bold,
                                  background:
                                    sub.reminder_days_before === d
                                      ? V3.sage
                                      : V3.paperHi,
                                  color:
                                    sub.reminder_days_before === d
                                      ? V3.paperHi
                                      : V3.inkMute,
                                  border:
                                    sub.reminder_days_before === d
                                      ? 'none'
                                      : `1px solid ${V3.rule}`,
                                  transition: 'all 160ms',
                                }}
                              >
                                {d}
                              </button>
                            ))}
                            <Mono color="inkMute" size="xxs" weight={500} style={{ marginLeft: 4 }}>
                              일 전
                            </Mono>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    {!isCancelled && (
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {isActive && (
                          <>
                            <div className="flex items-center" style={{ gap: 6 }}>
                              <Mono color="inkMute" size="xxs" weight={500} style={{ flexShrink: 0 }}>
                                건너뛰기
                              </Mono>
                              {[1, 2, 4].map((w) => (
                                <button
                                  key={w}
                                  onClick={() =>
                                    handlePause(sub.id, w as 1 | 2 | 4)
                                  }
                                  disabled={isLoading}
                                  className="flex-1 transition disabled:opacity-50"
                                  style={{
                                    padding: '6px 0',
                                    borderRadius: V3Radius.xs,
                                    border: `1px solid ${V3.rule}`,
                                    background: V3.paper,
                                    fontSize: 10.5,
                                    fontWeight: V3FontWeight.bold,
                                    color: V3.ink,
                                  }}
                                >
                                  {w}주
                                </button>
                              ))}
                            </div>
                            <div className="flex" style={{ gap: 8 }}>
                              <button
                                onClick={() => handlePause(sub.id)}
                                disabled={isLoading}
                                className="flex-1 inline-flex items-center justify-center transition disabled:opacity-50"
                                style={{
                                  gap: 4,
                                  padding: '10px 0',
                                  borderRadius: V3Radius.sm,
                                  fontSize: 11,
                                  fontWeight: V3FontWeight.bold,
                                  border: `1px solid ${V3.rule}`,
                                  color: V3.inkMute,
                                  background: V3.paperHi,
                                }}
                              >
                                {isLoading ? (
                                  '처리 중...'
                                ) : (
                                  <>
                                    <Pause size={12} strokeWidth={2.5} />
                                    일시정지
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => setEditingInterval(sub.id)}
                                disabled={isLoading}
                                className="flex-1 inline-flex items-center justify-center transition disabled:opacity-50"
                                style={{
                                  gap: 4,
                                  padding: '10px 0',
                                  borderRadius: V3Radius.sm,
                                  fontSize: 11,
                                  fontWeight: V3FontWeight.bold,
                                  border: `1px solid ${V3.rule}`,
                                  color: V3.sage,
                                  background: V3.paperHi,
                                }}
                              >
                                <RefreshCw size={12} strokeWidth={2.5} />
                                주기 변경
                              </button>
                              <button
                                onClick={() => setCancelSubId(sub.id)}
                                disabled={isLoading}
                                className="transition disabled:opacity-50"
                                style={{
                                  padding: '10px 14px',
                                  borderRadius: V3Radius.sm,
                                  fontSize: 11,
                                  fontWeight: V3FontWeight.bold,
                                  border: `1px solid ${V3.rule}`,
                                  color: V3.sale,
                                  background: V3.paperHi,
                                }}
                              >
                                해지
                              </button>
                            </div>
                          </>
                        )}
                        {isPaused && (
                          <div className="flex" style={{ gap: 8 }}>
                            <button
                              onClick={() => handleResume(sub.id)}
                              disabled={isLoading}
                              className="flex-1 inline-flex items-center justify-center transition disabled:opacity-50"
                              style={{
                                gap: 4,
                                padding: '10px 0',
                                borderRadius: V3Radius.sm,
                                fontSize: 11,
                                fontWeight: V3FontWeight.bold,
                                border: `1.5px solid ${V3.sage}`,
                                color: V3.sage,
                                background:
                                  'color-mix(in srgb, ' + V3.sage + ' 10%, transparent)',
                              }}
                            >
                              {isLoading ? (
                                '처리 중...'
                              ) : (
                                <>
                                  <Play size={12} strokeWidth={2.5} />
                                  다시 시작
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setCancelSubId(sub.id)}
                              disabled={isLoading}
                              className="transition disabled:opacity-50"
                              style={{
                                padding: '10px 18px',
                                borderRadius: V3Radius.sm,
                                fontSize: 11,
                                fontWeight: V3FontWeight.bold,
                                border: `1px solid ${V3.rule}`,
                                color: V3.sale,
                                background: V3.paperHi,
                              }}
                            >
                              해지
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* R10-3b: 정기배송 해지 확인 modal — browser confirm() 대체. */}
      <Modal
        open={cancelSubId !== null}
        onClose={() => {
          if (actionLoading === cancelSubId) return
          setCancelSubId(null)
        }}
        title="정기배송을 해지할까요?"
        dismissOnBackdrop={actionLoading !== cancelSubId}
        showClose={actionLoading !== cancelSubId}
      >
        <Modal.Body>
          해지 후에는 다시 신청해야 해요. 진행 중인 회차도 더 이상 배송되지 않아요.
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setCancelSubId(null)}
            disabled={actionLoading === cancelSubId}
            style={{
              padding: '10px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 12.5,
              fontWeight: V3FontWeight.bold,
              background: V3.paperHi,
              color: V3.inkMute,
              border: `1px solid ${V3.rule}`,
              cursor: actionLoading === cancelSubId ? 'not-allowed' : 'pointer',
              opacity: actionLoading === cancelSubId ? 0.5 : 1,
            }}
          >
            아니요
          </button>
          <button
            type="button"
            onClick={() => cancelSubId && void performCancel(cancelSubId)}
            disabled={actionLoading === cancelSubId}
            style={{
              padding: '10px 18px',
              borderRadius: V3Radius.sm,
              fontSize: 12.5,
              fontWeight: V3FontWeight.bold,
              background: V3.sale,
              color: V3.paperHi,
              border: 'none',
              cursor: actionLoading === cancelSubId ? 'not-allowed' : 'pointer',
              opacity: actionLoading === cancelSubId ? 0.7 : 1,
            }}
          >
            {actionLoading === cancelSubId ? '해지 중…' : '해지하기'}
          </button>
        </Modal.Footer>
      </Modal>
    </main>
  )
}

/**
 * 결제 재시도 시각 KST 포맷.
 */
function formatRetryAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('month')}월 ${get('day')}일 ${get('hour')}:${get('minute')}`
}

// V3FontSize 도 import 했지만 위에서 numeric 으로만 쓰니 명시적으로 사용 없음 — 향후 확장 대비.
void V3FontSize
