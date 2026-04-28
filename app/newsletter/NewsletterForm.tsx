'use client'

import { useState } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'

/**
 * NewsletterForm — 이메일 입력 + 마케팅 수신 동의 후 submit.
 *
 * 1차는 mailto-fallback 스타일: 서버 API 가 준비되면 fetch('/api/newsletter')
 * 로 교체. 지금은 사용자 메일 클라이언트로 “구독 신청” 메일을 열어 보낸다 —
 * 운영자가 받아서 수동으로 list 추가.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isValidEmail(email)) {
      setError('올바른 이메일 주소를 입력해 주세요')
      return
    }
    if (!agreed) {
      setError('마케팅 정보 수신 동의에 체크해 주세요')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'web' }),
      })
      const data: {
        ok?: boolean
        code?: string
        message?: string
        alreadySubscribed?: boolean
      } = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.message ?? '신청에 실패했어요. 잠시 후 다시 시도해 주세요.')
        return
      }
      setDone(true)
    } catch {
      setError('네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mt-5 md:mt-7 flex items-center gap-3">
        <span
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--moss)', color: 'var(--bg)' }}
        >
          <Check className="w-4 h-4" strokeWidth={3} />
        </span>
        <p
          className="text-[12.5px] md:text-[14px]"
          style={{ color: 'var(--bg)' }}
        >
          신청해 주셔서 감사해요. 메일 클라이언트가 열리면 그대로 보내주시면
          됩니다.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 md:mt-7 flex flex-col gap-3 md:gap-4"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="hello@example.com"
        autoComplete="email"
        inputMode="email"
        className="w-full h-12 md:h-14 px-4 md:px-5 rounded-xl text-[13px] md:text-[15px] focus:outline-none transition"
        style={{
          background: 'rgba(245,240,230,0.08)',
          color: 'var(--bg)',
          border: '1px solid rgba(245,240,230,0.18)',
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = 'var(--gold)')
        }
        onBlur={(e) =>
          (e.currentTarget.style.borderColor = 'rgba(245,240,230,0.18)')
        }
      />

      <label
        className="flex items-start gap-2.5 cursor-pointer text-[11.5px] md:text-[13px] leading-relaxed"
        style={{ color: 'rgba(245,240,230,0.78)' }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 shrink-0"
          style={{ accentColor: 'var(--gold)' }}
        />
        <span>
          마케팅 정보 수신에 동의합니다. (월 1회 발송 · 언제든 구독 해지 가능)
        </span>
      </label>

      {error && (
        <p
          className="inline-flex items-start gap-1.5 text-[11.5px] md:text-[13px] font-bold"
          style={{ color: '#FFB68A' }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2.25} />
          <span>{error}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 mt-1 md:mt-2 px-6 py-3 md:py-3.5 rounded-full text-[13px] md:text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-60"
        style={{
          background: 'var(--gold)',
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
        }}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
            전송 준비 중...
          </>
        ) : (
          '구독 신청하기'
        )}
      </button>
    </form>
  )
}
