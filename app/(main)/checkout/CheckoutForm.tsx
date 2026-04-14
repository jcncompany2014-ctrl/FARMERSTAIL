'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'
import { createClient } from '@/lib/supabase/client'

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
  shippingFee: number
  total: number
}

function generateOrderNumber() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `FT-${y}${m}${d}-${rand}`
}

export default function CheckoutForm({
  userId,
  userEmail,
  defaultProfile,
  orderItems,
  subtotal,
  shippingFee,
  total,
}: Props) {
  const router = useRouter()
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

  async function handlePay() {
    // 검증
    if (!name.trim() || !phone.trim() || !zip.trim() || !address.trim()) {
      alert('받는 분, 연락처, 주소를 모두 입력해주세요')
      return
    }

    setLoading(true)
    try {
      // 1) profiles에 저장 옵션
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

      // 2) 주문 row 먼저 생성 (pending 상태)
      const orderNumber = generateOrderNumber()

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          order_number: orderNumber,
          subtotal,
          shipping_fee: shippingFee,
          total_amount: total,
          recipient_name: name,
          recipient_phone: phone,
          zip,
          address,
          address_detail: addressDetail || null,
          delivery_memo: memo || null,
          payment_status: 'pending',
          order_status: 'pending',
        })
        .select('id, order_number')
        .single()

      if (orderError || !order) {
        throw new Error(orderError?.message ?? '주문 생성 실패')
      }

      // 3) order_items 삽입
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

      // 4) 토스페이먼츠 결제창 호출
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({ customerKey: ANONYMOUS })

      const firstItem = orderItems[0]
      const orderName =
        orderItems.length === 1
          ? firstItem.name
          : `${firstItem.name} 외 ${orderItems.length - 1}건`

      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: total },
        orderId: order.order_number,
        orderName,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerEmail: userEmail,
        customerName: name,
        card: {
          useEscrow: false,
          flowMode: 'DEFAULT',
          useCardPoint: false,
          useAppCardOnly: false,
        },
      })
      // 여기까지 오면 결제창이 뜬 상태. 성공/실패는 리다이렉트로 처리됨.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '결제 요청 중 오류'
      alert(msg)
      setLoading(false)
    }
  }

  return (
    <div className="px-5 space-y-6">
      {/* 배송지 */}
      <section className="p-5 rounded-2xl bg-white border border-[#EDE6D8]">
        <h2 className="text-sm font-bold text-[#2A2118] mb-3">배송지</h2>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="받는 분"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#F5F0E6] text-sm text-[#2A2118] placeholder:text-[#8A7668] focus:outline-none focus:ring-2 focus:ring-[#A0452E]"
          />
          <input
            type="tel"
            placeholder="연락처 (예: 010-1234-5678)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#F5F0E6] text-sm text-[#2A2118] placeholder:text-[#8A7668] focus:outline-none focus:ring-2 focus:ring-[#A0452E]"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="우편번호"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="w-28 px-4 py-3 rounded-xl bg-[#F5F0E6] text-sm text-[#2A2118] placeholder:text-[#8A7668] focus:outline-none focus:ring-2 focus:ring-[#A0452E]"
            />
            <input
              type="text"
              placeholder="기본 주소"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-[#F5F0E6] text-sm text-[#2A2118] placeholder:text-[#8A7668] focus:outline-none focus:ring-2 focus:ring-[#A0452E]"
            />
          </div>
          <input
            type="text"
            placeholder="상세 주소 (선택)"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#F5F0E6] text-sm text-[#2A2118] placeholder:text-[#8A7668] focus:outline-none focus:ring-2 focus:ring-[#A0452E]"
          />
          <input
            type="text"
            placeholder="배송 메모 (선택)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#F5F0E6] text-sm text-[#2A2118] placeholder:text-[#8A7668] focus:outline-none focus:ring-2 focus:ring-[#A0452E]"
          />
        </div>

        <label className="mt-3 flex items-center gap-2 text-xs text-[#5C4A3A] cursor-pointer">
          <input
            type="checkbox"
            checked={saveToProfile}
            onChange={(e) => setSaveToProfile(e.target.checked)}
            className="accent-[#A0452E]"
          />
          기본 배송지로 저장하기
        </label>
      </section>

      {/* 주문 상품 */}
      <section className="p-5 rounded-2xl bg-white border border-[#EDE6D8]">
        <h2 className="text-sm font-bold text-[#2A2118] mb-3">주문 상품</h2>
        <ul className="space-y-3">
          {orderItems.map((it) => (
            <li key={it.productId} className="flex gap-3">
              <div className="shrink-0 w-14 h-14 rounded-lg bg-[#F5F0E6] overflow-hidden relative">
                {it.imageUrl ? (
                  <Image
                    src={it.imageUrl}
                    alt={it.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">
                    🐾
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#2A2118] line-clamp-2">
                  {it.name}
                </p>
                <p className="text-xs text-[#8A7668] mt-0.5">
                  {it.unitPrice.toLocaleString()}원 × {it.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold text-[#2A2118] whitespace-nowrap">
                {it.lineTotal.toLocaleString()}원
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* 결제 요약 */}
      <section className="p-5 rounded-2xl bg-[#F5F0E6] border border-[#EDE6D8]">
        <div className="flex justify-between text-sm text-[#5C4A3A]">
          <span>상품 금액</span>
          <span>{subtotal.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between text-sm text-[#5C4A3A] mt-2">
          <span>배송비</span>
          <span>
            {shippingFee === 0 ? '무료' : `${shippingFee.toLocaleString()}원`}
          </span>
        </div>
        <div className="border-t border-[#EDE6D8] my-3" />
        <div className="flex justify-between items-center">
          <span className="text-[#2A2118] font-semibold">총 결제금액</span>
          <span className="font-['Archivo_Black'] text-xl text-[#A0452E]">
            {total.toLocaleString()}원
          </span>
        </div>
      </section>

      <p className="text-[11px] text-[#8A7668] leading-relaxed">
        주문 내용을 확인했으며, 결제 진행에 동의합니다. 이 결제는 토스페이먼츠
        테스트 모드로 진행됩니다.
      </p>

      {/* 고정 결제 버튼 */}
      <div className="fixed bottom-16 left-0 right-0 z-30 bg-white border-t border-[#EDE6D8]">
        <div className="max-w-md mx-auto px-5 py-3">
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full py-4 rounded-full bg-[#A0452E] text-white font-semibold disabled:opacity-50 hover:bg-[#8A3822] transition"
          >
            {loading ? '결제창 여는 중...' : `${total.toLocaleString()}원 결제하기`}
          </button>
        </div>
      </div>
    </div>
  )
}