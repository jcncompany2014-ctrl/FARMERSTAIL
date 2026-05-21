'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { StockBadge } from '@/components/ui/StockBadge'
import { BLUR_BG2 } from '@/lib/ui/blur'
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

  // audit 2-13: 카트 탭을 오래 열어두면 stock 이 stale. 다른 탭/앱 사용 후
  // 돌아왔을 때 (visibilitychange) 자동으로 서버 데이터 재요청. 5분 이상
  // 가만히 두면 (visibilitychange 없이도) 다시 요청. router.refresh() 가
  // RSC 만 다시 fetch — 사용자 인터랙션 흐름은 끊지 않음.
  useEffect(() => {
    let lastRefreshedAt = Date.now()
    const STALE_MS = 5 * 60_000

    function maybeRefresh() {
      if (Date.now() - lastRefreshedAt < 30_000) return // 30초 디바운스
      lastRefreshedAt = Date.now()
      startTransition(() => router.refresh())
    }

    function onVisible() {
      if (document.visibilityState === 'visible') maybeRefresh()
    }

    const interval = setInterval(() => {
      if (Date.now() - lastRefreshedAt >= STALE_MS) maybeRefresh()
    }, 60_000)

    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router])

  async function updateQty(id: string, nextInput: number) {
    let next = nextInput
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
      // audit 2-11: 단순 경고에서 자동 보정으로 — 사용자가 maxQ 까지는
      // 담을 수 있게 즉시 수량을 잘라 저장. Toast 로 안내만.
      toast.warning(`재고가 ${target.product.stock}개 남았어요. ${maxQ}개로 맞췄어요.`)
      next = maxQ
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
      toast.error('수량을 변경하지 못했어요')
      setItems(initialItems)
      return
    }
    startTransition(() => router.refresh())
  }

  async function removeItem(id: string) {
    // UX audit #8: window.confirm → optimistic remove + toast undo.
    // 사용자 1번 클릭으로 즉시 삭제, 4초 동안 '되돌리기' 버튼 — 실수 회복 가능.
    setBusyId(id)
    const prev = items
    const removed = items.find((i) => i.id === id)
    if (!removed) return
    setItems((p) => p.filter((i) => i.id !== id))

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.warning('로그인이 필요해요')
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
      toast.error('삭제하지 못했어요')
      setItems(prev)
      return
    }
    toast.success('장바구니에서 뺐어요', {
      action: {
        label: '되돌리기',
        onClick: async () => {
          // 다시 cart_items insert. 실패 시 toast.error.
          const { error: insErr } = await supabase
            .from('cart_items')
            .insert({
              user_id: user.id,
              product_id: removed.product.id,
              quantity: removed.quantity,
            })
          if (insErr) {
            toast.error('되돌리지 못했어요. 다시 추가해 주세요')
            return
          }
          startTransition(() => router.refresh())
        },
      },
    })
    startTransition(() => router.refresh())
  }

  return (
    <ul className="space-y-2.5 md:space-y-3">
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
            className="bg-white overflow-hidden"
            style={{
              borderRadius: 22,
              boxShadow: '0 2px 8px rgba(26,20,12,0.04), 0 8px 20px rgba(26,20,12,0.04)',
            }}
          >
            <div className="flex gap-3 p-3 md:gap-5 md:p-5">
              <Link
                href={`/products/${row.product.slug}`}
                className="shrink-0 w-20 h-20 md:w-28 md:h-28 overflow-hidden relative"
                style={{ borderRadius: 16, background: '#fbf3df' }}
              >
                {row.product.image_url ? (
                  <Image
                    src={row.product.image_url}
                    alt={row.product.name}
                    fill
                    sizes="(max-width: 768px) 80px, 112px"
                    placeholder="blur"
                    blurDataURL={BLUR_BG2}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag
                      className="w-5 h-5 md:w-7 md:h-7 text-muted"
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
                      className="text-[12px] md:text-[15px] text-text font-bold leading-snug line-clamp-2"
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
                    className="shrink-0 w-10 h-10 -mr-2 -mt-1 flex items-center justify-center rounded-full text-muted hover:text-sale hover:bg-bg transition disabled:opacity-40"
                    aria-label="삭제"
                  >
                    <X className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>

                <div className="mt-auto pt-2 md:pt-3 flex items-end justify-between">
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
                      className="w-10 h-10 md:w-10 md:h-10 flex items-center justify-center text-text font-bold text-base disabled:opacity-30 active:scale-90 transition"
                      aria-label="수량 감소"
                    >
                      −
                    </button>
                    <span className="w-8 md:w-10 text-center text-[13px] md:text-[14px] font-bold text-text">
                      {row.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(row.id, row.quantity + 1)}
                      disabled={isBusy || rowSoldOut || row.quantity >= maxQ}
                      className="w-10 h-10 md:w-10 md:h-10 flex items-center justify-center text-text font-bold text-base disabled:opacity-30 active:scale-90 transition"
                      aria-label="수량 증가"
                    >
                      +
                    </button>
                  </div>

                  {/* 가격 */}
                  <div className="text-right">
                    {hasSale && (
                      <div className="text-[9px] md:text-[11px] text-muted line-through leading-none">
                        {(row.product.price * row.quantity).toLocaleString()}원
                      </div>
                    )}
                    <div className="flex items-baseline gap-0.5 mt-0.5">
                      <span className="text-[14px] md:text-[18px] font-black text-terracotta">
                        {lineTotal.toLocaleString()}
                      </span>
                      <span className="text-[10px] md:text-[12px] text-muted">원</span>
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
