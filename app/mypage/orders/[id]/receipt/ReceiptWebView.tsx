/**
 * ReceiptWebView — 주문 영수증 '웹' 화면(웹 시안 WEB-A15, 2026-10-10 웹 리뉴얼). 인쇄·PDF 저장용 한 장.
 *
 * /mypage/orders/[id]/receipt 는 웹·앱이 같이 쓰는 서버 화면이다. 조회·금액 판정(결제된 주문만 · 단가 조정은
 * ±1,000원 안에서만 · 환불 줄)은 page.tsx 가 하고 앱(ReceiptAppView)과 같은 모델을 넘긴다 — 그리기만 다르다.
 * 가게 틀 없이 회색 바탕 위 흰 종이. 인쇄 땐 버튼을 숨기고 종이 칸을 넓히며 그림자·바탕을 뺀다.
 * 날짜는 정본(formatKstKoDateTime) — toLocaleString 은 서버 ICU 에서 "AM 07:00" 이 된다(2026-10-09 실측).
 * 점검 화면(/design-check-store?s=receipt)이 예시 값으로 로그인 없이 그린다. 예전 웹 판(크림 바탕·세리프)은 git 이력.
 */

import type { ReactNode } from 'react'
import { business } from '@/lib/business'
import { formatKstKoDateTime } from '@/lib/datetime-kst'
import ReceiptAutoPrint from './ReceiptAutoPrint'
import type { ReceiptAppModel } from './ReceiptAppView'

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

export default function ReceiptWebView({ m, orderId, print }: { m: ReceiptAppModel; orderId: string; print: boolean }) {
  const rows: { label: string; value: ReactNode; strong?: boolean }[] = [
    { label: '주문번호', value: m.orderNumber, strong: true },
    { label: '주문 일시', value: formatKstKoDateTime(m.createdAt) },
    ...(m.paidAt ? [{ label: '결제 일시', value: formatKstKoDateTime(m.paidAt) }] : []),
    {
      label: '수령인',
      value: (
        <>
          <strong style={{ fontWeight: 800 }}>{m.recipientName}</strong>
          {m.recipientPhone ? ` · ${m.recipientPhone}` : ''}
        </>
      ),
    },
    ...(m.address || m.addressDetail
      ? [
          {
            label: '배송지',
            value: (
              <span style={{ lineHeight: 1.55 }}>
                {m.zip && `(${m.zip}) `}
                {m.address}
                {m.addressDetail && (
                  <>
                    <br />
                    {m.addressDetail}
                  </>
                )}
              </span>
            ),
          },
        ]
      : []),
    ...(m.deliveryMemo ? [{ label: '배송 메모', value: m.deliveryMemo }] : []),
  ]
  return (
    <main className="fts" style={{ minHeight: '100dvh', background: '#F6F4F5' }}>
      {/* 인쇄 시점 자동 호출 — `?print=1` 일 때만. */}
      {print && <ReceiptAutoPrint />}
      <div className="fts-col fts-receipt">
        {/* 화면용 버튼 — 인쇄 땐 숨김. 서버 화면이라 onClick 대신 ?print=1 새 탭이 인쇄 창을 연다. */}
        <div className="print:hidden" style={{ padding: '16px 16px 4px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <a
            href={`/mypage/orders/${orderId}`}
            style={{
              height: 48,
              padding: '0 14px 0 8px',
              boxSizing: 'border-box',
              borderRadius: 4,
              border: '1.5px solid #141414',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 16,
              fontWeight: 700,
              color: '#141414',
              textDecoration: 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 6l-6 6 6 6" />
            </svg>
            주문 상세
          </a>
          <a
            href={`/mypage/orders/${orderId}/receipt?print=1`}
            target="_blank"
            rel="noopener"
            style={{
              height: 48,
              padding: '0 16px',
              borderRadius: 4,
              background: '#141414',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 16,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7 9V3.5h10V9" />
              <rect x="3.5" y="9" width="17" height="8" rx="1.5" />
              <path d="M7 14h10v6.5H7z" />
            </svg>
            인쇄 · PDF 저장
          </a>
        </div>

        <article
          className="fts-receipt-paper"
          style={{
            margin: '12px 16px 40px',
            padding: '26px 20px 22px',
            background: '#FFFFFF',
            borderRadius: 4,
            boxShadow: print ? 'none' : '0 1px 4px rgba(20,20,20,0.10)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <header style={{ paddingBottom: 16, borderBottom: '2px solid #141414', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.1 }}>
              주문 영수증
            </h1>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-ink.png" alt="파머스테일" width={93} height={16} style={{ height: 16, width: 'auto', display: 'block' }} />
              <span style={{ fontSize: 14, color: '#595959' }}>반려견 프리미엄 푸드</span>
            </span>
          </header>

          <dl style={{ margin: '4px 0 0', display: 'flex', flexDirection: 'column', fontSize: 16 }}>
            {rows.map((r) => (
              <div
                key={r.label}
                style={{ padding: '11px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '84px 1fr', alignItems: 'baseline' }}
              >
                <dt style={{ fontSize: 15, color: '#595959' }}>{r.label}</dt>
                <dd style={{ margin: 0, fontWeight: r.strong ? 800 : 400, overflowWrap: 'anywhere' }}>{r.value}</dd>
              </div>
            ))}
          </dl>

          <h2 style={{ margin: '22px 0 0', fontFamily: 'inherit', fontSize: 15, fontWeight: 800, letterSpacing: 'inherit', color: '#595959' }}>주문 상품</h2>
          <table style={{ marginTop: 8, width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 15, lineHeight: 1.4 }}>
            <thead>
              <tr style={{ borderBottom: '1.5px solid #141414', textAlign: 'left' }}>
                <th scope="col" style={{ padding: '8px 0', fontWeight: 800 }}>
                  상품명
                </th>
                <th scope="col" style={{ width: 70, padding: '8px 0', fontWeight: 800, textAlign: 'right' }}>
                  단가
                </th>
                <th scope="col" style={{ width: 50, padding: '8px 0', fontWeight: 800, textAlign: 'center' }}>
                  수량
                </th>
                <th scope="col" style={{ width: 74, padding: '8px 0', fontWeight: 800, textAlign: 'right' }}>
                  금액
                </th>
              </tr>
            </thead>
            <tbody>
              {m.items.map((it) => (
                <tr key={it.id} style={{ borderBottom: '1px solid #E5E5E5' }}>
                  <td style={{ padding: '11px 0', fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {it.product_name}
                    {/* 가게 단품은 이름에 이미 용량이 들어 있다(lib/store) — 겹치면 한 줄로. */}
                    {it.variant_name && !it.product_name.includes(it.variant_name) && (
                      <span style={{ display: 'block', marginTop: 2, fontSize: 14, fontWeight: 400, color: '#595959' }}>{it.variant_name}</span>
                    )}
                  </td>
                  <td style={{ padding: '11px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>{won(it.unit_price)}</td>
                  <td style={{ padding: '11px 0', textAlign: 'center' }}>{it.quantity}</td>
                  <td style={{ padding: '11px 0', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{won(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl style={{ margin: '14px 0 0', display: 'flex', flexDirection: 'column', fontSize: 16 }}>
            <SumRow label="상품 합계" value={won(m.subtotal)} />
            <SumRow label="배송비" value={m.shipping === 0 ? '무료' : won(m.shipping)} />
            {m.discount && <SumRow label={m.discount.label} value={`-${won(m.discount.amount)}`} />}
            {m.rounding !== null && <SumRow label="단가 조정" value={`${m.rounding > 0 ? '-' : '+'}${won(Math.abs(m.rounding))}`} />}
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: '2px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <dt style={{ fontSize: 17, fontWeight: 800 }}>최종 결제 금액</dt>
              <dd style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
                <span className="n" style={{ fontSize: 28 }}>
                  {m.total.toLocaleString('ko-KR')}
                </span>
                <span className="d" style={{ fontSize: 16 }}>
                  원
                </span>
              </dd>
            </div>
            {/* 환불이 있으면 환불액과 실제 결제 금액을 함께 — 예전엔 환불 주문도 결제 금액만 찍었다(2026-09-28). */}
            {m.refunded > 0 && (
              <>
                <SumRow label="환불 금액" value={`−${won(m.refunded)}`} />
                <SumRow label="실제 결제 금액" value={won(Math.max(0, m.total - m.refunded))} strong />
              </>
            )}
            {m.paymentMethodText && <div style={{ marginTop: 6, textAlign: 'right', fontSize: 15, color: '#595959' }}>결제 수단 · {m.paymentMethodText}</div>}
          </dl>

          {/* 사업자 정보 — 전자상거래법 §10 */}
          <footer
            style={{
              marginTop: 22,
              paddingTop: 16,
              borderTop: '1px dashed #BDBDBD',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              fontSize: 14,
              lineHeight: 1.6,
              color: '#595959',
            }}
          >
            <strong style={{ fontSize: 15, fontWeight: 800, color: '#141414' }}>{business.companyName}</strong>
            <span>
              대표 {business.ceo} · 사업자등록번호 {business.businessNumber}
            </span>
            <span>통신판매업신고 {business.mailOrderNumber}</span>
            <span>{business.address}</span>
            <span>
              고객센터 {business.email}
              {business.phone && ` · ${business.phone}`}
            </span>
            <span style={{ marginTop: 10, textAlign: 'center', fontSize: 14, color: '#767676' }}>
              이 영수증은 주문 내역 확인용이에요. 세금계산서가 필요하시면 고객센터로 문의해 주세요.
            </span>
          </footer>
        </article>
      </div>

      {/* 인쇄 — A4 여백, 버튼 숨김, 종이 칸을 넓히고 그림자·바탕 없이. */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 16mm 12mm;
          }
          body,
          .fts {
            background: #fff !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .fts-receipt {
            max-width: none !important;
          }
          .fts-receipt-paper {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </main>
  )
}

function SumRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <dt style={{ color: strong ? '#141414' : '#595959', fontWeight: strong ? 800 : 400 }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: strong ? 800 : 700, whiteSpace: 'nowrap' }}>{value}</dd>
    </div>
  )
}
