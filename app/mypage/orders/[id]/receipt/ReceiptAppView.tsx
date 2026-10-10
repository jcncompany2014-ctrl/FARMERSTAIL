/**
 * ReceiptAppView — 주문 영수증 '앱' 화면(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 M09).
 *
 * /mypage/orders/[id]/receipt 는 웹·앱이 같이 쓰는 서버 화면이다. 조회·금액 판정(결제된 주문만 · 단가 조정은
 * ±1,000원 안에서만 · 환불 줄)은 page.tsx 가 그대로 하고, 앱일 때만 이 컴포넌트가 그린다 — 웹 영수증(A4 인쇄용)은
 * 예전 그대로. 예전엔 앱에서도 머리줄 없이 웹 영수증이 떴다(앱시안 결정 3번 '동작').
 * 점검 화면(/design-check?s=receipt)이 같은 컴포넌트에 예시 값을 넣어 로그인 없이 시안과 나란히 본다.
 *
 * 저장은 ReceiptSaveButton — 이 종이(.ft-receipt-capture)를 그림으로 떠서 저장한다.
 */

import type { CSSProperties } from 'react'
import { V3 } from '@/lib/design/tokens'
import { business } from '@/lib/business'
import { pouchLineFromName, POUCH_NAME_EN, POUCH_PRODUCT_KO } from '@/lib/design/pouch'
import { kstKoDateTimeParts } from '@/lib/datetime-kst'
import ReceiptSaveButton from './ReceiptSaveButton'

export type ReceiptAppItem = {
  id: string
  product_name: string
  variant_name: string | null
  quantity: number
  unit_price: number
  line_total: number
}

export type ReceiptAppModel = {
  orderNumber: string
  createdAt: string
  paidAt: string | null
  recipientName: string
  recipientPhone: string | null
  zip: string | null
  address: string | null
  addressDetail: string | null
  deliveryMemo: string | null
  items: ReceiptAppItem[]
  subtotal: number
  shipping: number
  discount: null | { label: string; amount: number }
  /** 반올림 경로 차이 — 0 이거나 1,000원을 넘어 설명할 수 없으면 null(page.tsx 판정 그대로). */
  rounding: number | null
  total: number
  refunded: number
  paymentMethodText: string | null
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

/**
 * 날짜와 시각을 두 줄로(시안: "2026. 09. 26." / "오전 07:00") — 반 칸에 한 줄로 넣으면 어색하게 접힌다.
 * toLocaleString 은 쓰지 않는다 — 서버 ICU 가 "AM 07:00" 을 낸다(lib/datetime-kst kstKoDateTimeParts).
 */
function DateTimeLines({ iso }: { iso: string }) {
  const p = kstKoDateTimeParts(iso)
  if (!p) return <>-</>
  return (
    <>
      {p.date}
      <br />
      {p.time}
    </>
  )
}

/**
 * 주문 상세(OrderDetailAppView)와 같은 이름 — 레시피 팩은 큰 이름 = 팩에 찍힌 영어, 아래 회색 = '닭고기 화식 · 한 끼 팩'
 * (사장님 2026-10-10). 그 밖은 저장된 이름 그대로. pack = 팩 영어 이름 글꼴로 그릴지.
 */
function itemLabel(it: ReceiptAppItem): { name: string; sub: string | null; pack: boolean } {
  const line = pouchLineFromName(it.product_name)
  return line
    ? { name: POUCH_NAME_EN[line], sub: `${POUCH_PRODUCT_KO[line]} · 한 끼 팩`, pack: true }
    : { name: it.product_name, sub: it.variant_name, pack: false }
}

const DT: CSSProperties = { fontSize: 13, fontWeight: 700, color: V3.inkMute }
const DD: CSSProperties = { margin: '2px 0 0', fontSize: 15 }

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
      <dt style={{ color: V3.inkMute }}>{label}</dt>
      <dd style={{ margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>{value}</dd>
    </div>
  )
}

export default function ReceiptAppView({ m }: { m: ReceiptAppModel }) {
  const hasAddress = !!(m.address || m.addressDetail)
  return (
    // 줄 높이 normal — 시안 원본은 기본 줄 높이(여러 줄 칸 — 주소·상품명·사업자 정보 — 은 따로 지정).
    <div style={{ paddingBottom: 32, color: V3.ink, lineHeight: 'normal' }}>
      <article
        className="ft-receipt-capture"
        aria-label="주문 영수증"
        style={{
          margin: '20px 20px 0',
          padding: '22px 18px 20px',
          border: `1.5px solid ${V3.ink}`,
          borderRadius: 4,
          background: '#FFFFFF',
          color: V3.ink,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ paddingBottom: 14, borderBottom: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: V3.inkMute }}>주문 영수증</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- 그림 저장(html2canvas)이 그대로 뜨게 일반 img(같은 출처 정적 파일). */}
          <img src="/logo-ink.png" alt="파머스테일" width={127} height={22} style={{ height: 22, width: 'auto', alignSelf: 'flex-start', display: 'block' }} />
          <span style={{ fontSize: 14, color: V3.inkMute }}>파머스테일 · 반려견 프리미엄 푸드</span>
        </div>

        <dl style={{ margin: '16px 0 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px 12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <dt style={DT}>주문번호</dt>
            <dd style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, letterSpacing: '0.01em', wordBreak: 'break-all' }}>{m.orderNumber}</dd>
          </div>
          <div style={m.paidAt ? undefined : { gridColumn: '1 / -1' }}>
            <dt style={DT}>주문 일시</dt>
            <dd style={DD}>
              <DateTimeLines iso={m.createdAt} />
            </dd>
          </div>
          {m.paidAt && (
            <div>
              <dt style={DT}>결제 일시</dt>
              <dd style={DD}>
                <DateTimeLines iso={m.paidAt} />
              </dd>
            </div>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <dt style={DT}>수령인</dt>
            <dd style={DD}>
              <strong style={{ fontWeight: 800 }}>{m.recipientName}</strong>
              {m.recipientPhone && ` · ${m.recipientPhone}`}
            </dd>
          </div>
          {hasAddress && (
            <div style={{ gridColumn: '1 / -1' }}>
              <dt style={DT}>배송지</dt>
              <dd style={{ ...DD, lineHeight: 1.55, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
                {m.zip && `(${m.zip}) `}
                {m.address}
                {m.addressDetail && (
                  <>
                    <br />
                    {m.addressDetail}
                  </>
                )}
              </dd>
            </div>
          )}
          {m.deliveryMemo && (
            <div style={{ gridColumn: '1 / -1' }}>
              <dt style={DT}>배송 메모</dt>
              <dd style={{ ...DD, lineHeight: 1.55 }}>{m.deliveryMemo}</dd>
            </div>
          )}
        </dl>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column' }}>
          <span style={DT}>주문 상품</span>
          <table style={{ marginTop: 6, width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${V3.ink}`, textAlign: 'left' }}>
                <th style={{ padding: '8px 0', fontWeight: 800 }}>상품명</th>
                <th style={{ padding: '8px 0', fontWeight: 800, textAlign: 'right' }}>단가</th>
                <th style={{ padding: '8px 0', fontWeight: 800, textAlign: 'center', width: 40 }}>수량</th>
                <th style={{ padding: '8px 0', fontWeight: 800, textAlign: 'right' }}>금액</th>
              </tr>
            </thead>
            <tbody>
              {m.items.map((it) => {
                const label = itemLabel(it)
                return (
                  <tr key={it.id} style={{ borderBottom: `1px solid ${V3.rule}` }}>
                    <td style={{ padding: '10px 4px 10px 0', fontWeight: 700, lineHeight: 1.4 }}>
                      {label.pack ? (
                        <span className="ft-num" style={{ fontSize: 16, fontWeight: 400, letterSpacing: '0.02em' }}>
                          {label.name}
                        </span>
                      ) : (
                        label.name
                      )}
                      {label.sub && (
                        <>
                          <br />
                          <span style={{ fontWeight: 500, fontSize: 13, color: V3.inkMute }}>{label.sub}</span>
                        </>
                      )}
                    </td>
                    <td style={{ padding: '10px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>{won(it.unit_price)}</td>
                    <td style={{ padding: '10px 0', textAlign: 'center' }}>{it.quantity}</td>
                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{won(it.line_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <dl style={{ margin: '18px 0 0', paddingTop: 10, borderTop: `1.5px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
          <SumRow label="상품 합계" value={won(m.subtotal)} />
          <SumRow label="배송비" value={m.shipping === 0 ? '무료' : won(m.shipping)} />
          {m.discount && <SumRow label={m.discount.label} value={`-${won(m.discount.amount)}`} />}
          {m.rounding != null && (
            <SumRow label="단가 조정" value={`${m.rounding > 0 ? '-' : '+'}${won(Math.abs(m.rounding))}`} />
          )}
          <div
            style={{
              marginTop: 8,
              paddingTop: 12,
              borderTop: `1px solid ${V3.rule}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <dt style={{ fontSize: 16, fontWeight: 800 }}>최종 결제 금액</dt>
            <dd style={{ margin: 0, whiteSpace: 'nowrap' }}>
              <span className="ft-num" style={{ fontSize: 30, lineHeight: 1 }}>
                {m.total.toLocaleString('ko-KR')}
              </span>
              <span className="ft-poster" style={{ fontSize: 17 }}>
                원
              </span>
            </dd>
          </div>
          {/* 환불이 있으면 환불액과 실제 결제 금액을 함께(웹 영수증과 같은 규칙, 2026-09-28). */}
          {m.refunded > 0 && (
            <>
              <SumRow label="환불 금액" value={`−${won(m.refunded)}`} />
              <div style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
                <dt style={{ fontWeight: 800 }}>실제 결제 금액</dt>
                <dd style={{ margin: 0, fontWeight: 800, whiteSpace: 'nowrap' }}>{won(Math.max(0, m.total - m.refunded))}</dd>
              </div>
            </>
          )}
          {m.paymentMethodText && (
            <div style={{ marginTop: 6, textAlign: 'right', fontSize: 14, color: V3.inkMute }}>결제 수단 · {m.paymentMethodText}</div>
          )}
        </dl>

        {/* 사업자 정보 — 전자상거래법 §10(웹 영수증과 같은 lib/business 정본). */}
        <footer
          style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: '1px dashed #BDBDBD',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            fontSize: 13,
            lineHeight: 1.6,
            color: V3.inkMute,
          }}
        >
          <strong style={{ fontSize: 14, fontWeight: 800, color: V3.ink }}>{business.companyName}</strong>
          <span>
            대표 {business.ceo} · 사업자등록번호 {business.businessNumber}
          </span>
          <span>통신판매업신고 {business.mailOrderNumber}</span>
          <span>{business.address}</span>
          <span>
            고객센터 {business.email}
            {business.phone && ` · ${business.phone}`}
          </span>
          <span style={{ marginTop: 8, textAlign: 'center' }}>
            이 영수증은 주문 내역 확인용이에요. 세금계산서가 필요하시면 고객센터로 문의해 주세요.
          </span>
        </footer>
      </article>

      <ReceiptSaveButton orderNumber={m.orderNumber} />
    </div>
  )
}
