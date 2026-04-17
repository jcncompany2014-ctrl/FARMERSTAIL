'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
  subscription_items: SubscriptionItem[]
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '구독 중', color: 'text-[#6B7F3A]', bg: 'bg-[#6B7F3A]/10' },
  paused: { label: '일시정지', color: 'text-[#D4B872]', bg: 'bg-[#D4B872]/10' },
  cancelled: { label: '해지됨', color: 'text-[#8A7668]', bg: 'bg-[#8A7668]/10' },
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
    const { data: { user } } = await supabase.auth.getUser()
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

  async function handlePause(subId: string) {
    setActionLoading(subId)
    await supabase
      .from('subscriptions')
      .update({ status: 'paused' })
      .eq('id', subId)
    await loadSubscriptions()
    setActionLoading(null)
  }

  async function handleResume(subId: string) {
    setActionLoading(subId)
    // 재개 시 다음 배송일을 오늘 기준으로 다시 계산
    const sub = subs.find(s => s.id === subId)
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
    await loadSubscriptions()
    setActionLoading(null)
  }

  async function handleCancel(subId: string) {
    if (!confirm('정말 정기배송을 해지하시겠어요?\n해지 후에는 다시 신청해야 합니다.')) return
    setActionLoading(subId)
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled', next_delivery_date: null })
      .eq('id', subId)
    await loadSubscriptions()
    setActionLoading(null)
  }

  async function handleChangeInterval(subId: string, newInterval: number) {
    setActionLoading(subId)
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + newInterval * 7)

    await supabase
      .from('subscriptions')
      .update({
        interval_weeks: newInterval,
        next_delivery_date: nextDate.toISOString().split('T')[0],
      })
      .eq('id', subId)

    setEditingInterval(null)
    await loadSubscriptions()
    setActionLoading(null)
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[80vh]">
        <div className="text-[#8A7668]">로딩 중...</div>
      </main>
    )
  }

  return (
    <main className="px-6 py-6 pb-32">
      <div className="max-w-md mx-auto">
        <Link href="/mypage" className="text-sm text-[#8A7668] hover:text-[#3D2B1F]">
          ← 내 정보
        </Link>
        <h1 className="mt-4 text-xl font-black text-[#3D2B1F] tracking-tight">
          🔁 내 정기배송
        </h1>

        {/* 신규 신청 성공 배너 */}
        {showNewBanner && (
          <div className="mt-4 p-4 bg-[#6B7F3A]/10 border-2 border-[#6B7F3A] rounded-xl animate-pulse">
            <div className="text-sm font-bold text-[#6B7F3A]">
              ✅ 정기배송이 신청되었어요!
            </div>
            <div className="text-xs text-[#8A7668] mt-1">
              배송일 전에 안내 연락을 드릴게요.
            </div>
          </div>
        )}

        {subs.length === 0 ? (
          <div className="mt-10 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-[#8A7668] text-sm mb-4">아직 신청한 정기배송이 없어요</p>
            <Link
              href="/products"
              className="inline-block px-6 py-3 rounded-xl font-bold text-sm bg-[#6B7F3A] text-white border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              제품 둘러보기
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
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
                  className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                    isCancelled ? 'border-[#EDE6D8] opacity-60' : 'border-[#EDE6D8]'
                  }`}
                >
                  {/* 상태 바 */}
                  <div className={`px-5 py-2 flex items-center justify-between ${status.bg}`}>
                    <span className={`text-xs font-bold ${status.color}`}>{status.label}</span>
                    {sub.next_delivery_date && (
                      <span className="text-[10px] text-[#8A7668]">
                        다음 배송: {new Date(sub.next_delivery_date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* 상품 정보 */}
                  <div className="p-5">
                    {sub.subscription_items.map((item, i) => (
                      <div key={i} className="flex gap-3 items-center">
                        <div className="w-14 h-14 rounded-lg border border-[#EDE6D8] overflow-hidden flex-shrink-0 bg-[#F5F0E6]">
                          {item.product_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.product_image_url} alt={item.product_name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl">🍲</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-[#3D2B1F] truncate">{item.product_name}</div>
                          <div className="text-xs text-[#8A7668] mt-0.5">
                            {item.unit_price.toLocaleString()}원 × {item.quantity}개
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-black text-sm text-[#A0452E]">
                            {(item.unit_price * item.quantity).toLocaleString()}원
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* 주기 + 요약 */}
                    <div className="mt-4 pt-3 border-t border-[#EDE6D8] space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#8A7668]">배송 주기</span>
                        <span className="font-bold text-[#3D2B1F]">
                          {INTERVAL_LABELS[sub.interval_weeks] || `${sub.interval_weeks}주마다`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A7668]">회당 결제</span>
                        <span className="font-bold text-[#3D2B1F]">
                          {sub.total_amount.toLocaleString()}원
                          {sub.shipping_fee === 0 && (
                            <span className="ml-1 text-[10px] text-[#6B7F3A]">(배송비 무료)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#8A7668]">누적 배송</span>
                        <span className="font-bold text-[#3D2B1F]">{sub.total_deliveries}회</span>
                      </div>
                    </div>

                    {/* 주기 변경 UI */}
                    {isEditing && (
                      <div className="mt-3 p-3 bg-[#F5F0E6] rounded-xl">
                        <div className="text-xs font-bold text-[#8A7668] mb-2">배송 주기 변경</div>
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 4].map((w) => (
                            <button
                              key={w}
                              onClick={() => handleChangeInterval(sub.id, w)}
                              disabled={isLoading}
                              className={`py-2 rounded-lg border-2 text-xs font-bold transition-all ${
                                sub.interval_weeks === w
                                  ? 'border-[#6B7F3A] bg-[#6B7F3A]/10 text-[#6B7F3A]'
                                  : 'border-[#EDE6D8] bg-white text-[#3D2B1F] hover:border-[#8A7668]'
                              }`}
                            >
                              {INTERVAL_LABELS[w]}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setEditingInterval(null)}
                          className="mt-2 w-full text-xs text-[#8A7668] hover:text-[#3D2B1F]"
                        >
                          취소
                        </button>
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
                              className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 border-[#EDE6D8] text-[#8A7668] hover:border-[#8A7668] transition-all disabled:opacity-50"
                            >
                              {isLoading ? '처리 중...' : '⏸ 일시정지'}
                            </button>
                            <button
                              onClick={() => setEditingInterval(sub.id)}
                              disabled={isLoading}
                              className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 border-[#EDE6D8] text-[#6B7F3A] hover:border-[#6B7F3A] transition-all disabled:opacity-50"
                            >
                              🔄 주기 변경
                            </button>
                            <button
                              onClick={() => handleCancel(sub.id)}
                              disabled={isLoading}
                              className="py-2.5 px-3 rounded-xl text-xs font-bold border-2 border-[#EDE6D8] text-[#B83A2E] hover:border-[#B83A2E] transition-all disabled:opacity-50"
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
                              className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 border-[#6B7F3A] bg-[#6B7F3A]/10 text-[#6B7F3A] hover:bg-[#6B7F3A]/20 transition-all disabled:opacity-50"
                            >
                              {isLoading ? '처리 중...' : '▶ 다시 시작'}
                            </button>
                            <button
                              onClick={() => handleCancel(sub.id)}
                              disabled={isLoading}
                              className="py-2.5 px-4 rounded-xl text-xs font-bold border-2 border-[#EDE6D8] text-[#B83A2E] hover:border-[#B83A2E] transition-all disabled:opacity-50"
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