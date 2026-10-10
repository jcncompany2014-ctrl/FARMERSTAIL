'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * /contact 의 1:1 문의 폼.
 *
 * - 4필드: 이름, 이메일, 카테고리, 메시지.
 * - honeypot 필드 "website" 는 hidden — 봇이 채우면 서버에서 차단.
 * - 제출 후 success state 로 전환 (잠시 후 자동 reset 없음 — 사용자가 다음
 *   행동 선택).
 * - 모양은 웹 시안 WEB-C18(양식)·C18b(보낸 뒤) — 2026-10-10 웹 리뉴얼. 동작(검사·한도·honeypot·프리필)은 그대로.
 */

const CATEGORIES = [
  { value: 'product', label: '제품·영양 문의' },
  { value: 'order', label: '주문·배송' },
  { value: 'subscription', label: '정기배송' },
  { value: 'refund', label: '반품·환불' },
  { value: 'partnership', label: '제휴·도매' },
  { value: 'other', label: '기타' },
] as const

type Status = 'idle' | 'submitting' | 'success' | 'error'

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  // R91-B F-2 (D7): CancelOrderButton 의 VA 환불 deeplink 가 ?topic=va_refund
  // &order_id=... 로 진입 시 category + message 프리필 → 사용자 입력 부담 ↓.
  const searchParams = useSearchParams()
  const topic = searchParams.get('topic') ?? ''
  const orderId = searchParams.get('order_id') ?? ''
  const isVaRefund = topic === 'va_refund'
  const defaultCategory = isVaRefund ? 'refund' : 'product'
  const defaultMessage = isVaRefund
    ? `[가상계좌 환불 신청]\n주문번호: ${orderId}\n\n환불받으실 계좌 정보를 적어 주세요:\n- 은행명:\n- 계좌번호:\n- 예금주명:\n\n추가 메모(선택):\n`
    : ''

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'submitting') return

    const form = e.currentTarget
    const data = new FormData(form)

    // honeypot — 봇이 hidden field "website" 를 채우면 silently skip
    if (data.get('website')) {
      setStatus('success')
      return
    }

    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      category: String(data.get('category') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
    }

    if (!payload.name || !payload.email || !payload.message) {
      setStatus('error')
      setErrorMsg('이름·이메일·메시지를 모두 입력해 주세요.')
      return
    }
    if (payload.message.length < 10) {
      setStatus('error')
      setErrorMsg('메시지를 10자 이상 작성해 주세요.')
      return
    }

    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 429) {
        setStatus('error')
        setErrorMsg(
          '잠시 후 다시 시도해 주세요. (요청이 너무 많아요 — 1시간 5건 한도)',
        )
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setStatus('error')
        setErrorMsg(
          body.error ??
            '전송에 실패했어요. 잠시 후 다시 시도하거나 이메일로 보내주세요.',
        )
        return
      }
      setStatus('success')
      form.reset()
    } catch {
      setStatus('error')
      setErrorMsg('네트워크가 불안정해요. 잠시 후 다시 시도해 주세요.')
    }
  }

  if (status === 'success') {
    // 시안 C18b — 2px 먹선 칸 · 검은 동그라미 체크 · 포스터 글꼴 한 줄.
    return (
      <div
        role="status"
        style={{
          padding: '32px 20px 28px',
          borderRadius: 4,
          border: '2px solid #141414',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 12,
        }}
      >
        <span
          aria-hidden
          style={{ width: 60, height: 60, borderRadius: 30, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <strong className="d" style={{ fontSize: 28, fontWeight: 400, lineHeight: 1.2 }}>
          메시지 잘 받았어요
        </strong>
        <span style={{ fontSize: 17, lineHeight: 1.65, color: '#3D3D3D' }}>
          영업일에는 24시간 안에, 가능하면 더 빨리 답변드릴게요. 적어 주신 이메일로 접수 확인 메일도 보냈어요.
        </span>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          style={{
            marginTop: 6,
            height: 48,
            padding: '0 8px',
            border: 0,
            background: 'transparent',
            color: '#141414',
            fontSize: 17,
            fontWeight: 800,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            cursor: 'pointer',
          }}
        >
          다른 문의 보내기
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="이름" name="name" required maxLength={40} placeholder="홍길동" autoComplete="name" />
      <Field
        label="이메일"
        name="email"
        type="email"
        required
        maxLength={120}
        placeholder="story@example.com"
        autoComplete="email"
        inputMode="email"
      />

      <div style={FIELD_WRAP}>
        <label htmlFor="ft-category" style={LABEL}>
          문의 종류
        </label>
        <span style={{ position: 'relative', display: 'block' }}>
          <select
            id="ft-category"
            name="category"
            defaultValue={defaultCategory}
            style={{ ...CONTROL, width: '100%', padding: '0 44px 0 14px', background: '#FFFFFF', appearance: 'none', WebkitAppearance: 'none' }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#141414"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            style={{ position: 'absolute', right: 14, top: 18, pointerEvents: 'none' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>

      <div style={FIELD_WRAP}>
        <label htmlFor="ft-message" style={LABEL}>
          메시지
        </label>
        <textarea
          id="ft-message"
          name="message"
          required
          minLength={10}
          maxLength={3000}
          rows={6}
          defaultValue={defaultMessage}
          placeholder="자세한 내용을 적어 주세요 (10자 이상)"
          style={{ ...CONTROL, height: 'auto', minHeight: 160, padding: 14, lineHeight: 1.6, resize: 'vertical' }}
        />
      </div>

      {/* honeypot — visible 0 size, name="website" */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="ft-website">웹사이트 (작성하지 마세요)</label>
        <input id="ft-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status === 'error' && errorMsg && (
        <p
          role="alert"
          style={{ margin: 0, padding: '12px 14px', background: '#FDECEA', color: '#8A1F11', borderRadius: 4, fontSize: 15, fontWeight: 700, lineHeight: 1.55 }}
        >
          {errorMsg}
        </p>
      )}

      <span style={{ fontSize: 15, lineHeight: 1.55, color: '#595959' }}>
        적어 주신 내용은 개인정보처리방침에 따라 문의에 답하는 데만 써요.
      </span>
      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          height: 60,
          border: 0,
          borderRadius: 4,
          background: '#141414',
          color: '#FFFFFF',
          fontSize: 19,
          fontWeight: 800,
          cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
          opacity: status === 'submitting' ? 0.5 : 1,
        }}
      >
        {status === 'submitting' ? '보내는 중…' : '메시지 보내기'}
      </button>
    </form>
  )
}

/** 시안 C18 입력칸 — 높이 56 · 1.5px 회색 테 · 모서리 4 · 18px. */
const CONTROL: React.CSSProperties = {
  height: 56,
  boxSizing: 'border-box',
  padding: '0 14px',
  borderRadius: 4,
  border: '1.5px solid #8A8A8A',
  fontFamily: 'inherit',
  fontSize: 18,
  color: '#141414',
}
const FIELD_WRAP: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 }
const LABEL: React.CSSProperties = { fontSize: 16, fontWeight: 800 }

function Field({
  label,
  name,
  type = 'text',
  required,
  maxLength,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  maxLength?: number
  placeholder?: string
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'tel' | 'numeric'
}) {
  const id = `ft-${name}`
  return (
    <div style={FIELD_WRAP}>
      <label htmlFor={id} style={LABEL}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        style={CONTROL}
      />
    </div>
  )
}
