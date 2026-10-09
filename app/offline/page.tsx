'use client'

import { useServerAppContext } from '@/components/app/ServerAppContext'
import { AuthAppMain, AuthIconBox, AuthPrimaryButton, AuthResultPanel } from '@/components/v3/auth/AuthAppParts'

export default function OfflinePage() {
  const appLook = useServerAppContext()
  // 앱 새 디자인('A 포스터', 2026-10-09 캔버스 W18) — 앱이면 앱 모양(이모지 📡 대신 아이콘, 앱시안 결정 3번 '문구').
  //   판정 = offline/layout 의 서버 값. 웹은 아래 예전 화면 그대로.
  if (appLook) {
    return (
      <AuthAppMain>
        <AuthResultPanel
          icon={
            <AuthIconBox>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 9a14 14 0 0 1 19 0" />
                <path d="M5.5 12.5a9.5 9.5 0 0 1 13 0" />
                <path d="M8.7 16a5 5 0 0 1 6.6 0" />
                <circle cx="12" cy="19.5" r="1" fill="#141414" />
                <path d="M3 3l18 18" stroke="#C63D2A" strokeWidth="2.4" />
              </svg>
            </AuthIconBox>
          }
          title="오프라인 상태예요"
          titleSize={40}
          body={
            <>
              인터넷 연결이 끊어진 것 같아요.
              <br />
              Wi-Fi나 모바일 데이터를 확인해 주세요.
            </>
          }
          action={
            <AuthPrimaryButton onClick={() => window.location.reload()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 12a8 8 0 1 1-2.3-5.6" />
                <path d="M20 4v4.5h-4.5" />
              </svg>
              다시 시도하기
            </AuthPrimaryButton>
          }
        />
      </AuthAppMain>
    )
  }
  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="text-center max-w-sm md:max-w-xl">
        <div className="text-6xl md:text-8xl mb-6 md:mb-8" aria-hidden="true">📡</div>
        <h1
          // R28: font-serif → font-sans (v3 app 톤. Service Worker 가 PWA 에서만 보여줌)
          className="font-sans text-[24px] md:text-[40px] lg:text-[48px] font-black text-text mb-3 md:mb-5"
          style={{ letterSpacing: '-0.025em', lineHeight: 1.25 }}
        >
          오프라인 상태예요
        </h1>
        <p className="text-[13px] md:text-[16px] text-muted leading-relaxed mb-6 md:mb-9">
          인터넷 연결이 끊어진 것 같아요.
          <br />
          Wi-Fi나 모바일 데이터를 확인해 주세요.
        </p>
        <button
          onClick={() => window.location.reload()}
          // R28: neo-brutal (검정 border + 3px shadow) → 카트 sticky CTA grammar (그라데이션 shadow)
          className="px-6 md:px-9 py-3 md:py-4 rounded-full font-bold text-sm md:text-[15px] text-white active:scale-[0.98] transition"
          style={{
            background: 'var(--terracotta)',
            border: '1px solid rgba(178, 58, 26, 0.6)',
            boxShadow:
              '0 8px 22px -6px rgba(220, 83, 42, 0.48), 0 2px 8px rgba(220, 83, 42, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
          }}
        >
          다시 시도하기
        </button>
      </div>
    </main>
  )
}