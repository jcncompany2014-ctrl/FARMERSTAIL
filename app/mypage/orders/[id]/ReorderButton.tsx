'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Repeat, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type Item = { product_id: string; quantity: number }

/**
 * "재주문" — past order 상품을 현재 장바구니에 합치고 /cart로 이동.
 * product_id 중복 시 수량을 합산한다.
 */
export default function ReorderButton({ items }: { items: Item[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const toast = useToast()

  async function handleReorder() {
    if (items.length === 0) return
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      // loading state 정리 — 미로그인 redirect 후 폼이 다시 보일 수 있음
      setLoading(false)
      router.push('/login?next=/cart')
      return
    }

    // 기존 카트와 합치기 위해 현재 사용자 카트 조회
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, product_id, quantity')
      .eq('user_id', user.id)

    const byProd = new Map<string, { id: string; quantity: number }>()
    for (const row of existing ?? []) {
      byProd.set(row.product_id, { id: row.id, quantity: row.quantity })
    }

    const updates: { id: string; quantity: number }[] = []
    const inserts: { user_id: string; product_id: string; quantity: number }[] = []

    for (const it of items) {
      if (!it.product_id) continue
      const prev = byProd.get(it.product_id)
      if (prev) {
        updates.push({ id: prev.id, quantity: prev.quantity + it.quantity })
      } else {
        inserts.push({
          user_id: user.id,
          product_id: it.product_id,
          quantity: it.quantity,
        })
      }
    }

    // update 병렬 실행
    await Promise.all(
      updates.map((u) =>
        supabase
          .from('cart_items')
          .update({ quantity: u.quantity })
          .eq('id', u.id)
          .eq('user_id', user.id)
      )
    )

    if (inserts.length > 0) {
      const { error } = await supabase.from('cart_items').insert(inserts)
      if (error) {
        toast.error('재주문 실패: ' + error.message)
        setLoading(false)
        return
      }
    }

    // 카트 카운터 (chrome / 미니 토스트) 즉시 반영을 위한 이벤트
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ft:cart:add'))
    }

    router.push('/cart')
    router.refresh()
  }

  return (
    <button
      onClick={handleReorder}
      disabled={loading || items.length === 0}
      className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-text text-white text-[13px] font-black shadow-sm hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
          장바구니에 담는 중...
        </>
      ) : (
        <>
          <Repeat className="w-4 h-4" strokeWidth={2.5} />
          다시 주문하기
        </>
      )}
    </button>
  )
}
