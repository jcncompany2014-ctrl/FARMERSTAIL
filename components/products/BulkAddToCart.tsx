'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { trackAddToCart } from '@/lib/analytics'

/**
 * BulkAddToCart — 컬렉션 전체 상품을 한 번에 장바구니에 담기.
 *
 * /collections/[slug] 의 "이 컬렉션 전체 담기" 버튼이 사용. 비로그인이면
 * /login 으로 redirect, 로그인이면 maybeSingle 로 변동 누적 + 토스트.
 *
 * 재고 0 인 상품은 자동 skip — 토스트로 "N개 중 K개 담겼어요" 알림.
 */

type BulkProduct = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  stock: number
  category?: string | null
}

export default function BulkAddToCart({
  products,
  collectionTitle,
}: {
  products: BulkProduct[]
  collectionTitle: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 품절 / 비활성 상품 미리 제외
  const eligible = products.filter((p) => p.stock > 0)
  const skipped = products.length - eligible.length

  async function handleClick() {
    if (busy || done) return
    if (eligible.length === 0) {
      setError('담을 수 있는 상품이 없어요')
      return
    }
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    // upsert_cart_item RPC — atomic SELECT FOR UPDATE + UPDATE-or-INSERT.
    // race-safe + 한 번 호출에 1 row 누적. 컬렉션 N 개 묶음 추가는 N 번 호출.
    let added = 0
    for (const p of eligible) {
      const cap = Math.min(p.stock, 1)
      if (cap <= 0) continue

      const { error: rpcErr } = await supabase.rpc('upsert_cart_item', {
        p_user_id: user.id,
        p_product_id: p.id,
        p_variant_id: null,
        p_quantity: cap,
        p_max_qty: p.stock,
      })
      if (!rpcErr) added += 1

      trackAddToCart({
        item_id: p.id,
        item_name: p.name,
        price: p.sale_price ?? p.price,
        quantity: cap,
        item_category: p.category ?? undefined,
      })
    }

    // 미니카트 토스트 (한 번만)
    if (added > 0) {
      try {
        window.dispatchEvent(
          new CustomEvent('ft:cart:add', {
            detail: {
              productName: `${collectionTitle} 컬렉션`,
              quantity: added,
              imageUrl: null,
            },
          }),
        )
      } catch {
        /* noop */
      }
    }

    setBusy(false)
    setDone(true)
    setTimeout(() => setDone(false), 2500)

    if (added === 0) {
      setError('이미 모두 담긴 상품들이에요')
    } else if (skipped > 0) {
      setError(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || eligible.length === 0}
        className="inline-flex items-center justify-center gap-2 px-5 py-3 md:py-3.5 rounded-full font-bold text-[13px] md:text-[14px] transition active:scale-[0.98] disabled:opacity-60"
        style={{
          background: done ? 'var(--moss)' : 'var(--ink)',
          color: 'var(--bg)',
          letterSpacing: '-0.01em',
          boxShadow: '0 4px 14px rgba(30,26,20,0.22)',
        }}
      >
        {done ? (
          <>
            <Check className="w-4 h-4" strokeWidth={3} />
            컬렉션 담겼어요
          </>
        ) : busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
            담는 중...
          </>
        ) : (
          <>
            <ShoppingBag className="w-4 h-4" strokeWidth={2.25} />이 컬렉션 전체
            담기 ({eligible.length}개)
          </>
        )}
      </button>
      {skipped > 0 && (
        <p
          className="text-[10.5px] md:text-[11.5px]"
          style={{ color: 'var(--muted)' }}
        >
          ※ 품절 {skipped}개는 제외됩니다
        </p>
      )}
      {error && (
        <p
          className="text-[10.5px] md:text-[11.5px] font-bold"
          style={{ color: 'var(--sale)' }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
