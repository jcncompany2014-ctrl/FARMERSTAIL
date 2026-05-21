'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ShoppingBag, Minus, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { BLUR_BG2 } from '@/lib/ui/blur'
import { stockState, maxOrderable, stockMessage } from '@/lib/products/stock'

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
    /** 모바일 핸드오프 — 카드에 카테고리 태그 표시 */
    category?: string | null
    /** 모바일 핸드오프 — name 아래 sub-info */
    short_description?: string | null
    /** 모바일 핸드오프 — 정기배송 가능 SKU 표시 */
    is_subscribable?: boolean | null
  }
}

// 카테고리 라벨 → 한글 + tint 색
const CAT_META: Record<string, { label: string; bg: string; fg: string }> = {
  meal: { label: '화식', bg: 'rgba(93, 111, 63, 0.16)', fg: '#5d6f3f' },
  topper: { label: '토퍼', bg: 'rgba(232, 168, 46, 0.18)', fg: '#a87520' },
  treat: { label: '간식', bg: 'rgba(232, 168, 46, 0.18)', fg: '#a87520' },
  set: { label: '체험팩', bg: 'rgba(220, 83, 42, 0.16)', fg: '#dc532a' },
  supplement: { label: '영양제', bg: 'rgba(63, 127, 184, 0.14)', fg: '#3f7fb8' },
  premium: { label: '프리미엄', bg: 'rgba(232, 168, 46, 0.18)', fg: '#a87520' },
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
      toast.warning('품절 상품이에요. 장바구니에서 제거해 주세요.')
      return
    }
    if (next > maxQ) {
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
    <ul className="space-y-2.5 md:space-y-3 px-4 md:px-0">
      {items.map((row) => {
        const price = row.product.sale_price ?? row.product.price
        const hasSale = row.product.sale_price !== null
        const discountPct = hasSale
          ? Math.round(
              ((row.product.price - row.product.sale_price!) /
                row.product.price) *
                100
            )
          : 0
        const lineTotal = price * row.quantity
        const isBusy = busyId === row.id
        const rowStock = stockState(row.product.stock)
        const rowSoldOut = rowStock === 'out'
        const maxQ = maxOrderable(row.product.stock)
        const cat = row.product.category
          ? CAT_META[row.product.category] ?? null
          : null
        const subInfo = row.product.short_description ?? ''

        return (
          <li
            key={row.id}
            className="bg-white overflow-hidden"
            style={{
              borderRadius: 20,
              boxShadow: '0 2px 8px rgba(26,20,12,0.04), 0 8px 20px rgba(26,20,12,0.04)',
            }}
          >
            <div
              className="grid p-3 md:p-4 gap-3 md:gap-4 items-start"
              style={{ gridTemplateColumns: '92px 1fr' }}
            >
              {/* Photo */}
              <Link
                href={`/products/${row.product.slug}`}
                className="block overflow-hidden relative"
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 14,
                  background: '#fbf3df',
                }}
              >
                {row.product.image_url ? (
                  <Image
                    src={row.product.image_url}
                    alt={row.product.name}
                    fill
                    sizes="92px"
                    placeholder="blur"
                    blurDataURL={BLUR_BG2}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag
                      className="w-6 h-6 text-muted"
                      strokeWidth={1.5}
                    />
                  </div>
                )}
              </Link>

              {/* Content */}
              <div className="flex flex-col min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {/* badges row */}
                    <div className="flex gap-1.5 flex-wrap items-center mb-1">
                      {row.product.is_subscribable && (
                        <span
                          className="inline-flex items-center font-bold"
                          style={{
                            padding: '2px 7px',
                            background: 'rgba(93, 111, 63, 0.16)',
                            color: '#5d6f3f',
                            borderRadius: 6,
                            fontSize: 9.5,
                            letterSpacing: 0.2,
                          }}
                        >
                          정기배송
                        </span>
                      )}
                      {cat && (
                        <span
                          className="inline-flex items-center font-bold"
                          style={{
                            padding: '2px 7px',
                            background: cat.bg,
                            color: cat.fg,
                            borderRadius: 6,
                            fontSize: 9.5,
                            letterSpacing: 0.2,
                          }}
                        >
                          {cat.label}
                        </span>
                      )}
                      {hasSale && discountPct > 0 && (
                        <span
                          className="inline-flex items-center font-bold"
                          style={{
                            padding: '2px 7px',
                            background: '#dc532a',
                            color: '#fff',
                            borderRadius: 6,
                            fontSize: 9.5,
                            letterSpacing: 0.2,
                          }}
                        >
                          −{discountPct}%
                        </span>
                      )}
                    </div>

                    {/* name */}
                    <Link
                      href={`/products/${row.product.slug}`}
                      className="font-['Archivo_Black'] block leading-tight"
                      style={{
                        fontSize: 13,
                        color: '#1a140c',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {row.product.name}
                    </Link>

                    {/* sub info */}
                    {subInfo && (
                      <div
                        className="mt-1 truncate"
                        style={{ fontSize: 10, color: '#7a6d5b' }}
                      >
                        {subInfo}
                      </div>
                    )}

                    {/* stock — plain red text (no badge) */}
                    {rowStock !== 'in_stock' && (
                      <div
                        className="mt-1 font-bold"
                        style={{ fontSize: 10.5, color: 'var(--sale)' }}
                      >
                        {rowSoldOut ? '품절' : stockMessage(row.product.stock)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(row.id)}
                    disabled={isBusy}
                    className="shrink-0 p-1 -mr-1 -mt-1 text-muted hover:text-sale transition disabled:opacity-40"
                    aria-label="삭제"
                  >
                    <X size={16} strokeWidth={2.2} />
                  </button>
                </div>

                {/* Qty stepper + price */}
                <div className="flex justify-between items-center mt-2.5">
                  <div
                    className={
                      'flex items-center p-0.5 ' +
                      (rowSoldOut ? 'opacity-50' : '')
                    }
                    style={{
                      background: '#fbf3df',
                      borderRadius: 14,
                    }}
                  >
                    <button
                      onClick={() => updateQty(row.id, row.quantity - 1)}
                      disabled={isBusy || row.quantity <= 1 || rowSoldOut}
                      className="flex items-center justify-center transition active:scale-90 disabled:opacity-30"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 12,
                        background: '#fff',
                        color: '#1a140c',
                      }}
                      aria-label="수량 감소"
                    >
                      <Minus size={14} strokeWidth={2.4} />
                    </button>
                    <span
                      className="text-center font-bold tabular-nums"
                      style={{
                        minWidth: 28,
                        padding: '0 8px',
                        fontSize: 13,
                        color: '#1a140c',
                      }}
                    >
                      {row.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(row.id, row.quantity + 1)}
                      disabled={isBusy || rowSoldOut || row.quantity >= maxQ}
                      className="flex items-center justify-center transition active:scale-90 disabled:opacity-30"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 12,
                        background: '#1a140c',
                        color: '#fff',
                      }}
                      aria-label="수량 증가"
                    >
                      <Plus size={14} strokeWidth={2.4} />
                    </button>
                  </div>

                  <div className="text-right">
                    {hasSale && (
                      <div
                        className="line-through leading-none tabular-nums"
                        style={{ fontSize: 9, color: '#7a6d5b' }}
                      >
                        {(row.product.price * row.quantity).toLocaleString()}원
                      </div>
                    )}
                    <div
                      className="font-['Archivo_Black'] mt-0.5 flex items-baseline gap-0.5 tabular-nums"
                      style={{ fontSize: 17, color: '#1a140c', lineHeight: 1 }}
                    >
                      {lineTotal.toLocaleString()}
                      <span style={{ fontSize: 11, color: '#7a6d5b' }}>원</span>
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
