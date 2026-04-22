'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Consumes a `pending_referral` stashed in sessionStorage during the
 * signup flow and redeems it via RPC the first time the user lands on
 * a page that mounts this component (typically /dashboard).
 *
 * Exists because the Kakao OAuth roundtrip throws away the form state
 * from /signup, so we can't redeem inline. sessionStorage survives the
 * callback hop on the same origin.
 *
 * Silent on failure — if the RPC returns "invalid code" / "already
 * redeemed" / "cannot redeem own code", we just quietly drop the key.
 * The user is already in the app; a noisy error is more harm than help.
 */
export default function ReferralAutoRedeemer() {
  const supabase = createClient()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let code: string | null = null
    try {
      code = sessionStorage.getItem('pending_referral')
    } catch {
      return
    }
    if (!code) return

    // Burn the key immediately so we don't retry on every remount
    // (dashboard can unmount/remount during tab switches).
    try {
      sessionStorage.removeItem('pending_referral')
    } catch {
      /* noop */
    }

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.rpc('redeem_referral_code', {
        input_code: code,
      })
      if (error) return
      const bonus =
        (data as { referee_bonus?: number } | null)?.referee_bonus ?? 3000
      setToast(`친구 초대 코드 ${bonus.toLocaleString()}P가 적립되었어요!`)
    })()
  }, [supabase])

  if (!toast) return null

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 max-w-sm w-[calc(100%-32px)] bg-text text-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4"
      role="status"
    >
      <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-white" strokeWidth={2.25} />
      </div>
      <p className="flex-1 text-[12px] font-semibold leading-snug">{toast}</p>
      <button
        type="button"
        onClick={() => setToast(null)}
        aria-label="닫기"
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition"
      >
        <X className="w-3.5 h-3.5 text-white/70" strokeWidth={2.25} />
      </button>
    </div>
  )
}
