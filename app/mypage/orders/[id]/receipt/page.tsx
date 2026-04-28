import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { business } from '@/lib/business'
import { paymentMethodLabel } from '@/lib/payments/toss'
import ReceiptAutoPrint from './ReceiptAutoPrint'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '주문 영수증',
  robots: { index: false, follow: false },
}

/**
 * /mypage/orders/[id]/receipt — 인쇄·PDF 저장 전용 영수증 페이지.
 *
 * 별도 PDF 라이브러리 없이 브라우저의 네이티브 print → "PDF 로 저장" 을
 * 활용. 모바일 (iOS Safari "PDF 로 인쇄", Android Chrome "PDF 저장") 도
 * 동일하게 동작.
 *
 * # 디자인 원칙
 *
 * - 종이 (A4) 비율 기준. max-w-[800px] + 흑백 친화 색.
 * - 매거진 톤은 살리되 잉크 절약을 위해 배경 색은 최소화.
 * - 사업자 정보는 footer 에 — 전자상거래법 §10 표기.
 * - 결제 영수증이 아니라 "주문 확인서" 성격 — 세금계산서 필요시 별도.
 *
 * # 자동 인쇄
 *
 * `?print=1` query 가 있으면 마운트 직후 `window.print()` 자동 호출.
 * 사용자 흐름: /mypage/orders/[id] "영수증 / PDF" 버튼 → 새 탭에서 ?print=1
 * 으로 열림 → 인쇄 다이얼로그 자동 표시 → 사용자가 "PDF 저장" 선택.
 */
type Params = Promise<{ id: string }>
type SearchParams = Promise<{ print?: string }>

type OrderRow = {
  id: string
  order_number: string
  total_amount: number
  shipping_fee: number
  payment_status: string
  payment_method: string | null
  order_status: string
  created_at: string
  paid_at: string | null
  recipient_name: string
  recipient_phone: string | null
  shipping_address: string | null
  shipping_address_detail: string | null
  shipping_zip: string | null
  shipping_memo: string | null
  user_id: string
  order_items: OrderItemRow[]
}

type OrderItemRow = {
  id: string
  product_name: string
  variant_name: string | null
  quantity: number
  unit_price: number
  line_total: number
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { print } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/mypage/orders/${id}/receipt`)

  const { data: order } = await supabase
    .from('orders')
    .select(
      `
      id, order_number, total_amount, shipping_fee, payment_status,
      payment_method, order_status, created_at, paid_at, recipient_name,
      recipient_phone, shipping_address, shipping_address_detail,
      shipping_zip, shipping_memo, user_id,
      order_items(id, product_name, variant_name, quantity, unit_price, line_total)
      `,
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!order) notFound()
  const o = order as unknown as OrderRow

  const subtotal = (o.order_items ?? []).reduce(
    (s, it) => s + (it.line_total ?? 0),
    0,
  )
  const shipping = o.shipping_fee ?? 0

  return (
    <main
      className="min-h-screen py-8 px-4 print:p-0 print:min-h-0"
      style={{ background: '#FAF6EE' }}
    >
      {/* 인쇄 시점 자동 호출 — `?print=1` 일 때만. */}
      {print === '1' && <ReceiptAutoPrint />}

      <div
        className="max-w-[800px] mx-auto bg-white print:max-w-none print:bg-transparent"
        style={{
          padding: 40,
          color: '#1E1A14',
          // 인쇄 시 그림자 제거.
          boxShadow:
            print === '1' ? 'none' : '0 4px 24px -8px rgba(30,26,20,0.15)',
          borderRadius: 8,
        }}
      >
        {/* 화면용 액션 바 — 인쇄 시 hidden. server component 라 onClick 못 쓰고
            a[href] 로 ?print=1 새 탭 열어서 클라이언트가 자동 print() 실행. */}
        <div className="flex justify-end gap-2 mb-6 print:hidden">
          <a
            href={`/mypage/orders/${o.id}`}
            className="px-4 py-2 rounded-full text-[12px] font-bold border border-rule text-text hover:border-text transition"
          >
            ← 주문 상세
          </a>
          <a
            href={`/mypage/orders/${o.id}/receipt?print=1`}
            target="_blank"
            rel="noopener"
            className="px-4 py-2 rounded-full text-[12px] font-bold transition"
            style={{ background: '#1E1A14', color: '#FAF6EE' }}
          >
            인쇄 / PDF 저장
          </a>
        </div>

        {/* 헤더 — 매거진 마스트헤드 톤 */}
        <header
          style={{
            borderBottom: '2px solid #1E1A14',
            paddingBottom: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#A0452E',
            }}
          >
            Receipt · 주문 영수증
          </div>
          <h1
            className="font-serif"
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginTop: 4,
            }}
          >
            FARMER&apos;S TAIL
          </h1>
          <div
            style={{
              fontSize: 10,
              color: '#7A7A7A',
              marginTop: 4,
              letterSpacing: '0.06em',
            }}
          >
            파머스테일 · 반려견 프리미엄 푸드
          </div>
        </header>

        {/* 주문 메타 — 2 컬럼 */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            marginBottom: 24,
          }}
        >
          <div>
            <Label>주문번호</Label>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
              {o.order_number}
            </div>
            <Label style={{ marginTop: 12 }}>주문 일시</Label>
            <div style={{ fontSize: 12 }}>{formatDateTime(o.created_at)}</div>
            {o.paid_at && (
              <>
                <Label style={{ marginTop: 12 }}>결제 일시</Label>
                <div style={{ fontSize: 12 }}>{formatDateTime(o.paid_at)}</div>
              </>
            )}
          </div>
          <div>
            <Label>수령인</Label>
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              {o.recipient_name}
            </div>
            {o.recipient_phone && (
              <div style={{ fontSize: 12, color: '#7A7A7A', marginTop: 2 }}>
                {o.recipient_phone}
              </div>
            )}
            {(o.shipping_address || o.shipping_address_detail) && (
              <>
                <Label style={{ marginTop: 12 }}>배송지</Label>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {o.shipping_zip && `(${o.shipping_zip}) `}
                  {o.shipping_address}
                  {o.shipping_address_detail && (
                    <>
                      <br />
                      {o.shipping_address_detail}
                    </>
                  )}
                </div>
              </>
            )}
            {o.shipping_memo && (
              <>
                <Label style={{ marginTop: 12 }}>배송 메모</Label>
                <div style={{ fontSize: 12 }}>{o.shipping_memo}</div>
              </>
            )}
          </div>
        </section>

        {/* 상품 표 */}
        <section style={{ marginBottom: 24 }}>
          <Label>주문 상품</Label>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: 8,
              fontSize: 12,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid #1E1A14',
                  textAlign: 'left',
                }}
              >
                <th style={{ padding: '8px 0', fontWeight: 700 }}>상품명</th>
                <th
                  style={{ padding: '8px 0', fontWeight: 700, textAlign: 'right' }}
                >
                  단가
                </th>
                <th
                  style={{
                    padding: '8px 0',
                    fontWeight: 700,
                    textAlign: 'center',
                    width: 60,
                  }}
                >
                  수량
                </th>
                <th
                  style={{ padding: '8px 0', fontWeight: 700, textAlign: 'right' }}
                >
                  금액
                </th>
              </tr>
            </thead>
            <tbody>
              {(o.order_items ?? []).map((it) => (
                <tr
                  key={it.id}
                  style={{ borderBottom: '1px solid #EDE6D8' }}
                >
                  <td style={{ padding: '10px 0' }}>
                    <div style={{ fontWeight: 700 }}>{it.product_name}</div>
                    {it.variant_name && (
                      <div style={{ fontSize: 11, color: '#7A7A7A', marginTop: 2 }}>
                        {it.variant_name}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    {it.unit_price.toLocaleString()}원
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'center' }}>
                    {it.quantity}
                  </td>
                  <td
                    style={{
                      padding: '10px 0',
                      textAlign: 'right',
                      fontWeight: 700,
                    }}
                  >
                    {it.line_total.toLocaleString()}원
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 결제 요약 */}
        <section
          style={{
            borderTop: '1px solid #1E1A14',
            paddingTop: 16,
            marginBottom: 32,
          }}
        >
          <SummaryRow label="상품 합계" value={`${subtotal.toLocaleString()}원`} />
          <SummaryRow
            label="배송비"
            value={shipping === 0 ? '무료' : `${shipping.toLocaleString()}원`}
          />
          <div
            style={{
              borderTop: '1px solid #EDE6D8',
              marginTop: 12,
              paddingTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>최종 결제 금액</span>
            <span
              className="font-serif"
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: '#A0452E',
                letterSpacing: '-0.02em',
              }}
            >
              {o.total_amount.toLocaleString()}원
            </span>
          </div>
          {o.payment_method && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: '#7A7A7A',
                textAlign: 'right',
              }}
            >
              결제 수단 · {paymentMethodLabel(o.payment_method)}
            </div>
          )}
        </section>

        {/* 사업자 정보 — 전자상거래법 §10 */}
        <footer
          style={{
            borderTop: '1px dashed #D9CFBB',
            paddingTop: 16,
            fontSize: 10,
            color: '#7A7A7A',
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 700, color: '#1E1A14', marginBottom: 4 }}>
            {business.companyName}
          </div>
          <div>
            대표 {business.ceo} · 사업자등록번호 {business.businessNumber}
          </div>
          <div>통신판매업신고 {business.mailOrderNumber}</div>
          <div>{business.address}</div>
          <div>
            고객센터 {business.email}
            {business.phone && ` · ${business.phone}`}
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 9,
              color: '#9A9A9A',
              textAlign: 'center',
            }}
          >
            본 영수증은 주문 내역 확인용입니다. 세금계산서 발행이 필요하시면
            고객센터로 문의해 주세요.
          </div>
        </footer>
      </div>

      {/* Print CSS — @page 마진 + 화면 전용 요소 숨김 */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 16mm 12mm;
          }
          body {
            background: #fff !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </main>
  )
}

function Label({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#7A7A7A',
        marginBottom: 4,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        padding: '6px 0',
      }}
    >
      <span style={{ color: '#7A7A7A' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}
