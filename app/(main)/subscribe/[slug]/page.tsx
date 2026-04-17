'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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

const INTERVALS = [
  { value: 1, label: '매주', desc: '1주마다 배송' },
  { value: 2, label: '2주마다', desc: '2주마다 배송' },
  { value: 4, label: '4주마다', desc: '4주마다 배송' },
]

const SHIPPING_FREE_THRESHOLD = 30000
const SHIPPING_FEE = 3000

// --- 다음 우편번호 스크립트 로더 ---
let daumScriptLoaded = false
let daumScriptLoading = false
const daumCallbacks: (() => void)[] = []

function loadDaumPostcode(): Promise<void> {
  return new Promise((resolve) => {
    if (daumScriptLoaded) { resolve(); return }
    if (daumScriptLoading) { daumCallbacks.push(resolve); return }
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

declare global {
  interface Window {
    daum: {
      Postcode: new (config: {
        oncomplete: (data: {
          zonecode: string
          roadAddress: string
          jibunAddress: string
          buildingName: string
          userSelectedType: 'R' | 'J'
        }) => void
      }) => { open: () => void }
    }
  }
}

export default function SubscribePage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()
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

  // 주소 state를 ref로도 유지 (Daum 클로저 문제 방지)
  const setZipRef = useRef(setRecipientZip)
  const setAddrRef = useRef(setRecipientAddress)
  const setDetailRef = useRef(setRecipientAddressDetail)
  setZipRef.current = setRecipientZip
  setAddrRef.current = setRecipientAddress
  setDetailRef.current = setRecipientAddressDetail

  useEffect(() => {
    loadDaumPostcode()
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prod } = await supabase
        .from('products')
        .select('id, name, slug, price, sale_price, image_url, category, short_description')
        .eq('slug', slug)
        .eq('is_active', true)
        .eq('is_subscribable', true)
        .single()

      if (!prod) { setLoading(false); return }
      setProduct(prod)

      const { data: prof } = await supabase
        .from('profiles')
        .select('name, phone, zip, address, address_detail')
        .eq('id', user.id)
        .single()

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
      oncomplete(data) {
        const addr = data.userSelectedType === 'R' ? data.roadAddress : data.jibunAddress
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
      alert('수령인 정보를 모두 입력해 주세요.')
      return
    }
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const unitPrice = product.sale_price ?? product.price
    const subtotal = unitPrice * quantity
    const shippingFee = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE
    const totalAmount = subtotal + shippingFee

    const nextDelivery = new Date()
    nextDelivery.setDate(nextDelivery.getDate() + interval * 7)

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
      })
      .select('id')
      .single()

    if (subErr || !sub) {
      alert('구독 생성에 실패했습니다. 다시 시도해 주세요.')
      setSubmitting(false)
      return
    }

    await supabase
      .from('subscription_items')
      .insert({
        subscription_id: sub.id,
        product_id: product.id,
        quantity,
        unit_price: unitPrice,
        product_name: product.name,
        product_image_url: product.image_url,
      })

    router.push('/mypage/subscriptions?new=1')
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[80vh]">
        <div className="text-[#8A7668]">로딩 중...</div>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="px-6 py-10 max-w-md mx-auto text-center">
        <p className="text-[#8A7668]">정기배송이 가능한 제품이 아니에요</p>
        <Link href="/products" className="mt-4 inline-block text-[#3D2B1F] font-bold underline">← 제품 목록</Link>
      </main>
    )
  }

  const unitPrice = product.sale_price ?? product.price
  const subtotal = unitPrice * quantity
  const shippingFee = subtotal >= SHIPPING_FREE_THRESHOLD ? 0 : SHIPPING_FEE
  const totalAmount = subtotal + shippingFee

  return (
    <main className="px-6 py-6 pb-32">
      <div className="max-w-md mx-auto">
        <Link href={`/products/${slug}`} className="text-sm text-[#8A7668] hover:text-[#3D2B1F]">← 제품으로 돌아가기</Link>
        <h1 className="mt-4 text-xl font-black text-[#3D2B1F] tracking-tight">🔁 정기배송 신청</h1>

        {/* 제품 요약 */}
        <div className="mt-4 bg-white rounded-2xl border-2 border-[#EDE6D8] p-4 flex gap-4 items-center">
          <div className="w-20 h-20 rounded-xl border border-[#EDE6D8] overflow-hidden flex-shrink-0 bg-[#F5F0E6]">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">
                {product.category === '간식' ? '🍪' : '🍲'}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-[#3D2B1F] text-sm truncate">{product.name}</div>
            {product.short_description && (
              <div className="text-xs text-[#8A7668] mt-0.5 truncate">{product.short_description}</div>
            )}
            <div className="mt-1 font-black text-[#A0452E]">
              {unitPrice.toLocaleString()}원
              {product.sale_price && (
                <span className="ml-1 text-xs text-[#8A7668] line-through font-normal">{product.price.toLocaleString()}원</span>
              )}
            </div>
          </div>
        </div>

        {/* 배송 주기 */}
        <div className="mt-4 bg-white rounded-2xl border-2 border-[#EDE6D8] p-5">
          <div className="text-xs font-bold text-[#8A7668] uppercase tracking-wider mb-3">배송 주기</div>
          <div className="grid grid-cols-3 gap-2">
            {INTERVALS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setInterval(opt.value)}
                className={`py-3 px-2 rounded-xl border-2 text-center transition-all ${
                  interval === opt.value
                    ? 'border-[#6B7F3A] bg-[#6B7F3A]/10'
                    : 'border-[#EDE6D8] bg-white hover:border-[#8A7668]'
                }`}
              >
                <div className={`text-sm font-bold ${interval === opt.value ? 'text-[#6B7F3A]' : 'text-[#3D2B1F]'}`}>{opt.label}</div>
                <div className="text-[10px] text-[#8A7668] mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 수량 */}
        <div className="mt-4 bg-white rounded-2xl border-2 border-[#EDE6D8] p-5">
          <div className="text-xs font-bold text-[#8A7668] uppercase tracking-wider mb-3">수량 (회당)</div>
          <div className="flex items-center gap-3">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl bg-[#F5F0E6] font-black text-[#3D2B1F] text-xl active:scale-95 transition">−</button>
            <div className="flex-1 text-center font-black text-2xl text-[#3D2B1F]">{quantity}</div>
            <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-xl bg-[#F5F0E6] font-black text-[#3D2B1F] text-xl active:scale-95 transition">+</button>
          </div>
        </div>

        {/* 배송지 */}
        <div className="mt-4 bg-white rounded-2xl border-2 border-[#EDE6D8] p-5">
          <div className="text-xs font-bold text-[#8A7668] uppercase tracking-wider mb-3">배송지 정보</div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#5C4A3A] mb-1">수령인 *</label>
              <input type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="이름"
                className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-[#FDFDFD] text-[#3D2B1F] text-sm focus:border-[#6B7F3A] focus:outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4A3A] mb-1">연락처 *</label>
              <input type="tel" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="010-0000-0000"
                className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-[#FDFDFD] text-[#3D2B1F] text-sm focus:border-[#6B7F3A] focus:outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4A3A] mb-1">주소 *</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={recipientZip} readOnly placeholder="우편번호"
                  className="w-28 px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-[#F5F0E6] text-[#3D2B1F] text-sm" />
                <button type="button" onClick={openAddressSearch}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-white text-sm font-bold text-[#3D2B1F] hover:border-[#6B7F3A] hover:text-[#6B7F3A] transition active:scale-95">
                  🔍 주소 검색
                </button>
              </div>
              <input type="text" value={recipientAddress} readOnly placeholder="주소 검색을 눌러주세요"
                className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-[#F5F0E6] text-[#3D2B1F] text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4A3A] mb-1">상세 주소</label>
              <input type="text" value={recipientAddressDetail} onChange={(e) => setRecipientAddressDetail(e.target.value)} placeholder="동/호수"
                className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-[#FDFDFD] text-[#3D2B1F] text-sm focus:border-[#6B7F3A] focus:outline-none transition" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4A3A] mb-1">배송 메모</label>
              <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="부재 시 문 앞에 놓아주세요"
                className="w-full px-4 py-3 rounded-xl border-2 border-[#EDE6D8] bg-[#FDFDFD] text-[#3D2B1F] text-sm focus:border-[#6B7F3A] focus:outline-none transition" />
            </div>
          </div>
        </div>

        {/* 결제 요약 */}
        <div className="mt-4 bg-white rounded-2xl border-2 border-[#EDE6D8] p-5">
          <div className="text-xs font-bold text-[#8A7668] uppercase tracking-wider mb-3">결제 요약 (회당)</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8A7668]">상품 금액</span>
              <span className="text-[#3D2B1F] font-bold">{subtotal.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8A7668]">배송비</span>
              <span className="text-[#3D2B1F] font-bold">{shippingFee === 0 ? '무료' : `${shippingFee.toLocaleString()}원`}</span>
            </div>
            {shippingFee > 0 && (
              <div className="text-[10px] text-[#8A7668]">{(SHIPPING_FREE_THRESHOLD - subtotal).toLocaleString()}원 더 담으면 무료배송!</div>
            )}
            <div className="pt-2 border-t border-[#EDE6D8] flex justify-between">
              <span className="font-bold text-[#3D2B1F]">회당 결제 금액</span>
              <span className="text-lg font-black text-[#A0452E]">{totalAmount.toLocaleString()}원</span>
            </div>
          </div>
          <div className="mt-3 p-3 bg-[#6B7F3A]/10 rounded-xl">
            <div className="text-xs text-[#6B7F3A] font-bold">
              📅 첫 배송 예정일: {new Date(Date.now() + interval * 7 * 86400000).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="text-[10px] text-[#8A7668] mt-1">이후 {interval}주마다 자동으로 배송 안내 연락을 드려요.</div>
          </div>
        </div>

        {/* 안내 */}
        <div className="mt-4 p-4 bg-[#F5F0E6] rounded-xl">
          <div className="text-xs text-[#8A7668] space-y-1">
            <p>• 정기배송은 배송일 전 알림을 통해 결제가 진행돼요.</p>
            <p>• 언제든지 마이페이지에서 일시정지/해지할 수 있어요.</p>
            <p>• 배송 주기, 수량, 배송지는 자유롭게 변경 가능해요.</p>
          </div>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t-2 border-[#EDE6D8] px-6 py-3 z-30">
        <div className="max-w-md mx-auto">
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 rounded-xl font-bold text-base border-2 border-[#2A2118] shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-70 bg-[#6B7F3A] text-white">
            {submitting ? '신청 중...' : `정기배송 신청하기 · ${totalAmount.toLocaleString()}원/회`}
          </button>
        </div>
      </div>
    </main>
  )
}