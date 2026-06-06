import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AdminPagination from '@/components/admin/AdminPagination'

export const dynamic = 'force-dynamic'

const PER_PAGE = 50

type SearchParams = Promise<{
  q?: string
  page?: string
}>

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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { q = '', page: pageRaw } = await searchParams
  const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1)

  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select(
      'id, email, name, phone, zip, address, address_detail, role, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

  if (q.trim()) {
    query = query.or(
      `email.ilike.%${q.trim()}%,name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`
    )
  }

  const { data: users, error, count } = await query
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // 각 유저별 주문 수/누적 금액 집계 (현재 페이지 50명에 한정 — N+1 bounded)
  const userIds = (users ?? []).map((u) => u.id)
  const orderStats: Record<string, { count: number; total: number }> = {}

  if (userIds.length > 0) {
    // R101-D: 누적 결제액에 partially_refunded 주문도 포함 + net(환불 제외)으로
    // 합산. 이전엔 'paid' 만 봐서 부분환불된 주문이 통째로 누락됐다(5만원 결제 후
    // 1만원만 환불해도 4만원이 0 으로 사라짐).
    const { data: orders } = await supabase
      .from('orders')
      .select('user_id, total_amount, refunded_amount, payment_status')
      .in('user_id', userIds)
      .in('payment_status', ['paid', 'partially_refunded'])

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-['Archivo_Black'] text-3xl text-ink">
          USERS
        </h1>
        <p className="text-sm text-muted mt-1">
          총 {total.toLocaleString()}명의 회원
        </p>
      </div>

      {/* 검색 */}
      <div className="mb-4">
        <form action="/admin/users" method="get" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="이메일, 이름, 연락처로 검색"
            className="flex-1 max-w-md px-4 py-2 rounded-full text-sm bg-white border border-rule focus:outline-none focus:border-terracotta"
          />
          <button
            type="submit"
            className="px-5 py-2 rounded-full text-xs font-semibold bg-terracotta text-white hover:bg-[#8A3822] transition"
          >
            검색
          </button>
          {q && (
            <Link
              href="/admin/users"
              className="px-4 py-2 rounded-full text-xs font-semibold bg-white border border-rule text-text hover:border-terracotta transition"
            >
              초기화
            </Link>
          )}
        </form>
      </div>

      {/* 테이블 */}
      <div className="p-6 rounded-2xl bg-white border border-rule">
        {error ? (
          <div>
            <p className="text-sale text-sm">
              회원 정보를 불러오지 못했어요.
            </p>
            <p className="text-xs text-muted mt-2">
              잠시 후 다시 시도해 주세요. 계속 안 되면 개발 담당에게 이 화면을
              알려주세요. (회원 조회 권한 설정 문제일 수 있어요.)
            </p>
          </div>
        ) : !users || users.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">
            {q ? '조건에 맞는 회원이 없어요' : '가입한 회원이 없어요'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted border-b border-rule">
                  <th className="text-left py-2 font-medium">이메일</th>
                  <th className="text-left py-2 font-medium">이름</th>
                  <th className="text-left py-2 font-medium">연락처</th>
                  <th className="text-left py-2 font-medium">주소</th>
                  <th className="text-center py-2 font-medium">권한</th>
                  <th className="text-right py-2 font-medium">주문</th>
                  <th className="text-right py-2 font-medium">누적</th>
                  <th className="text-right py-2 font-medium">가입일</th>
                  <th className="text-center py-2 font-medium">CS</th>
                </tr>
              </thead>
              <tbody>
                {/* audit #79: generated 에서 created_at 도 nullable 추론 */}
                {users.map((u: {
                  id: string
                  email: string | null
                  name: string | null
                  phone: string | null
                  zip: string | null
                  address: string | null
                  address_detail: string | null
                  role: string | null
                  created_at: string | null
                }) => {
                  const stats = orderStats[u.id] ?? { count: 0, total: 0 }
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-rule/50 hover:bg-bg transition"
                    >
                      <td className="py-3 text-[11px] text-ink">
                        {u.email ?? '-'}
                      </td>
                      <td className="py-3 text-ink">{u.name ?? '-'}</td>
                      <td className="py-3 text-[11px] text-text">
                        {u.phone ?? '-'}
                      </td>
                      <td className="py-3 text-[11px] text-text max-w-xs truncate">
                        {u.address
                          ? `${u.address}${u.address_detail ? ' ' + u.address_detail : ''}`
                          : '-'}
                      </td>
                      <td className="py-3 text-center">
                        {u.role === 'admin' ? (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#2A2118] text-white">
                            ADMIN
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">user</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-ink font-semibold">
                        {stats.count}건
                      </td>
                      <td className="py-3 text-right font-semibold text-terracotta">
                        {stats.total.toLocaleString()}원
                      </td>
                      <td className="py-3 text-right text-[11px] text-muted">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="py-3 text-center">
                        <Link
                          href={`/admin/users/${u.id}/message`}
                          className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-terracotta/10 text-terracotta hover:bg-terracotta hover:text-white transition"
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
        )}
      </div>

      {!error && (
        <AdminPagination
          page={page}
          totalPages={totalPages}
          basePath="/admin/users"
          params={{ q: q || undefined }}
          total={total}
        />
      )}

      {/* 안내 */}
      <div className="mt-4 p-4 rounded-xl bg-bg border border-rule">
        <p className="text-[11px] text-text">
          ℹ️ 개인정보 보호를 위해 회원 정보는 조회만 가능해요. 수정이 필요하면
          회원 본인이 직접 마이페이지에서 변경해야 해요. 관리자 권한 부여는
          Supabase SQL Editor에서 직접 처리하세요.
        </p>
      </div>
    </div>
  )
}