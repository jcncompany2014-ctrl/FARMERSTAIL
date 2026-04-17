'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type SubscriptionRow = {
  id: string
  user_id: string
  status: 'active' | 'paused' | 'cancelled'
  interval_weeks: number
  next_delivery_date: string | null
  last_delivery_date: string | null
  total_deliveries: number
  recipient_name: string | null
  recipient_phone: string | null
  recipient_address: string | null
  recipient_address_detail: string | null
  recipient_zip: string | null
  subtotal: number
  shipping_fee: number
  total_amount: number
  created_at: string
  profiles: { name: string | null; email: string | null } | null
  subscription_items: {
    product_name: string
    product_image_url: string | null
    quantity: number
    unit_price: number
  }[]
}

const TABS = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '구독 중' },
  { value: 'paused', label: '일시정지' },
  { value: 'cancelled', label: '해지' },
  { value: 'upcoming', label: '📦 배송 예정' },
]

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: '구독 중', cls: 'bg-[#6B7F3A]/10 text-[#6B7F3A]' },
  paused: { label: '일시정지', cls: 'bg-[#D4B872]/10 text-[#D4B872]' },
  cancelled: { label: '해지', cls: 'bg-[#8A7668]/10 text-[#8A7668]' },
}

const INTERVAL_LABELS: Record<number, string> = { 1: '매주', 2: '2주', 4: '4주' }

export default function AdminSubscriptionsPage() {
  const supabase = createClient()

  const [subs, setSubs] = useState<SubscriptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase
      .from('subscriptions')
      .select('*, profiles(name, email), subscription_items(*)')
      .order('created_at', { ascending: false })

    if (data) setSubs(data as SubscriptionRow[])
    setLoading(false)
  }

  // 필터링
  const today = new Date().toISOString().split('T')[0]
  const filtered = subs.filter((s) => {
    // 탭 필터
    if (tab === 'upcoming') {
      if (s.status !== 'active') return false
      if (!s.next_delivery_date) return false
      // 오늘 포함 7일 이내 배송 예정
      const diff = (new Date(s.next_delivery_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
      if (diff < 0 || diff > 7) return false
    } else if (tab !== 'all') {
      if (s.status !== tab) return false
    }
    // 검색
    if (search) {
      const q = search.toLowerCase()
      const name = (s.profiles?.name || '').toLowerCase()
      const email = (s.profiles?.email || '').toLowerCase()
      const recipient = (s.recipient_name || '').toLowerCase()
      const products = s.subscription_items.map(i => i.product_name.toLowerCase()).join(' ')
      if (!name.includes(q) && !email.includes(q) && !recipient.includes(q) && !products.includes(q)) return false
    }
    return true
  })

  // 배송 예정 건수
  const upcomingCount = subs.filter((s) => {
    if (s.status !== 'active' || !s.next_delivery_date) return false
    const diff = (new Date(s.next_delivery_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 7
  }).length

  async function handleStatusChange(subId: string, newStatus: string) {
    setActionLoading(subId)
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'cancelled') {
      updates.next_delivery_date = null
    }
    if (newStatus === 'active') {
      const sub = subs.find(s => s.id === subId)
      if (sub) {
        const next = new Date()
        next.setDate(next.getDate() + sub.interval_weeks * 7)
        updates.next_delivery_date = next.toISOString().split('T')[0]
      }
    }
    await supabase.from('subscriptions').update(updates).eq('id', subId)
    await loadAll()
    setActionLoading(null)
  }

  async function handleBulkCreateOrders() {
    if (!confirm('배송 예정인 구독 건들에 대해 주문을 일괄 생성하시겠습니까?')) return

    setBulkLoading(true)
    setBulkResult(null)

    // 배송 예정 구독 (7일 이내)
    const upcoming = subs.filter((s) => {
      if (s.status !== 'active' || !s.next_delivery_date) return false
      const diff = (new Date(s.next_delivery_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 7
    })

    let created = 0
    let failed = 0

    for (const sub of upcoming) {
      const orderNumber = `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

      // 1) 주문 생성
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: sub.user_id,
          order_number: orderNumber,
          subtotal: sub.subtotal,
          shipping_fee: sub.shipping_fee,
          total_amount: sub.total_amount,
          recipient_name: sub.recipient_name,
          recipient_phone: sub.recipient_phone,
          recipient_zip: sub.recipient_zip,
          recipient_address: sub.recipient_address,
          recipient_address_detail: sub.recipient_address_detail,
          payment_status: 'pending',
          payment_method: 'subscription',
          order_status: 'preparing',
          subscription_id: sub.id,
        })
        .select('id')
        .single()

      if (orderErr || !order) {
        failed++
        continue
      }

      // 2) 주문 상품 생성
      const items = sub.subscription_items.map((item) => ({
        order_id: order.id,
        product_id: null as string | null,
        product_name: item.product_name,
        product_image_url: item.product_image_url,
        unit_price: item.unit_price,
        quantity: item.quantity,
        line_total: item.unit_price * item.quantity,
      }))

      await supabase.from('order_items').insert(items)

      // 3) 구독 업데이트: 다음 배송일 갱신, 누적 횟수 +1
      const nextDate = new Date(sub.next_delivery_date!)
      nextDate.setDate(nextDate.getDate() + sub.interval_weeks * 7)

      await supabase
        .from('subscriptions')
        .update({
          next_delivery_date: nextDate.toISOString().split('T')[0],
          last_delivery_date: today,
          total_deliveries: sub.total_deliveries + 1,
        })
        .eq('id', sub.id)

      created++
    }

    setBulkResult(`✅ ${created}건 주문 생성 완료${failed > 0 ? `, ${failed}건 실패` : ''}`)
    await loadAll()
    setBulkLoading(false)
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-[#3D2B1F]">정기배송 관리</h1>
          <p className="text-sm text-[#8A7668] mt-1">
            전체 {subs.length}건 · 활성 {subs.filter(s => s.status === 'active').length}건
          </p>
        </div>
        {upcomingCount > 0 && (
          <button
            onClick={handleBulkCreateOrders}
            disabled={bulkLoading}
            className="px-4 py-2.5 rounded-xl font-bold text-sm bg-[#6B7F3A] text-white border-2 border-[#2A2118] shadow-[2px_2px_0_#2A2118] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all disabled:opacity-50"
          >
            {bulkLoading ? '생성 중...' : `📦 일괄 주문 생성 (${upcomingCount}건)`}
          </button>
        )}
      </div>

      {/* 일괄 결과 배너 */}
      {bulkResult && (
        <div className="mb-4 p-3 bg-[#6B7F3A]/10 border border-[#6B7F3A] rounded-xl text-sm text-[#6B7F3A] font-bold flex items-center justify-between">
          <span>{bulkResult}</span>
          <button onClick={() => setBulkResult(null)} className="text-[#8A7668] hover:text-[#3D2B1F]">✕</button>
        </div>
      )}

      {/* 탭 필터 */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.value
                ? 'bg-[#3D2B1F] text-white'
                : 'bg-white text-[#8A7668] border border-[#EDE6D8] hover:border-[#8A7668]'
            }`}
          >
            {t.label}
            {t.value === 'upcoming' && upcomingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#A0452E] text-white text-[10px]">
                {upcomingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="고객명, 이메일, 상품명 검색..."
          className="w-full px-4 py-2.5 rounded-xl border-2 border-[#EDE6D8] bg-white text-sm text-[#3D2B1F] focus:border-[#6B7F3A] focus:outline-none transition"
        />
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="text-center py-10 text-[#8A7668]">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-[#8A7668]">해당하는 구독이 없습니다.</div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-[#EDE6D8] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5F0E6] text-[#8A7668] text-xs font-bold uppercase tracking-wider">
                  <th className="text-left px-4 py-3">고객</th>
                  <th className="text-left px-4 py-3">상품</th>
                  <th className="text-center px-4 py-3">주기</th>
                  <th className="text-center px-4 py-3">상태</th>
                  <th className="text-center px-4 py-3">다음 배송</th>
                  <th className="text-right px-4 py-3">회당 금액</th>
                  <th className="text-center px-4 py-3">누적</th>
                  <th className="text-center px-4 py-3">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE6D8]">
                {filtered.map((sub) => {
                  const badge = STATUS_BADGE[sub.status] || STATUS_BADGE.active
                  const isLoading = actionLoading === sub.id

                  return (
                    <tr key={sub.id} className={`hover:bg-[#F5F0E6]/50 transition ${sub.status === 'cancelled' ? 'opacity-50' : ''}`}>
                      {/* 고객 */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-[#3D2B1F] text-xs">
                          {sub.profiles?.name || sub.recipient_name || '-'}
                        </div>
                        <div className="text-[10px] text-[#8A7668]">
                          {sub.profiles?.email || ''}
                        </div>
                      </td>
                      {/* 상품 */}
                      <td className="px-4 py-3">
                        {sub.subscription_items.map((item, i) => (
                          <div key={i} className="text-xs text-[#3D2B1F]">
                            {item.product_name} ×{item.quantity}
                          </div>
                        ))}
                      </td>
                      {/* 주기 */}
                      <td className="px-4 py-3 text-center text-xs font-bold text-[#3D2B1F]">
                        {INTERVAL_LABELS[sub.interval_weeks] || `${sub.interval_weeks}주`}
                      </td>
                      {/* 상태 */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      {/* 다음 배송 */}
                      <td className="px-4 py-3 text-center text-xs text-[#3D2B1F]">
                        {sub.next_delivery_date
                          ? new Date(sub.next_delivery_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                          : '-'}
                      </td>
                      {/* 금액 */}
                      <td className="px-4 py-3 text-right text-xs font-bold text-[#A0452E]">
                        {sub.total_amount.toLocaleString()}원
                      </td>
                      {/* 누적 */}
                      <td className="px-4 py-3 text-center text-xs text-[#3D2B1F]">
                        {sub.total_deliveries}회
                      </td>
                      {/* 관리 */}
                      <td className="px-4 py-3 text-center">
                        {sub.status !== 'cancelled' && (
                          <div className="flex gap-1 justify-center">
                            {sub.status === 'active' && (
                              <button
                                onClick={() => handleStatusChange(sub.id, 'paused')}
                                disabled={isLoading}
                                className="px-2 py-1 rounded text-[10px] font-bold bg-[#D4B872]/10 text-[#D4B872] hover:bg-[#D4B872]/20 transition disabled:opacity-50"
                                title="일시정지"
                              >
                                ⏸
                              </button>
                            )}
                            {sub.status === 'paused' && (
                              <button
                                onClick={() => handleStatusChange(sub.id, 'active')}
                                disabled={isLoading}
                                className="px-2 py-1 rounded text-[10px] font-bold bg-[#6B7F3A]/10 text-[#6B7F3A] hover:bg-[#6B7F3A]/20 transition disabled:opacity-50"
                                title="재개"
                              >
                                ▶
                              </button>
                            )}
                            <button
                              onClick={() => handleStatusChange(sub.id, 'cancelled')}
                              disabled={isLoading}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-[#B83A2E]/10 text-[#B83A2E] hover:bg-[#B83A2E]/20 transition disabled:opacity-50"
                              title="해지"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}