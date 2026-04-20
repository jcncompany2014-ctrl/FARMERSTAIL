'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Row = {
  id: string
  quantity: number
  product: {
    id: string
    name: string
    slug: string
    price: number
    sale_price: number | null
    image_url: string | null
    stock: number
  }
}

export default function CartList({ initialItems }: { initialItems: Row[] }) {
  const [items, setItems] = useState<Row[]>(initialItems)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  async function updateQty(id: string, next: number) {
    if (next < 1) return
    const target = items.find((i) => i.id === id)
    if (!target) return
    if (next > target.product.stock) {
      alert(`재고가 ${target.product.stock}개 남았어요`)
      return
    }

    setBusyId(id)
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: next } : i))
    )

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: next })
      .eq('id', id)

    setBusyId(null)

    if (error) {
      alert('수량 변경 실패: ' + error.message)
      setItems(initialItems)
      return
    }
    startTransition(() => router.refresh())
  }

  async function removeItem(id: string) {
    if (!confirm('이 상품을 장바구니에서 뺄까요?')) return

    setBusyId(id)
    const prev = items
    setItems((p) => p.filter((i) => i.id !== id))

    const { error } = await supabase.from('cart_items').delete().eq('id', id)

    setBusyId(null)

    if (error) {
      alert('삭제 실패: ' + error.message)
      setItems(prev)
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <ul className="space-y-2.5">
      {items.map((row) => {
        const price = row.product.sale_price ?? row.product.price
        const hasSale = row.product.sale_price !== null
        const lineTotal = price * row.quantity
        const isBusy = busyId === row.id

        return (
          <li
            key={row.id}
            className="bg-white rounded-xl border border-[#EDE6D8] overflow-hidden"
          >
            <div className="flex gap-3 p-3">
              <Link
                href={`/products/${row.product.slug}`}
                className="shrink-0 w-20 h-20 rounded-lg bg-[#F5F0E6] overflow-hidden relative"
              >
                {row.product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.product.image_url}
                    alt={row.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    🐾
                  </div>
                )}
              </Link>

              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex justify-between items-start gap-2">
                  <Link
                    href={`/products/${row.product.slug}`}
                    className="text-[12px] text-[#3D2B1F] font-bold leading-snug line-clamp-2"
                  >
                    {row.product.name}
                  </Link>
                  <button
                    onClick={() => removeItem(row.id)}
                    disabled={isBusy}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-[#8A7668] hover:text-[#B83A2E] hover:bg-[#F5F0E6] text-xs transition disabled:opacity-40"
                    aria-label="삭제"
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-auto pt-2 flex items-end justify-between">
                  {/* 수량 스텝퍼 */}
                  <div className="flex items-center bg-[#F5F0E6] rounded-lg">
                    <button
                      onClick={() => updateQty(row.id, row.quantity - 1)}
                      disabled={isBusy || row.quantity <= 1}
                      className="w-7 h-7 flex items-center justify-center text-[#3D2B1F] font-bold text-sm disabled:opacity-30 active:scale-90 transition"
                      aria-label="수량 감소"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-[12px] font-bold text-[#3D2B1F]">
                      {row.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(row.id, row.quantity + 1)}
                      disabled={isBusy}
                      className="w-7 h-7 flex items-center justify-center text-[#3D2B1F] font-bold text-sm disabled:opacity-30 active:scale-90 transition"
                      aria-label="수량 증가"
                    >
                      +
                    </button>
                  </div>

                  {/* 가격 */}
                  <div className="text-right">
                    {hasSale && (
                      <div className="text-[9px] text-[#8A7668] line-through leading-none">
                        {(row.product.price * row.quantity).toLocaleString()}원
                      </div>
                    )}
                    <div className="flex items-baseline gap-0.5 mt-0.5">
                      <span className="text-[14px] font-black text-[#A0452E]">
                        {lineTotal.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-[#8A7668]">원</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
