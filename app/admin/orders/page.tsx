import Link from 'next/link'
import { Download, Search as SearchIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AdminPagination from '@/components/admin/AdminPagination'
import { Hl, Em } from '@/components/admin/ui'
import { Badge } from '@/components/adminui/badge'
import { Button } from '@/components/adminui/button'
import { Card, CardContent } from '@/components/adminui/card'
import { Input } from '@/components/adminui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/adminui/table'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import { safeOrTerm } from '@/lib/supabase/or-filter'

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

/**
 * 상태 배지 — 라벨/색 의미는 구버전 그대로(준비=브랜드 테라코타, 배송=그린,
 * 완료=옅은 그린, 취소·실패=적색 계열, 미결제=회색). 부품만 shadcn Badge.
 */
function statusBadge(paymentStatus: string, orderStatus: string): {
  label: string
  cls: string
} {
  if (paymentStatus !== 'paid') {
    const labelMap: Record<string, string> = {
      pending: '결제 대기',
      failed: '결제 실패',
      cancelled: '결제 취소',
      partially_refunded: '부분 환불',
      refunded: '환불',
    }
    const label = labelMap[paymentStatus] ?? paymentStatus
    const cls =
      paymentStatus === 'partially_refunded'
        ? 'bg-amber-100 text-amber-900 border-transparent'
        : paymentStatus === 'refunded' || paymentStatus === 'failed'
          ? 'bg-red-100 text-red-900 border-transparent'
          : 'bg-secondary text-secondary-foreground border-transparent'
    return { label, cls }
  }
  switch (orderStatus) {
    case 'preparing':
      return { label: '준비 중', cls: 'bg-primary text-primary-foreground border-transparent' }
    case 'shipping':
      return { label: '배송 중', cls: 'bg-emerald-600 text-white border-transparent' }
    case 'delivered':
      return { label: '배송 완료', cls: 'bg-emerald-100 text-emerald-900 border-transparent' }
    case 'cancelled':
      return { label: '취소', cls: 'bg-destructive text-white border-transparent' }
    default:
      return { label: orderStatus, cls: 'bg-secondary text-secondary-foreground border-transparent' }
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
    // ★결제됨 = paid + partially_refunded. 부분 환불된 주문도 박스는 나가야
    //  하는데 예전엔 'paid' 만 걸러서 발송 큐에서 통째로 사라졌다
    //  (lib/commerce/paid-status).
    //
    //  단 'cancelled' 는 예외다 — 취소된 주문은 결제도 함께 무효가 되므로
    //  payment_status 가 refunded/cancelled 다. 결제 필터를 걸면 이 칩은
    //  **구조적으로 항상 0건**이 된다(2026-08-07 재감사). 상태로만 거른다.
    query =
      status === 'cancelled'
        ? query.eq('order_status', status)
        : query.in('payment_status', PAID_STATUSES).eq('order_status', status)
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
    // 정화는 lib/supabase/or-filter 정본 하나 (2026-08-08 보안 재감사).
    // 백슬래시 이스케이프는 PostgREST 버전에 따라 해석이 갈린 전례가 있어
    // 정본은 **제거(strip)** 방식을 쓴다.
    const escaped = safeOrTerm(trimmed)
    // 빈 문자열이면 '%%' 전량 매치 — 검색을 걸지 않는다(정본 계약).
    if (escaped) query = query.or(
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
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">주문 관리</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            <Hl>들어온 주문을 결제·배송 상태별로 찾고 관리</Hl>하는 곳이에요.
            정기배송 자동결제도 결제될 때마다 여기에 주문 한 건으로 쌓여요.{' '}
            <Em>주문번호를 누르면</Em> 상세에서 배송 상태 변경·환불을 처리할 수
            있어요.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          {/* download 속성: 서버 Content-Disposition 파일명 + 구형 브라우저
              네비게이션 방지(기존 동작 유지) */}
          <a href={exportHref} download>
            <Download />
            CSV 내보내기
          </a>
        </Button>
      </div>

      {/* 필터 탭 + 검색 — URL(GET) 기반 동작은 구버전과 동일 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = status === f.key
            const href =
              f.key === 'all'
                ? `/admin/orders${q ? `?q=${encodeURIComponent(q)}` : ''}`
                : `/admin/orders?status=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ''}`
            return (
              <Button
                key={f.key}
                variant={active ? 'default' : 'outline'}
                size="sm"
                className="h-8 rounded-full px-3.5"
                asChild
              >
                <Link href={href}>{f.label}</Link>
              </Button>
            )
          })}
        </div>

        <form action="/admin/orders" method="get" className="flex items-center gap-2">
          {status !== 'all' && (
            <input type="hidden" name="status" value={status} />
          )}
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="주문번호 · 이름 · 전화"
            inputMode="search"
            autoComplete="off"
            className="h-9 w-56 rounded-full"
          />
          <Button type="submit" size="sm" className="h-9 rounded-full">
            <SearchIcon />
            검색
          </Button>
        </form>
      </div>

      {error ? (
        <Card className="py-4">
          <CardContent className="px-4 text-sm text-destructive">
            에러: {error.message}
          </CardContent>
        </Card>
      ) : !orders || orders.length === 0 ? (
        <Card className="py-10">
          <CardContent className="text-center text-sm text-muted-foreground">
            조건에 맞는 주문이 없어요
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 모바일 카드 — 테이블은 폰에서 셀이 부러진다(2026-07-19 사장님 폰). */}
          <div className="space-y-2.5 md:hidden">
            {orders.map((o) => {
              const badge = statusBadge(o.payment_status, o.order_status)
              return (
                <Link key={o.id} href={`/admin/orders/${o.id}`} className="block">
                  <Card className="gap-0 py-3.5 transition active:bg-muted">
                    <CardContent className="px-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {o.order_number}
                        </span>
                        <Badge className={`shrink-0 ${badge.cls}`}>{badge.label}</Badge>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-bold">
                          {o.recipient_name}
                        </span>
                        <strong className="shrink-0 text-sm tabular-nums">
                          {o.total_amount.toLocaleString()}원
                        </strong>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {o.recipient_phone} · {formatDate(o.created_at)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {/* 데스크톱 테이블 */}
          <Card className="hidden gap-0 py-2 md:block">
            <CardContent className="px-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>주문자</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead className="text-center">상태</TableHead>
                    <TableHead className="text-right">주문 시각</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => {
                    const badge = statusBadge(o.payment_status, o.order_status)
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-[11.5px]">
                          {o.order_number}
                        </TableCell>
                        <TableCell className="font-medium">{o.recipient_name}</TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">
                          {o.recipient_phone}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {o.total_amount.toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={badge.cls}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-[11.5px] tabular-nums text-muted-foreground">
                          {formatDate(o.created_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="text-[12px] font-semibold text-primary hover:underline"
                          >
                            상세 →
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

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
