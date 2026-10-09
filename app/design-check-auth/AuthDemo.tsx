'use client'

/**
 * /design-check-auth 의 그리는 부분 — 로그인·가입 앱 화면 부품에 예시 값을 넣어 띄운다(실제 메일 발송·로그인 없음).
 * 입력은 화면 안에서만 움직이고, 보내기 버튼은 아무 데도 보내지 않는다.
 */

import { useEffect, useState, type FormEvent } from 'react'
import ForgotPasswordAppView from '@/components/v3/auth/ForgotPasswordAppView'
import ResetPasswordAppView, { type ResetPasswordAppStatus } from '@/components/v3/auth/ResetPasswordAppView'
import AgeGateAppView from '@/components/v3/auth/AgeGateAppView'
import FirstScreenFlow from '@/app/start/first/FirstScreenFlow'
import { saveAutosignupDraft, clearAutosignupDraft } from '@/lib/autosignup-draft'
import { holdStartPhoto } from '@/lib/start-photo'

const noSubmit = (e: FormEvent) => e.preventDefault()

/**
 * 새 첫 화면(시안 Y1~Y6) — 예시 강아지 정보(땅콩)를 초안에 적어 두고 띄운다. 단계는 주소의 &step=N(실제와 같은 방식).
 * fresh = 빈 초안(첫 단계 그대로), photo = 사진 고른 뒤(Y5c·Y6 — 공개 사진 /sheltie-snow-45.jpg 를 폰에 든 것처럼).
 */
function FirstDemo({ fresh, photo }: { fresh: boolean; photo: boolean }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    ;(async () => {
      clearAutosignupDraft()
      if (!fresh) {
        saveAutosignupDraft({
          dog: { name: '땅콩', birthDate: '2023-05-02', breed: '셔틀랜드 쉽독(셸티)', gender: 'female', neutered: true, weight: '11.2', ageValue: '2', ageUnit: 'years' },
        })
      }
      if (photo) {
        const blob = await (await fetch('/sheltie-snow-45.jpg')).blob()
        const dataUrl = await new Promise<string>((res) => {
          const fr = new FileReader()
          fr.onload = () => res(String(fr.result))
          fr.readAsDataURL(blob)
        })
        holdStartPhoto(dataUrl)
      }
      if (alive) setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [fresh, photo])
  return ready ? <FirstScreenFlow /> : null
}

export default function AuthDemo({ s, fresh = false, photo = false }: { s: string; fresh?: boolean; photo?: boolean }) {
  if (s === 'first') return <FirstDemo fresh={fresh} photo={photo} />
  return <AuthDemoInner s={s} />
}

function AuthDemoInner({ s }: { s: string }) {
  const [email, setEmail] = useState(s === 'forgot-sent' ? 'guardian@example.com' : '')
  const [password, setPassword] = useState(s === 'reset' ? 'abcd1234!!' : '')
  const [confirm, setConfirm] = useState('')
  const [year, setYear] = useState(s === 'age-gate-under14' ? '2014' : s === 'age-gate' ? '1994' : '')

  if (s === 'forgot' || s === 'forgot-sent') {
    return (
      <ForgotPasswordAppView
        submitted={s === 'forgot-sent'}
        email={email}
        onEmailChange={setEmail}
        loading={false}
        error=""
        onSubmit={noSubmit}
      />
    )
  }
  if (s === 'reset' || s === 'reset-expired' || s === 'reset-done') {
    const status: ResetPasswordAppStatus = s === 'reset' ? 'form' : s === 'reset-expired' ? 'expired' : 'done'
    return (
      <ResetPasswordAppView
        status={status}
        expiredMessage="재설정 링크가 만료됐거나 이미 사용됐어요. 메일을 다시 받아 주세요."
        password={password}
        onPasswordChange={setPassword}
        confirm={confirm}
        onConfirmChange={setConfirm}
        mismatch={confirm.length > 0 && password !== confirm}
        updating={false}
        updateError=""
        canSubmit={password.length >= 8}
        onSubmit={noSubmit}
      />
    )
  }
  if (s === 'age-gate' || s === 'age-gate-under14') {
    const currentYear = new Date().getFullYear()
    const n = Number(year)
    const under14 = Number.isInteger(n) && n > currentYear - 14 && n <= currentYear
    return (
      <AgeGateAppView
        year={year}
        years={Array.from({ length: 101 }, (_, i) => currentYear - i)}
        onYearChange={setYear}
        isUnder14={under14}
        error=""
        saving={false}
        canSubmit={!!year}
        onPrimary={() => {}}
      />
    )
  }
  return null
}
