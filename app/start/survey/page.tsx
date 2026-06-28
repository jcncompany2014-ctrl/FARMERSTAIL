'use client'

// 트랙B — /start/survey: 클린 풀스크린 웹 설문 (사장님 지시 회차322).
//
// 강아지 기본(step0) 후 설문은 마케팅 chrome(WebChrome 헤더/잡다한 푸터) 없이
// **설문만** 노출 → 집중·이탈↓ (FD 퀴즈처럼 풀스크린). /start/layout.tsx 가
// pass-through(루트 AuthAwareShell 무력화)라 이 page 가 chrome 을 안 그리면 0.
//
// 직접 진입(draft 미완성)은 /start 로 되돌림. 미링크 + noindex 의도(부모 /start
// 동일). dogName 은 localStorage 초안에서 읽어 StartSurvey 에 전달.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loadAutosignupDraft, isDogDraftComplete } from '@/lib/autosignup-draft'
import StartSurvey from '../StartSurvey'

export default function StartSurveyPage() {
  const router = useRouter()

  // SSR + 클라 첫 렌더 모두 null 로 시작(동일) → hydration mismatch 0. 마운트 후
  // localStorage 초안 판정: 완성이면 dogName 세팅, 미완성이면 /start 로 되돌림.
  const [dogName, setDogName] = useState<string | null>(null)
  useEffect(() => {
    const dog = loadAutosignupDraft()?.dog
    if (!isDogDraftComplete(dog)) {
      router.replace('/start')
      return
    }
    // 외부 스토어(localStorage) 동기화 목적의 의도적 마운트-후 set.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDogName((dog?.name || '').trim())
  }, [router])

  // 판정 전(SSR/마운트 직후) — 빈 화면(서버/클라 일치, 깜빡임 방지).
  if (dogName === null) return null

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--fd-offwhite)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 미니멀 상단바 — 로고 + 나가기 (마케팅 nav 없음) */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--fd-line)',
        }}
      >
        <Link href="/" aria-label="파머스테일 홈" className="inline-flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ink.png"
            alt="Farmer's Tail"
            style={{ height: 21, width: 'auto' }}
          />
        </Link>
        <Link
          href="/"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--fd-muted)',
            textDecoration: 'none',
          }}
        >
          나가기
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          padding: '24px 20px 32px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <StartSurvey dogName={dogName} />
      </main>
    </div>
  )
}
