'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * ProfileForm — 마이페이지 / 계정 의 기본 프로필 편집 폼.
 *
 * 편집 가능한 필드 (auth.email 제외 — Supabase Auth flow 가 따로):
 *   - name
 *   - phone (포매팅)
 *
 * 만 14세 가드용 출생연도는 **가입 시점에 수집·검증**되므로 여기선 편집하지
 * 않는다. 견주 생일 입력은 폐기(2026-06-27) — 생일 할인은 강아지 생일 기준.
 */

export type ProfileFormInitial = {
  name: string | null
  phone: string | null
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 4) return digits
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function isValidKoreanMobile(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits === '' || /^01[016789]\d{7,8}$/.test(digits)
}

export default function ProfileForm({
  initial,
}: {
  initial: ProfileFormInitial
}) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState(initial.name ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')

  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)

    if (name.trim().length < 1) {
      setError('이름을 입력해 주세요')
      return
    }
    if (!isValidKoreanMobile(phone)) {
      setError('휴대폰 번호 형식이 올바르지 않아요')
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('로그인이 만료되었어요. 다시 로그인해 주세요.')
      return
    }

    setSaving(true)
    const { error: updErr } = await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
      })
      .eq('id', user.id)
    setSaving(false)

    if (updErr) {
      setError('저장하지 못했어요')
      return
    }
    setDone(true)
    router.refresh()
    setTimeout(() => setDone(false), 3000)
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Field label="이름">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="이름"
          className="w-full px-4 py-3 rounded-lg text-[14px] focus:outline-none transition"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
            color: 'var(--ink)',
          }}
          placeholder="홍길동"
        />
      </Field>

      <Field label="휴대폰 번호">
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          aria-label="휴대폰 번호"
          className="w-full px-4 py-3 rounded-lg text-[14px] focus:outline-none transition"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
            color: 'var(--ink)',
          }}
          placeholder="010-1234-5678"
        />
      </Field>

      {error && (
        <p
          className="inline-flex items-start gap-1.5 text-[12px] font-bold"
          style={{ color: 'var(--terracotta)' }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2.25} />
          <span>{error}</span>
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-bold transition active:scale-[0.97] disabled:opacity-60"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            letterSpacing: '-0.01em',
          }}
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.25} />
          ) : null}
          {saving ? '저장 중…' : '저장'}
        </button>
        {done && (
          <span
            className="inline-flex items-center gap-1 text-[12px] font-bold"
            style={{ color: 'var(--moss)' }}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            저장됐어요
          </span>
        )}
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="block text-[11px] font-bold mb-1.5"
        style={{ color: 'var(--ink)' }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}
