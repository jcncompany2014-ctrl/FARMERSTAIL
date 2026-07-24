'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/Spinner'
import { freshTierLabel } from '@/lib/subscription/freshTier'
import { nextShipDate } from '@/lib/shipping-schedule'
import { AdminTabs } from '@/components/admin/ui'
import { SUBS_TABS } from '@/components/admin/tabGroups'

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
      {/* 대개편 v2 T1 — 정기배송 그룹 탭 (구독|캘린더|자동결제) */}
      <AdminTabs tabs={SUBS_TABS} active="/admin/subscriptions" />
      {/* 헤더 — 기능형 클린 어드민(zinc) 통일 (2026-07-19 마스터피스 2차) */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
            정기배송 관리
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            고객들의 정기배송(2주마다 · 화요일 발송)을 조회·관리하는 곳이에요.
            결제와 배송 예약은 자동으로 돌아가서, 문제 있는 구독만 손보면 돼요.
            — 전체 {subs.length}건 · 활성{' '}
            {subs.filter((s) => s.status === 'active').length}건
          </p>
        </div>
      </div>

      {/* 탭 + 검색 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                tab === t.value
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-400'
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
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="고객명 · 이메일 · 상품명"
          className="px-3 py-1.5 rounded-full text-xs bg-white border border-zinc-200 focus:outline-none focus:border-terracotta w-full sm:w-56"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
          <Spinner size={16} />
          <span className="text-[12px]">불러오는 중...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-400">
          해당하는 구독이 없어요
        </div>
      ) : (
        <>
          {/* ── 데스크톱: 테이블 ─────────────────────────────── */}
          <div className="hidden md:block bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-zinc-400 border-b border-zinc-200">
                    <th className="text-left px-4 py-2.5 font-medium">고객</th>
                    <th className="text-left px-4 py-2.5 font-medium">구성</th>
                    <th className="text-center px-4 py-2.5 font-medium">상태</th>
                    <th className="text-center px-4 py-2.5 font-medium">다음 배송</th>
                    <th className="text-right px-4 py-2.5 font-medium">회당 금액</th>
                    <th className="text-center px-4 py-2.5 font-medium">누적</th>
                    <th className="text-center px-4 py-2.5 font-medium">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filtered.map((sub) => (
                    <SubRow
                      key={sub.id}
                      sub={sub}
                      isLoading={actionLoading === sub.id}
                      onAction={handleStatusChange}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 모바일: 카드 리스트 (사장님 폰 운영 — 가로 스크롤 제거) ── */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((sub) => (
              <SubCard
                key={sub.id}
                sub={sub}
                isLoading={actionLoading === sub.id}
                onAction={handleStatusChange}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── 행 공통 조각 ──────────────────────────────────────────── */

function StatusBadge({ status }: { status: SubscriptionRow['status'] }) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.active!
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${badge.cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {badge.label}
    </span>
  )
}

/** 관리 버튼 — 이모지 단독(⏸▶✕) 대신 라벨 버튼(폰 오터치·의미 명확). */
function RowActions({
  sub,
  isLoading,
  onAction,
}: {
  sub: SubscriptionRow
  isLoading: boolean
  onAction: (id: string, status: string) => void
}) {
  if (sub.status === 'cancelled') return null
  return (
    <div className="flex gap-1.5 justify-center flex-wrap">
      {sub.status === 'active' && (
        <button
          onClick={() => onAction(sub.id, 'paused')}
          disabled={isLoading}
          className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition disabled:opacity-50"
        >
          일시정지
        </button>
      )}
      {sub.status === 'paused' && (
        <button
          onClick={() => onAction(sub.id, 'active')}
          disabled={isLoading}
          className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50"
        >
          재개
        </button>
      )}
      <button
        onClick={() => onAction(sub.id, 'cancelled')}
        disabled={isLoading}
        className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition disabled:opacity-50"
      >
        해지
      </button>
      {/* 동선 단축 — 카드 문제·배송 문의 시 바로 1:1 메시지로. */}
      <a
        href={`/admin/users/${sub.user_id}/message`}
        className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-400 transition"
      >
        메시지
      </a>
    </div>
  )
}

function SubRow({
  sub,
  isLoading,
  onAction,
}: {
  sub: SubscriptionRow
  isLoading: boolean
  onAction: (id: string, status: string) => void
}) {
  return (
    <tr
      className={`hover:bg-zinc-50 transition ${sub.status === 'cancelled' ? 'opacity-50' : ''}`}
    >
      <td className="px-4 py-3">
        <div className="font-bold text-zinc-900 text-xs">
          {sub.profiles?.name || sub.recipient_name || '-'}
        </div>
        <div className="text-[10px] text-zinc-400">{sub.profiles?.email || ''}</div>
      </td>
      <td className="px-4 py-3">
        {sub.subscription_items.map((item, i) => (
          <div key={i} className="text-xs text-zinc-700">
            {item.product_name} ×{item.quantity}
          </div>
        ))}
        <div className="text-[10px] text-zinc-400 mt-0.5">
          {freshTierLabel(sub.fresh_ratio)}
          {sub.dogs ? ` · 🐶 ${sub.dogs.name}` : ''}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <StatusBadge status={sub.status} />
      </td>
      <td className="px-4 py-3 text-center text-xs text-zinc-700">
        {sub.next_delivery_date
          ? new Date(sub.next_delivery_date).toLocaleDateString('ko-KR', {
              month: 'short',
              day: 'numeric',
            })
          : '-'}
      </td>
      <td className="px-4 py-3 text-right text-xs font-bold text-zinc-900">
        {sub.total_amount.toLocaleString()}원
      </td>
      <td className="px-4 py-3 text-center text-xs text-zinc-700">
        {sub.total_deliveries}회
      </td>
      <td className="px-4 py-3 text-center">
        <RowActions sub={sub} isLoading={isLoading} onAction={onAction} />
      </td>
    </tr>
  )
}

/** 모바일 카드 — 테이블과 같은 정보를 세로로. 가로 스크롤 없음. */
function SubCard({
  sub,
  isLoading,
  onAction,
}: {
  sub: SubscriptionRow
  isLoading: boolean
  onAction: (id: string, status: string) => void
}) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-4 ${sub.status === 'cancelled' ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-zinc-900 text-[13px] truncate">
            {sub.profiles?.name || sub.recipient_name || '-'}
          </p>
          <p className="text-[10px] text-zinc-400 truncate">
            {sub.profiles?.email || ''}
          </p>
        </div>
        <StatusBadge status={sub.status} />
      </div>
      <div className="mt-2.5 text-[12px] text-zinc-700">
        {sub.subscription_items.map((item, i) => (
          <div key={i}>
            {item.product_name} ×{item.quantity}
          </div>
        ))}
        <p className="text-[10px] text-zinc-400 mt-0.5">
          {freshTierLabel(sub.fresh_ratio)}
          {sub.dogs ? ` · 🐶 ${sub.dogs.name}` : ''}
        </p>
      </div>
      <div className="mt-2.5 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[12px]">
        <span className="text-zinc-500">
          다음 배송{' '}
          <strong className="text-zinc-800">
            {sub.next_delivery_date
              ? new Date(sub.next_delivery_date).toLocaleDateString('ko-KR', {
                  month: 'short',
                  day: 'numeric',
                })
              : '-'}
          </strong>{' '}
          · 누적 {sub.total_deliveries}회
        </span>
        <strong className="text-zinc-900">
          {sub.total_amount.toLocaleString()}원
        </strong>
      </div>
      <div className="mt-3">
        <RowActions sub={sub} isLoading={isLoading} onAction={onAction} />
      </div>
    </div>
  )
}
