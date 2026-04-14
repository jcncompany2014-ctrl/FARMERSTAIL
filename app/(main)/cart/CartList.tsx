'use client'

import Image from 'next/image'
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
    <ul className="px-5 space-y-3">
      {items.map((row) => {
        const price = row.product.sale_price ?? row.product.price
        const lineTotal = price * row.quantity
        const isBusy = busyId === row.id

        return (
          <li
            key={row.id}
            className="flex gap-3 p-3 rounded-2xl bg-white border border-[#EDE6D8]"
          >
            <Link
              href={`/products/${row.product.slug}`}
              className="shrink-0 w-20 h-20 rounded-xl bg-[#F5F0E6] overflow-hidden relative"
            >
              {row.product.image_url ? (
                <Image
                  src={row.product.image_url}
                  alt={row.product.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  🐾
                </div>
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <Link
                  href={`/products/${row.product.slug}`}
                  className="text-sm text-[#2A2118] font-medium line-clamp-2"
                >
                  {row.product.name}
                </Link>
                <button
                  onClick={() => removeItem(row.id)}
                  disabled={isBusy}
                  className="text-[#8A7668] hover:text-[#B83A2E] text-xs shrink-0"
                  aria-label="삭제"
                >
                  ✕
                </button>
              </div>

              <p className="mt-1 font-['Archivo_Black'] text-[#A0452E]">
                {lineTotal.toLocaleString()}원
              </p>

              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => updateQty(row.id, row.quantity - 1)}
                  disabled={isBusy || row.quantity <= 1}
                  className="w-7 h-7 rounded-full border border-[#EDE6D8] text-[#5C4A3A] disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-7 text-center text-sm text-[#2A2118]">
                  {row.quantity}
                </span>
                <button
                  onClick={() => updateQty(row.id, row.quantity + 1)}
                  disabled={isBusy}
                  className="w-7 h-7 rounded-full border border-[#EDE6D8] text-[#5C4A3A] disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}