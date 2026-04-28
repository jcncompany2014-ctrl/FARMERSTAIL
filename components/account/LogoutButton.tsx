'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    await supabase.auth.signOut()
    setBusy(false)
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[12.5px] md:text-[13.5px] font-bold transition active:scale-[0.97] disabled:opacity-60"
      style={{
        background: 'transparent',
        color: 'var(--muted)',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
      }}
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.25} />
      ) : (
        <LogOut className="w-3.5 h-3.5" strokeWidth={2.25} />
      )}
      로그아웃
    </button>
  )
}
