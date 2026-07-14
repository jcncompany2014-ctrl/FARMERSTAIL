'use client'

// audit #101 — SubscribeClient: 단건 제품 정기배송 신청 폼. page.tsx (server)
// 가 auth + product + profile 을 prefetch. 빈 spinner 800ms+ 제거.
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Repeat,
  Soup,
  Cookie,
  Search,
  CalendarDays,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { formatPhone } from '@/lib/formatters'

export type SubscribeProduct = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  category: string | null
  short_description: string | null
}

export type SubscribeProfileInitial = {
  name: string
  phone: string
  zip: string
  address: string
  address_detail: string
}

type DaumPostcodeData = {
  userSelectedType: 'R' | 'J'
  roadAddress: string
  jibunAddress: string
  zonecode: string
  buildingName: string
}

const INTERVALS = [
  { value: 1, label: '매주', desc: '1주마다 배송' },
  { value: 2, label: '2주마다', desc: '2주마다 배송' },
  { value: 4, label: '4주마다', desc: '4주마다 배송' },
]

// 구독료에 배송비 포함 — 무료배송/배송비 임계 시스템 폐지(2026-06-27 사장님 지시).

let daumScriptLoaded = false
let daumScriptLoading = false
const daumCallbacks: (() => void)[] = []

function loadDaumPostcode(): Promise<void> {
  return new Promise((resolve) => {
    if (daumScriptLoaded) {
      resolve()
      return
    }
    if (daumScriptLoading) {
      daumCallbacks.push(resolve)
      return
    }
    daumScriptLoading = true
    const s = document.createElement('script')
    s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    s.async = true
    s.onload = () => {
      daumScriptLoaded = true
      daumScriptLoading = false
      resolve()
      daumCallbacks.forEach((cb) => cb())
      daumCallbacks.length = 0
    }
    document.head.appendChild(s)
  })
}

export type SubscribeClientProps = {
  slug: string
  userId: string
  product: SubscribeProduct
  profile: SubscribeProfileInitial
}

export default function SubscribeClient({
  userId,
  product,
  profile,
}: SubscribeClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [submitting, setSubmitting] = useState(false)

  const [quantity, setQuantity] = useState(1)
  const [interval, setInterval] = useState(2)
  const [recipientName, setRecipientName] = useState(profile.name)
  const [recipientPhone, setRecipientPhone] = useState(profile.phone)
  const [recipientZip, setRecipientZip] = useState(profile.zip)
  const [recipientAddress, setRecipientAddress] = useState(profile.address)
  const [recipientAddressDetail, setRecipientAddressDetail] = useState(
    profile.address_detail,
  )
  const [memo, setMemo] = useState('')

  const setZipRef = useRef(setRecipientZip)
  const setAddrRef = useRef(setRecipientAddress)
  const setDetailRef = useRef(setRecipientAddressDetail)
  useEffect(() => {
    setZipRef.current = setRecipientZip
    setAddrRef.current = setRecipientAddress
    setDetailRef.current = setRecipientAddressDetail
  }, [])

  const [firstDeliveryAt, setFirstDeliveryAt] = useState<number | null>(null)
  useEffect(() => {
    setFirstDeliveryAt(Date.now() + interval * 7 * 86400000)
  }, [interval])

  useEffect(() => {
    void loadDaumPostcode()
  }, [])

  const openAddressSearch = useCallback(async () => {
    await loadDaumPostcode()
    new window.daum.Postcode({
      oncomplete(data: DaumPostcodeData) {
        const addr =
          data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress
        setZipRef.current(data.zonecode)
        setAddrRef.current(addr)
        if (data.buildingName) {
          setDetailRef.current(data.buildingName)
        }
      },
    }).open()
  }, [])

  async function handleSubmit() {
    if (!recipientName || !recipientPhone || !recipientAddress) {
      toast.error('수령인 정보를 모두 입력해 주세요')
      return
    }
    setSubmitting(true)

    const unitPrice = product.sale_price ?? product.price
    const subtotal = unitPrice * quantity
    const shippingFee = 0
    const totalAmount = subtotal + shippingFee

    // billingKey 발급 흐름에 쓰이는 customerKey — Toss 측 사용자 식별자.
    // user.id 그대로 노출하지 않도록 별도 random UUID. 같은 구독은 같은
    // customerKey 유지 (재발급 시도/카드 변경 시 일관성).
    const customerKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // audit #79: subscriptions schema-drift cast.
    const { data: sub, error: subErr } = await (
      supabase as unknown as {
        from: (t: string) => {
          insert: (r: Record<string, unknown>) => {
            select: (cols: string) => {
              single: () => Promise<{
                data: { id: string } | null
                error: { message?: string } | null
              }>
            }
          }
        }
      }
    )
      .from('subscriptions')
      .insert({
        user_id: userId,
        interval_weeks: interval,
        status: 'active',
        // 카드 등록 전 = 배송 일정 없음(null). billing-issue 성공 시 interval 로
        // 스케줄. 카드 없는 구독이 홈에서 '활성'으로 뜨는 문제 차단(사장님 2026-07-14).
        next_delivery_date: null,
        total_deliveries: 0,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        // R84-D1: DB schema 는 zip/address/address_detail (no recipient_ prefix).
        // 이전 코드는 존재하지 않는 컬럼 박아서 출시 직후 정기배송 100% 실패였음.
        zip: recipientZip,
        address: recipientAddress,
        address_detail: recipientAddressDetail,
        subtotal,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        billing_customer_key: customerKey,
      })
      .select('id')
      .single()

    if (subErr || !sub) {
      toast.error('정기배송을 신청하지 못했어요')
      setSubmitting(false)
      return
    }

    const { error: itemErr } = await supabase
      .from('subscription_items')
      .insert({
        subscription_id: sub.id,
        product_id: product.id,
        quantity,
        unit_price: unitPrice,
        product_name: product.name,
        product_image_url: product.image_url,
      })

    if (itemErr) {
      // 상품 0개 '유령 구독' + 카드 자동결제 방지 — billing-auth 로 넘어가기
      // 전에 막아 billing_key 가 안 생기므로 cron 자동청구도 차단된다. 방금 만든
      // 구독은 cancelled 로 정리(롤백). 사용자에게 알리고 중단.
      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', sub.id)
      toast.error('정기배송 상품을 담지 못했어요. 다시 시도해 주세요')
      setSubmitting(false)
      return
    }

    // 카드 등록 페이지로 redirect — Toss billing auth 트리거. 사용자가 카드를
    // 등록하면 next_delivery_date 에 cron 이 자동 청구. 카드 등록 미완료 시에는
    // billing_key 가 NULL 이라 cron 이 자동 skip — 사용자는 마이페이지에서
    // 언제든 다시 등록 가능.
    router.push(
      `/subscribe/billing-auth?subscriptionId=${sub.id}&customerKey=${encodeURIComponent(customerKey)}`,
    )
  }

  const unitPrice = product.sale_price ?? product.price
  const subtotal = unitPrice * quantity
  const shippingFee = 0
  const totalAmount = subtotal + shippingFee

  // memo 는 서버에 별도 컬럼 없음 — 현재는 사용자 입력만 받고 future use 위해
  // 보존 (cron 배송 메모로 옮길 예정). lint void 회피용 ref 한 줄.
  void memo

  // v3: rounded-xl(12) → rounded(4), bg-[#FDFDFD] → bg-bg-3 (paperHi).
  // R89-B (D7): iOS Safari 는 input font-size < 16px 시 focus 자동 zoom-in.
  const inputCls =
    'w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[16px] text-text placeholder:text-muted focus:outline-none focus:border-moss transition'
  const labelCls =
    'block text-[10.5px] font-semibold text-muted mb-1.5 uppercase tracking-[0.2em]'

  return (
    <div className="px-5 py-6 pb-32">
      <div className="max-w-md mx-auto">
        <div className="mt-3">
          <span className="kicker inline-block">Subscribe · 정기배송</span>
          <h1
            className="font-sans text-[28px] font-black text-text tracking-tight mt-1.5 inline-flex items-center gap-2"
            style={{ letterSpacing: '-0.02em', lineHeight: 1 }}
          >
            <Repeat className="w-5 h-5 text-moss" strokeWidth={2.2} />
            정기배송 신청
          </h1>
        </div>

        {/* 제품 요약 */}
        <div className="mt-4 bg-bg-3 rounded border border-rule p-4 flex gap-4 items-center">
          <div className="w-20 h-20 rounded border border-rule overflow-hidden flex-shrink-0 bg-bg">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                {product.category === '간식' ? (
                  <Cookie
                    className="w-8 h-8 text-muted"
                    strokeWidth={1.3}
                  />
                ) : (
                  <Soup
                    className="w-8 h-8 text-muted"
                    strokeWidth={1.3}
                  />
                )}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-text text-[13.5px] truncate">
              {product.name}
            </div>
            {product.short_description && (
              <div className="text-[10.5px] text-muted mt-0.5 truncate">
                {product.short_description}
              </div>
            )}
            <div className="mt-1 font-black text-[13.5px] text-terracotta">
              {unitPrice.toLocaleString()}원
              {product.sale_price && (
                <span className="ml-1 text-[10.5px] text-muted line-through font-normal">
                  {product.price.toLocaleString()}원
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 배송 주기 */}
        <div className="mt-3 bg-bg-3 rounded border border-rule p-5">
          <div className={labelCls}>배송 주기</div>
          {/* UI audit A-7: 3 카드 h-full + min-h — 한국어 길이 차로 row 높이 변동 차단. */}
          <div className="grid grid-cols-3 gap-2">
            {INTERVALS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInterval(opt.value)}
                className={`h-full min-h-[72px] py-3 px-2 rounded border text-center transition ${
                  interval === opt.value
                    ? 'border-moss bg-moss/10'
                    : 'border-rule bg-bg-3 hover:border-muted'
                }`}
              >
                <div
                  className={`text-[13.5px] font-bold ${
                    interval === opt.value
                      ? 'text-moss'
                      : 'text-text'
                  }`}
                >
                  {opt.label}
                </div>
                <div className="text-[10.5px] text-muted mt-0.5">
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 수량 */}
        <div className="mt-3 bg-bg-3 rounded border border-rule p-5">
          <div className={labelCls}>수량 (회당)</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded bg-bg font-black text-text text-xl active:scale-95 transition"
            >
              −
            </button>
            <div className="flex-1 text-center font-black text-[22px] text-text">
              {quantity}
            </div>
            <button
              onClick={() => setQuantity(Math.min(20, quantity + 1))}
              className="w-10 h-10 rounded bg-bg font-black text-text text-xl active:scale-95 transition"
            >
              +
            </button>
          </div>
        </div>

        {/* 배송지 */}
        <div className="mt-3 bg-bg-3 rounded border border-rule p-5">
          <div className={labelCls}>배송지 정보</div>
          <div className="space-y-3">
            <div>
              <label className="block text-[10.5px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
                수령인 *
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="이름"
                autoComplete="name"
                enterKeyHint="next"
                maxLength={40}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
                연락처 *
              </label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(formatPhone(e.target.value))}
                placeholder="010-0000-0000"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                maxLength={13}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
                주소 *
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={recipientZip}
                  readOnly
                  placeholder="우편번호"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={5}
                  className="w-28 px-4 py-3 rounded border border-rule bg-bg text-[13.5px] text-text"
                />
                <button
                  type="button"
                  onClick={openAddressSearch}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded border border-rule bg-bg-3 text-[13.5px] font-bold text-text hover:border-moss hover:text-moss transition active:scale-95"
                >
                  <Search className="w-3.5 h-3.5" strokeWidth={2} />
                  주소 검색
                </button>
              </div>
              <input
                type="text"
                value={recipientAddress}
                readOnly
                placeholder="주소 검색을 눌러주세요"
                autoComplete="street-address"
                className="w-full px-4 py-3 rounded border border-rule bg-bg text-[13.5px] text-text placeholder:text-muted"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
                상세 주소
              </label>
              <input
                type="text"
                value={recipientAddressDetail}
                onChange={(e) => setRecipientAddressDetail(e.target.value)}
                placeholder="동/호수"
                autoComplete="address-line2"
                enterKeyHint="next"
                maxLength={100}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
                배송 메모
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="부재 시 문 앞에 놓아주세요"
                enterKeyHint="done"
                maxLength={80}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* 결제 요약 */}
        <div className="mt-3 bg-bg-3 rounded border border-rule p-5">
          <div className={labelCls}>결제 요약 (회당)</div>
          {/* UI audit A-6: 결제 요약 4 row 우측 가격 tabular-nums — 자릿수 정렬. */}
          <div className="space-y-2 text-[13.5px]">
            {/* 정가 앵커 → 구독 할인 시각화 (2026-07-11 확정 가격표) — 표시 전용. */}
            {product.sale_price != null && product.price > unitPrice && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted">정가</span>
                  <span className="text-muted line-through tabular-nums">
                    {(product.price * quantity).toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">구독 할인</span>
                  <span className="font-bold tabular-nums" style={{ color: 'var(--moss)' }}>
                    −{((product.price - unitPrice) * quantity).toLocaleString()}원
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted">상품 금액</span>
              <span className="text-text font-bold tabular-nums">
                {subtotal.toLocaleString()}원
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">배송비</span>
              <span className="font-bold" style={{ color: 'var(--moss)' }}>
                무료 · 파머스테일 부담
              </span>
            </div>
            <div className="pt-2 border-t border-rule flex justify-between">
              <span className="font-bold text-text">회당 결제 금액</span>
              <span className="text-[18px] font-black text-terracotta tabular-nums">
                {totalAmount.toLocaleString()}원
              </span>
            </div>
          </div>
          <div className="mt-3 p-3 bg-moss/10 rounded">
            <div className="flex items-center gap-1.5 text-[12px] text-moss font-bold">
              <CalendarDays className="w-3.5 h-3.5" strokeWidth={2} />첫 배송
              예정일:{' '}
              {firstDeliveryAt
                ? new Date(firstDeliveryAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '계산 중...'}
            </div>
            <div className="text-[10.5px] text-muted mt-1 leading-relaxed">
              이후 {interval}주마다 등록하신 카드로 자동 결제 후 배송돼요.
            </div>
          </div>
        </div>

        {/* 안내 — R92-S (D7): 전자상거래법 §13 + 콘텐츠산업진흥법 정기과금
            고지 의무. 자동결제 여부 / 금액 / 주기 / 결제 시점 / 해지 방법을
            명확히 표시 ("배송 안내 연락" 같은 완곡 표현 금지). */}
        <div className="mt-3 p-4 bg-bg rounded">
          <div className="text-[10.5px] text-muted space-y-1 leading-relaxed">
            <p>
              · <b className="text-text">자동결제 안내:</b> 등록하신 카드로{' '}
              <b className="text-text">
                {interval}주마다 {totalAmount.toLocaleString()}원
              </b>
              이 자동 청구됩니다.
            </p>
            <p>· 매 결제 전 알림을 보내드려, 미리 변경·해지하실 수 있어요.</p>
            <p>· 언제든지 마이페이지 → 정기배송에서 일시정지/해지할 수 있어요 (위약금 없음).</p>
            <p>· 배송 주기, 수량, 배송지는 자유롭게 변경 가능해요.</p>
          </div>
        </div>
      </div>

      {/* Sticky bottom CTA — `.ft-sticky-cta-bottom` 이 chrome-aware:
          web 에선 viewport bottom, app 에선 탭바 위로 자동 정렬 + safe-area. */}
      <div className="ft-sticky-cta-bottom bg-bg border-t border-rule px-5 py-3 z-30">
        <div className="max-w-md mx-auto">
          {/* R92-S (D7): 정기과금 명시 동의 — 신청 = 자동결제 동의 간주 근거. */}
          <p className="text-[10.5px] text-muted text-center mb-2 leading-relaxed">
            신청하기를 누르면 {interval}주 주기 자동결제(
            {totalAmount.toLocaleString()}원/회)에 동의하는 것으로 간주됩니다.
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-full text-[13.5px] font-black active:scale-[0.98] transition disabled:opacity-70 bg-moss text-white shadow-[0_4px_14px_rgba(107,127,58,0.25)]"
          >
            {submitting
              ? '신청 중...'
              : `정기배송 신청하기 · ${totalAmount.toLocaleString()}원/회`}
          </button>
        </div>
      </div>
    </div>
  )
}
