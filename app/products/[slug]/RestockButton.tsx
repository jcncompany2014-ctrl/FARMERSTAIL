'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * 품절 상품 PDP 하단에 붙는 "재입고 알림 받기" 버튼.
 *
 * 재고가 0 인 경우에만 렌더한다고 가정한다 (부모에서 조건 분기).
 *
 * 상태 흐름
 *   idle  → subscribing → subscribed
 *   subscribed → unsubscribing → idle
 *
 * 로그인하지 않은 경우 첫 클릭에서 /login?next=... 로 보낸다.
 */
export default function RestockButton({
  productId,
  variantId,
}: {
  productId: string
  variantId: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 현재 구독 상태 로드. 로그인하지 않았으면 subscribed=false.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) setSubscribed(false)
        return
      }
      const q = supabase
        .from('restock_alerts')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .is('notified_at', null)
      const { data } = variantId
        ? await q.eq('variant_id', variantId).maybeSingle()
        : await q.is('variant_id', null).maybeSingle()
      if (mounted) setSubscribed(!!data)
    })()
    return () => {
      mounted = false
    }
  }, [supabase, productId, variantId])

  async function toggle() {
    if (loading) return
    setError(null)
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push(
        `/login?next=${encodeURIComponent(
          typeof window !== 'undefined' ? window.location.pathname : '/',
        )}`,
      )
      return
    }

    const method = subscribed ? 'DELETE' : 'POST'
    const res = await fetch('/api/restock', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, variantId }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.message ?? '요청 실패')
      return
    }
    setSubscribed(!subscribed)
  }

  if (subscribed === null) {
    return (
      <div className="w-full rounded-full bg-bg border border-rule h-[52px] flex items-center justify-center">
        <span className="text-[11px] text-muted">불러오는 중…</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`w-full py-4 rounded-full text-[14px] font-bold active:scale-[0.98] transition flex items-center justify-center gap-2 ${
          subscribed
            ? 'bg-moss text-white'
            : 'bg-ink text-bg'
        } disabled:opacity-60`}
        style={{ letterSpacing: '-0.01em' }}
      >
        {subscribed ? (
          <>
            <Check className="w-4 h-4" strokeWidth={2.5} />
            알림 받는 중 · 취소
          </>
        ) : loading ? (
          <>
            <BellRing className="w-4 h-4 animate-pulse" strokeWidth={2} />
            처리 중…
          </>
        ) : (
          <>
            <Bell className="w-4 h-4" strokeWidth={2} />
            재입고 알림 받기
          </>
        )}
      </button>
      {subscribed && (
        <p className="text-[11px] text-muted text-center leading-relaxed">
          재입고되면 이메일과 앱 알림으로 바로 알려드릴게요.
        </p>
      )}
      {error && (
        <p className="text-[11px] text-sale font-semibold text-center">
          {error}
        </p>
      )}
    </div>
  )
}
