'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isKoreanMobile } from '@/lib/phone'
import { V3 } from '@/lib/design/tokens'
import { INPUT_STYLE, primaryButton } from '@/components/v3/me/MeParts'
import { CheckIcon } from '@/components/v3/me/MeIcons'

/**
 * ProfileForm — 마이페이지 / 계정 의 기본 프로필 편집 폼.
 *
 * 편집 가능한 필드:
 *   - name
 *   - phone (포매팅)
 *   - email — 변경 시 Supabase Auth 가 새 주소로 인증 메일 발송, 링크 확인 후 적용
 *     (2026-07-16 사장님: 이름·전화만 있어 빈약 → 이메일 변경 추가).
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 M01): 웹(/account/profile 웹 화면)과 같이 쓰는 부품이라
 * `variant='app'` 일 때만 앱 모양(이름표 16 · 입력 56 · 저장 버튼 56 먹색)으로 그린다. 기본값 'web' 은 한 픽셀도
 * 바뀌지 않는다. 저장·검사 로직은 두 모양이 같은 save() 를 쓴다.
 */

export type ProfileFormInitial = {
  name: string | null
  phone: string | null
  email: string | null
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length < 4) return digits
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

// 빈 값은 허용(선택 입력) — 채웠으면 정본 규칙을 따른다.
function isValidKoreanMobile(value: string): boolean {
  return value.replace(/\D/g, '') === '' || isKoreanMobile(value)
}

export default function ProfileForm({
  initial,
  variant = 'web',
}: {
  initial: ProfileFormInitial
  /** 'app' = 앱 새 디자인 모양. 기본 'web'(웹 화면 그대로). */
  variant?: 'web' | 'app'
}) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState(initial.name ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [email, setEmail] = useState(initial.email ?? '')

  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    setEmailSent(false)

    if (name.trim().length < 1) {
      setError('이름을 입력해 주세요')
      return
    }
    if (!isValidKoreanMobile(phone)) {
      setError('휴대폰 번호 형식이 올바르지 않아요')
      return
    }
    const emailChanged =
      email.trim().toLowerCase() !== (initial.email ?? '').trim().toLowerCase()
    if (emailChanged && !isValidEmail(email)) {
      setError('이메일 형식이 올바르지 않아요')
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

    // 이메일 변경 — Supabase Auth. 새 주소로 인증 메일이 가고, 링크를 눌러야 실제 변경.
    let emailErr: string | null = null
    if (emailChanged) {
      const { error: authErr } = await supabase.auth.updateUser({
        email: email.trim(),
      })
      if (authErr) {
        emailErr =
          authErr.message.includes('already') || authErr.message.includes('registered')
            ? '이미 사용 중인 이메일이에요'
            : '이메일 변경 메일을 보내지 못했어요'
      }
    }
    setSaving(false)

    if (updErr) {
      setError('저장하지 못했어요')
      return
    }
    if (emailErr) {
      setError(emailErr)
      return
    }
    setDone(true)
    if (emailChanged) setEmailSent(true)
    router.refresh()
    setTimeout(() => setDone(false), 3000)
  }

  if (variant === 'app') {
    // 앱 모양(시안 M01 '기본 정보') — 섹션 제목은 화면(ProfileAppView)이 그린다. 간격 18 은 섹션과 같다.
    return (
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <AppField label="이름">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="ft-me-input"
            style={INPUT_STYLE}
            placeholder="이름"
          />
        </AppField>
        <AppField label="휴대폰 번호">
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            autoComplete="tel"
            className="ft-me-input"
            style={INPUT_STYLE}
            placeholder="010-1234-5678"
          />
        </AppField>
        <AppField label="이메일" hint="바꾸면 새 주소로 인증 메일이 가요. 메일 속 링크를 눌러야 바뀌어요.">
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="ft-me-input"
            style={INPUT_STYLE}
            placeholder="you@example.com"
          />
        </AppField>

        {emailSent && (
          <p role="status" style={{ margin: 0, display: 'flex', gap: 6, fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: V3.ink }}>
            <CheckIcon size={18} strokeWidth={2.6} style={{ marginTop: 2 }} />
            <span>새 이메일로 인증 메일을 보냈어요. 링크를 누르면 변경돼요.</span>
          </p>
        )}
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.5, color: V3.sale }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={saving} style={{ ...primaryButton(56), opacity: saving ? 0.6 : 1 }}>
          {saving ? '저장 중…' : '저장'}
        </button>
        {done && (
          <p role="status" style={{ margin: '-6px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: V3.ink }}>
            <CheckIcon size={18} strokeWidth={2.6} />
            저장됐어요
          </p>
        )}
      </form>
    )
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

      <Field
        label="이메일"
        hint="변경하면 새 주소로 인증 메일이 가요. 링크를 눌러야 바뀝니다."
      >
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="이메일"
          className="w-full px-4 py-3 rounded-lg text-[14px] focus:outline-none transition"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
            color: 'var(--ink)',
          }}
          placeholder="you@example.com"
        />
      </Field>

      {emailSent && (
        <p
          className="inline-flex items-start gap-1.5 text-[12px] font-bold"
          style={{ color: 'var(--moss)' }}
        >
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2.25} />
          <span>새 이메일로 인증 메일을 보냈어요. 링크를 누르면 변경돼요.</span>
        </p>
      )}

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

/** 앱 모양 이름표 — 입력을 감싸 이름표를 눌러도 입력으로 간다(시안 M01: 16px 800 · 간격 8 · 덧말 15 회색). */
function AppField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: V3.ink }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 15, lineHeight: 1.5, color: V3.inkMute }}>{hint}</span>}
    </label>
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
