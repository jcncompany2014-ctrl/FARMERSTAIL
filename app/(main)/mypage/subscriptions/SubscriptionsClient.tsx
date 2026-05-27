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
 *
 * 분할 (2026-05-27): 큰 inline JSX 를 sub-component 로 추출:
 *   - SubscriptionsEmptyState · SubscriptionsNewBanner ·
 *     SubscriptionCard · SubscriptionCancelModal
 *   - helper / 상수 → `lib/v3-helpers/subscriptions.ts`
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Repeat } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  trackSubscriptionPaused,
  trackSubscriptionResumed,
  trackSubscriptionCancelled,
} from '@/lib/analytics'
import { V3, V3FontSize, V3FontWeight, V3LetterSpacing } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'
import {
  generateFallbackCustomerKey,
} from '@/lib/v3-helpers/subscriptions'
import SubscriptionsEmptyState from './_components/SubscriptionsEmptyState'
import SubscriptionsNewBanner from './_components/SubscriptionsNewBanner'
import SubscriptionCard from './_components/SubscriptionCard'
import SubscriptionCancelModal from './_components/SubscriptionCancelModal'

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

        {showNewBanner && <SubscriptionsNewBanner />}

        {subs.length === 0 ? (
          <SubscriptionsEmptyState />
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subs.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                sub={sub}
                isEditing={editingInterval === sub.id}
                isLoading={actionLoading === sub.id}
                onPause={handlePause}
                onResume={handleResume}
                onStartCancel={(subId) => setCancelSubId(subId)}
                onStartEditInterval={(subId) => setEditingInterval(subId)}
                onCancelEditInterval={() => setEditingInterval(null)}
                onChangeInterval={handleChangeInterval}
                onToggleReminder={handleToggleReminder}
                onChangeReminderDays={handleChangeReminderDays}
                onReRegisterCard={handleReRegisterCard}
              />
            ))}
          </div>
        )}
      </div>

      <SubscriptionCancelModal
        cancelSubId={cancelSubId}
        actionLoading={actionLoading}
        onClose={() => setCancelSubId(null)}
        onConfirm={(subId) => void performCancel(subId)}
      />
    </main>
  )
}

// V3FontSize 도 import 했지만 위에서 numeric 으로만 쓰니 명시적으로 사용 없음 — 향후 확장 대비.
void V3FontSize
