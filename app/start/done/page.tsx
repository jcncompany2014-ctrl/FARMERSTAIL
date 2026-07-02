'use client'

// 트랙B — 웹 가입 완료 착지 화면(사장님 결정 2026-06-16, A안 = 웹은 리드 캡처).
//
// 배경: /dogs/* 는 app-only(proxy.ts:172) 라 웹 가입자가 분석 종착점으로 가면
// /app-required 로 튕긴다. 그 "앱 설치 벽" 대신, 가입 직후 웹에서 매끄러운
// "가입 완료 → 정밀 분석은 앱에서" 핸드오프를 보여준다.
//   • 앱(PWA/Capacitor) 사용자: /start/claim·login 이 곧장 /dogs/{id}/analysis 로 보냄.
//   • 웹 사용자: 여기로 와서 완료 안내 + 앱 유도.
// ※ FD식 웹 결제(Your Plan→Checkout)는 토스 PG 통과 + 결제 불변영역 해제 후 별도.

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check } from 'lucide-react'
import WebChrome from '@/components/WebChrome'
import { Section, Container, Display, Eyebrow, PhotoSlot } from '@/components/web/fd/ui'

function DoneInner() {
  const params = useSearchParams()
  const name = (params.get('name') || '').trim() || '우리 아이'

  return (
    <WebChrome>
      <main>
        <Section bg="offwhite" pad="lg">
          <Container size="sm">
            <div className="text-center">
              <span
                className="inline-flex items-center justify-center rounded-full"
                style={{ width: 56, height: 56, background: 'var(--fd-green)' }}
              >
                <Check className="w-7 h-7" strokeWidth={2.6} color="#FFFFFF" />
              </span>
              <div className="pt-5">
                <Eyebrow>Welcome · 가입 완료</Eyebrow>
              </div>
              <Display as="h1" size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
                가입이 완료됐어요!
              </Display>
              <p
                className="pt-4 text-[14.5px] md:text-[16px] mx-auto"
                style={{ maxWidth: 440, lineHeight: 1.7, color: 'var(--fd-muted)' }}
              >
                <b style={{ color: 'var(--fd-pine)' }}>{name}</b> 맞춤 분석이 준비됐어요.
                38개 영양소 정밀 분석과 맞춤 레시피는 앱에서 이어져요.
              </p>

              {/* 앱 다운로드 — 실제 스토어 배지는 출시 시 주입(PhotoSlot src). */}
              <div className="pt-7 grid grid-cols-2 gap-3 mx-auto" style={{ maxWidth: 360 }}>
                <PhotoSlot label="App Store 배지" ratio="5 / 2" tone="pine" rounded={10} className="w-full" />
                <PhotoSlot label="Google Play 배지" ratio="5 / 2" tone="pine" rounded={10} className="w-full" />
              </div>

              <p className="pt-6 text-[12.5px]" style={{ color: 'var(--fd-muted)' }}>
                이미 앱이 있다면{' '}
                <Link
                  href="/login"
                  className="font-bold underline underline-offset-2"
                  style={{ color: 'var(--fd-coral-text)' }}
                >
                  앱에서 로그인
                </Link>
                해 주세요.
              </p>
            </div>
          </Container>
        </Section>
      </main>
    </WebChrome>
  )
}

export default function StartDonePage() {
  return (
    <Suspense fallback={null}>
      <DoneInner />
    </Suspense>
  )
}
