'use client'

import { useState } from 'react'

/**
 * NewsletterForm — 이메일 입력 + 마케팅 수신 동의 후 서버로 submit.
 *
 * POST `/api/newsletter` ({ email, source: 'web' }) 로 구독 신청 — 서버가
 * 이메일 검증·중복 처리·구독 저장을 담당한다.
 * (옛 mailto-fallback 방식[운영자 수동 list 추가]은 API 구축 후 폐기됨.)
 *
 * 모양은 웹 시안 WEB-C13(2026-10-10 웹 리뉴얼) — 회색 칸 안 이메일 칸·동의 체크·검은 버튼. 동작(검사·동의·API)은 그대로.
 * 회색 칸(#F6F4F5) 위에 놓이므로 입력칸은 흰 바탕. 보낸 뒤·오류 모양은 시안에 없어 문의 양식(app/contact/ContactForm)과 맞췄다.
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
      setError('잠시 네트워크가 불안정한 것 같아요. 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    // 보낸 뒤 — 시안에 없어 문의 양식의 보낸 뒤(C18b)와 같은 말투: 2px 먹선 칸 · 검은 동그라미 체크.
    return (
      <div
        role="status"
        style={{
          marginTop: 18,
          padding: '18px 16px',
          borderRadius: 4,
          border: '2px solid #141414',
          background: '#FFFFFF',
          display: 'grid',
          gridTemplateColumns: '44px 1fr',
          columnGap: 12,
          alignItems: 'center',
        }}
      >
        <span
          aria-hidden
          style={{ width: 44, height: 44, borderRadius: 22, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#141414' }}>
          <strong style={{ fontWeight: 800 }}>확인 메일을 보냈어요.</strong> 메일의 링크를 눌러 구독을 완료해 주세요.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 시안 C13 — 이메일 이름표 위, 높이 56 · 1.5px 회색 테 · 흰 바탕 · 18px */}
      <label style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>이메일</span>
        <input
          type="email"
          aria-label="이메일 주소"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hello@example.com"
          autoComplete="email"
          inputMode="email"
          style={{
            height: 56,
            boxSizing: 'border-box',
            padding: '0 14px',
            borderRadius: 4,
            border: '1.5px solid #8A8A8A',
            background: '#FFFFFF',
            fontFamily: 'inherit',
            fontSize: 18,
            color: '#141414',
          }}
        />
      </label>

      {/* 동의 체크 — 26px 상자(먹색), 줄 전체를 눌러도 체크된다. */}
      <label
        style={{
          marginTop: 14,
          minHeight: 52,
          display: 'grid',
          gridTemplateColumns: '38px 1fr',
          alignItems: 'center',
          fontSize: 16,
          fontWeight: 700,
          lineHeight: 1.5,
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ margin: 0, width: 26, height: 26, accentColor: '#141414' }}
        />
        <span>마케팅 정보 수신에 동의해요 (월 1회 발송)</span>
      </label>

      {error && (
        <p
          role="alert"
          style={{ margin: '10px 0 0', padding: '12px 14px', borderRadius: 4, background: '#FDECEA', color: '#8A1F11', fontSize: 15, fontWeight: 700, lineHeight: 1.55 }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          marginTop: 14,
          height: 60,
          border: 0,
          borderRadius: 4,
          background: '#141414',
          color: '#FFFFFF',
          fontFamily: 'inherit',
          fontSize: 19,
          fontWeight: 800,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.5 : 1,
        }}
      >
        {submitting ? '전송 준비 중...' : '구독 신청하기'}
      </button>
    </form>
  )
}
