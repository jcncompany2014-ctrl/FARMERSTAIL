'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'
import { ShoppingBag, Ticket, Coins, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AddressSearch from '@/components/AddressSearch'
import {
  validateCoupon,
  applyCouponRedemption,
  type Coupon,
} from '@/lib/coupons'
import { debitPoints } from '@/lib/commerce/points'
import { trackBeginCheckout } from '@/lib/analytics'
import { calculateShipping, shippingLabel } from '@/lib/commerce/shipping'

type OrderItem = {
  productId: string
  name: string
  imageUrl: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
}

type Props = {
  userId: string
  userEmail: string
  defaultProfile: {
    name: string
    phone: string
    zip: string
    address: string
    addressDetail: string
  }
  orderItems: OrderItem[]
  subtotal: number
  /** 서버측 초기 배송비 — 실제 표기/결제는 zip 변경에 따라 클라이언트가 재계산. */
  shippingFee?: number
  /** 서버측 초기 total — begin_checkout 이벤트 용. 결제 금액은 재계산. */
  total: number
  pointBalance: number
}

function generateOrderNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `FT-${y}${m}${d}-${rand}`
}

const MIN_POINT_USE = 100 // 100포인트부터 사용 가능

export default function CheckoutForm({
  userId,
  userEmail,
  defaultProfile,
  orderItems,
  subtotal,
  total: baseTotal,
  pointBalance,
}: Props) {
  useRouter()
  const supabase = createClient()

  const [name, setName] = useState(defaultProfile.name)
  const [phone, setPhone] = useState(defaultProfile.phone)
  const [zip, setZip] = useState(defaultProfile.zip)
  const [address, setAddress] = useState(defaultProfile.address)
  const [addressDetail, setAddressDetail] = useState(
    defaultProfile.addressDetail
  )
  const [memo, setMemo] = useState('')
  const [saveToProfile, setSaveToProfile] = useState(false)
  const [loading, setLoading] = useState(false)

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState<{
    coupon: Coupon
    discount: number
  } | null>(null)
  const [couponMsg, setCouponMsg] = useState<string | null>(null)
  const [couponChecking, setCouponChecking] = useState(false)

  // Points state
  const [usePoints, setUsePoints] = useState(0)

  // GA4/Pixel begin_checkout — 페이지 마운트 시 1회. 결제 시도 버튼
  // 이전에도 "체크아웃 단계 진입"을 깔끔하게 카운트하기 위해.
  useEffect(() => {
    trackBeginCheckout({
      value: baseTotal,
      items: orderItems.map((it) => ({
        item_id: it.productId,
        item_name: it.name,
        price: it.unitPrice,
        quantity: it.quantity,
      })),
    })
    // orderItems/baseTotal은 props라 이 컴포넌트 수명 동안 안정 — 마운트 1회로 충분.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 결제수단 — 카드 기본. 가상계좌를 선택하면 현금영수증 옵션이
  // 노출된다. 카드 결제는 카드매출전표가 자동으로 법적 영수증
  // 역할을 하므로 별도 신청 UI 없음.
  const [paymentMethod, setPaymentMethod] = useState<
    'CARD' | 'VIRTUAL_ACCOUNT'
  >('CARD')
  // 현금영수증 — 소득공제(휴대폰) / 지출증빙(사업자번호) / 미신청.
  // 가상계좌일 때만 의미 있음.
  const [cashReceiptType, setCashReceiptType] = useState<
    '소득공제' | '지출증빙' | ''
  >('')
  const [cashReceiptNumber, setCashReceiptNumber] = useState('')

  const couponDiscount = couponApplied?.discount ?? 0

  // Points cap: can't exceed balance, can't exceed (subtotal - couponDiscount)
  const maxPointsUsable = useMemo(() => {
    const afterCoupon = Math.max(0, subtotal - couponDiscount)
    return Math.min(pointBalance, afterCoupon)
  }, [pointBalance, subtotal, couponDiscount])

  const effectivePointsUsed =
    usePoints > maxPointsUsable ? maxPointsUsable : usePoints

  // 주소의 zip이 바뀔 때마다 배송비 재계산. baseTotal prop은 서버 초기값이라
  // 무시하고 여기서 subtotal + dynamicShipping.total로 다시 만든다.
  const dynamicShipping = useMemo(
    () => calculateShipping({ subtotal, zip }),
    [subtotal, zip],
  )
  const currentShippingFee = dynamicShipping.total
  const currentBaseTotal = subtotal + currentShippingFee

  const total = Math.max(
    0,
    currentBaseTotal - couponDiscount - effectivePointsUsed
  )

  async function applyCoupon() {
    setCouponMsg(null)
    setCouponChecking(true)
    const result = await validateCoupon(
      supabase,
      couponCode,
      subtotal,
      userId
    )
    setCouponChecking(false)
    if (!result.ok) {
      setCouponMsg(result.reason)
      return
    }
    setCouponApplied({ coupon: result.coupon, discount: result.discount })
    setCouponMsg(null)
  }

  function removeCoupon() {
    setCouponApplied(null)
    setCouponCode('')
    setCouponMsg(null)
  }

  const handleAddressComplete = useCallback(
    (data: { zip: string; address: string; buildingName: string }) => {
      setZip(data.zip)
      setAddress(data.address)
      if (data.buildingName) {
        setAddressDetail(data.buildingName)
      }
    },
    []
  )

  async function handlePay() {
    if (!name.trim() || !phone.trim() || !zip.trim() || !address.trim()) {
      alert('받는 분, 연락처, 주소를 모두 입력해주세요')
      return
    }

    setLoading(true)
    try {
      if (saveToProfile) {
        await supabase
          .from('profiles')
          .update({
            name,
            phone,
            zip,
            address,
            address_detail: addressDetail,
          })
          .eq('id', userId)
      }

      const orderNumber = generateOrderNumber()

      // 1% cashback on the net paid amount — credited on delivery in a later step.
      const pointsEarned = Math.floor(total * 0.01)

      // 가상계좌를 선택한 경우에만 현금영수증 정보를 저장한다.
      // 카드의 경우 매출전표가 법적 영수증이라 불필요.
      const wantsCashReceipt =
        paymentMethod === 'VIRTUAL_ACCOUNT' &&
        cashReceiptType !== '' &&
        cashReceiptNumber.trim() !== ''

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          order_number: orderNumber,
          subtotal,
          shipping_fee: currentShippingFee,
          total_amount: total,
          discount_amount: couponDiscount,
          coupon_code: couponApplied?.coupon.code ?? null,
          points_used: effectivePointsUsed,
          points_earned: pointsEarned,
          recipient_name: name,
          recipient_phone: phone,
          zip,
          address,
          address_detail: addressDetail || null,
          delivery_memo: memo || null,
          payment_status: 'pending',
          order_status: 'pending',
          cash_receipt_type: wantsCashReceipt ? cashReceiptType : null,
          cash_receipt_number: wantsCashReceipt
            ? cashReceiptNumber.trim()
            : null,
        })
        .select('id, order_number')
        .single()

      if (orderError || !order) {
        throw new Error(orderError?.message ?? '주문 생성 실패')
      }

      // Record coupon redemption + bump usage count (lib/coupons로 일원화).
      if (couponApplied) {
        await applyCouponRedemption(supabase, {
          coupon: couponApplied.coupon,
          userId,
          orderId: order.id,
        })
      }

      // 주문 생성 시점에 바로 포인트 차감 — 취소 시 환급은 cancel route에서.
      // debitPoints 는 balance 재확인 + 음수 금액 방어가 포함돼 있음.
      if (effectivePointsUsed > 0) {
        await debitPoints(supabase, {
          userId,
          amount: effectivePointsUsed,
          reason: '주문 결제 포인트 사용',
          referenceType: 'order',
          referenceId: order.id,
        })
      }

      const itemsPayload = orderItems.map((it) => ({
        order_id: order.id,
        product_id: it.productId,
        product_name: it.name,
        product_image_url: it.imageUrl,
        unit_price: it.unitPrice,
        quantity: it.quantity,
        line_total: it.lineTotal,
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsPayload)

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({ customerKey: ANONYMOUS })

      const firstItem = orderItems[0]
      const orderName =
        orderItems.length === 1
          ? firstItem.name
          : `${firstItem.name} 외 ${orderItems.length - 1}건`

      // 결제수단별 Toss v2 SDK 호출. 공통 파라미터는 동일하고
      // method-specific 옵션만 분기한다.
      const commonParams = {
        amount: { currency: 'KRW' as const, value: total },
        orderId: order.order_number,
        orderName,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerEmail: userEmail,
        customerName: name,
      }

      if (paymentMethod === 'VIRTUAL_ACCOUNT') {
        // 현금영수증 파라미터 분기:
        //   • 소득공제(휴대폰) → customerMobilePhone 에 휴대폰번호 전달.
        //     Toss가 이 번호를 국세청 소득공제 발급용 키로 사용.
        //   • 지출증빙(사업자번호) → cashReceipt.registrationNumber 에
        //     사업자번호를 담아 전달. (휴대폰이 아니므로 customerMobilePhone
        //     과 다른 필드.)
        const digits = cashReceiptNumber.replace(/[^0-9]/g, '')
        const receiptOverrides = wantsCashReceipt
          ? cashReceiptType === '소득공제'
            ? {
                cashReceipt: { type: '소득공제' as const },
                customerMobilePhone: digits,
              }
            : {
                cashReceipt: {
                  type: '지출증빙' as const,
                  registrationNumber: digits,
                },
              }
          : {}

        await payment.requestPayment({
          method: 'VIRTUAL_ACCOUNT',
          ...commonParams,
          ...(('customerMobilePhone' in receiptOverrides)
            ? { customerMobilePhone: receiptOverrides.customerMobilePhone }
            : {}),
          virtualAccount: {
            // 24시간 입금 대기. 이 시간이 지나면 Toss가 자동 만료
            // 처리하고 웹훅으로 EXPIRED 이벤트를 쏜다.
            validHours: 24,
            useEscrow: false,
            // 소비자가 현금영수증을 요청한 경우에만 전달.
            // Toss는 cashReceipt 필드가 없으면 "미발급"으로 처리.
            ...('cashReceipt' in receiptOverrides
              ? { cashReceipt: receiptOverrides.cashReceipt }
              : {}),
          },
        })
      } else {
        // CARD — 매출전표가 자동 발급되므로 현금영수증 옵션 없음.
        await payment.requestPayment({
          method: 'CARD',
          ...commonParams,
          card: {
            useEscrow: false,
            flowMode: 'DEFAULT',
            useCardPoint: false,
            useAppCardOnly: false,
          },
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '결제 요청 중 오류'
      alert(msg)
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-lg border border-rule bg-[#FDFDFD] text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition'

  return (
    <div className="px-5 mt-3 space-y-3">
      {/* 배송지 */}
      <section className="bg-white rounded-xl border border-rule px-5 py-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-black text-text">배송지</h2>
          <span className="text-[10px] text-muted">* 필수 입력</span>
        </div>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="받는 분 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <input
            type="tel"
            placeholder="연락처 (예: 010-1234-5678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="우편번호"
              value={zip}
              readOnly
              className="flex-1 px-4 py-3 rounded-lg border border-rule bg-bg text-[13px] text-text placeholder:text-muted"
            />
            <AddressSearch
              onComplete={handleAddressComplete}
              className="shrink-0"
            />
          </div>
          <input
            type="text"
            placeholder="주소 (검색 버튼으로 입력)"
            value={address}
            readOnly
            className="w-full px-4 py-3 rounded-lg border border-rule bg-bg text-[13px] text-text placeholder:text-muted"
          />
          <input
            type="text"
            placeholder="상세 주소 (동/호수 등)"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="배송 메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className={inputClass}
          />
        </div>

        <label className="mt-3 flex items-center gap-2 text-[11px] text-text cursor-pointer">
          <input
            type="checkbox"
            checked={saveToProfile}
            onChange={(e) => setSaveToProfile(e.target.checked)}
            className="accent-terracotta w-3.5 h-3.5"
          />
          기본 배송지로 저장
        </label>
      </section>

      {/* 쿠폰 */}
      <section className="bg-white rounded-xl border border-rule px-5 py-5">
        <div className="flex items-center gap-2 mb-3">
          <Ticket className="w-4 h-4 text-terracotta" strokeWidth={2} />
          <h2 className="text-[13px] font-black text-text">쿠폰 적용</h2>
        </div>
        {couponApplied ? (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-terracotta/5 border border-terracotta/30">
            <div className="flex items-center gap-2 min-w-0">
              <Check
                className="w-4 h-4 text-terracotta shrink-0"
                strokeWidth={2.5}
              />
              <div className="min-w-0">
                <p className="text-[12px] font-black text-terracotta truncate">
                  {couponApplied.coupon.name}
                </p>
                <p className="text-[10px] text-muted truncate">
                  −{couponApplied.discount.toLocaleString()}원 적용됨
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={removeCoupon}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-sale transition"
              aria-label="쿠폰 제거"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="쿠폰 코드 입력"
                className="flex-1 px-3 py-2.5 rounded-lg bg-bg border border-rule text-[12px] font-bold text-text placeholder:text-muted/60 focus:outline-none focus:border-terracotta"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={couponChecking || !couponCode.trim()}
                className="px-4 py-2.5 rounded-lg bg-text text-white text-[12px] font-bold active:scale-[0.98] transition disabled:opacity-50"
              >
                {couponChecking ? '확인 중' : '적용'}
              </button>
            </div>
            {couponMsg && (
              <p className="text-[11px] font-bold text-sale mt-2">
                {couponMsg}
              </p>
            )}
          </>
        )}
      </section>

      {/* 포인트 */}
      {pointBalance > 0 && (
        <section className="bg-white rounded-xl border border-rule px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-gold" strokeWidth={2} />
              <h2 className="text-[13px] font-black text-text">
                포인트 사용
              </h2>
            </div>
            <span className="text-[10px] text-muted">
              보유 {pointBalance.toLocaleString()}P
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={maxPointsUsable}
              step={100}
              value={usePoints}
              onChange={(e) => {
                const v = Math.max(
                  0,
                  Math.min(maxPointsUsable, Number(e.target.value) || 0)
                )
                setUsePoints(v)
              }}
              placeholder="0"
              className="flex-1 px-3 py-2.5 rounded-lg bg-bg border border-rule text-[13px] font-bold text-text focus:outline-none focus:border-terracotta"
            />
            <button
              type="button"
              onClick={() => setUsePoints(maxPointsUsable)}
              className="px-3 py-2.5 rounded-lg border border-rule text-[11px] font-bold text-text hover:border-terracotta hover:text-terracotta transition"
            >
              전액
            </button>
            <button
              type="button"
              onClick={() => setUsePoints(0)}
              className="px-3 py-2.5 rounded-lg border border-rule text-[11px] font-bold text-muted hover:border-sale hover:text-sale transition"
            >
              초기화
            </button>
          </div>
          <p className="text-[10px] text-muted mt-1.5">
            {MIN_POINT_USE.toLocaleString()}P 단위로 사용 가능 · 최대{' '}
            {maxPointsUsable.toLocaleString()}P
          </p>
        </section>
      )}

      {/* 주문 상품 */}
      <section className="bg-white rounded-xl border border-rule px-5 py-5">
        <h2 className="text-[13px] font-black text-text mb-3">
          주문 상품{' '}
          <span className="text-muted font-bold">({orderItems.length})</span>
        </h2>
        <ul className="space-y-3">
          {orderItems.map((it) => (
            <li key={it.productId} className="flex gap-3">
              <div className="shrink-0 w-14 h-14 rounded-lg bg-bg overflow-hidden relative">
                {it.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.imageUrl}
                    alt={it.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag
                      className="w-5 h-5 text-muted"
                      strokeWidth={1.5}
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-text leading-snug line-clamp-2">
                  {it.name}
                </p>
                <p className="text-[10px] text-muted mt-0.5">
                  {it.unitPrice.toLocaleString()}원 × {it.quantity}
                </p>
              </div>
              <p className="text-[12px] font-black text-text whitespace-nowrap">
                {it.lineTotal.toLocaleString()}원
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* 결제 수단 */}
      <section className="bg-white rounded-xl border border-rule px-5 py-5">
        <h2 className="text-[13px] font-black text-text mb-3">
          결제 수단
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`flex items-center gap-2 px-3.5 py-3 rounded-lg border cursor-pointer transition ${
              paymentMethod === 'CARD'
                ? 'border-terracotta bg-bg'
                : 'border-rule bg-[#FDFDFD] hover:border-rule-2'
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              value="CARD"
              checked={paymentMethod === 'CARD'}
              onChange={() => setPaymentMethod('CARD')}
              className="accent-terracotta"
            />
            <div>
              <div className="text-[12px] font-bold text-text">
                신용·체크카드
              </div>
              <div className="text-[10px] text-muted">즉시 결제</div>
            </div>
          </label>
          <label
            className={`flex items-center gap-2 px-3.5 py-3 rounded-lg border cursor-pointer transition ${
              paymentMethod === 'VIRTUAL_ACCOUNT'
                ? 'border-terracotta bg-bg'
                : 'border-rule bg-[#FDFDFD] hover:border-rule-2'
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              value="VIRTUAL_ACCOUNT"
              checked={paymentMethod === 'VIRTUAL_ACCOUNT'}
              onChange={() => setPaymentMethod('VIRTUAL_ACCOUNT')}
              className="accent-terracotta"
            />
            <div>
              <div className="text-[12px] font-bold text-text">
                가상계좌
              </div>
              <div className="text-[10px] text-muted">무통장 입금</div>
            </div>
          </label>
        </div>

        {/* 현금영수증 — 가상계좌 선택 시에만 노출 */}
        {paymentMethod === 'VIRTUAL_ACCOUNT' && (
          <div className="mt-4 pt-4 border-t border-rule">
            <h3 className="text-[12px] font-black text-text mb-2">
              현금영수증{' '}
              <span className="text-[10px] text-muted font-semibold">
                (선택)
              </span>
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              <ReceiptOption
                label="미신청"
                active={cashReceiptType === ''}
                onClick={() => {
                  setCashReceiptType('')
                  setCashReceiptNumber('')
                }}
              />
              <ReceiptOption
                label="소득공제"
                active={cashReceiptType === '소득공제'}
                onClick={() => setCashReceiptType('소득공제')}
              />
              <ReceiptOption
                label="지출증빙"
                active={cashReceiptType === '지출증빙'}
                onClick={() => setCashReceiptType('지출증빙')}
              />
            </div>
            {cashReceiptType !== '' && (
              <input
                type="text"
                inputMode={
                  cashReceiptType === '지출증빙' ? 'numeric' : 'tel'
                }
                value={cashReceiptNumber}
                onChange={(e) => setCashReceiptNumber(e.target.value)}
                placeholder={
                  cashReceiptType === '소득공제'
                    ? '휴대폰번호 (숫자만, 예: 01012345678)'
                    : '사업자등록번호 (숫자만, 예: 1234567890)'
                }
                className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-rule bg-[#FDFDFD] text-[12px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta"
              />
            )}
            <p className="mt-2 text-[10px] text-muted leading-relaxed">
              가상계좌 입금 확인 후 국세청에 자동 등록됩니다. 신용카드로
              결제하시면 카드매출전표가 법적 영수증 역할을 하므로 별도
              신청이 필요 없습니다.
            </p>
          </div>
        )}
      </section>

      {/* 결제 요약 */}
      <section className="bg-white rounded-xl border border-rule px-5 py-5">
        <h2 className="text-[13px] font-black text-text mb-3">
          결제 정보
        </h2>
        <div className="flex justify-between text-[12px] text-text">
          <span>상품 금액</span>
          <span className="font-bold text-text">
            {subtotal.toLocaleString()}원
          </span>
        </div>
        <div className="flex justify-between text-[12px] text-text mt-2">
          <span>배송비</span>
          <span className="font-bold text-text">
            {shippingLabel(dynamicShipping)}
          </span>
        </div>
        {dynamicShipping.isRemote && (
          <p className="text-[10px] text-muted mt-0.5">
            도서산간 추가 배송비가 포함된 금액이에요
          </p>
        )}
        {couponDiscount > 0 && (
          <div className="flex justify-between text-[12px] mt-2">
            <span className="text-terracotta">쿠폰 할인</span>
            <span className="font-bold text-terracotta">
              −{couponDiscount.toLocaleString()}원
            </span>
          </div>
        )}
        {effectivePointsUsed > 0 && (
          <div className="flex justify-between text-[12px] mt-2">
            <span className="text-terracotta">포인트 사용</span>
            <span className="font-bold text-terracotta">
              −{effectivePointsUsed.toLocaleString()}원
            </span>
          </div>
        )}
        <div className="border-t border-rule my-3" />
        <div className="flex justify-between items-center">
          <span className="text-[13px] font-black text-text">
            총 결제금액
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-[18px] font-black text-terracotta">
              {total.toLocaleString()}
            </span>
            <span className="text-[11px] text-muted">원</span>
          </div>
        </div>
        <div className="mt-2 text-right text-[10px] text-moss font-bold">
          결제 완료 시 {Math.floor(total * 0.01).toLocaleString()}P 적립 예정
        </div>
      </section>

      <p className="text-[10px] text-muted leading-relaxed px-1">
        주문 내용을 확인했으며, 결제 진행에 동의합니다.
        <br />이 결제는 토스페이먼츠 테스트 모드로 진행됩니다.
      </p>

      {/* 고정 결제 버튼 */}
      <div
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-30"
      >
        <div className="max-w-md mx-auto px-5">
          <button
            onClick={handlePay}
            disabled={loading || total <= 0}
            className="w-full py-4 rounded-full text-[14px] font-bold active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              letterSpacing: '-0.01em',
              boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
            }}
          >
            {loading
              ? '결제창 여는 중...'
              : total <= 0
              ? '결제 금액이 0원입니다'
              : `${total.toLocaleString()}원 결제하기`}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 현금영수증 옵션 pill 버튼.
 * 3개 중 하나만 선택된 상태를 시각적으로 강조한다 — active일 때 브랜드
 * 브라운(#A0452E) 배경 + 흰 글자, inactive일 때 베이지 배경 + 어두운 글자.
 */
function ReceiptOption({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-2 rounded-lg text-[11.5px] font-bold transition ${
        active
          ? 'bg-terracotta text-white border border-terracotta'
          : 'bg-[#FDFDFD] text-text border border-rule hover:border-rule-2'
      }`}
    >
      {label}
    </button>
  )
}
