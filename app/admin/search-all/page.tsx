import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Search, User, Package, Repeat } from 'lucide-react'
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/lib/commerce/order-fsm'
import { STATUS_MAP as SUB_STATUS_MAP } from '@/lib/v3-helpers/subscriptions'
import { AdminTabs } from '@/components/admin/ui'
import { CUSTOMER_TABS } from '@/components/admin/tabGroups'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ q?: string }>

/**
 * /admin/search-all — 한 검색창으로 사용자 / 주문 / 정기배송 동시 조회.
 *
 * CS 핫라인: 고객이 "주문번호 ABC123" 또는 "이메일 hello@x.com" 으로 문의 오면
 * 어디 들어가서 검색해야 할지 고민하지 않게. 한 곳에서 hit.
 *
 * 검색 대상:
 *   - profiles: email / name / phone ilike
 *   - orders: order_number / recipient_name ilike
 *   - subscriptions: id (UUID prefix) — id 가 직접 입력되는 케이스는 드물어
 *     사용자별로 묶어 표시
 *
 * 결과는 카테고리별 카드. 각 행 클릭 시 해당 admin 상세 페이지로 이동.
 */
export default async function AdminUnifiedSearch({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { q = '' } = await searchParams
  const query = q.trim()
  const supabase = await createClient()

  type ProfileRow = {
    id: string
    email: string | null
    name: string | null
    phone: string | null
    created_at: string
  }
  type OrderRow = {
    id: string
    order_number: string
    recipient_name: string | null
    total_amount: number
    payment_status: string
    order_status: string
    created_at: string
  }
  type SubRow = {
    id: string
    user_id: string
    status: string
    next_delivery_date: string | null
    total_amount: number
    profiles: { name: string | null; email: string | null } | null
  }

  let profiles: ProfileRow[] = []
  let orders: OrderRow[] = []
  let subs: SubRow[] = []

  if (query) {
    const like = `%${query.replace(/[%_]/g, '\\$&')}%`

    const [pRes, oRes, sRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, name, phone, created_at')
        .or(`email.ilike.${like},name.ilike.${like},phone.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('orders')
        .select(
          'id, order_number, recipient_name, total_amount, payment_status, order_status, created_at',
        )
        .or(`order_number.ilike.${like},recipient_name.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('subscriptions')
        .select(
          'id, user_id, status, next_delivery_date, total_amount, profiles(name, email)',
        )
        .or(`recipient_name.ilike.${like},recipient_phone.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    profiles = (pRes.data ?? []) as ProfileRow[]
    orders = (oRes.data ?? []) as OrderRow[]
    subs = ((sRes.data ?? []) as unknown) as SubRow[]
  }

  const totalHits = profiles.length + orders.length + subs.length

  return (
    <div>
      {/* 대개편 v2 T2 — 고객 그룹 탭 + 헤더 zinc 통일(킥커-제목 중복 제거) */}
      <AdminTabs tabs={CUSTOMER_TABS} active="/admin/search-all" />
      <header className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
          전체 검색
        </h1>
        <p className="text-[13px] text-zinc-500 mt-1">
          고객이 전화나 메시지로 문의할 때 빠르게 찾는 곳이에요 —
          이메일·이름·연락처·주문번호 아무거나 넣으면 회원·주문·정기배송을 한 번에
          찾아줘요.
        </p>
      </header>

      <form action="/admin/search-all" method="get" className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-xl">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
            strokeWidth={2}
          />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="hello@example.com / 홍길동 / 010-1234-5678 / FT-2026-0001"
            className="w-full pl-9 pr-4 py-2.5 rounded-full text-sm bg-white border border-zinc-200 focus:outline-none focus:border-terracotta"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2 rounded-full text-xs font-semibold bg-terracotta text-white hover:bg-[#8A3822] transition"
        >
          검색
        </button>
      </form>

      {!query ? (
        <div className="bg-white rounded-lg border border-zinc-200 p-8 text-center">
          <p className="text-[12px] text-muted">검색어를 입력해 주세요.</p>
        </div>
      ) : totalHits === 0 ? (
        <div className="bg-white rounded-lg border border-zinc-200 p-8 text-center">
          <p className="text-[12px] text-muted">
            &ldquo;{query}&rdquo; 결과가 없어요.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 사용자 */}
          {profiles.length > 0 && (
            <ResultSection
              title="회원"
              icon={<User className="w-3.5 h-3.5" strokeWidth={2} />}
              count={profiles.length}
            >
              <ul className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                {profiles.map((p) => (
                  <li
                    key={p.id}
                    className="border-b border-zinc-200 last:border-b-0"
                  >
                    <Link
                      href={`/admin/users/${p.id}/message`}
                      className="block px-4 py-3 hover:bg-bg-2/40 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-bold text-text">
                            {p.name ?? '(이름 없음)'}
                          </p>
                          <p className="text-[11px] text-muted truncate">
                            {p.email ?? '—'} · {p.phone ?? '—'}
                          </p>
                        </div>
                        <span className="text-[10px] text-terracotta font-bold shrink-0">
                          메시지 →
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {/* 주문 */}
          {orders.length > 0 && (
            <ResultSection
              title="주문"
              icon={<Package className="w-3.5 h-3.5" strokeWidth={2} />}
              count={orders.length}
            >
              <ul className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                {orders.map((o) => (
                  <li
                    key={o.id}
                    className="border-b border-zinc-200 last:border-b-0"
                  >
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="block px-4 py-3 hover:bg-bg-2/40 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-bold text-text font-mono">
                            {o.order_number}
                          </p>
                          <p className="text-[11px] text-muted">
                            {o.recipient_name ?? '—'} ·{' '}
                            {o.total_amount.toLocaleString()}원 ·{' '}
                            <span className="font-bold text-terracotta">
                              {ORDER_STATUS_LABEL[o.order_status as OrderStatus] ??
                                o.order_status}
                            </span>
                          </p>
                        </div>
                        <span className="text-[10px] text-terracotta font-bold shrink-0">
                          상세 →
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {/* 정기배송 */}
          {subs.length > 0 && (
            <ResultSection
              title="정기배송"
              icon={<Repeat className="w-3.5 h-3.5" strokeWidth={2} />}
              count={subs.length}
            >
              <ul className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                {subs.map((s) => (
                  <li
                    key={s.id}
                    className="border-b border-zinc-200 last:border-b-0"
                  >
                    <Link
                      href="/admin/subscriptions"
                      className="block px-4 py-3 hover:bg-bg-2/40 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-bold text-text">
                            {s.profiles?.name ?? '(이름 없음)'} ·{' '}
                            <span className="text-muted font-mono text-[11px]">
                              {s.id.slice(0, 8)}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted">
                            {s.profiles?.email ?? '—'} ·{' '}
                            {s.total_amount.toLocaleString()}원/2주 ·{' '}
                            <span className="font-bold text-terracotta">
                              {SUB_STATUS_MAP[
                                s.status as 'active' | 'paused' | 'cancelled'
                              ]?.label ?? s.status}
                            </span>
                            {s.next_delivery_date
                              ? ` · 다음: ${s.next_delivery_date}`
                              : ''}
                          </p>
                        </div>
                        <span className="text-[10px] text-terracotta font-bold shrink-0">
                          관리 →
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}
        </div>
      )}
    </div>
  )
}

function ResultSection({
  title,
  icon,
  count,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-terracotta">{icon}</span>
        <h2 className="text-[13px] font-black text-text">{title}</h2>
        <span className="text-[10px] text-muted">{count}건</span>
      </div>
      {children}
    </section>
  )
}
