'use client'

import { useState } from 'react'
import { Copy, Check, Send, AlertCircle } from 'lucide-react'
import { Select } from '@/components/v3'

interface DogOption {
  id: string
  name: string
}

interface SuccessResult {
  token: string
  accept_url: string
  expires_at: string
  dog_name: string
}

export default function NewInviteClient({ dogs }: { dogs: DogOption[] }) {
  const [dogId, setDogId] = useState(dogs[0]?.id ?? '')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'co_guardian' | 'viewer'>('co_guardian')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SuccessResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!dogId || !email || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dog_id: dogId, email, role }),
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(
          payload.error === 'invalid_email'
            ? '이메일 형식이 맞지 않아요'
            : payload.error === 'dog_not_found'
              ? '선택한 강아지를 찾지 못했어요'
              : '초대 발급에 실패했어요. 잠시 후 다시 시도해 주세요',
        )
        return
      }
      setResult(payload as SuccessResult)
    } catch (e) {
      console.error('invitation submit', e)
      setError('네트워크가 불안정해요. 다시 시도해 주세요')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopy() {
    if (!result || typeof navigator === 'undefined') return
    void navigator.clipboard.writeText(result.accept_url).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => {
        /* ignore */
      },
    )
  }

  if (dogs.length === 0) {
    return (
      <section className="px-5 mt-6">
        <div className="rounded border border-rule bg-bg-3 px-5 py-8 text-center">
          <p className="text-[13px] font-bold text-text">
            먼저 강아지를 등록해주세요
          </p>
          <p className="text-[11px] text-muted mt-1.5">
            등록된 강아지에 한해 가족 초대가 가능해요.
          </p>
        </div>
      </section>
    )
  }

  if (result) {
    return (
      <section className="px-5 mt-4 space-y-3">
        <div
          className="rounded border px-4 py-4"
          style={{
            background: 'color-mix(in srgb, var(--moss) 8%, var(--bg-3))',
            borderColor: 'var(--moss)',
          }}
        >
          <p
            className="font-sans"
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--ink)',
            }}
          >
            {result.dog_name}에 가족 초대를 발급했어요
          </p>
          <p className="text-[11px] text-muted mt-1">
            만료: {new Date(result.expires_at).toLocaleString('ko-KR')}
          </p>
        </div>

        <div className="rounded border border-rule bg-bg-3 px-4 py-3">
          <p className="text-[10.5px] uppercase tracking-widest text-muted mb-2">
            초대 링크
          </p>
          <code
            className="block break-all text-[11.5px] text-text"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {result.accept_url}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded border border-rule bg-bg text-[12px] font-bold text-text active:scale-[0.99] transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                복사 완료
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" strokeWidth={2.5} />
                링크 복사
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-muted leading-relaxed">
          링크를 카카오톡 / 메시지로 가족에게 보내주세요. 가족이 링크를
          클릭 + 로그인하면 자동으로 멤버에 추가돼요.
        </p>

        <button
          type="button"
          onClick={() => {
            setResult(null)
            setEmail('')
          }}
          className="text-[11px] text-terracotta font-semibold underline underline-offset-2"
        >
          또 다른 초대 만들기
        </button>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 mt-4 space-y-3">
      <div>
        <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
          공유할 강아지 *
        </label>
        <Select
          value={dogId}
          onChange={(e) => setDogId(e.target.value)}
          options={dogs.map((d) => ({ value: d.id, label: d.name }))}
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
          가족 이메일 *
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="family@example.com"
          required
          className="w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition"
        />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
          역할
        </label>
        <Select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          options={[
            { value: 'co_guardian', label: '공동 보호자 (편집 가능)' },
            { value: 'viewer', label: '뷰어 (조회만)' },
          ]}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded border px-3 py-2 flex items-start gap-2"
          style={{ background: 'rgba(184,58,46,0.06)', borderColor: 'var(--sale)' }}
        >
          <AlertCircle
            className="w-3.5 h-3.5 mt-0.5 shrink-0"
            color="var(--sale)"
            strokeWidth={2}
          />
          <p className="text-[12px]" style={{ color: 'var(--sale)' }}>
            {error}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !email || !dogId}
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded bg-text text-bg text-[13px] font-bold disabled:opacity-50 transition active:scale-[0.99]"
      >
        <Send className="w-4 h-4" strokeWidth={2.5} />
        {submitting ? '발급 중…' : '초대 링크 만들기'}
      </button>
    </form>
  )
}
