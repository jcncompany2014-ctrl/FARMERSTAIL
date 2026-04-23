'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { StockBadge } from '@/components/ui/StockBadge'
import { stockState, maxOrderable } from '@/lib/products/stock'

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
  const toast = useToast()

  async function updateQty(id: string, next: number) {
    if (next < 1) return
    const target = items.find((i) => i.id === id)
    if (!target) return
    const maxQ = maxOrderable(target.product.stock)
    if (maxQ <= 0) {
      // 품절 상품이 장바구니에 남아 있는 경우 — 증가는 막고 제거를 안내.
      toast.warning('품절 상품이에요. 장바구니에서 제거해 주세요.')
      return
    }
    if (next > maxQ) {
      toast.warning(`재고가 ${target.product.stock}개 남았어요`)
      return
    }

    setBusyId(id)
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: next } : i))
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: next })
      .eq('id', id)
      .eq('user_id', user.id)

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

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

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
        // row-level 재고 상태 — 담아 뒀는데 그 사이 품절된 케이스 대응.
        const rowStock = stockState(row.product.stock)
        const rowSoldOut = rowStock === 'out'
        const maxQ = maxOrderable(row.product.stock)

        return (
          <li
            key={row.id}
            className="bg-white rounded-xl border border-rule overflow-hidden"
          >
            <div className="flex gap-3 p-3">
              <Link
                href={`/products/${row.product.slug}`}
                className="shrink-0 w-20 h-20 rounded-lg bg-bg overflow-hidden relative"
              >
                {row.product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.product.image_url}
                    alt={row.product.name}
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
              </Link>

              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${row.product.slug}`}
                      className="text-[12px] text-text font-bold leading-snug line-clamp-2"
                    >
                      {row.product.name}
                    </Link>
                    {/* 재고 뱃지 — low/out일 때만 렌더 */}
                    {rowStock !== 'in_stock' && (
                      <div className="mt-1">
                        <StockBadge
                          stock={row.product.stock}
                          placement="inline"
                          showCount
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(row.id)}
                    disabled={isBusy}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-muted hover:text-sale hover:bg-bg transition disabled:opacity-40"
                    aria-label="삭제"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>

                <div className="mt-auto pt-2 flex items-end justify-between">
                  {/* 수량 스텝퍼 — 품절 row는 disabled 상태로 표시. */}
                  <div
                    className={
                      'flex items-center bg-bg rounded-lg ' +
                      (rowSoldOut ? 'opacity-50' : '')
                    }
                  >
                    <button
                      onClick={() => updateQty(row.id, row.quantity - 1)}
                      disabled={isBusy || row.quantity <= 1 || rowSoldOut}
                      className="w-7 h-7 flex items-center justify-center text-text font-bold text-sm disabled:opacity-30 active:scale-90 transition"
                      aria-label="수량 감소"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-[12px] font-bold text-text">
                      {row.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(row.id, row.quantity + 1)}
                      disabled={isBusy || rowSoldOut || row.quantity >= maxQ}
                      className="w-7 h-7 flex items-center justify-center text-text font-bold text-sm disabled:opacity-30 active:scale-90 transition"
                      aria-label="수량 증가"
                    >
                      +
                    </button>
                  </div>

                  {/* 가격 */}
                  <div className="text-right">
                    {hasSale && (
                      <div className="text-[9px] text-muted line-through leading-none">
                        {(row.product.price * row.quantity).toLocaleString()}원
                      </div>
                    )}
                    <div className="flex items-baseline gap-0.5 mt-0.5">
                      <span className="text-[14px] font-black text-terracotta">
                        {lineTotal.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted">원</span>
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
