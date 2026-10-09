import Link from 'next/link'

/**
 * StartAppShell — 앱 컨텍스트에서 /start 퍼널을 감싸는 미니멀 셸 (사장님 2026-07-19, B안).
 *
 * # 왜
 * /start(무료 맞춤분석 설문)는 웹 마케팅 chrome(WebChrome: 초록 헤더 로고+로그인+
 * 햄버거 + 잡다한 푸터)을 강제 렌더한다. 앱에서 "무료 맞춤분석"을 누르면 그 웹
 * 화면이 통째로 떠서 "웹으로 넘어간" 느낌을 줬다(웹/앱 절대 분리 위반).
 *
 * 사장님 B안: 웹 설문을 **앱 톤으로 리스킨**해 앱 안에서 이메일 가입까지. 이
 * 셸이 그 앱 톤 껍데기다 — 마케팅 nav/푸터 없이 로고 + 나가기만(설문 집중,
 * 이탈↓). /start/survey 의 미니멀 헤더와 같은 문법.
 *
 * 서버 컴포넌트(클라 훅 없음) — /start·/start/done 서버 page 에서 바로 감싼다.
 */
export default function StartAppShell({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        // 2026-10-09 앱 새 디자인('A 포스터', 캔버스 W27·W28): 흰 바탕. 예전엔 종이색(--fd-offwhite — 이 셸은
        // data-ft-chrome="app" 스코프 밖이라 앱 변수 --paper 가 미정의). 이 셸은 앱 갈래에서만 쓴다.
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* 윗줄(시안 W27): 높이 64 · 작은 로고(17) · '나가기' 15/700 회색 · 아래 1px 선. */}
      <header
        style={{
          height: 64,
          flexShrink: 0,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 20px',
          borderBottom: '1px solid #E5E5E5',
        }}
      >
        <Link href="/dashboard" aria-label="파머스테일 홈" className="inline-flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ink.png" alt="Farmer's Tail" style={{ height: 17, width: 'auto', display: 'block' }} />
        </Link>
        <Link
          href="/login"
          style={{
            minHeight: 48,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            fontSize: 15,
            fontWeight: 700,
            color: '#595959',
            textDecoration: 'none',
          }}
        >
          나가기
        </Link>
      </header>
      {children}
    </div>
  )
}
