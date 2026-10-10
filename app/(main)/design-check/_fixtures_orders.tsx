/**
 * /design-check 주문 화면 예시 값(앱 새 디자인 'A 포스터' 묶음④, 캔버스 M07~M10·I01·I09·I10, 2026-10-09).
 *
 * 실제 화면과 같은 부품(OrdersAppView · OrderDetailAppView · ReceiptAppView · TrackingView 앱)에 넣어 로그인 없이
 * 시안과 나란히 본다. 손님 데이터가 아니다 — 받는 분은 '보호자'(공개 캡처 규칙), 주소·번호는 자리표시.
 */
import type { OrderRow } from '@/app/mypage/orders/OrdersAppView'
import type { OrderDetailAppModel, OrderDetailAppItem } from '@/app/mypage/orders/[id]/OrderDetailAppView'
import type { ReceiptAppModel } from '@/app/mypage/orders/[id]/receipt/ReceiptAppView'

// 주문 상세 모델은 주소와 상세 주소 사이를 줄바꿈으로 잇는다(page.tsx 와 같게).
const ADDRESS = '(01234) 서울특별시 ○○구 ○○로 12\n○○아파트 101동 1001호'

function listItems(rows: Array<[string, number, number]>): OrderRow['order_items'] {
  return rows.map(([product_name, unit_price, quantity], i) => ({ id: `it-${i}`, product_name, product_image_url: null, quantity, unit_price }))
}

// 시안 M07 — 배송 완료 다섯 건(최근 순). 이름은 저장값 그대로 넣고('치킨 레시피') 화면이 '닭고기 레시피'로 그리는지 본다.
export const ORDERS_LIST: OrderRow[] = [
  { id: 'o1', order_number: 'FT-20260926-K3P9QX', total_amount: 77800, payment_status: 'paid', order_status: 'delivered', created_at: '2026-09-25T22:00:00Z', order_items: listItems([['치킨 레시피', 5320, 7], ['흑돼지 레시피', 5800, 7]]) },
  { id: 'o2', order_number: 'FT-20260926-7HD2LM', total_amount: 36400, payment_status: 'paid', order_status: 'delivered', created_at: '2026-09-25T22:00:00Z', order_items: listItems([['오리 레시피', 2600, 7], ['치킨 레시피', 2600, 7]]) },
  { id: 'o3', order_number: 'FT-20260912-Q8W4ZT', total_amount: 77800, payment_status: 'paid', order_status: 'delivered', created_at: '2026-09-11T22:00:00Z', order_items: listItems([['치킨 레시피', 5320, 7], ['흑돼지 레시피', 5800, 7]]) },
  { id: 'o4', order_number: 'FT-20260912-B5N1RC', total_amount: 36400, payment_status: 'paid', order_status: 'delivered', created_at: '2026-09-11T22:00:00Z', order_items: listItems([['오리 레시피', 2600, 7], ['치킨 레시피', 2600, 7]]) },
  { id: 'o5', order_number: 'FT-20260829-M2X7JA', total_amount: 77800, payment_status: 'paid', order_status: 'delivered', created_at: '2026-08-28T22:00:00Z', order_items: listItems([['치킨 레시피', 5320, 7], ['흑돼지 레시피', 5800, 7]]) },
]

const DETAIL_ITEMS: OrderDetailAppItem[] = [
  { id: 'd1', product_name: '치킨 레시피', product_image_url: null, unit_price: 5320, quantity: 7, line_total: 37240 },
  { id: 'd2', product_name: '흑돼지 레시피', product_image_url: null, unit_price: 5800, quantity: 7, line_total: 40600 },
]

const CARD_RECEIPT_LINK = (
  <a href="#" style={{ fontWeight: 800, color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
    영수증 보기 ›
  </a>
)

function detail(over: Partial<OrderDetailAppModel>): OrderDetailAppModel {
  return {
    id: 'o1',
    orderNumber: 'FT-20260926-K3P9QX',
    showReceipt: true,
    isCancelled: false,
    cancelledAtText: null,
    cancelReason: null,
    refundNote: false,
    stepIndex: 2,
    shipRows: [],
    trackHref: null,
    trackingSoon: false,
    items: DETAIL_ITEMS,
    virtualAccount: null,
    recipient: { name: '보호자', phone: '010-0000-0000', address: ADDRESS, memo: null },
    payRows: [
      { label: '결제 상태', value: '결제 완료', strong: true },
      { label: '결제 수단', value: '신용·체크카드' },
      { label: '결제 일시', value: '2026. 09. 26. 오전 07:00' },
      { label: '카드 영수증', value: CARD_RECEIPT_LINK },
    ],
    subtotal: 77800,
    shippingFeeText: '무료',
    discount: null,
    total: 77800,
    refunded: 0,
    cancelSlot: null,
    paidSubscriptionBox: false,
    ...over,
  }
}

export const ORDER_DETAILS: Record<string, OrderDetailAppModel> = {
  // 시안 M08 — 배송 완료(택배사·송장·발송/도착 일시 + 실시간 배송 조회).
  'order-detail': detail({
    shipRows: [
      { label: '택배사', value: 'CJ대한통운', strong: true },
      { label: '송장번호', value: '601234567890', spaced: true },
      { label: '발송 일시', value: '2026. 09. 29. 오후 03:20' },
      { label: '도착 일시', value: '2026. 09. 30. 오후 01:40', strong: true },
    ],
    trackHref: '/design-check?s=track',
  }),
  // 시안 I01 — 결제됐고 아직 안 나간 정기배송 박스(결제·발송 예정 + 직접 취소 불가 안내).
  'order-preparing': detail({
    orderNumber: 'FT-20261010-M7Q2LD',
    stepIndex: 0,
    shipRows: [
      { label: '결제', value: '10월 10일 (토) 결제 완료', strong: true },
      { label: '발송 예정', value: '10월 13일 (화)', strong: true },
    ],
    payRows: [
      { label: '결제 상태', value: '결제 완료', strong: true },
      { label: '결제 수단', value: '신용·체크카드' },
      { label: '결제 일시', value: '2026. 10. 10. 오전 07:00' },
      { label: '카드 영수증', value: CARD_RECEIPT_LINK },
    ],
    paidSubscriptionBox: true,
  }),
}

// 시안 M09 — 단가 조정 −40원(라인 합 77,840 → 결제 77,800, 표시용 팩단가 10원 올림 차이).
export const RECEIPT: ReceiptAppModel = {
  orderNumber: 'FT-20260926-K3P9QX',
  createdAt: '2026-09-25T22:00:00Z',
  paidAt: '2026-09-25T22:00:00Z',
  recipientName: '보호자',
  recipientPhone: '010-0000-0000',
  zip: '01234',
  address: '서울특별시 ○○구 ○○로 12',
  addressDetail: '○○아파트 101동 1001호',
  deliveryMemo: null,
  items: [
    { id: 'r1', product_name: '치킨 레시피', variant_name: null, quantity: 7, unit_price: 5320, line_total: 37240 },
    { id: 'r2', product_name: '흑돼지 레시피', variant_name: null, quantity: 7, unit_price: 5800, line_total: 40600 },
  ],
  subtotal: 77840,
  shipping: 0,
  discount: null,
  rounding: 40,
  total: 77800,
  refunded: 0,
  paymentMethodText: '신용·체크카드',
}

/**
 * 운송장 조회(시안 M10·I09·I10) — 실제 TrackingView(앱)에 넣는다. 조회 API(/api/tracking)는 점검에선 로그인이 없어
 * 401 이라, 찍을 땐 shoot.mjs 의 @@fetch 예시 응답으로 바꿔 낀다. 접수 중(I09)은 '발송 36시간 안'이 조건이라
 * 발송 일시를 지금 기준으로 만든다(그래서 함수).
 */
export function trackFixture(s: string): null | {
  carrier: string
  trackingNumber: string
  orderStatus: string
  shippedAt: string
  deliveredAt: string | null
} {
  if (s === 'track') {
    return { carrier: 'cj', trackingNumber: '601234567890', orderStatus: 'delivered', shippedAt: '2026-09-29T06:20:00Z', deliveredAt: '2026-09-30T04:40:00Z' }
  }
  if (s === 'track-pending' || s === 'track-fail') {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    return { carrier: 'cj', trackingNumber: '601234567890', orderStatus: 'shipping', shippedAt: s === 'track-pending' ? twoHoursAgo : '2026-09-29T06:20:00Z', deliveredAt: null }
  }
  return null
}
