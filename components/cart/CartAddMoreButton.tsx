'use client'

/**
 * CartAddMoreButton — ADD MORE 카드의 + 버튼 (장바구니에 1개 추가).
 *
 * supabase 직접 호출 — 이미 존재하면 quantity +1, 없으면 새 row insert.
 * 모바일 카트 화면에 머무는 상태에서 즉시 담을 수 있게 router.refresh().
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

export default function CartAddMoreButton({ productId }: { productId: string }) {
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  async function onAdd() {
    if (busy) return
    setBusy(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      toast.warning('로그인이 필요해요')
      router.push('/login?next=/cart')
      setBusy(false)
      return
    }

    // 기존 row 가 있는지 먼저 본다.
    const { data: existing } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id)
      if (error) {
        toast.error('담지 못했어요')
        setBusy(false)
        return
      }
    } else {
      const { error } = await supabase.from('cart_items').insert({
        user_id: user.id,
        product_id: productId,
        quantity: 1,
      })
      if (error) {
        toast.error('담지 못했어요')
        setBusy(false)
        return
      }
    }

    toast.success('장바구니에 담았어요')
    setBusy(false)
    startTransition(() => router.refresh())
  }

  return (
    <button
      onClick={onAdd}
      disabled={busy}
      className="flex items-center justify-center transition active:scale-90 disabled:opacity-40"
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        background: '#dc532a',
        color: '#fff',
      }}
      aria-label="장바구니에 담기"
    >
      <Plus size={14} color="#fff" strokeWidth={2.4} />
    </button>
  )
}
