'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'

/**
 * /contact 의 1:1 문의 폼.
 *
 * - 4필드: 이름, 이메일, 카테고리, 메시지.
 * - honeypot 필드 "website" 는 hidden — 봇이 채우면 서버에서 차단.
 * - 제출 후 success state 로 전환 (잠시 후 자동 reset 없음 — 사용자가 다음
 *   행동 선택).
 * - 톤은 editorial — paper-tone + serif heading.
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
    return (
      <div className="text-center py-6 md:py-10">
        <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full mb-4 md:mb-5"
          style={{ background: 'color-mix(in srgb, var(--fd-green) 16%, transparent)' }}>
          <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2} color="var(--fd-green)" />
        </div>
        <h3
          className="text-[18px] md:text-[24px] font-black mb-2 md:mb-3"
          style={{ color: 'var(--fd-pine)', letterSpacing: '-0.02em' }}
        >
          메시지 잘 받았어요.
        </h3>
        <p
          className="text-[12.5px] md:text-[14px] leading-relaxed mb-5 md:mb-6"
          style={{ color: 'var(--fd-muted)' }}
        >
          평일 영업일 24시간 이내, 가능하면 더 빨리 답변드릴게요.
          <br />입력하신 이메일로 접수 확인 메일도 함께 보냈어요.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="text-[12px] md:text-[13px] font-bold underline underline-offset-2 hover:opacity-70"
          style={{ color: 'var(--fd-coral-text)' }}
        >
          다른 문의 보내기
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
      <div className="grid md:grid-cols-2 gap-3 md:gap-4">
        <Field
          label="이름"
          name="name"
          required
          maxLength={40}
          placeholder="안성민"
          autoComplete="name"
        />
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
      </div>

      <div>
        <Label htmlFor="ft-category">문의 카테고리</Label>
        <select
          id="ft-category"
          name="category"
          defaultValue={defaultCategory}
          className="w-full px-3 py-2.5 md:py-3 rounded text-[13px] md:text-[14px] bg-white focus:outline-none transition"
          style={{
            boxShadow: 'inset 0 0 0 1px var(--fd-line)',
            color: 'var(--fd-pine)',
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="ft-message">메시지</Label>
        <textarea
          id="ft-message"
          name="message"
          required
          minLength={10}
          maxLength={3000}
          rows={6}
          defaultValue={defaultMessage}
          placeholder="자세한 내용을 적어 주세요. (10자 이상)"
          className="w-full px-3 py-2.5 md:py-3 rounded text-[13px] md:text-[14px] bg-white focus:outline-none transition resize-y leading-relaxed"
          style={{
            boxShadow: 'inset 0 0 0 1px var(--fd-line)',
            color: 'var(--fd-pine)',
            minHeight: 140,
          }}
        />
      </div>

      {/* honeypot — visible 0 size, name="website" */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="ft-website">웹사이트 (작성하지 마세요)</label>
        <input
          id="ft-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {status === 'error' && errorMsg && (
        <p
          className="text-[11.5px] md:text-[12.5px] leading-relaxed"
          style={{ color: 'var(--sale)' }}
          role="alert"
        >
          {errorMsg}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p
          className="text-[10.5px] md:text-[11.5px] leading-relaxed flex-1"
          style={{ color: 'var(--fd-muted)' }}
        >
          개인정보 처리방침에 따라 문의 응대 목적에만 사용됩니다.
        </p>
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="px-6 py-2.5 md:px-8 md:py-3.5 rounded-full text-[12px] md:text-[14px] font-bold transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          style={{
            background: 'var(--fd-pine)',
            color: '#FFFFFF',
            letterSpacing: '-0.01em',
          }}
        >
          {status === 'submitting' ? '보내는 중…' : '메시지 보내기'}
        </button>
      </div>
    </form>
  )
}

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
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="w-full px-3 py-2.5 md:py-3 rounded text-[13px] md:text-[14px] bg-white focus:outline-none transition"
        style={{
          boxShadow: 'inset 0 0 0 1px var(--fd-line)',
          color: 'var(--fd-pine)',
        }}
      />
    </div>
  )
}

function Label({
  htmlFor,
  children,
}: {
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block mb-1.5 md:mb-2 text-[11px] md:text-[12px] font-bold"
      style={{
        color: 'var(--fd-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </label>
  )
}
