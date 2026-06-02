'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function WishlistRemoveButton({
  productId,
}: {
  productId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)

  async function remove() {
    if (busy) return
    setBusy(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setBusy(false)
      router.push('/login')
      return
    }
    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', productId)
    if (error) {
      // 실패 시 버튼 영구잠금 방지 — 하트 유지(목록 그대로).
      setBusy(false)
      return
    }
    router.refresh()
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      aria-label="찜 해제"
      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-bg-3/95 backdrop-blur border border-rule text-terracotta flex items-center justify-center shadow-sm hover:bg-bg-3 active:scale-95 transition disabled:opacity-50 z-10"
    >
      <Heart className="w-4 h-4 fill-terracotta" strokeWidth={2} />
    </button>
  )
}
