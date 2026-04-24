import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { toCsvWithBom } from '@/lib/csv'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/admin/orders/export?status=&q=&from=&to=
 *
 * 출력: text/csv (UTF-8 BOM) — Excel 에서 바로 열림.
 * 보안: admin 만. 비관리자는 403.
 * Payload: 주문 row + join 된 order_items 요약. 관리자 UI 필터와 동일한
 * status/q/날짜 파라미터를 받아, 현재 보고 있는 뷰를 그대로 export.
 *
 * `from`/`to` 는 ISO 또는 YYYY-MM-DD. 지정 안 하면 최근 90일.
 */

type OrderRow = {
  id: string
  order_number: string
  total_amount: number
  subtotal: number | null
  shipping_fee: number | null
  payment_status: string
  payment_method: string | null
  order_status: string
  created_at: string
  paid_at: string | null
  recipient_name: string | null
  recipient_phone: string | null
  recipient_zip: string | null
  recipient_address: string | null
  recipient_address_detail: string | null
  shipping_memo: string | null
  tracking_carrier: string | null
  tracking_number: string | null
  order_items:
    | {
        product_name: string | null
        quantity: number
        unit_price: number
        line_total: number
      }[]
    | null
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function parseBoundary(input: string | null, fallback: Date): string {
  if (!input) return fallback.toISOString()
  // YYYY-MM-DD 는 로컬 자정으로 해석해 하루 단위 범위가 어긋나지 않게.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(`${input}T00:00:00`) : new Date(input)
  if (Number.isNaN(d.getTime())) return fallback.toISOString()
  return d.toISOString()
}

function sanitizeCarrier(carrier: string | null | undefined): string {
  if (!carrier) return ''
  // 실제 carrierLabel 은 별도 모듈이지만, CSV 는 원시 코드만 내보낸다
  // (운영팀이 엑셀에서 VLOOKUP 으로 이름 붙이기 쉬움).
  return carrier
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status') ?? 'all'
  const q = (url.searchParams.get('q') ?? '').trim()
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const from = parseBoundary(fromParam, ninetyDaysAgo)
  const to = parseBoundary(toParam, new Date())

  let query = supabase
    .from('orders')
    .select(
      `
      id, order_number, total_amount, subtotal, shipping_fee,
      payment_status, payment_method, order_status,
      created_at, paid_at,
      recipient_name, recipient_phone, recipient_zip,
      recipient_address, recipient_address_detail, shipping_memo,
      tracking_carrier, tracking_number,
      order_items (product_name, quantity, unit_price, line_total)
    `,
    )
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(5000)

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

  if (q) {
    // 주문번호 · 수령자명 부분 일치. SQL injection 은 supabase-js 가 이스케이프.
    query = query.or(`order_number.ilike.%${q}%,recipient_name.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json(
      { error: 'query_failed', detail: error.message },
      { status: 500 },
    )
  }

  const rows = ((data ?? []) as unknown as OrderRow[]).map((o) => {
    const items = o.order_items ?? []
    const itemsSummary = items
      .map(
        (it) =>
          `${it.product_name ?? '-'} × ${it.quantity} (${it.line_total.toLocaleString()}원)`,
      )
      .join(' | ')
    const address = [o.recipient_address, o.recipient_address_detail]
      .filter(Boolean)
      .join(' ')
    return {
      주문번호: o.order_number,
      주문일시: formatDateTime(o.created_at),
      결제일시: formatDateTime(o.paid_at),
      결제상태: o.payment_status,
      결제수단: o.payment_method ?? '',
      배송상태: o.order_status,
      수령인: o.recipient_name ?? '',
      연락처: o.recipient_phone ?? '',
      우편번호: o.recipient_zip ?? '',
      주소: address,
      배송메모: o.shipping_memo ?? '',
      상품요약: itemsSummary,
      상품수: items.reduce((s, it) => s + it.quantity, 0),
      상품금액: o.subtotal ?? '',
      배송비: o.shipping_fee ?? '',
      결제금액: o.total_amount,
      택배사: sanitizeCarrier(o.tracking_carrier),
      송장번호: o.tracking_number ?? '',
    }
  })

  const columns = [
    '주문번호',
    '주문일시',
    '결제일시',
    '결제상태',
    '결제수단',
    '배송상태',
    '수령인',
    '연락처',
    '우편번호',
    '주소',
    '배송메모',
    '상품요약',
    '상품수',
    '상품금액',
    '배송비',
    '결제금액',
    '택배사',
    '송장번호',
  ]

  // BOM 을 문자열로 앞에 붙인 뒤 fetch/Response 가 UTF-8 로 자동 인코딩.
  // Uint8Array 직접 전달은 strict TS 에서 ArrayBufferLike vs ArrayBuffer
  // 미스매치를 일으켜 문자열 경로로 통일.
  const body = toCsvWithBom(rows, columns)

  const today = new Date()
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const filename = `farmerstail_orders_${stamp}.csv`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
