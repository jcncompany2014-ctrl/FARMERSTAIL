'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cleanupPushOnLogout } from '@/lib/capacitor'

/** look='web' — 웹 계정 화면(웹 시안 WEB-A19, 2026-10-10 웹 리뉴얼): 높이 48 · 회색 테 · 모서리 4. 기본은 예전 모양. */
export default function LogoutButton({ look }: { look?: 'web' } = {}) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    // 푸시 정리(네이티브 토큰 + 웹 구독) — signOut 후엔 세션이 없어 못 지운다.
    await cleanupPushOnLogout()
    // ★서버 로그아웃이 실패해도(오프라인 등) 이 기기 세션은 확실히 지운다(2026-09-26 점검 7차).
    //   예전엔 오류를 안 봐서 로그인 화면으로 보냈는데 세션이 살아 있었다(푸시 토큰만 지워진 채).
    const { error: signOutErr } = await supabase.auth.signOut()
    if (signOutErr) await supabase.auth.signOut({ scope: 'local' })
    setBusy(false)
    router.push('/')
    router.refresh()
  }

  if (look === 'web') {
    return (
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        style={{
          height: 48,
          padding: '0 16px',
          borderRadius: 4,
          border: '1.5px solid #8A8A8A',
          background: '#FFFFFF',
          color: '#3D3D3D',
          fontFamily: 'inherit',
          fontSize: 16,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.25} /> : <LogOut className="w-4 h-4" strokeWidth={2.25} />}
        로그아웃
      </button>
    )
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
