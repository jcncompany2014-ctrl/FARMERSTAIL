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
        background: 'var(--fd-offwhite)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--fd-line)',
        }}
      >
        <Link href="/dashboard" aria-label="파머스테일 홈" className="inline-flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ink.png" alt="Farmer's Tail" style={{ height: 21, width: 'auto' }} />
        </Link>
        <Link
          href="/login"
          style={{ fontSize: 12, fontWeight: 700, color: 'var(--fd-muted)', textDecoration: 'none' }}
        >
          나가기
        </Link>
      </header>
      {children}
    </div>
  )
}
