import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AdminPagination from '@/components/admin/AdminPagination'

export const dynamic = 'force-dynamic'

const PER_PAGE = 50

type SearchParams = Promise<{
  status?: string
  q?: string
  page?: string
}>

// 서버(Vercel)는 UTC 라 raw Date getter 를 쓰면 주문 시각이 9시간 어긋난다.
// KST 로 명시 포맷 — "2026.06.05 14:30".
const KST_DATETIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
function formatDate(iso: string) {
  const parts = KST_DATETIME.formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}.${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`
}

function statusBadge(paymentStatus: string, orderStatus: string) {
  if (paymentStatus !== 'paid') {
    const labelMap: Record<string, string> = {
      pending: '결제 대기',
      failed: '결제 실패',
      cancelled: '결제 취소',
      partially_refunded: '부분 환불',
      refunded: '환불',
    }
    return {
      label: labelMap[paymentStatus] ?? paymentStatus,
      color: 'bg-rule text-text',
    }
  }
  switch (orderStatus) {
    case 'preparing':
      return { label: '준비 중', color: 'bg-terracotta text-white' }
    case 'shipping':
      return { label: '배송 중', color: 'bg-moss text-white' }
    case 'delivered':
      return { label: '배송 완료', color: 'bg-[#8BA05A] text-white' }
    case 'cancelled':
      return { label: '취소', color: 'bg-sale text-white' }
    default:
      return { label: orderStatus, color: 'bg-rule text-text' }
  }
}

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '결제 전' },
  { key: 'preparing', label: '준비 중' },
  { key: 'shipping', label: '배송 중' },
  { key: 'delivered', label: '배송 완료' },
  { key: 'cancelled', label: '취소' },
]

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { status = 'all', q = '', page: pageRaw } = await searchParams
  const page = Math.max(1, parseInt(pageRaw ?? '1', 10) || 1)

  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select(
      'id, order_number, total_amount, payment_status, order_status, created_at, recipient_name, recipient_phone',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

  // 상태 필터
  if (status === 'pending') {
    query = query.eq('payment_status', 'pending')
  } else if (
    status === 'preparing' ||
    status === 'shipping' ||
    status === 'delivered' ||
    status === 'cancelled'
  ) {
    query = query.eq('payment_status', 'paid').eq('order_status', status)
  }

  // 검색 — 주문번호 / 수령자명 / 전화번호 3중. 운영팀이 고객 문의 받을 때
  // 가장 흔한 키 세 가지. PostgREST `or()` 는 (%, _, (, ), \, ,) escape 안
  // 해주니 직접 처리.
  //
  // 전화 검색 한계: stored 형식이 '010-1234-5678' 인데 사용자가 '01012345678'
  // (하이픈 없이) 입력하면 매치 안 됨. 운영팀 안내: 입력 형식 그대로 저장된
  // 형식과 맞춰야 함. 정규화는 generated column + index 가 정공이라 schema
  // 변경이 필요해 별도 작업.
  const trimmed = q.trim()
  if (trimmed) {
    const escaped = trimmed.replace(/[\\%_,()]/g, (m) => `\\${m}`)
    query = query.or(
      [
        `order_number.ilike.%${escaped}%`,
        `recipient_name.ilike.%${escaped}%`,
        `recipient_phone.ilike.%${escaped}%`,
      ].join(','),
    )
  }

  const { data: orders, error, count } = await query
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // CSV export URL — 현재 필터/검색을 그대로 전달.
  const exportParams = new URLSearchParams()
  if (status !== 'all') exportParams.set('status', status)
  if (q.trim()) exportParams.set('q', q.trim())
  const exportHref = `/api/admin/orders/export${
    exportParams.toString() ? `?${exportParams.toString()}` : ''
  }`

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
            주문 관리
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            들어온 주문을 결제·배송 상태별로 찾고 관리하는 곳이에요. 정기배송
            자동결제도 결제될 때마다 여기에 주문 한 건으로 쌓여요. 주문번호를
            누르면 상세에서 배송 상태 변경·환불을 처리할 수 있어요.
          </p>
        </div>
        <a
          href={exportHref}
          // download 속성이 있으면 브라우저가 바로 저장. 서버는 Content-Disposition
          // 으로 파일명을 지정하지만, 구형 Safari/Edge 에서 href 그대로 네비게이션
          // 되는 이슈를 방지.
          download
          className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white border border-zinc-200 text-ink hover:border-terracotta hover:text-terracotta transition"
        >
          <span>⬇</span>
          <span>CSV 내보내기</span>
        </a>
      </div>

      {/* 필터 탭 + 검색 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const active = status === f.key
            const href =
              f.key === 'all'
                ? `/admin/orders${q ? `?q=${encodeURIComponent(q)}` : ''}`
                : `/admin/orders?status=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`
            return (
              <Link
                key={f.key}
                href={href}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  active
                    ? 'bg-[#2A2118] text-white'
                    : 'bg-white text-text border border-zinc-200 hover:border-terracotta'
                }`}
              >
                {f.label}
              </Link>
            )
          })}
        </div>

        <form
          action="/admin/orders"
          method="get"
          className="flex gap-2 items-center"
        >
          {status !== 'all' && (
            <input type="hidden" name="status" value={status} />
          )}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="주문번호 · 이름 · 전화"
            inputMode="search"
            autoComplete="off"
            className="px-3 py-1.5 rounded-full text-xs bg-white border border-zinc-200 focus:outline-none focus:border-terracotta w-56"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-terracotta text-white hover:bg-[#8A3822] transition"
          >
            검색
          </button>
        </form>
      </div>

      {/* 주문 테이블(데스크톱) / 카드(모바일) */}
      <div className="md:p-6 md:rounded-lg md:bg-white md:border md:border-zinc-200">
        {error ? (
          <p className="text-sale text-sm">에러: {error.message}</p>
        ) : !orders || orders.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">
            조건에 맞는 주문이 없어요
          </p>
        ) : (
          <>
          {/* 모바일 카드 — 테이블은 폰에서 셀이 부러진다(2026-07-19 사장님 폰). */}
          <div className="md:hidden space-y-2.5">
            {orders.map((o) => {
              const badge = statusBadge(o.payment_status, o.order_status)
              return (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="block rounded-lg border border-zinc-200 bg-white p-4 active:bg-zinc-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-zinc-500 truncate">
                      {o.order_number}
                    </span>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold text-zinc-900 truncate">
                      {o.recipient_name}
                    </span>
                    <strong className="shrink-0 text-[14px] text-zinc-900">
                      {o.total_amount.toLocaleString()}원
                    </strong>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {o.recipient_phone} · {formatDate(o.created_at)}
                  </p>
                </Link>
              )
            })}
          </div>

          {/* 데스크톱 테이블 */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted border-b border-zinc-200">
                  <th className="text-left py-2 font-medium">주문번호</th>
                  <th className="text-left py-2 font-medium">주문자</th>
                  <th className="text-left py-2 font-medium">연락처</th>
                  <th className="text-right py-2 font-medium">금액</th>
                  <th className="text-center py-2 font-medium">상태</th>
                  <th className="text-right py-2 font-medium">주문 시각</th>
                  <th className="text-center py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const badge = statusBadge(o.payment_status, o.order_status)
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-zinc-200/50 hover:bg-bg transition"
                    >
                      <td className="py-3 font-mono text-[11px] text-ink">
                        {o.order_number}
                      </td>
                      <td className="py-3 text-ink">{o.recipient_name}</td>
                      <td className="py-3 text-[11px] text-text">
                        {o.recipient_phone}
                      </td>
                      <td className="py-3 text-right font-semibold text-ink">
                        {o.total_amount.toLocaleString()}원
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${badge.color}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-current opacity-80"
                            aria-hidden
                          />
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[11px] text-muted">
                        {formatDate(o.created_at)}
                      </td>
                      <td className="py-3 text-center">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="text-[11px] text-terracotta hover:underline font-semibold"
                        >
                          상세 →
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
          basePath="/admin/orders"
          params={{
            status: status !== 'all' ? status : undefined,
            q: q || undefined,
          }}
          total={total}
        />
      )}
    </div>
  )
}