'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
// Toss SDK 는 결제 버튼 누르기 전엔 필요 X. checkout 페이지 진입 시 main
// 번들에 포함되면 사용자가 폼 채우는 동안 수십 KB 가 idle. handlePay 안에서
// dynamic import 로 늦춤 (line ~381).
import {
  ShoppingBag,
  Coins,
  MapPin,
  Plus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import AddressSearch from '@/components/AddressSearch'
import { formatPhone } from '@/lib/formatters'
import {
  validateCoupon,
  applyCouponRedemption,
  revokeCouponRedemption,
  type Coupon,
} from '@/lib/coupons'
import { debitPoints, appendLedger } from '@/lib/commerce/points'
import { trackBeginCheckout } from '@/lib/analytics'
import CheckoutCouponSheet from '@/components/coupons/CheckoutCouponSheet'
import { calculateShipping, shippingLabel } from '@/lib/commerce/shipping'
import type { Address } from '@/lib/commerce/addresses'

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
  /**
   * 저장된 배송지 목록. 기본 배송지가 있으면 첫 번째로 옴. 비어 있으면
   * 폼이 빈 상태로 표시되고 "기본 배송지로 저장" 체크박스가 새 주소를
   * addresses 테이블에 insert 하는 용도로 동작.
   */
  savedAddresses: Address[]
  /** 초기 선택된 저장 배송지 id (있으면). 클라이언트 상태의 시드값. */
  selectedAddressId: string | null
  orderItems: OrderItem[]
  subtotal: number
  /** 서버측 초기 배송비 — 실제 표기/결제는 zip 변경에 따라 클라이언트가 재계산. */
  shippingFee?: number
  /** 서버측 초기 total — begin_checkout 이벤트 용. 결제 금액은 재계산. */
  total: number
  pointBalance: number
  /** 적립률 (%) — tier 기반. 서버에서 profile.tier → tierMeta(t).earnRate. */
  earnRate?: number
  /**
   * Round B (2026-05-20): 첫 박스 50% off 자동 적용용.
   *
   * server (checkout/page.tsx) 가 `paid orders == 0` + audience='first_signup'
   * 활성/미만료 쿠폰 1건 prefetch 결과를 전달. CheckoutForm 은 mount 시 1회
   * applyCouponCode 호출 → 사용자는 코드 입력 없이도 자동 할인 적용.
   *
   * 적용 실패해도 silent — 분석 페이지 카피와 실 결제가 어긋나면 사용자가
   * 명시 입력으로 보완 가능.
   */
  autoApplyCouponCode?: string | null
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

type CheckoutDraft = {
  v?: number
  ts?: number
  name?: string
  phone?: string
  zip?: string
  address?: string
  addressDetail?: string
  memo?: string
}

// 컴포넌트 외부 함수 — react-hooks/purity 규칙 회피 (Date.now / localStorage 가
// render path 안에 있으면 lint 가 hydration mismatch 잠재 위험으로 표시).
function loadCheckoutDraft(autosaveKey: string): CheckoutDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(autosaveKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CheckoutDraft
    if (parsed.v !== 1) return null
    if (parsed.ts && Date.now() - parsed.ts > 7 * 86_400_000) {
      localStorage.removeItem(autosaveKey)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export default function CheckoutForm({
  userId,
  userEmail,
  defaultProfile,
  savedAddresses,
  selectedAddressId,
  orderItems,
  subtotal,
  total: baseTotal,
  pointBalance,
  earnRate = 1,
  autoApplyCouponCode = null,
}: Props) {
  // useRouter 호출 흔적 — 라우팅 후 결제는 Toss SDK 가 직접 redirect 하므로
  // 여기서 router 객체가 필요 없다. 사용 안 하는 호출 제거.
  const supabase = createClient()
  const toast = useToast()

  // audit 2-1: 자동저장 — 네트워크 끊김 / 새로고침 / 결제 실패 후 재진입 시
  // 받는 분/연락처/주소/메모 가 날아가지 않게 localStorage 7일 보존. 결제
  // 성공 시 clear. 주소 동에 PII 가 들어가지만 본인 브라우저 안에 머무름.
  const AUTOSAVE_KEY = `ft:checkout-draft:${userId}`
  const initialDraft = loadCheckoutDraft(AUTOSAVE_KEY)

  const [name, setName] = useState(initialDraft?.name ?? defaultProfile.name)
  const [phone, setPhone] = useState(initialDraft?.phone ?? defaultProfile.phone)
  const [zip, setZip] = useState(initialDraft?.zip ?? defaultProfile.zip)
  const [address, setAddress] = useState(
    initialDraft?.address ?? defaultProfile.address,
  )
  const [addressDetail, setAddressDetail] = useState(
    initialDraft?.addressDetail ?? defaultProfile.addressDetail,
  )
  const [memo, setMemo] = useState(initialDraft?.memo ?? '')
  // "기본 배송지로 저장" 체크 — 이전엔 profiles 에 업서트했는데, 이제
  // addresses 테이블에 새 row 를 insert 한다. 이미 저장된 주소를 고른
  // 경우엔 이 체크박스 자체가 숨겨진다 (중복 저장 방지).
  const [saveToAddresses, setSaveToAddresses] = useState(false)
  // 현재 폼에 로드된 저장 배송지 id. 사용자가 주소를 수동 편집하면
  // 이 링크가 끊어지면서 null 로 바뀐다 ("새 주소 입력 중" 상태).
  const [activeAddressId, setActiveAddressId] = useState<string | null>(
    selectedAddressId,
  )
  const [loading, setLoading] = useState(false)

  // 저장된 배송지를 클릭하면 폼에 채우고, activeAddressId 를 갱신한다.
  const handleSelectSaved = useCallback((addr: Address) => {
    setName(addr.recipientName)
    // 저장값이 하이픈 없이 들어왔을 수도 있어 일관 표시 위해 formatPhone 통과.
    setPhone(formatPhone(addr.phone))
    setZip(addr.zip)
    setAddress(addr.address)
    setAddressDetail(addr.addressDetail)
    setActiveAddressId(addr.id)
    // 저장된 걸 고른 상태면 "저장" 체크박스는 의미 없음 — 해제.
    setSaveToAddresses(false)
  }, [])

  // Coupon state — sheet 가 자체 errMsg / loading 처리. 적용된 쿠폰 객체만 보유.
  const [couponApplied, setCouponApplied] = useState<{
    coupon: Coupon
    discount: number
  } | null>(null)

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

  // audit 2-1: 폼 변경 시 500ms 디바운스로 localStorage 저장. 결제 성공/주문
  // 생성 직후 useEffect 가 아니라 handlePay 내부에서 명시 clear.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            v: 1,
            ts: Date.now(),
            name,
            phone,
            zip,
            address,
            addressDetail,
            memo,
          }),
        )
      } catch {
        /* quota/disabled — silent */
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [AUTOSAVE_KEY, name, phone, zip, address, addressDetail, memo])

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

  /**
   * code 를 받아 server-side validate. CheckoutCouponSheet 의 카드 클릭이든
   * 직접 입력이든 동일 validation. sheet 가 자체 loading / errMsg state 보유.
   */
  async function applyCouponCode(
    rawCode: string,
  ): Promise<{ ok: boolean; message?: string }> {
    const result = await validateCoupon(supabase, rawCode, subtotal, userId)
    if (!result.ok) {
      return { ok: false, message: result.reason }
    }
    setCouponApplied({ coupon: result.coupon, discount: result.discount })
    return { ok: true }
  }

  function removeCoupon() {
    setCouponApplied(null)
  }

  // Round B (2026-05-20): 첫 박스 자동 쿠폰 적용 — mount 1회.
  // server 가 paid orders 0건 + first_signup audience 활성 쿠폰 1건 prefetch
  // 한 결과를 전달. 실패 (만료 / per_user_limit 초과 등) 시 silent — 사용자가
  // sheet 에서 직접 선택 가능하게 두면 됨.
  useEffect(() => {
    if (!autoApplyCouponCode) return
    if (couponApplied) return
    // applyCouponCode 가 setState 호출 → mount 후 1 tick.
    void applyCouponCode(autoApplyCouponCode)
    // 마운트 + autoApplyCouponCode 변경시 1회. applyCouponCode 는 closure 라
    // deps 에 넣으면 매 렌더마다 재호출 가능 → 의도적으로 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoApplyCouponCode])

  const handleAddressComplete = useCallback(
    (data: { zip: string; address: string; buildingName: string }) => {
      setZip(data.zip)
      setAddress(data.address)
      if (data.buildingName) {
        setAddressDetail(data.buildingName)
      }
      // Daum 검색으로 주소를 바꾸면 저장된 배송지와 끊어진 상태.
      setActiveAddressId(null)
    },
    []
  )

  async function handlePay() {
    if (!name.trim() || !phone.trim() || !zip.trim() || !address.trim()) {
      toast.error('받는 분, 연락처, 주소를 모두 입력해 주세요')
      return
    }

    // 현금영수증 발급번호 자릿수 검증 — 가상계좌 + 발급유형 선택 시 번호가 너무
    // 짧으면(휴대폰 10~11 / 사업자 10 미만) 입금 후 국세청 등록이 조용히 실패해
    // 주문은 성공하는데 영수증만 안 나온다. 제출 전 차단(disputed audit 후속).
    if (
      paymentMethod === 'VIRTUAL_ACCOUNT' &&
      cashReceiptType !== '' &&
      cashReceiptNumber.trim().length < 10
    ) {
      toast.error('현금영수증 번호를 정확히 입력해 주세요 (휴대폰 10~11자리 · 사업자 10자리)')
      return
    }

    setLoading(true)
    try {
      // "기본 배송지로 저장" 체크 + 저장된 주소가 아닐 때만 addresses
      // 테이블에 새 row 를 만든다. /api/addresses 를 타서 zod + RLS 를
      // 서버측에서 한번 더 검증. 실패해도 결제는 계속 진행 (best-effort).
      if (saveToAddresses && !activeAddressId) {
        try {
          await fetch('/api/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientName: name,
              phone,
              zip,
              address,
              addressDetail,
              // 이미 주소가 있는 계정이라도 체크박스를 명시적으로 눌렀다는
              // 건 "이걸 기본으로 쓰겠다"는 의도. 트리거가 자동으로 기존
              // 기본값을 해제해 준다.
              isDefault: true,
            }),
          })
        } catch {
          // 결제 자체를 막지 않는다 — 주소 저장은 부수 효과.
        }
      }

      const orderNumber = generateOrderNumber()

      // Tier 기반 cashback (씨앗 1% / 새싹 1.5% / 꽃 2% / 열매 2.5% / 단짝 3%) — 결제 net
      // 금액 × 적립률 / 100. 적립은 배송 완료 시점에 credit (lib/commerce/points).
      const pointsEarned = Math.floor((total * earnRate) / 100)

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
      // R83-5: ok 체크 추가. coupon 사용 race / per_user_limit 초과 시 빠르게 실패.
      if (couponApplied) {
        const couponResult = await applyCouponRedemption(supabase, {
          coupon: couponApplied.coupon,
          userId,
          orderId: order.id,
        })
        if (!couponResult.ok) {
          await supabase.from('orders').delete().eq('id', order.id)
          throw new Error(couponResult.reason ?? '쿠폰 사용에 실패했어요.')
        }
      }

      // 주문 생성 시점에 바로 포인트 차감 — 취소 시 환급은 cancel route에서.
      // R83-5: result.ok 체크 추가. RPC 실패(잔액 부족/위변조) 시 order + coupon
      // 롤백 후 사용자에게 에러 표시. 이전엔 무시 → ledger 미차감 + order.points_used
      // 그대로 → 위변조 가능했음.
      if (effectivePointsUsed > 0) {
        const debitResult = await debitPoints(supabase, {
          userId,
          amount: effectivePointsUsed,
          reason: '주문 결제 포인트 사용',
          referenceType: 'order',
          referenceId: order.id,
        })
        if (!debitResult.ok) {
          if (couponApplied) {
            await revokeCouponRedemption(supabase, {
              couponCode: couponApplied.coupon.code,
            })
          }
          await supabase.from('orders').delete().eq('id', order.id)
          throw new Error(debitResult.reason ?? '포인트 차감에 실패했어요.')
        }
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
        // R84-B3: items insert 실패 시 points/coupon 도 롤백.
        // 이전엔 throw 만 하고 points debit row 와 coupon redemption 이 orphan
        // 으로 남아 사용자 잔액 잠김. order-expire cron 이 30분 후 정리하지만
        // 그 사이 사용자가 같은 상품 다시 결제하려 하면 잔액 부족.
        if (effectivePointsUsed > 0) {
          await appendLedger(supabase, {
            userId,
            delta: effectivePointsUsed,
            reason: '주문 실패 포인트 환급 (아이템 저장 실패)',
            referenceType: 'order_refund_credit',
            referenceId: order.id,
          })
        }
        if (couponApplied) {
          await revokeCouponRedemption(supabase, {
            couponCode: couponApplied.coupon.code,
          })
        }
        await supabase.from('orders').delete().eq('id', order.id)
        throw new Error(itemsError.message)
      }

      // ── 재고 atomic decrement (oversell 방지) ───────────────────────────
      // reserve_order_stock RPC 가 모든 상품 row 를 FOR UPDATE 잡고 부족분
      // 검출 → 부족이면 ok=false 반환. ok=false 시 방금 만든 order/items 를
      // 롤백 (delete) 하고 사용자에게 안내. Toss redirect 전에 확정해 결제
      // 후 oversell 발견 시 환불 비용 / CS 부담 차단.
      const reservePayload = orderItems.map((it) => ({
        product_id: it.productId,
        qty: it.quantity,
      }))
      const { data: reserveResult, error: reserveError } = await supabase.rpc(
        'reserve_order_stock',
        { items: reservePayload },
      )
      const reserveOk =
        !reserveError &&
        reserveResult &&
        typeof reserveResult === 'object' &&
        'ok' in (reserveResult as Record<string, unknown>) &&
        (reserveResult as { ok: boolean }).ok === true
      if (!reserveOk) {
        // R83-5: 롤백 — 포인트 환급 + 쿠폰 revoke 까지 명시 처리.
        // 이전엔 "보수적으로 생략" → 사용자가 다시 시도해도 포인트 비어 있음.
        // 순서: ledger credit → coupon revoke → order delete (CASCADE order_items).
        if (effectivePointsUsed > 0) {
          await appendLedger(supabase, {
            userId,
            delta: effectivePointsUsed,
            reason: '주문 실패 포인트 환급 (재고 부족)',
            referenceType: 'order_refund_credit',
            referenceId: order.id,
          })
        }
        if (couponApplied) {
          await revokeCouponRedemption(supabase, {
            couponCode: couponApplied.coupon.code,
          })
        }
        await supabase.from('orders').delete().eq('id', order.id)
        const insufficientList =
          reserveResult &&
          typeof reserveResult === 'object' &&
          'insufficient' in (reserveResult as Record<string, unknown>)
            ? ((reserveResult as { insufficient?: Array<{ product_id: string; available: number }> })
                .insufficient ?? [])
            : []
        const firstShort =
          insufficientList.length > 0
            ? orderItems.find((it) => it.productId === insufficientList[0]!.product_id)?.name
            : null
        throw new Error(
          firstShort
            ? `${firstShort} 가 품절됐어요. 카트를 새로고침해 주세요.`
            : '결제 직전 재고가 부족해졌어요. 카트를 새로고침해 주세요.',
        )
      }

      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
      // SDK 를 결제 시점에 lazy load — checkout 폼 진입 시 main 번들에서
      // 빠짐 (수십 KB 절감). 함수 첫 실행에서 한 번만 fetch.
      const { loadTossPayments, ANONYMOUS } = await import(
        '@tosspayments/tosspayments-sdk'
      )
      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({ customerKey: ANONYMOUS })

      const firstItem = orderItems[0]!
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
      // R66 — 사용자 fallback 카피 부드럽게 (voice-guidelines).
      const msg =
        err instanceof Error
          ? err.message
          : '결제를 진행하지 못했어요. 잠시 후 다시 시도해 주세요.'
      toast.error(msg)
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-lg border border-rule bg-[#FDFDFD] text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition'

  return (
    <div className="px-5 mt-3 md:px-6 md:mt-6 md:grid md:grid-cols-[1fr_360px] md:gap-8 md:items-start">
      {/* ── 좌측 (md+): 폼 섹션들 — 배송지 / 주문 상품 / 쿠폰 / 포인트 / 결제 수단 ── */}
      <div className="space-y-3 md:space-y-5 md:min-w-0">

      {/* 배송지 */}
      <section className="bg-white rounded-xl border border-rule px-5 py-5 md:px-6 md:py-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-black text-text">배송지</h2>
          <span className="text-[10px] text-muted">* 필수 입력</span>
        </div>

        {/*
          저장된 배송지 picker — 1개 이상 있을 때만 노출. 칩 형태로
          나열해 탭 한 번에 폼을 채운다. 활성 칩은 ink 배경, 나머지는
          베이지. "새 주소" 칩으로 수동 입력 모드 복귀 가능.
          "관리" 링크로 /mypage/addresses 이동 → 편집/삭제/기본변경.
        */}
        {savedAddresses.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="kicker kicker-muted" style={{ fontSize: 9 }}>
                Saved · 저장된 배송지
              </span>
              <Link
                href="/mypage/addresses"
                className="text-[10px] font-bold text-muted hover:text-terracotta transition"
              >
                관리 →
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 no-scrollbar">
              {savedAddresses.map((a) => {
                const isActive = a.id === activeAddressId
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleSelectSaved(a)}
                    className={`shrink-0 text-left px-3.5 py-2.5 rounded-xl border transition ${
                      isActive
                        ? 'border-ink'
                        : 'border-rule hover:border-rule-2'
                    }`}
                    style={{
                      background: isActive ? 'var(--ink)' : '#FDFDFD',
                      color: isActive ? 'var(--bg)' : 'var(--text)',
                      minWidth: 180,
                      maxWidth: 240,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <MapPin
                        className="w-3 h-3 shrink-0"
                        strokeWidth={2}
                      />
                      <span className="text-[11px] font-black tracking-tight truncate">
                        {a.label || a.recipientName || '배송지'}
                      </span>
                      {a.isDefault && (
                        <span
                          className="shrink-0 text-[9.5px] font-black px-1.5 py-0.5 rounded tracking-wider"
                          style={{
                            background: isActive
                              ? 'rgba(255,255,255,0.18)'
                              : 'var(--gold)',
                            color: isActive ? 'var(--bg)' : 'var(--ink)',
                          }}
                        >
                          기본
                        </span>
                      )}
                    </div>
                    <p
                      className="text-[10.5px] mt-1 line-clamp-1"
                      style={{
                        opacity: isActive ? 0.8 : 0.7,
                      }}
                    >
                      {a.address}
                    </p>
                    <p
                      className="text-[10px] mt-0.5 line-clamp-1"
                      style={{
                        opacity: isActive ? 0.7 : 0.6,
                      }}
                    >
                      {a.recipientName} · {a.phone}
                    </p>
                  </button>
                )
              })}
              {/* 수동 입력 전환 칩 — 이미 비활성(activeAddressId=null) 상태면 강조 */}
              <button
                type="button"
                onClick={() => {
                  setActiveAddressId(null)
                  setName('')
                  setPhone('')
                  setZip('')
                  setAddress('')
                  setAddressDetail('')
                }}
                className={`shrink-0 px-3.5 py-2.5 rounded-xl border flex items-center gap-1.5 transition ${
                  activeAddressId === null
                    ? 'border-terracotta bg-terracotta/5'
                    : 'border-dashed border-rule-2 hover:border-terracotta'
                }`}
                style={{ minWidth: 110 }}
              >
                <Plus
                  className="w-3 h-3"
                  strokeWidth={2.5}
                  style={{
                    color:
                      activeAddressId === null
                        ? 'var(--terracotta)'
                        : 'var(--muted)',
                  }}
                />
                <span
                  className="text-[11px] font-black tracking-tight"
                  style={{
                    color:
                      activeAddressId === null
                        ? 'var(--terracotta)'
                        : 'var(--muted)',
                  }}
                >
                  새 주소
                </span>
              </button>
            </div>
          </div>
        )}

        {/* R87-B2 (D11): WCAG 1.3.1/3.3.2 + 장차법 §14 — input 별 aria-label
            추가. 시각 변경 없이 스크린리더 사용자에게 컨텍스트 제공. placeholder
            만 의존하면 입력 시 사라져 IME 사용자가 무엇을 입력하는지 잃음. */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="받는 분 이름"
            aria-label="받는 분 이름"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (activeAddressId) setActiveAddressId(null)
            }}
            autoComplete="name"
            enterKeyHint="next"
            className={inputClass}
          />
          <input
            type="tel"
            placeholder="연락처 (예: 010-1234-5678)"
            aria-label="연락처"
            value={phone}
            onChange={(e) => {
              // 숫자만 추출 → 자동 하이픈. 사용자가 010 입력 → 010-, 7자리 → 010-1234-...
              setPhone(formatPhone(e.target.value))
              if (activeAddressId) setActiveAddressId(null)
            }}
            inputMode="tel"
            autoComplete="tel"
            enterKeyHint="next"
            maxLength={13}
            className={inputClass}
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="우편번호"
              aria-label="우편번호"
              value={zip}
              readOnly
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
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
            aria-label="주소"
            value={address}
            readOnly
            autoComplete="street-address"
            className="w-full px-4 py-3 rounded-lg border border-rule bg-bg text-[13px] text-text placeholder:text-muted"
          />
          <input
            type="text"
            placeholder="상세 주소 (동/호수 등)"
            aria-label="상세 주소"
            value={addressDetail}
            onChange={(e) => {
              setAddressDetail(e.target.value)
              if (activeAddressId) setActiveAddressId(null)
            }}
            autoComplete="address-line2"
            enterKeyHint="next"
            className={inputClass}
          />
          <input
            type="text"
            placeholder="배송 메모 (선택)"
            aria-label="배송 메모 (선택사항)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            enterKeyHint="done"
            maxLength={80}
            className={inputClass}
          />
        </div>

        {/*
          "저장된 주소가 아닐 때만" 저장 체크박스 노출. 이미 고른 주소면
          중복 저장할 이유가 없어 숨긴다. (관리는 /mypage/addresses 에서.)
        */}
        {!activeAddressId && (
          <label className="mt-3 flex items-center gap-2 text-[11px] text-text cursor-pointer">
            <input
              type="checkbox"
              checked={saveToAddresses}
              onChange={(e) => setSaveToAddresses(e.target.checked)}
              className="accent-terracotta w-3.5 h-3.5"
            />
            이 주소를 기본 배송지로 저장
          </label>
        )}
      </section>

      {/* 쿠폰 — sheet 기반 (사용 가능 쿠폰 자동 list + 1탭 적용) */}
      <CheckoutCouponSheet
        subtotal={subtotal}
        applied={
          couponApplied
            ? {
                name: couponApplied.coupon.name,
                code: couponApplied.coupon.code,
                discount: couponApplied.discount,
              }
            : null
        }
        onApply={(targetCode) => applyCouponCode(targetCode)}
        onRemove={removeCoupon}
      />

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
            {/* UX audit #11: 100 단위 강제 (step=100 인데 input 자체는 1단위 허용했음).
                Math.floor(v/100)*100 로 commit 시 반올림 — 결제 단계 reject 차단. */}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={maxPointsUsable}
              step={100}
              value={usePoints}
              onChange={(e) => {
                const raw = Math.max(
                  0,
                  Math.min(maxPointsUsable, Number(e.target.value) || 0)
                )
                const v = Math.floor(raw / 100) * 100
                setUsePoints(v)
              }}
              placeholder="0"
              aria-label={`사용할 포인트 (최대 ${maxPointsUsable.toLocaleString()}P, 100P 단위)`}
              className="flex-1 px-3 py-2.5 rounded-lg bg-bg border border-rule text-[13px] font-bold text-text focus:outline-none focus:border-terracotta tabular-nums"
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
                  <Image
                    src={it.imageUrl}
                    alt={it.name}
                    fill
                    sizes="56px"
                    className="object-cover"
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
              <p className="text-[12px] font-black text-text whitespace-nowrap tabular-nums">
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
            {/* UX audit #10: cashReceipt 검증 — 휴대폰 010-XXXX-XXXX 10자리, 사업자 10자리.
                숫자만 허용 + maxLength + 자동 형식 검증. */}
            {cashReceiptType !== '' && (
              <input
                type="text"
                inputMode={
                  cashReceiptType === '지출증빙' ? 'numeric' : 'tel'
                }
                value={cashReceiptNumber}
                onChange={(e) => {
                  // 숫자만 추출, 11자리 cap (휴대폰) / 10자리 (사업자)
                  const digits = e.target.value.replace(/\D/g, '')
                  const max = cashReceiptType === '지출증빙' ? 10 : 11
                  setCashReceiptNumber(digits.slice(0, max))
                }}
                maxLength={11}
                placeholder={
                  cashReceiptType === '소득공제'
                    ? '휴대폰번호 (숫자만, 예: 01012345678)'
                    : '사업자등록번호 (숫자만, 예: 1234567890)'
                }
                className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-rule bg-[#FDFDFD] text-[12px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta tabular-nums"
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

      {/* 좌측 form 컬럼 닫기 */}
      </div>

      {/* ── 우측 (md+): 결제 요약 + CTA — sticky ─────────────────────── */}
      <aside className="mt-3 md:mt-0 ft-sticky-product-col md:self-start space-y-3 md:space-y-4">

      {/* 결제 요약 */}
      <section className="bg-white rounded-xl border border-rule px-5 py-5 md:px-6 md:py-6">
        <h2 className="text-[13px] md:text-[14px] font-black text-text mb-3 md:mb-4">
          결제 정보
        </h2>
        {/* UI audit: 결제 합계 row — 우측 가격이 모두 tabular-nums 로 자릿수 정렬
            (39,000원 / 8,400원 / 250,000원 우측 끝 일직선). */}
        <div className="flex justify-between text-[12px] text-text">
          <span>상품 금액</span>
          <span className="font-bold text-text tabular-nums">
            {subtotal.toLocaleString()}원
          </span>
        </div>
        <div className="flex justify-between text-[12px] text-text mt-2">
          <span>배송비</span>
          <span className="font-bold text-text tabular-nums">
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
            <span className="font-bold text-terracotta tabular-nums">
              −{couponDiscount.toLocaleString()}원
            </span>
          </div>
        )}
        {effectivePointsUsed > 0 && (
          <div className="flex justify-between text-[12px] mt-2">
            <span className="text-terracotta">포인트 사용</span>
            <span className="font-bold text-terracotta tabular-nums">
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
            <span className="text-[18px] font-black text-terracotta tabular-nums">
              {total.toLocaleString()}
            </span>
            <span className="text-[11px] text-muted">원</span>
          </div>
        </div>
        <div className="mt-2 text-right text-[10px] text-moss font-bold tabular-nums">
          {/* R86-C4: 이전엔 하드코드 0.01 (=1%) — Mate/단짝 3% 사용자에게 1/3 가치로
              잘못 표시 (표시광고법 위반 가능). earnRate (등급별) 로 정정. */}
          결제 완료 시 {Math.floor((total * earnRate) / 100).toLocaleString()}P 적립 예정
        </div>
      </section>

      {/* 출시 차단 fix: production toss client key 사용 시 "테스트 모드" 문구 숨김.
          NEXT_PUBLIC_TOSS_CLIENT_KEY 는 'test_*' (테스트) 또는 'live_*' (운영) 으로 시작. */}
      <p className="text-[11px] md:text-[11.5px] text-muted leading-relaxed px-1">
        주문 내용을 확인했으며, 결제를 진행할게요.
        {(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '').startsWith('test_') && (
          <>
            <br />이 결제는 토스페이먼츠 테스트 모드로 진행돼요.
          </>
        )}
      </p>

      {/* 데스크톱 inline 결제 버튼 */}
      <button
        onClick={handlePay}
        disabled={loading || total <= 0}
        className="hidden md:block w-full py-4 rounded-full text-[15px] font-bold active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100"
        style={{
          background: 'var(--ink)',
          color: 'var(--bg)',
          letterSpacing: '-0.01em',
        }}
      >
        {loading
          ? '결제창 여는 중...'
          : total <= 0
          ? '결제 금액이 0원입니다'
          : `${total.toLocaleString()}원 결제하기`}
      </button>

      {/* 우측 컬럼 닫기 */}
      </aside>

      {/* 모바일 고정 결제 버튼 — 데스크톱은 위 inline 으로 처리 */}
      <div
        className="ft-sticky-cta-bottom md:hidden z-30 pt-3 pb-4"
        style={{ background: 'linear-gradient(to top, var(--bg) 80%, transparent)' }}
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
