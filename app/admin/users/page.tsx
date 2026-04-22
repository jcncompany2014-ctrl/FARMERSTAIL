import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  q?: string
}>

function formatDate(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { q = '' } = await searchParams

  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select('id, email, name, phone, zip, address, address_detail, role, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (q.trim()) {
    query = query.or(
      `email.ilike.%${q.trim()}%,name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`
    )
  }

  const { data: users, error } = await query

  // 각 유저별 주문 수/누적 금액 집계
  const userIds = (users ?? []).map((u) => u.id)
  const orderStats: Record<string, { count: number; total: number }> = {}

  if (userIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('user_id, total_amount, payment_status')
      .in('user_id', userIds)
      .eq('payment_status', 'paid')

    ;(orders ?? []).forEach((o: { user_id: string; total_amount: number }) => {
      if (!orderStats[o.user_id]) {
        orderStats[o.user_id] = { count: 0, total: 0 }
      }
      orderStats[o.user_id].count += 1
      orderStats[o.user_id].total += o.total_amount
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-['Archivo_Black'] text-3xl text-ink">
          USERS
        </h1>
        <p className="text-sm text-muted mt-1">
          총 {users?.length ?? 0}명의 회원
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
            <p className="text-sale text-sm">에러: {error.message}</p>
            <p className="text-xs text-muted mt-2">
              profiles 테이블 RLS 정책에 admin 조회 권한이 없을 수 있어요.
              아래 SQL을 Supabase에서 실행해보세요:
            </p>
            <pre className="text-[10px] font-mono bg-bg p-3 rounded mt-2 overflow-x-auto">
{`create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());`}
            </pre>
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
                </tr>
              </thead>
              <tbody>
                {users.map((u: {
                  id: string
                  email: string | null
                  name: string | null
                  phone: string | null
                  zip: string | null
                  address: string | null
                  address_detail: string | null
                  role: string | null
                  created_at: string
                }) => {
                  const stats = orderStats[u.id] ?? { count: 0, total: 0 }
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-bg hover:bg-bg transition"
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
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2A2118] text-white">
                            ADMIN
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted">
                            user
                          </span>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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