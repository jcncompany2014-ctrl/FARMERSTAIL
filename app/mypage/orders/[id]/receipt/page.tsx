import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { paymentMethodLabel } from '@/lib/payments/toss'
import { discountReasonLabel } from '@/lib/commerce/discount-reason'
import AuthAwareShell from '@/components/AuthAwareShell'
import { isAppContextServer } from '@/lib/app-context'
import ReceiptAppView, { type ReceiptAppModel } from './ReceiptAppView'
import ReceiptWebView from './ReceiptWebView'

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
 * - 웹 = 웹 시안 WEB-A15(2026-10-10 웹 리뉴얼) — 회색 바탕 위 흰 종이 한 장, 먹색 글자. 인쇄 땐 종이 칸을 넓히고 그림자·바탕 없이.
 * - 앱 = ReceiptAppView(시안 M09) — 저장은 그림 저장(앱 WebView 는 인쇄·새 탭이 막혀 있다).
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
  /** 할인액·사유 — 영수증에 반드시 표시한다(2026-08-08). */
  discount_amount: number | null
  discount_reason: string | null
  payment_status: string
  refunded_amount: number | null
  payment_method: string | null
  order_status: string
  created_at: string
  paid_at: string | null
  recipient_name: string
  recipient_phone: string | null
  // ★ 실제 orders 컬럼명 (2026-07-31 정정). 예전엔 shipping_* 로 적혀 있었는데
  //   그 이름은 orders 에 **없어서** select 가 통째로 실패했고, order 가 null 이
  //   되어 아래 notFound() 로 빠졌다 — **모든 영수증이 404** 였다.
  address: string | null
  address_detail: string | null
  zip: string | null
  delivery_memo: string | null
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
      id, order_number, total_amount, shipping_fee, discount_amount,
      discount_reason, payment_status, refunded_amount,
      payment_method, order_status, created_at, paid_at, recipient_name,
      recipient_phone, address, address_detail,
      zip, delivery_memo, user_id,
      order_items(id, product_name, variant_name, quantity, unit_price, line_total)
      `,
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!order) notFound()
  const o = order as unknown as OrderRow
  // ★결제되지 않은 주문은 영수증이 아니다(2026-09-28 점검 9차) — 결제 실패·대기 주문도 주소로 들어오면
  //   결제 영수증 모양으로 '최종 결제 금액'을 찍었다. 한 번이라도 결제된 주문(환불 포함)만 영수증을 보인다.
  if (!['paid', 'partially_refunded', 'refunded'].includes(o.payment_status)) notFound()
  const refunded = Math.max(0, o.refunded_amount ?? 0)

  const subtotal = (o.order_items ?? []).reduce(
    (s, it) => s + (it.line_total ?? 0),
    0,
  )
  const shipping = o.shipping_fee ?? 0
  const discount = o.discount_amount ?? 0

  /**
   * ★영수증이 안 맞았다 (2026-08-08 금액 감사).
   *
   * 상품 합계와 최종 결제 금액만 찍고 **할인 줄이 없었다.** 나무 등급 고객은
   * 상품합계 357,420원 / 최종결제 321,570원 — 차이 **35,850원이 설명 없이**
   * 남았다(40kg 견은 99,980원). 청구 크론은 `discount_amount`·
   * `discount_reason` 을 제대로 저장하고 있었다 — **읽는 화면이 없었을 뿐**이다.
   *
   * 할인이 없는 고객도 120원쯤 어긋난다: order_items 의 `line_total` 은
   * 표시용 팩단가(10원 올림)를 곱한 값이고, `total_amount` 는 라인 총액
   * 기준(100원 올림)이라 합산 경로가 다르다. 그 차이는 '단가 조정'으로
   * 명시한다 — 숫자가 안 맞는 영수증은 그 자체로 신뢰를 깎는다.
   */
  const rounding = subtotal + shipping - discount - o.total_amount
  /**
   * ★'단가 조정'은 반올림 경로 차이(±120원 수준)를 설명하는 이름이다.
   * 그런데 상한 없이 쓰면 **데이터가 실제로 어긋난 주문**(항목 누락·금액 오염)
   * 까지 이 한 줄이 조용히 삼킨다 — 수만 원 차이가 '단가 조정 -35,850원'으로
   * 인쇄되면 영수증이 사고를 정상처럼 포장하는 셈이다(2026-08-08 diff 재검증).
   * 1,000원을 넘으면 반올림일 수 없으니 그 줄을 빼고(합계 불일치가 눈에 보이게)
   * 서버 로그로 남긴다. 고객에게 틀린 설명을 붙이는 것보다 낫다.
   */
  const roundingExplainable = Math.abs(rounding) <= 1000
  if (!roundingExplainable) {
    console.error(
      '[receipt] 합계 불일치가 반올림 범위를 넘는다 — 데이터 확인 필요:',
      { orderId: o.id, orderNumber: o.order_number, diff: rounding },
    )
  }

  // 앱·웹이 같은 모델(금액·판정은 위 그대로) — 그리기만 다르다.
  const model: ReceiptAppModel = {
    orderNumber: o.order_number,
    createdAt: o.created_at,
    paidAt: o.paid_at,
    recipientName: o.recipient_name,
    recipientPhone: o.recipient_phone,
    zip: o.zip,
    address: o.address,
    addressDetail: o.address_detail,
    deliveryMemo: o.delivery_memo,
    items: o.order_items ?? [],
    subtotal,
    shipping,
    discount: discount > 0 ? { label: discountReasonLabel(o.discount_reason), amount: discount } : null,
    rounding: rounding !== 0 && roundingExplainable ? rounding : null,
    total: o.total_amount,
    refunded,
    paymentMethodText: o.payment_method ? paymentMethodLabel(o.payment_method) : null,
  }

  // ★앱은 앱 화면으로(앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 M09) — 예전엔 앱에서도 머리줄 없는 웹 영수증이
  //   떴고, '인쇄 / PDF 저장'(새 탭 + window.print)은 앱 WebView 에서 막혀 있었다. 저장은 그림 저장(ReceiptSaveButton).
  if (await isAppContextServer()) {
    return (
      <AuthAwareShell>
        <ReceiptAppView m={model} />
      </AuthAwareShell>
    )
  }

  // 웹 = 웹 시안 WEB-A15(2026-10-10 웹 리뉴얼) — 인쇄·PDF 저장용 한 장(ReceiptWebView).
  return <ReceiptWebView m={model} orderId={o.id} print={print === '1'} />
}
