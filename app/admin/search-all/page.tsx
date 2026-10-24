import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Search, User, Package, Dog } from 'lucide-react'
import { AdminTabs } from '@/components/admin/ui'
import { CUSTOMER_TABS } from '@/components/admin/tabGroups'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import { safeOrTerm } from '@/lib/supabase/or-filter'
import { customerHref, subscriptionHref } from '@/lib/admin/customer-link'
import { orderBadge, subBadge } from '@/lib/admin/status-badge'
import { subscriptionState, type SubState } from '@/lib/subscription-state'
import { weekdayKo } from '@/lib/shipping-schedule'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ q?: string }>

/**
 * /admin/search-all — 찾기. 검색창 하나로 강아지·고객·주문을 한 번에.
 *
 * 2026-10-24 어드민 2묶음(2-4): **강아지 이름으로 찾기**를 넣고 맨 위에 둔다. 사장님은 고객을 강아지 이름으로 기억하는데
 * (태리·치카), 예전 검색 셋 다 강아지 이름으로는 아무것도 못 찾았다. 강아지 줄을 누르면 정기배송 한 장이 열린다.
 *
 * 검색 대상:
 *   - dogs: name
 *   - profiles: email / name / phone
 *   - orders: order_number / recipient_name
 *   - subscriptions: 받는 분 이름·전화 + 찾은 강아지의 것 + 찾은 고객의 것
 *
 * ★조회 실패를 '결과 없음'으로 위장하지 않는다(규칙1) — subscriptions→profiles FK 가 빠져 있던 동안 정기배송 칸이 몇 주간
 *   조용히 비어 있었다. 칸마다 실패를 모아 빨간 줄로 말한다.
 */

type ProfileRow = { id: string; email: string | null; name: string | null; phone: string | null }
type OrderRow = {
  id: string
  order_number: string
  recipient_name: string | null
  total_amount: number
  payment_status: string
  order_status: string
  paid_at: string | null
}
type DogRow = { id: string; name: string; user_id: string }
type SubRow = {
  id: string
  user_id: string
  dog_id: string | null
  status: 'active' | 'paused' | 'cancelled'
  next_delivery_date: string | null
  has_billing_key: boolean
  failed_charge_count: number | null
  requires_billing_key_renewal: boolean | null
  recipient_name: string | null
  profiles: { name: string | null } | null
  dogs: { name: string } | null
}

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${weekdayKo(iso.slice(0, 10))})`

/** 진행 중이 위로 — 같은 강아지의 해지된 옛 정기배송이 새 것을 가리지 않게. */
const STATE_ORDER: Record<SubState, number> = { active: 0, card_failed: 1, needs_card: 2, paused: 3, cancelled: 4 }

export default async function AdminUnifiedSearch({ searchParams }: { searchParams: SearchParams }) {
  const { q = '' } = await searchParams
  const query = q.trim()
  const supabase = await createClient()

  let profiles: ProfileRow[] = []
  let orders: OrderRow[] = []
  let subs: Array<SubRow & { state: SubState }> = []
  let dogsWithoutSub: Array<DogRow & { ownerName: string | null }> = []
  const failed: string[] = []

  // 기호만 입력하면 정화 후 빈 문자열 = '%%' 전량 매치 — 검색을 걸지 않는다(정본 docstring 의 계약).
  const safeQ = query ? safeOrTerm(query) : ''
  if (safeQ) {
    const like = `%${safeQ}%`
    const [pRes, oRes, dRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, name, phone')
        .or(`email.ilike.${like},name.ilike.${like},phone.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('orders')
        .select('id, order_number, recipient_name, total_amount, payment_status, order_status, paid_at')
        .or(`order_number.ilike.${like},recipient_name.ilike.${like}`)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('dogs').select('id, name, user_id').ilike('name', like).limit(30),
    ])
    if (pRes.error) failed.push('고객')
    if (oRes.error) failed.push('주문')
    if (dRes.error) failed.push('강아지')
    profiles = (pRes.data ?? []) as ProfileRow[]
    orders = (oRes.data ?? []) as OrderRow[]
    const dogs = (dRes.data ?? []) as DogRow[]

    // 정기배송 = 받는 분 이름·전화로 찾은 것 + 찾은 강아지의 것 + 찾은 고객의 것. id 목록은 DB 에서 온 UUID 라 or() 에 넣어도 안전하다.
    const clauses = [`recipient_name.ilike.${like}`, `recipient_phone.ilike.${like}`]
    if (dogs.length) clauses.push(`dog_id.in.(${dogs.map((d) => d.id).join(',')})`)
    if (profiles.length) clauses.push(`user_id.in.(${profiles.map((p) => p.id).join(',')})`)
    const sRes = await supabase
      .from('subscriptions')
      .select(
        'id, user_id, dog_id, status, next_delivery_date, has_billing_key, failed_charge_count, requires_billing_key_renewal, recipient_name, profiles(name), dogs(name)',
      )
      .or(clauses.join(','))
      .order('created_at', { ascending: false })
      .limit(40)
    if (sRes.error) failed.push('정기배송')
    subs = ((sRes.data ?? []) as unknown as SubRow[])
      .map((s) => ({
        ...s,
        state: subscriptionState({
          status: s.status,
          has_billing_key: s.has_billing_key,
          next_delivery_date: s.next_delivery_date,
          failed_charge_count: s.failed_charge_count ?? 0,
          requires_billing_key_renewal: !!s.requires_billing_key_renewal,
        }),
      }))
      .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])

    // 정기배송이 없는 강아지도 보여 준다(설문만 하고 신청 전) — 누르면 고객 화면.
    const withSub = new Set(subs.map((s) => s.dog_id).filter(Boolean))
    const lonely = dogs.filter((d) => !withSub.has(d.id))
    if (lonely.length) {
      const owners = await supabase.from('profiles').select('id, name').in('id', [...new Set(lonely.map((d) => d.user_id))])
      if (owners.error) failed.push('보호자 이름')
      const nameBy = new Map(((owners.data ?? []) as Array<{ id: string; name: string | null }>).map((p) => [p.id, p.name]))
      dogsWithoutSub = lonely.map((d) => ({ ...d, ownerName: nameBy.get(d.user_id) ?? null }))
    }
  }

  const totalHits = profiles.length + orders.length + subs.length + dogsWithoutSub.length

  return (
    <div>
      <AdminTabs tabs={CUSTOMER_TABS} active="/admin/search-all" />
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <Search className="size-5 text-primary" strokeWidth={2} />
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">찾기</h1>
        </div>
        <p className="mt-1 text-[14px] text-muted-foreground">강아지 이름 · 보호자 · 전화 · 주문번호 아무거나 넣어 보세요.</p>
      </header>

      <form action="/admin/search-all" method="get" className="mb-5 flex gap-2">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2} />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="땅콩 / 홍길동 / 010-1234-5678 / FT-20261024"
            className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-[15px] focus:border-primary focus:outline-none"
          />
        </div>
        <button type="submit" className="rounded-full bg-primary px-5 py-2 text-[14px] font-bold text-primary-foreground transition hover:opacity-90">
          찾기
        </button>
      </form>

      {failed.length > 0 && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-[13px] font-semibold text-destructive">
          {failed.join(' · ')}을(를) 불러오지 못했어요 — 없는 게 아니에요. 새로고침해 주세요.
        </p>
      )}

      {!query ? null : totalHits === 0 && failed.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-[14px] text-muted-foreground">
          &ldquo;{query}&rdquo;(으)로 찾은 게 없어요.
        </p>
      ) : (
        <div className="space-y-6">
          {(subs.length > 0 || dogsWithoutSub.length > 0) && (
            <ResultSection title="강아지 · 정기배송" icon={<Dog className="size-4" strokeWidth={2} />} count={subs.length + dogsWithoutSub.length}>
              {subs.map((s) => (
                <li key={s.id} className="border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <Link href={subscriptionHref(s.id)} className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <b className="text-[16px]">{s.dogs?.name ?? '(강아지 미상)'}</b>
                        <AdminStatusBadge badge={subBadge(s.state)} />
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {s.state === 'active' && s.next_delivery_date ? `다음 발송 ${md(s.next_delivery_date)}` : '정기배송 한 장 보기'} ›
                      </p>
                    </Link>
                    <Link href={customerHref(s.user_id)} className="shrink-0 text-[13px] font-semibold text-primary">
                      보호자 {s.profiles?.name ?? s.recipient_name ?? ''} ›
                    </Link>
                  </div>
                </li>
              ))}
              {dogsWithoutSub.map((d) => (
                <li key={d.id} className="border-b border-border last:border-b-0">
                  <Link href={customerHref(d.user_id)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/40">
                    <span className="min-w-0">
                      <b className="text-[16px]">{d.name}</b>
                      <span className="ml-1.5 text-[13px] text-muted-foreground">정기배송 없음</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-primary">보호자 {d.ownerName ?? ''} ›</span>
                  </Link>
                </li>
              ))}
            </ResultSection>
          )}

          {profiles.length > 0 && (
            <ResultSection title="고객" icon={<User className="size-4" strokeWidth={2} />} count={profiles.length}>
              {profiles.map((p) => (
                <li key={p.id} className="border-b border-border last:border-b-0">
                  <Link href={customerHref(p.id)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/40">
                    <span className="min-w-0">
                      <b className="text-[15px]">{p.name ?? '(이름 없음)'}</b>
                      <span className="block truncate text-[13px] text-muted-foreground">
                        {p.phone ?? '전화 없음'} · {p.email ?? '이메일 없음'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-primary">고객 화면 ›</span>
                  </Link>
                </li>
              ))}
            </ResultSection>
          )}

          {orders.length > 0 && (
            <ResultSection title="주문" icon={<Package className="size-4" strokeWidth={2} />} count={orders.length}>
              {orders.map((o) => (
                <li key={o.id} className="border-b border-border last:border-b-0">
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/40">
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <b className="text-[15px]">{o.recipient_name ?? '(받는 분 없음)'}</b>
                        <AdminStatusBadge badge={orderBadge(o)} />
                      </span>
                      <span className="block truncate font-mono text-[12px] text-muted-foreground">{o.order_number}</span>
                    </span>
                    {/* 결제 안 된 시도는 받은 돈이 아니다 — 금액을 흐리게(규칙313). */}
                    <span className={`shrink-0 text-[14px] font-bold tabular-nums ${o.paid_at ? '' : 'text-muted-foreground line-through'}`}>
                      {o.total_amount.toLocaleString('ko-KR')}원 ›
                    </span>
                  </Link>
                </li>
              ))}
            </ResultSection>
          )}
        </div>
      )}
    </div>
  )
}

function ResultSection({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-[15px] font-black text-foreground">{title}</h2>
        <span className="text-[13px] text-muted-foreground">{count}건</span>
      </div>
      <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">{children}</ul>
    </section>
  )
}
