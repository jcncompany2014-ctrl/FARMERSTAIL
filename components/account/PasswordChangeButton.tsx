'use client'

import { useState } from 'react'
import { Loader2, Check, AlertCircle, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * PasswordChangeButton — 비밀번호 재설정 메일 트리거.
 *
 * Supabase Auth 의 resetPasswordForEmail 을 호출. 사용자가 현재 비밀번호 없이
 * 변경할 수 있는 가장 안전한 방식 (재설정 링크가 인증된 메일함으로 가야 변경
 * 가능). redirectTo 는 /auth/callback?next=/account/profile 로 설정해
 * 링크 클릭 후 프로필 화면으로 돌아오게.
 */
export default function PasswordChangeButton({ email }: { email: string }) {
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!email) {
      setError('가입 이메일을 확인할 수 없어요')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback?next=/account/profile`
          : undefined
      const { error: authErr } = await supabase.auth.resetPasswordForEmail(
        email,
        redirectTo ? { redirectTo } : undefined,
      )
      if (authErr) {
        setError(authErr.message)
        return
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '발송 실패')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p
        className="inline-flex items-center gap-1.5 text-[11.5px] font-bold"
        style={{ color: 'var(--moss)' }}
      >
        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
        재설정 메일을 보냈어요. 받은 편지함을 확인해 주세요.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={send}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-bold transition active:scale-[0.97] disabled:opacity-60 self-start"
        style={{
          background: 'var(--ink)',
          color: 'var(--bg)',
          letterSpacing: '-0.01em',
        }}
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.25} />
        ) : (
          <KeyRound className="w-3.5 h-3.5" strokeWidth={2.25} />
        )}
        {busy ? '발송 중…' : '재설정 메일 받기'}
      </button>
      {error && (
        <p
          className="inline-flex items-start gap-1.5 text-[11px] font-bold"
          style={{ color: 'var(--terracotta)' }}
        >
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" strokeWidth={2.25} />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
