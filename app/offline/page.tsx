'use client'

import '@/components/store/store.css'
import { useServerAppContext } from '@/components/app/ServerAppContext'
import { AuthAppMain, AuthIconBox, AuthPrimaryAnchor, AuthResultPanel } from '@/components/v3/auth/AuthAppParts'

// '다시 시도하기'는 앱·웹 둘 다 **일반 링크**다(2026-10-13, 규칙200) — 오프라인에선 스크립트 묶음이 안 와 이 화면이 하이드레이션
// 되지 않아 onClick 이 붙지 않았다(안드로이드 에뮬레이터 재현: 눌러도 먹통). href="/" 는 스크립트가 하나도 없을 때의 길이고,
// data-ft-retry 표식이 붙은 링크는 offline/layout 의 인라인 스크립트(lib/offline-retry)가 지금 주소로 바꾸고, 인터넷이
// 돌아오면 그 주소로 다시 불러온다.
export default function OfflinePage() {
  const appLook = useServerAppContext()
  // 앱 새 디자인('A 포스터', 2026-10-09 캔버스 W18) — 앱이면 앱 모양(이모지 📡 대신 아이콘, 앱시안 결정 3번 '문구').
  //   판정 = offline/layout 의 서버 값. 웹은 아래 웹 시안 A28 모양(2026-10-10 웹 리뉴얼).
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
            <AuthPrimaryAnchor href="/" data-ft-retry="">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 12a8 8 0 1 1-2.3-5.6" />
                <path d="M20 4v4.5h-4.5" />
              </svg>
              다시 시도하기
            </AuthPrimaryAnchor>
          }
        />
      </AuthAppMain>
    )
  }
  // 웹 = 웹 시안 WEB-A28(2026-10-10 웹 리뉴얼) — 흰 바탕·먹색 · 로고만 있는 머리줄(오프라인이라 가게 메뉴는 의미가 없다).
  return (
    <main className="fts" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="fts-page" style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: 'calc(56px + env(safe-area-inset-top, 0px))',
            boxSizing: 'border-box',
            padding: 'env(safe-area-inset-top, 0px) 20px 0',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #E5E5E5',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ink.png" alt="파머스테일" width={105} height={18} style={{ height: 18, width: 'auto', display: 'block' }} />
        </header>
        <section role="status" style={{ padding: '72px 20px 48px', display: 'flex', flexDirection: 'column' }}>
          <span aria-hidden style={{ width: 72, height: 72, boxSizing: 'border-box', border: '2.5px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 9a14 14 0 0 1 19 0" />
              <path d="M5.5 12.5a9.5 9.5 0 0 1 13 0" />
              <path d="M8.7 16a5 5 0 0 1 6.6 0" />
              <circle cx="12" cy="19.5" r="1" fill="#141414" />
              <path d="M3 3l18 18" stroke="#B3261E" strokeWidth="2.4" />
            </svg>
          </span>
          <h1 className="d" style={{ margin: '26px 0 0', fontSize: 42, lineHeight: 1.1 }}>
            오프라인 상태예요
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            인터넷 연결이 끊어진 것 같아요.
            <br />
            와이파이나 모바일 데이터를 확인해 주세요.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 오프라인 화면은 하이드레이션이 안 돼 next/link 가 아니라 전체 새로 불러오기 링크여야 한다(규칙200) */}
          <a
            href="/"
            data-ft-retry=""
            style={{
              marginTop: 32,
              height: 60,
              boxSizing: 'border-box',
              border: 0,
              borderRadius: 4,
              background: '#141414',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: 18,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 12a8 8 0 1 1-2.3-5.6" />
              <path d="M20 4v4.5h-4.5" />
            </svg>
            다시 시도하기
          </a>
        </section>
      </div>
    </main>
  )
}
