'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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

type Product = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  category: string | null
  short_description: string | null
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

const SHIPPING_FREE_THRESHOLD = 30000
const SHIPPING_FEE = 3000

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

export default function SubscribePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
  const toast = useToast()
  const slug = params.slug as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [quantity, setQuantity] = useState(1)
  const [interval, setInterval] = useState(2)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientZip, setRecipientZip] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [recipientAddressDetail, setRecipientAddressDetail] = useState('')
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
    loadDaumPostcode()
  }, [])

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: prod } = await supabase
        .from('products')
        .select(
          'id, name, slug, price, sale_price, image_url, category, short_description'
        )
        .eq('slug', slug)
        .eq('is_active', true)
        .eq('is_subscribable', true)
        .maybeSingle()

      if (!prod) {
        setLoading(false)
        return
      }
      setProduct(prod)

      // 신규 회원의 profile row 미존재 케이스 방어
      const { data: prof } = await supabase
        .from('profiles')
        .select('name, phone, zip, address, address_detail')
        .eq('id', user.id)
        .maybeSingle()

      if (prof) {
        setRecipientName(prof.name ?? '')
        setRecipientPhone(prof.phone ?? '')
        setRecipientZip(prof.zip ?? '')
        setRecipientAddress(prof.address ?? '')
        setRecipientAddressDetail(prof.address_detail ?? '')
      }
      setLoading(false)
    }
    load()
  }, [slug, router, supabase])

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
    if (!product) return
    if (!recipientName || !recipientPhone || !recipientAddress) {
      toast.error('수령인 정보를 모두 입력해 주세요.')
      return
    }
    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const unitPrice = product.sale_price ?? product.price
    const subtotal = unitPrice * quantity
    const shippingFee = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE
    const totalAmount = subtotal + shippingFee

    const nextDelivery = new Date()
    nextDelivery.setDate(nextDelivery.getDate() + interval * 7)

    // billingKey 발급 흐름에 쓰이는 customerKey — Toss 측 사용자 식별자.
    // user.id 그대로 노출하지 않도록 별도 random UUID. 같은 구독은 같은
    // customerKey 유지 (재발급 시도/카드 변경 시 일관성).
    const customerKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        interval_weeks: interval,
        status: 'active',
        next_delivery_date: nextDelivery.toISOString().split('T')[0],
        total_deliveries: 0,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_zip: recipientZip,
        recipient_address: recipientAddress,
        recipient_address_detail: recipientAddressDetail,
        subtotal,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        billing_customer_key: customerKey,
      })
      .select('id')
      .single()

    if (subErr || !sub) {
      toast.error('구독 생성에 실패했습니다. 다시 시도해 주세요.')
      setSubmitting(false)
      return
    }

    await supabase.from('subscription_items').insert({
      subscription_id: sub.id,
      product_id: product.id,
      quantity,
      unit_price: unitPrice,
      product_name: product.name,
      product_image_url: product.image_url,
    })

    // 카드 등록 페이지로 redirect — Toss billing auth 트리거. 사용자가 카드를
    // 등록하면 next_delivery_date 에 cron 이 자동 청구. 카드 등록 미완료 시에는
    // billing_key 가 NULL 이라 cron 이 자동 skip — 사용자는 마이페이지에서
    // 언제든 다시 등록 가능.
    router.push(
      `/subscribe/billing-auth?subscriptionId=${sub.id}&customerKey=${encodeURIComponent(customerKey)}`,
    )
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[80vh]">
        <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  if (!product) {
    return (
      <main className="px-5 py-10 max-w-md mx-auto text-center">
        <p className="text-[12px] text-muted">
          정기배송이 가능한 제품이 아니에요
        </p>
        <Link
          href="/products"
          className="mt-4 inline-block text-[13px] text-text font-bold underline"
        >
          ← 제품 목록
        </Link>
      </main>
    )
  }

  const unitPrice = product.sale_price ?? product.price
  const subtotal = unitPrice * quantity
  const shippingFee = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE
  const totalAmount = subtotal + shippingFee

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-rule bg-[#FDFDFD] text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-moss transition'
  const labelCls =
    'block text-[10px] font-semibold text-muted mb-1.5 uppercase tracking-[0.2em]'

  return (
    <main className="px-5 py-6 pb-32">
      <div className="max-w-md mx-auto">
        <Link
          href={`/products/${slug}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 제품으로 돌아가기
        </Link>
        <div className="mt-3">
          <span className="kicker inline-block">Subscribe</span>
          <h1 className="font-serif text-[22px] font-black text-text tracking-tight mt-1.5 inline-flex items-center gap-2">
            <Repeat className="w-5 h-5 text-moss" strokeWidth={2} />
            정기배송 신청
          </h1>
        </div>

        {/* 제품 요약 */}
        <div className="mt-4 bg-white rounded-2xl border border-rule p-4 flex gap-4 items-center">
          <div className="w-20 h-20 rounded-xl border border-rule overflow-hidden flex-shrink-0 bg-bg">
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
            <div className="font-bold text-text text-[13px] truncate">
              {product.name}
            </div>
            {product.short_description && (
              <div className="text-[11px] text-muted mt-0.5 truncate">
                {product.short_description}
              </div>
            )}
            <div className="mt-1 font-black text-[14px] text-terracotta">
              {unitPrice.toLocaleString()}원
              {product.sale_price && (
                <span className="ml-1 text-[11px] text-muted line-through font-normal">
                  {product.price.toLocaleString()}원
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 배송 주기 */}
        <div className="mt-3 bg-white rounded-2xl border border-rule p-5">
          <div className={labelCls}>배송 주기</div>
          <div className="grid grid-cols-3 gap-2">
            {INTERVALS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInterval(opt.value)}
                className={`py-3 px-2 rounded-xl border text-center transition ${
                  interval === opt.value
                    ? 'border-moss bg-moss/10'
                    : 'border-rule bg-white hover:border-muted'
                }`}
              >
                <div
                  className={`text-[13px] font-bold ${
                    interval === opt.value
                      ? 'text-moss'
                      : 'text-text'
                  }`}
                >
                  {opt.label}
                </div>
                <div className="text-[10px] text-muted mt-0.5">
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 수량 */}
        <div className="mt-3 bg-white rounded-2xl border border-rule p-5">
          <div className={labelCls}>수량 (회당)</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-xl bg-bg font-black text-text text-xl active:scale-95 transition"
            >
              −
            </button>
            <div className="flex-1 text-center font-black text-[22px] text-text">
              {quantity}
            </div>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-xl bg-bg font-black text-text text-xl active:scale-95 transition"
            >
              +
            </button>
          </div>
        </div>

        {/* 배송지 */}
        <div className="mt-3 bg-white rounded-2xl border border-rule p-5">
          <div className={labelCls}>배송지 정보</div>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
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
              <label className="block text-[10px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
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
              <label className="block text-[10px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
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
                  className="w-28 px-4 py-3 rounded-xl border border-rule bg-bg text-[13px] text-text"
                />
                <button
                  type="button"
                  onClick={openAddressSearch}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-rule bg-white text-[13px] font-bold text-text hover:border-moss hover:text-moss transition active:scale-95"
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
                className="w-full px-4 py-3 rounded-xl border border-rule bg-bg text-[13px] text-text placeholder:text-muted"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
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
              <label className="block text-[10px] font-semibold text-text mb-1 uppercase tracking-[0.2em]">
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
        <div className="mt-3 bg-white rounded-2xl border border-rule p-5">
          <div className={labelCls}>결제 요약 (회당)</div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted">상품 금액</span>
              <span className="text-text font-bold">
                {subtotal.toLocaleString()}원
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">배송비</span>
              <span className="text-text font-bold">
                {shippingFee === 0
                  ? '무료'
                  : `${shippingFee.toLocaleString()}원`}
              </span>
            </div>
            {shippingFee > 0 && (
              <div className="text-[10px] text-muted">
                {(SHIPPING_FREE_THRESHOLD - subtotal).toLocaleString()}원 더 담으면 무료배송!
              </div>
            )}
            <div className="pt-2 border-t border-rule flex justify-between">
              <span className="font-bold text-text">회당 결제 금액</span>
              <span className="text-[18px] font-black text-terracotta">
                {totalAmount.toLocaleString()}원
              </span>
            </div>
          </div>
          <div className="mt-3 p-3 bg-moss/10 rounded-xl">
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
            <div className="text-[10px] text-muted mt-1 leading-relaxed">
              이후 {interval}주마다 자동으로 배송 안내 연락을 드려요.
            </div>
          </div>
        </div>

        {/* 안내 */}
        <div className="mt-3 p-4 bg-bg rounded-xl">
          <div className="text-[11px] text-muted space-y-1 leading-relaxed">
            <p>· 정기배송은 배송일 전 알림을 통해 결제가 진행돼요.</p>
            <p>· 언제든지 마이페이지에서 일시정지/해지할 수 있어요.</p>
            <p>· 배송 주기, 수량, 배송지는 자유롭게 변경 가능해요.</p>
          </div>
        </div>
      </div>

      {/* Sticky bottom CTA — `.ft-sticky-cta-bottom` 이 chrome-aware:
          web 에선 viewport bottom, app 에선 탭바 위로 자동 정렬 + safe-area. */}
      <div className="ft-sticky-cta-bottom bg-bg border-t border-rule px-5 py-3 z-30">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-xl text-[13px] font-black active:scale-[0.98] transition disabled:opacity-70 bg-moss text-white shadow-[0_4px_14px_rgba(107,127,58,0.25)]"
          >
            {submitting
              ? '신청 중...'
              : `정기배송 신청하기 · ${totalAmount.toLocaleString()}원/회`}
          </button>
        </div>
      </div>
    </main>
  )
}
