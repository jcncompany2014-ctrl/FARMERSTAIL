'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Check,
  AlertCircle,
  Cake,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * ProfileForm — 마이페이지 / 계정 의 기본 프로필 편집 폼.
 *
 * 편집 가능한 필드 (auth.email 제외 — Supabase Auth flow 가 따로):
 *   - name
 *   - phone (포매팅)
 *   - birth_year + birth_month + birth_day (생일 쿠폰 자동 발급용)
 *
 * birth_year 는 만 14세 이상 가드. month/day 는 선택 — 채워야 생일 쿠폰 받을 수
 * 있음. 빈 칸이면 그대로 NULL 유지.
 */

export type ProfileFormInitial = {
  name: string | null
  phone: string | null
  birth_year: number | null
  birth_month: number | null
  birth_day: number | null
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

/** 월별 일수 (윤년은 무시 — 2/29 입력은 클라에서 막진 않고 DB CHECK 만 통과). */
function daysInMonth(month: number, year: number): number {
  if (!month) return 31
  return new Date(year || 2000, month, 0).getDate()
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
  const [birthYear, setBirthYear] = useState(
    initial.birth_year ? String(initial.birth_year) : '',
  )
  const [birthMonth, setBirthMonth] = useState(
    initial.birth_month ? String(initial.birth_month) : '',
  )
  const [birthDay, setBirthDay] = useState(
    initial.birth_day ? String(initial.birth_day) : '',
  )

  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentYear = new Date().getFullYear()
  const MIN_BIRTH_YEAR = currentYear - 100
  const MAX_BIRTH_YEAR = currentYear - 14

  const yearNum = birthYear ? Number(birthYear) : null
  const monthNum = birthMonth ? Number(birthMonth) : null
  const dayNum = birthDay ? Number(birthDay) : null

  const monthDayBothFilled = !!birthMonth && !!birthDay
  const monthDayPartialFilled =
    (!!birthMonth && !birthDay) || (!birthMonth && !!birthDay)

  const maxDay = daysInMonth(monthNum ?? 0, yearNum ?? 0)
  const dayInRange =
    !dayNum || (dayNum >= 1 && dayNum <= maxDay)

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
    if (
      yearNum !== null &&
      (yearNum < MIN_BIRTH_YEAR || yearNum > MAX_BIRTH_YEAR)
    ) {
      setError(
        yearNum > MAX_BIRTH_YEAR
          ? '만 14세 이상만 이용할 수 있어요'
          : '출생 연도가 올바르지 않아요',
      )
      return
    }
    if (monthDayPartialFilled) {
      setError('생일은 월/일 모두 입력해 주세요 (또는 둘 다 비워두세요)')
      return
    }
    if (!dayInRange) {
      setError(`${monthNum}월은 ${maxDay}일까지 있어요`)
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
        birth_year: yearNum,
        birth_month: monthNum,
        birth_day: dayNum,
      })
      .eq('id', user.id)
    setSaving(false)

    if (updErr) {
      setError('저장 실패: ' + updErr.message)
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
        label="생일"
        hint="월/일을 채우시면 생일 당일 자동으로 환영 쿠폰을 보내드려요. 마케팅 수신 동의 사용자만 발송."
      >
        <div className="grid grid-cols-3 gap-2">
          <select
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="px-3 py-3 rounded-lg text-[13px] focus:outline-none"
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
            }}
          >
            <option value="">연도</option>
            {Array.from({ length: MAX_BIRTH_YEAR - MIN_BIRTH_YEAR + 1 }).map(
              (_, i) => {
                const y = MAX_BIRTH_YEAR - i
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                )
              },
            )}
          </select>
          <select
            value={birthMonth}
            onChange={(e) => setBirthMonth(e.target.value)}
            className="px-3 py-3 rounded-lg text-[13px] focus:outline-none"
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
            }}
          >
            <option value="">월</option>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}월
              </option>
            ))}
          </select>
          <select
            value={birthDay}
            onChange={(e) => setBirthDay(e.target.value)}
            className="px-3 py-3 rounded-lg text-[13px] focus:outline-none"
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--rule)',
              color: 'var(--ink)',
            }}
          >
            <option value="">일</option>
            {Array.from({ length: maxDay }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}일
              </option>
            ))}
          </select>
        </div>
        {monthDayBothFilled && (
          <p
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: 'var(--moss)' }}
          >
            <Cake className="w-3 h-3" strokeWidth={2.5} />
            생일 쿠폰 자동 발송 대상이에요
          </p>
        )}
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
