'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resendConfirmationMessage } from '@/lib/auth/resend-confirmation'

/**
 * "인증 메일 다시 받기" — 가입 인증 메일 재발송 (2026-09-24 출시 전 점검).
 *
 * # 왜
 * 이메일 인증이 켜져 있는데 재발송 수단이 제품 어디에도 없었다. 게다가 로그인 화면은
 * `email_not_confirmed` 도 "이메일 또는 비밀번호가 올바르지 않아요"로 보여서,
 * 2026-09-10 실제 고객이 3분 동안 9번 막히다 '비밀번호 찾기'로 우회해 들어왔다
 * (Supabase 인증 로그로 확인). 메일이 스팸함에 갔거나 지웠을 때 나갈 문이 없었다.
 *
 * 로그인 화면(web+app 공유)과 가입 직후 "메일 보냈어요" 화면 두 곳이 쓴다 —
 * 스타일은 호출처 색을 받아 각 화면 톤을 그대로 따른다(웹 시각 불변).
 * Supabase 는 같은 주소 재발송을 60초에 한 번으로 막으므로 버튼도 60초 쉰다.
 */
const COOLDOWN_SEC = 60

export default function ResendConfirmationButton({
  email,
  color = 'var(--fd-muted)',
  className = '',
}: {
  email: string
  color?: string
  className?: string
}) {
  const [supabase] = useState(() => createClient())
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function resend() {
    const target = email.trim()
    if (!target || sending || cooldown > 0) return
    setSending(true)
    setNotice(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email: target })
    setSending(false)
    const msg = resendConfirmationMessage(error ? { status: error.status, code: error.code } : null)
    setNotice(msg)
    // 성공이든 한도 초과든 바로 다시 누르면 Supabase 가 거절한다 — 기다리게 한다.
    if (msg.ok || msg.rateLimited) setCooldown(COOLDOWN_SEC)
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={resend}
        disabled={sending || cooldown > 0 || !email.trim()}
        className="font-semibold underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
        style={{ color, minHeight: 44 }}
      >
        {sending
          ? '보내는 중...'
          : cooldown > 0
            ? `인증 메일 다시 받기 (${cooldown}초 후)`
            : '인증 메일 다시 받기'}
      </button>
      {notice && (
        <p role="status" className="mt-1 text-[12px] leading-relaxed" style={{ color }}>
          {notice.text}
        </p>
      )}
    </div>
  )
}
