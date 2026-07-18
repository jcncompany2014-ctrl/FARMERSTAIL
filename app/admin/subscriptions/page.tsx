'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/Spinner'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import { nextShipDate } from '@/lib/shipping-schedule'

type SubscriptionRow = {
  id: string
  user_id: string
  status: 'active' | 'paused' | 'cancelled'
  interval_weeks: number
  coverage_weeks: number | null
  fresh_ratio: number | null
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
  dog_id: string | null
  dogs: { id: string; name: string } | null
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
  active: { label: '구독 중', cls: 'bg-moss/10 text-moss' },
  paused: { label: '일시정지', cls: 'bg-gold/10 text-gold' },
  cancelled: { label: '해지', cls: 'bg-muted/10 text-muted' },
}


export default function AdminSubscriptionsPage() {
  const supabase = createClient()

  const [subs, setSubs] = useState<SubscriptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    void loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data } = await supabase
      .from('subscriptions')
      .select('*, profiles(name, email), subscription_items(*), dogs(id, name)')
      .order('created_at', { ascending: false })

    // audit #79: generated row vs domain SubscriptionRow nullable 차이 — unknown cast.
    if (data) setSubs(data as unknown as SubscriptionRow[])
    setLoading(false)
  }

  // 필터링
  const today = new Date().toISOString().split('T')[0] ?? ''
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
    // 해지는 되돌리기 어려운 조치 — 모바일 오터치 가드(2026-07-19 검수).
    if (
      newStatus === 'cancelled' &&
      !confirm('이 구독을 해지할까요? 다음 자동결제가 중단됩니다.')
    ) {
      return
    }
    setActionLoading(subId)
    const updates: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'cancelled') {
      updates.next_delivery_date = null
    }
    if (newStatus === 'active') {
      const sub = subs.find(s => s.id === subId)
      if (sub) {
        // 배송 주기는 2주 하나로 고정 — 재개는 다음 화요일부터(2026-07-16).
        updates.next_delivery_date = nextShipDate()
      }
    }
    // audit #79: subscriptions update Record cast.
    await (supabase as unknown as {
      from: (t: string) => {
        update: (r: Record<string, unknown>) => {
          eq: (c: string, v: string) => Promise<unknown>
        }
      }
    })
      .from('subscriptions')
      .update(updates)
      .eq('id', subId)
    await loadAll()
    setActionLoading(null)
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-text">정기배송 관리</h1>
          <p className="text-sm text-muted mt-1">
            전체 {subs.length}건 · 활성 {subs.filter(s => s.status === 'active').length}건
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/subscriptions/calendar"
            className="px-3 py-2 rounded-lg border border-zinc-200 text-[12px] font-bold text-ink hover:bg-bg transition inline-flex items-center gap-1.5"
          >
            📅 캘린더 뷰
          </a>
        </div>
        {/* ("일괄 주문 생성" 버튼은 2026-07-19 제거 — 자동청구 크론 이전 유물.
            결제 없이 주문을 만들고 배송일을 +14 밀어, 누르면 그 회차 청구가
            통째로 증발하는 사고 버튼이었다. 지금은 subscription-charge 크론이
            청구→주문 생성→배송일 갱신을 전부 자동으로 한다.) */}
      </div>

      {/* 탭 필터 */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.value
                ? 'bg-text text-white'
                : 'bg-white text-muted border border-zinc-200 hover:border-muted'
            }`}
          >
            {t.label}
            {t.value === 'upcoming' && upcomingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-terracotta text-white text-[10px]">
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
          className="w-full px-4 py-2.5 rounded-xl border-2 border-zinc-200 bg-white text-sm text-text focus:border-moss focus:outline-none transition"
        />
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted">
          <Spinner size={16} />
          <span className="text-[12px]">불러오는 중...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted">해당하는 구독이 없어요</div>
      ) : (
        <div className="bg-white rounded-lg border-2 border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg text-muted text-xs font-bold uppercase tracking-wider">
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
              <tbody className="divide-y divide-rule">
                {filtered.map((sub) => {
                  const badge = STATUS_BADGE[sub.status] || STATUS_BADGE.active!
                  const isLoading = actionLoading === sub.id

                  return (
                    <tr key={sub.id} className={`hover:bg-bg/50 transition ${sub.status === 'cancelled' ? 'opacity-50' : ''}`}>
                      {/* 고객 */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-text text-xs">
                          {sub.profiles?.name || sub.recipient_name || '-'}
                        </div>
                        <div className="text-[10px] text-muted">
                          {sub.profiles?.email || ''}
                        </div>
                      </td>
                      {/* 상품 */}
                      <td className="px-4 py-3">
                        {sub.subscription_items.map((item, i) => (
                          <div key={i} className="text-xs text-text">
                            {item.product_name} ×{item.quantity}
                          </div>
                        ))}
                      </td>
                      {/* 분량 — '주기' 열은 뺐다(2026-07-16). 전부 2주 고정이라
                          모든 행에 같은 값이 찍힐 뿐이었다. */}
                      <td className="px-4 py-3 text-center text-xs font-bold text-text">
                        <div className="text-[9px] text-muted font-normal">
                          {freshTierLabel(sub.fresh_ratio)}
                        </div>
                        {sub.dogs && (
                          <div className="text-[9px] text-terracotta font-normal mt-0.5">
                            🐶 {sub.dogs.name}
                          </div>
                        )}
                      </td>
                      {/* 상태 */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold ${badge.cls}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden />
                          {badge.label}
                        </span>
                      </td>
                      {/* 다음 배송 */}
                      <td className="px-4 py-3 text-center text-xs text-text">
                        {sub.next_delivery_date
                          ? new Date(sub.next_delivery_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                          : '-'}
                      </td>
                      {/* 금액 */}
                      <td className="px-4 py-3 text-right text-xs font-bold text-terracotta">
                        {sub.total_amount.toLocaleString()}원
                      </td>
                      {/* 누적 */}
                      <td className="px-4 py-3 text-center text-xs text-text">
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
                                className="px-2 py-1 rounded text-[10px] font-bold bg-gold/10 text-gold hover:bg-gold/20 transition disabled:opacity-50"
                                title="일시정지"
                              >
                                ⏸
                              </button>
                            )}
                            {sub.status === 'paused' && (
                              <button
                                onClick={() => handleStatusChange(sub.id, 'active')}
                                disabled={isLoading}
                                className="px-2 py-1 rounded text-[10px] font-bold bg-moss/10 text-moss hover:bg-moss/20 transition disabled:opacity-50"
                                title="재개"
                              >
                                ▶
                              </button>
                            )}
                            <button
                              onClick={() => handleStatusChange(sub.id, 'cancelled')}
                              disabled={isLoading}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-sale/10 text-sale hover:bg-sale/20 transition disabled:opacity-50"
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