'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SubscriptionItem = {
  product_name: string
  product_image_url: string | null
  quantity: number
  unit_price: number
}

type Subscription = {
  id: string
  status: 'active' | 'paused' | 'cancelled'
  interval_weeks: number
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
  subscription_items: SubscriptionItem[]
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '구독 중', color: 'text-moss', bg: 'bg-moss/10' },
  paused: { label: '일시정지', color: 'text-gold', bg: 'bg-gold/10' },
  cancelled: { label: '해지됨', color: 'text-muted', bg: 'bg-muted/10' },
}

const INTERVAL_LABELS: Record<number, string> = {
  1: '매주',
  2: '2주마다',
  4: '4주마다',
}

export default function MySubscriptionsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const isNew = searchParams.get('new') === '1'

  const [subs, setSubs] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewBanner, setShowNewBanner] = useState(isNew)
  const [editingInterval, setEditingInterval] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadSubscriptions()
    if (isNew) {
      const timer = setTimeout(() => setShowNewBanner(false), 4000)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSubscriptions() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data } = await supabase
      .from('subscriptions')
      .select('*, subscription_items(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setSubs(data as Subscription[])
    setLoading(false)
  }

  // Returns current auth uid or routes to /login. Every mutation below
  // chains `.eq('user_id', uid)` so admin-role accounts cannot mutate
  // other users' subscriptions by ID guessing.
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

  async function handlePause(subId: string) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) return
    await supabase
      .from('subscriptions')
      .update({ status: 'paused' })
      .eq('id', subId)
      .eq('user_id', uid)
    await loadSubscriptions()
    setActionLoading(null)
  }

  async function handleResume(subId: string) {
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) return
    const sub = subs.find((s) => s.id === subId)
    if (!sub) return
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + sub.interval_weeks * 7)

    await supabase
      .from('subscriptions')
      .update({
        status: 'active',
        next_delivery_date: nextDate.toISOString().split('T')[0],
      })
      .eq('id', subId)
      .eq('user_id', uid)
    await loadSubscriptions()
    setActionLoading(null)
  }

  async function handleCancel(subId: string) {
    if (
      !confirm('정말 정기배송을 해지하시겠어요?\n해지 후에는 다시 신청해야 합니다.')
    )
      return
    setActionLoading(subId)
    const uid = await requireUid()
    if (!uid) return
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', next_delivery_date: null })
      .eq('id', subId)
      .eq('user_id', uid)
    await loadSubscriptions()
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
    await loadSubscriptions()
  }

  async function handleChangeReminderDays(subId: string, days: number) {
    const uid = await requireUid()
    if (!uid) return
    await supabase
      .from('subscriptions')
      .update({ reminder_days_before: days })
      .eq('id', subId)
      .eq('user_id', uid)
    await loadSubscriptions()
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
    await loadSubscriptions()
    setActionLoading(null)
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[80vh]">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="px-5 py-6 pb-32">
      <div className="max-w-md mx-auto">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 내 정보
        </Link>
        <div className="mt-3">
          <span className="kicker">Subscriptions · 정기배송</span>
          <h1
            className="font-serif mt-1.5 inline-flex items-center gap-2"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            <Repeat className="w-5 h-5 text-moss" strokeWidth={2} />
            내 정기배송
          </h1>
        </div>

        {/* 신규 신청 성공 배너 */}
        {showNewBanner && (
          <div className="mt-4 p-4 bg-moss/10 border border-moss/40 rounded-xl">
            <div className="flex items-center gap-2 text-[13px] font-bold text-moss">
              <Check className="w-4 h-4" strokeWidth={2.5} />
              정기배송이 신청되었어요!
            </div>
            <div className="text-[11px] text-muted mt-1">
              배송일 전에 안내 연락을 드릴게요.
            </div>
          </div>
        )}

        {subs.length === 0 ? (
          <div
            className="mt-8 text-center rounded-2xl border px-5 py-12"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-4"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <Package
                className="w-6 h-6 text-muted"
                strokeWidth={1.3}
              />
            </div>
            <span className="kicker kicker-moss">Start · 시작하기</span>
            <h3
              className="font-serif mt-2"
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              아직 신청한 정기배송이 없어요
            </h3>
            <p className="text-[12px] text-muted mt-2 leading-relaxed">
              꾸준한 영양 공급, 더 저렴한 가격
              <br />
              정기배송으로 시작해보세요
            </p>
            <Link
              href="/products"
              className="mt-5 inline-flex items-center gap-1 px-6 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              제품 둘러보기
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {subs.map((sub) => {
              const status = STATUS_MAP[sub.status] || STATUS_MAP.active
              const isActive = sub.status === 'active'
              const isPaused = sub.status === 'paused'
              const isCancelled = sub.status === 'cancelled'
              const isEditing = editingInterval === sub.id
              const isLoading = actionLoading === sub.id

              return (
                <div
                  key={sub.id}
                  className={`bg-white rounded-2xl border border-rule overflow-hidden transition ${
                    isCancelled ? 'opacity-60' : ''
                  }`}
                >
                  {/* 상태 바 */}
                  <div
                    className={`px-5 py-2 flex items-center justify-between ${status.bg}`}
                  >
                    <span
                      className={`text-[11px] font-bold ${status.color}`}
                    >
                      {status.label}
                    </span>
                    {sub.next_delivery_date && (
                      <span className="text-[10px] text-muted">
                        다음 배송:{' '}
                        {new Date(sub.next_delivery_date).toLocaleDateString(
                          'ko-KR',
                          { month: 'long', day: 'numeric' }
                        )}
                      </span>
                    )}
                  </div>

                  {/* 상품 정보 */}
                  <div className="p-5">
                    {sub.subscription_items.map((item, i) => (
                      <div key={i} className="flex gap-3 items-center">
                        <div className="w-14 h-14 rounded-lg border border-rule overflow-hidden flex-shrink-0 bg-bg">
                          {item.product_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product_image_url}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Soup
                                className="w-5 h-5 text-muted"
                                strokeWidth={1.5}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[12px] text-text truncate">
                            {item.product_name}
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">
                            {item.unit_price.toLocaleString()}원 ×{' '}
                            {item.quantity}개
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div
                            className="font-serif"
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: 'var(--terracotta)',
                              letterSpacing: '-0.015em',
                            }}
                          >
                            {(item.unit_price * item.quantity).toLocaleString()}원
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* 주기 + 요약 */}
                    <div className="mt-4 pt-3 border-t border-rule space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted">배송 주기</span>
                        <span className="font-bold text-text">
                          {INTERVAL_LABELS[sub.interval_weeks] ||
                            `${sub.interval_weeks}주마다`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">회당 결제</span>
                        <span className="font-bold text-text">
                          {sub.total_amount.toLocaleString()}원
                          {sub.shipping_fee === 0 && (
                            <span className="ml-1 text-[10px] text-moss">
                              (배송비 무료)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">누적 배송</span>
                        <span className="font-bold text-text">
                          {sub.total_deliveries}회
                        </span>
                      </div>
                    </div>

                    {/* 주기 변경 UI */}
                    {isEditing && (
                      <div className="mt-3 p-3 bg-bg rounded-xl">
                        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.2em] mb-2">
                          배송 주기 변경
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 4].map((w) => (
                            <button
                              key={w}
                              onClick={() => handleChangeInterval(sub.id, w)}
                              disabled={isLoading}
                              className={`py-2 rounded-lg border text-[11px] font-bold transition ${
                                sub.interval_weeks === w
                                  ? 'border-moss bg-moss/10 text-moss'
                                  : 'border-rule bg-white text-text hover:border-muted'
                              }`}
                            >
                              {INTERVAL_LABELS[w]}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setEditingInterval(null)}
                          className="mt-2 w-full text-[11px] text-muted hover:text-text"
                        >
                          취소
                        </button>
                      </div>
                    )}

                    {/* 배송 리마인드 */}
                    {!isCancelled && (
                      <div className="mt-4 bg-bg rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {sub.reminder_enabled ? (
                              <Bell className="w-3.5 h-3.5 text-terracotta" strokeWidth={2} />
                            ) : (
                              <BellOff className="w-3.5 h-3.5 text-muted" strokeWidth={2} />
                            )}
                            <span className="text-[11px] font-bold text-text">
                              배송 알림
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              handleToggleReminder(sub.id, !sub.reminder_enabled)
                            }
                            disabled={isLoading}
                            className={`relative inline-flex items-center h-5 w-9 rounded-full transition ${
                              sub.reminder_enabled ? 'bg-moss' : 'bg-rule-2'
                            } disabled:opacity-50`}
                            aria-label="배송 알림 토글"
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                                sub.reminder_enabled ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>
                        {sub.reminder_enabled && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <span className="text-[10px] text-muted">
                              D-
                            </span>
                            {[1, 2, 3, 5].map((d) => (
                              <button
                                key={d}
                                onClick={() =>
                                  handleChangeReminderDays(sub.id, d)
                                }
                                disabled={isLoading}
                                className={`w-7 h-6 rounded-md text-[10px] font-bold transition ${
                                  sub.reminder_days_before === d
                                    ? 'bg-moss text-white'
                                    : 'bg-white text-muted border border-rule hover:border-moss'
                                }`}
                              >
                                {d}
                              </button>
                            ))}
                            <span className="ml-1 text-[10px] text-muted">
                              일 전
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    {!isCancelled && (
                      <div className="mt-4 flex gap-2">
                        {isActive && (
                          <>
                            <button
                              onClick={() => handlePause(sub.id)}
                              disabled={isLoading}
                              className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-bold border border-rule text-muted hover:border-muted transition disabled:opacity-50"
                            >
                              {isLoading ? (
                                '처리 중...'
                              ) : (
                                <>
                                  <Pause
                                    className="w-3 h-3"
                                    strokeWidth={2.5}
                                  />
                                  일시정지
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => setEditingInterval(sub.id)}
                              disabled={isLoading}
                              className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-bold border border-rule text-moss hover:border-moss transition disabled:opacity-50"
                            >
                              <RefreshCw className="w-3 h-3" strokeWidth={2.5} />
                              주기 변경
                            </button>
                            <button
                              onClick={() => handleCancel(sub.id)}
                              disabled={isLoading}
                              className="py-2.5 px-3 rounded-xl text-[11px] font-bold border border-rule text-sale hover:border-sale transition disabled:opacity-50"
                            >
                              해지
                            </button>
                          </>
                        )}
                        {isPaused && (
                          <>
                            <button
                              onClick={() => handleResume(sub.id)}
                              disabled={isLoading}
                              className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-bold border border-moss bg-moss/10 text-moss hover:bg-moss/20 transition disabled:opacity-50"
                            >
                              {isLoading ? (
                                '처리 중...'
                              ) : (
                                <>
                                  <Play
                                    className="w-3 h-3"
                                    strokeWidth={2.5}
                                  />
                                  다시 시작
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleCancel(sub.id)}
                              disabled={isLoading}
                              className="py-2.5 px-4 rounded-xl text-[11px] font-bold border border-rule text-sale hover:border-sale transition disabled:opacity-50"
                            >
                              해지
                            </button>
                          </>
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
    </main>
  )
}
