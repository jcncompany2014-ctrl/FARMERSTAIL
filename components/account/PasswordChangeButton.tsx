'use client'

import { useState } from 'react'
import { userFacingError } from '@/lib/error-message'
import { Loader2, Check, AlertCircle, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { V3 } from '@/lib/design/tokens'
import { outlineButton } from '@/components/v3/me/MeParts'
import { CheckIcon, KeyIcon } from '@/components/v3/me/MeIcons'

/**
 * PasswordChangeButton — 비밀번호 재설정 메일 트리거.
 *
 * Supabase Auth 의 resetPasswordForEmail 을 호출. 사용자가 현재 비밀번호 없이
 * 변경할 수 있는 가장 안전한 방식 (재설정 링크가 인증된 메일함으로 가야 변경
 * 가능). redirectTo 는 /auth/callback?next=/account/profile 로 설정해
 * 링크 클릭 후 프로필 화면으로 돌아오게.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M01): 웹과 같이 쓰는 부품이라 `variant='app'` 일 때만 앱 모양
 * (흰 바탕 1.5px 먹선 · 높이 52 · 열쇠 그림)으로 그린다. 기본 'web' 은 그대로. 보내기 로직은 같은 send().
 */
export default function PasswordChangeButton({
  email,
  variant = 'web',
}: {
  email: string
  /** 'app' = 앱 새 디자인 모양. 기본 'web'(웹 화면 그대로). */
  variant?: 'web' | 'app'
}) {
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
        // Supabase 원문('For security purposes, you can only request this after 42 seconds.')
        // 대신 한국어(2026-09-26 점검 7차).
        setError(
          /rate|seconds|too many/i.test(authErr.message)
            ? '보안을 위해 잠시 후 다시 요청해 주세요(1분에 한 번 보낼 수 있어요).'
            : '메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
        )
        return
      }
      setDone(true)
    } catch (err) {
      setError(userFacingError(err, '발송하지 못했어요'))
    } finally {
      setBusy(false)
    }
  }

  if (variant === 'app') {
    if (done) {
      return (
        <p role="status" style={{ margin: '4px 0 0', display: 'flex', gap: 6, fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: V3.ink }}>
          <CheckIcon size={18} strokeWidth={2.6} style={{ marginTop: 2 }} />
          <span>재설정 메일을 보냈어요. 받은 편지함을 확인해 주세요.</span>
        </p>
      )
    }
    return (
      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" onClick={send} disabled={busy} style={{ ...outlineButton(52, 16), width: '100%', opacity: busy ? 0.6 : 1 }}>
          <KeyIcon size={18} />
          {busy ? '보내는 중…' : '재설정 메일 받기'}
        </button>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: V3.sale }}>
            {error}
          </p>
        )}
      </div>
    )
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
