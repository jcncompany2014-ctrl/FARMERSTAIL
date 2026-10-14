import Link from 'next/link'
import { Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminPagination from '@/components/admin/AdminPagination'
import { AdminTabs, Hl, Em, FilterChip, LoadError } from '@/components/admin/ui'
import { CUSTOMER_TABS } from '@/components/admin/tabGroups'
import { safeOrTerm } from '@/lib/supabase/or-filter'
import { customerHref } from '@/lib/admin/customer-link'
import {
  CUSTOMER_FLAG_KEYS,
  CUSTOMER_FLAG_LABEL,
  matchesFlagFilter,
  parseFlagFilter,
  type CustomerFlagKey,
} from '@/lib/admin/customer-flags'
import { loadAllCustomerFlags } from '@/lib/admin/customer-flags-load'

export const dynamic = 'force-dynamic'

const PER_PAGE = 50

type SearchParams = Promise<{
  q?: string
  page?: string
  /** 챙길 손님 필터 — any · card_renewal · old_app · no_push · bounced (lib/admin/customer-flags). */
  flag?: string
}>

type UserRow = {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  zip: string | null
  address: string | null
  address_detail: string | null
  role: string | null
  created_at: string | null
}

const USER_COLS = 'id, email, name, phone, zip, address, address_detail, role, created_at'

// 서버(Vercel UTC) raw getter 대신 KST 로 가입일 포맷 (자정 경계 off-by-one 방지).
const KST_DATE = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
function formatDate(iso: string | null) {
  if (!iso) return '-'
  const parts = KST_DATE.formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}.${get('month')}.${get('day')}`
}

/** 검색어를 메모리에서 거를 때(챙길 손님 필터와 함께) — ilike 와 같은 '포함' 판정. */
function matchesQuery(u: { email: string | null; name: string | null; phone: string | null }, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [u.email, u.name, u.phone].some((v) => (v ?? '').toLowerCase().includes(needle))
}

function FlagBadges({ keys }: { keys: readonly CustomerFlagKey[] | undefined }) {
  if (!keys || keys.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <span
          key={k}
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            k === 'card_renewal' || k === 'old_app' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {CUSTOMER_FLAG_LABEL[k]}
        </span>
      ))}
    </span>
  )
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { q = '', page: pageRaw, flag: flagRaw } = await searchParams
  const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1)
  const flag = parseFlagFilter(flagRaw)

  const supabase = await createClient()

  /**
   * 챙길 손님 신호 — 메일 반송·앱 알림 못 받음·옛 앱·카드 재등록(2026-10-14 C4, 규칙256).
   * 판정은 정본(lib/admin/customer-flags), 조회는 service_role(알림 기기는 본인만 읽는 RLS — 관리자 쿠키로는 0행이라
   * 전원이 '알림 못 받음'으로 보인다). 이 화면은 레이아웃이 관리자를 확인한 뒤다. 실패하면 배지·필터를 '없음'으로 그리지
   * 않고 알린다(규칙1).
   */
  const flagRes = await loadAllCustomerFlags(createAdminClient())
  const flagCounts = new Map<string, number>()
  if (flagRes.ok) {
    for (const f of flagRes.byUser.values()) {
      if (f.keys.length > 0) flagCounts.set('any', (flagCounts.get('any') ?? 0) + 1)
      for (const k of f.keys) flagCounts.set(k, (flagCounts.get(k) ?? 0) + 1)
    }
  }

  let users: UserRow[] | null = null
  let error: { message: string } | null = null
  let total = 0

  if (flag) {
    // 필터 — 신호가 있는 회원을 가입 최신순으로 거른 뒤 이 쪽 50명만 다시 읽는다(검색어는 메모리에서 같이 거른다).
    if (!flagRes.ok) {
      error = { message: flagRes.error }
    } else {
      const matched = flagRes.users.filter(
        (u) => matchesFlagFilter(flagRes.byUser.get(u.id)?.keys ?? [], flag) && matchesQuery(u, q),
      )
      total = matched.length
      const pageIds = matched.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((u) => u.id)
      if (pageIds.length === 0) {
        users = []
      } else {
        const { data, error: e } = await supabase.from('profiles').select(USER_COLS).in('id', pageIds)
        error = e
        const order = new Map(pageIds.map((id, i) => [id, i]))
        users = ((data ?? []) as UserRow[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      }
    }
  } else {
    let query = supabase
      .from('profiles')
      .select(USER_COLS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

    // ★`.or()` 는 표현식 문자열이라 supabase-js 가 escape 하지 않는다 —
    //  사용자 입력에 `,()` 가 있으면 필터 절이 주입된다(2026-08-08 보안 재감사).
    //  저장소의 다른 다섯 곳은 이미 정화하고 있었는데 여기만 빠져 있었다.
    const safeQ = safeOrTerm(q)
    if (safeQ) {
      query = query.or(
        `email.ilike.%${safeQ}%,name.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`,
      )
    }

    const res = await query
    users = (res.data ?? null) as UserRow[] | null
    error = res.error
    total = res.count ?? 0
  }
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // 각 유저별 주문 수/누적 금액 집계 (현재 페이지 50명에 한정 — N+1 bounded)
  const userIds = (users ?? []).map((u) => u.id)
  const orderStats: Record<string, { count: number; total: number }> = {}
  let orderStatsFailed = false

  if (userIds.length > 0) {
    // R101-D: 누적 결제액에 partially_refunded 주문도 포함 + net(환불 제외)으로
    // 합산. 이전엔 'paid' 만 봐서 부분환불된 주문이 통째로 누락됐다(5만원 결제 후
    // 1만원만 환불해도 4만원이 0 으로 사라짐).
    // ★error 를 받는다 (2026-09-05 전수감사, AGENTS.md 규칙1) — 실패를 버리면
    //   전원 '주문 0건 · 누적 0원'으로 위장된다. 실패 시 아래 배너로 표시.
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('user_id, total_amount, refunded_amount, payment_status')
      .in('user_id', userIds)
      .in('payment_status', ['paid', 'partially_refunded'])
    if (ordersErr) {
      console.error('[admin-users] 주문 집계 조회 실패:', ordersErr.message)
      orderStatsFailed = true
    }

    ;(orders ?? []).forEach(
      (o: {
        user_id: string
        total_amount: number
        refunded_amount: number | null
      }) => {
        if (!orderStats[o.user_id]) {
          orderStats[o.user_id] = { count: 0, total: 0 }
        }
        orderStats[o.user_id]!.count += 1
        orderStats[o.user_id]!.total += o.total_amount - (o.refunded_amount ?? 0)
      },
    )
  }

  const flagHref = (f: string | null) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (f) sp.set('flag', f)
    const s = sp.toString()
    return s ? `/admin/users?${s}` : '/admin/users'
  }
  const flagsOf = (id: string) => (flagRes.ok ? flagRes.byUser.get(id)?.keys : undefined)

  return (
    <div>
      {/* 대개편 v2 T2 — 고객 그룹 탭 (회원|답장|검색) */}
      <AdminTabs tabs={CUSTOMER_TABS} active="/admin/users" />
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" strokeWidth={2} />
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            회원 관리
          </h1>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          <Hl>가입한 고객 명단</Hl>이에요. 이름을 누르면 그 고객의 정기배송·강아지·결제·문의 기록이 한 화면에 떠요.
          특정 고객의 주문·정기배송을 찾을 땐 옆의{' '}
          <Em>&lsquo;전체 검색&rsquo; 탭</Em>이 빨라요. — {flag ? '걸러진' : '총'}{' '}
          {total.toLocaleString()}명
        </p>
      </div>

      {/* 검색 */}
      <div className="mb-3">
        <form action="/admin/users" method="get" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="이메일, 이름, 연락처로 검색"
            className="flex-1 max-w-md px-4 py-2 rounded-full text-sm bg-card border border-border focus:outline-none focus:border-primary"
          />
          {flag && <input type="hidden" name="flag" value={flag} />}
          <button
            type="submit"
            className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            검색
          </button>
          {(q || flag) && (
            <Link
              href="/admin/users"
              className="px-4 py-2 rounded-full text-xs font-semibold bg-card border border-border text-foreground hover:border-primary transition"
            >
              초기화
            </Link>
          )}
        </form>
      </div>

      {/* 챙길 손님 필터(C4) */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        <FilterChip label="전체" active={!flag} href={flagHref(null)} />
        <FilterChip label={`챙길 손님 ${flagRes.ok ? (flagCounts.get('any') ?? 0) : '?'}`} active={flag === 'any'} href={flagHref('any')} />
        {CUSTOMER_FLAG_KEYS.map((k) => (
          <FilterChip
            key={k}
            label={`${CUSTOMER_FLAG_LABEL[k]} ${flagRes.ok ? (flagCounts.get(k) ?? 0) : '?'}`}
            active={flag === k}
            href={flagHref(k)}
          />
        ))}
      </div>
      {!flagRes.ok && (
        <div className="mb-3">
          <LoadError
            what="챙길 손님 신호"
            hint="메일 반송·알림 기기·카드 상태를 불러오지 못했어요 — 배지가 없어도 신호가 없는 게 아니에요. 새로고침해 주세요."
          />
        </div>
      )}

      {orderStatsFailed && (
        <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="text-[12px] font-semibold text-destructive">
            주문 횟수·누적 금액을 불러오지 못했어요 — 아래 숫자가 전부 0으로
            보일 수 있어요. 실제 0이 아니라 조회가 실패한 상태예요.
          </p>
        </div>
      )}

      {/* 테이블(데스크톱) / 카드(모바일) — 모바일에선 흰 컨테이너를 벗겨
          카드-인-카드 이중 보더를 피한다. */}
      <div className="md:p-6 md:rounded-xl md:bg-card md:border md:border-border md:shadow-sm">
        {error ? (
          <div>
            <p className="text-destructive text-sm">
              회원 정보를 불러오지 못했어요.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              잠시 후 다시 시도해 주세요. 계속 안 되면 개발 담당에게 이 화면을
              알려주세요. (회원 조회 권한 설정 문제일 수 있어요.)
            </p>
          </div>
        ) : !users || users.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            {q || flag ? '조건에 맞는 회원이 없어요' : '가입한 회원이 없어요'}
          </p>
        ) : (
          <>
          {/* 모바일: 카드 리스트 — 테이블은 폰에서 셀이 부러진다(2026-07-19). */}
          <div className="md:hidden space-y-2.5">
            {users.map((u) => {
              const stats = orderStats[u.id] ?? { count: 0, total: 0 }
              return (
                <div
                  key={u.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link href={customerHref(u.id)} className="min-w-0">
                      <p className="font-bold text-foreground text-[13px] truncate underline-offset-2 hover:underline">
                        {u.name ?? '(이름 미등록)'}
                        {u.role === 'admin' && (
                          <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-foreground text-background align-middle">
                            ADMIN
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {u.email ?? '-'}
                      </p>
                    </Link>
                    <Link
                      href={`/admin/users/${u.id}/message`}
                      className="shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary"
                    >
                      메시지
                    </Link>
                  </div>
                  <div className="mt-1.5">
                    <FlagBadges keys={flagsOf(u.id)} />
                  </div>
                  <div className="mt-2 text-[12px] text-muted-foreground space-y-0.5">
                    {u.phone && <p>{u.phone}</p>}
                    {u.address && (
                      <p className="truncate">
                        {u.address}
                        {u.address_detail ? ` ${u.address_detail}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      주문 {stats.count}건 · 누적{' '}
                      <strong className="text-foreground">
                        {stats.total.toLocaleString()}원
                      </strong>
                    </span>
                    <span>{formatDate(u.created_at)} 가입</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 데스크톱: 테이블 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground border-b border-border">
                  <th className="text-left py-2 font-medium">이름</th>
                  <th className="text-left py-2 font-medium">이메일</th>
                  <th className="text-left py-2 font-medium">연락처</th>
                  <th className="text-left py-2 font-medium">챙길 신호</th>
                  <th className="text-center py-2 font-medium">권한</th>
                  <th className="text-right py-2 font-medium">주문</th>
                  <th className="text-right py-2 font-medium">누적</th>
                  <th className="text-right py-2 font-medium">가입일</th>
                  <th className="text-center py-2 font-medium">CS</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const stats = orderStats[u.id] ?? { count: 0, total: 0 }
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border/60 hover:bg-secondary/50 transition"
                    >
                      <td className="py-3 text-foreground">
                        <Link href={customerHref(u.id)} className="font-semibold underline-offset-2 hover:underline">
                          {u.name ?? '(이름 미등록)'}
                        </Link>
                      </td>
                      <td className="py-3 text-[11px] text-foreground">
                        {u.email ?? '-'}
                      </td>
                      <td className="py-3 text-[11px] text-foreground">
                        {u.phone ?? '-'}
                      </td>
                      <td className="py-3">
                        <FlagBadges keys={flagsOf(u.id)} />
                      </td>
                      <td className="py-3 text-center">
                        {u.role === 'admin' ? (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-foreground text-background">
                            ADMIN
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">user</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-foreground font-semibold">
                        {stats.count}건
                      </td>
                      <td className="py-3 text-right font-semibold text-primary">
                        {stats.total.toLocaleString()}원
                      </td>
                      <td className="py-3 text-right text-[11px] text-muted-foreground">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="py-3 text-center">
                        <Link
                          href={`/admin/users/${u.id}/message`}
                          className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition"
                        >
                          메시지
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {!error && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          basePath="/admin/users"
          params={{ q: q || undefined, flag: flag ?? undefined }}
          total={total}
        />
      )}

      {/* 안내 */}
      <div className="mt-4 p-4 rounded-xl bg-secondary/60 border border-border">
        <p className="text-[11px] text-foreground">
          ℹ️ 배송지·강아지 알레르기는 고객 화면에서 고칠 수 있어요(확인창 + 작업 기록). 화식 비율·금액은 고객 동의가
          필요해서 어드민이 직접 바꾸지 않아요. 그 밖의 정보는 회원 본인이 마이페이지에서 바꿔요. 관리자 권한 부여는
          Supabase SQL Editor에서 직접 처리하세요.
        </p>
      </div>
    </div>
  )
}
