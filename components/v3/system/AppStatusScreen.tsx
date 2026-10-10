import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { V3, V3Radius } from '@/lib/design/tokens'

/**
 * AppStatusScreen — 앱의 '상태 화면' 한 벌: 화면 오류 · 없는 주소 · 앱 전체 오류 (2026-10-09 'A 포스터').
 *
 * 시안 B03(화면 오류)·B04(앱 전체 오류)·B05(없는 주소)는 같은 틀이다 — 먹선 네모 칸(72) 안 그림 →
 * (작은 머리말) → 포스터 제목(38) → 본문(18) → 먹색 주 버튼 + 먹선 보조 버튼(높이 58). 세 화면이 따로
 * 그리면 하나만 고쳐지고 나머지는 옛 모양으로 남는다 — 그래서 한 곳에서 그린다. 치수는 시안 값 그대로.
 *
 * - 스타일은 전부 인라인이다. app/global-error.tsx 는 루트 layout 이 무너진 자리라 globals.css·글꼴
 *   변수가 없다 — 거기서도 같은 부품을 쓰려고 클래스(Tailwind·앱 범위 CSS)에 기대지 않는다.
 * - 제목은 h1 — 앱 틀 안에선 globals.css 의 앱 범위 규칙이 포스터 글꼴(Black Han Sans)을 입힌다.
 *   틀 밖(standalone)은 글꼴을 직접 적는다.
 * - 문구의 줄바꿈은 줄바꿈 문자로 받는다(시안의 줄 나눔 그대로). 좁은 폰에선 낱말 단위로만 더 접힌다.
 * - 고객 문구 규칙: 오류 번호·영어·'문제 코드'를 보이지 않는다. 오류 전달(Sentry)은 호출부 몫이다.
 *
 * 훅이 없어 서버·클라이언트 어디서든 그려진다. onClick 동작은 클라이언트 컴포넌트(error.tsx 등)에서만 넘긴다.
 */

export type AppStatusAction =
  | {
      label: string
      icon?: ReactNode
      href: string
      /** true = 전체 새로 불러오기(a 태그). 라우터가 없는 global-error 전용 — 평소엔 Link 로 넘어간다. */
      fullReload?: boolean
    }
  | {
      label: string
      icon?: ReactNode
      onClick: () => void
    }

interface AppStatusScreenProps {
  /** 72px 먹선 네모 칸 안의 그림(시안 40px) — components/v3/system/StatusIcons. */
  icon: ReactNode
  /** 제목 위 작은 머리말(선택, 한글). */
  kicker?: string
  /** 포스터 제목 — 줄바꿈 문자가 줄 나눔. */
  title: string
  /** 본문 — 줄바꿈 문자가 줄 나눔. */
  body: string
  primary: AppStatusAction
  secondary?: AppStatusAction
  /**
   * 'chrome'(기본) = 앱 틀(윗줄·아래 탭) 안 — 그 사이 빈 곳의 가운데에 놓는다.
   * 'standalone' = 틀도 전역 CSS 도 없는 화면(global-error) — 화면 전체 + 안전 영역 + 제목 글꼴 직접.
   */
  frame?: 'chrome' | 'standalone'
}

/**
 * 앱 틀 안에서 윗줄(--ft-header-h 56)과 아래 탭(--ft-tabbar-h = 떠 있는 알약 62 + 바닥 간격) 사이를 채우는 높이.
 * 결제 퍼널(아래 탭 대신 결제 바 80 + 16)에서도 넘치지 않게 40px 을 넉넉히 뺐다 — 넘치면 화면이
 * 몇 px 씩 위아래로 끌린다. 아래 여백(12)은 그만큼 줄여 시안 B03 의 위치(위 32 · 아래 48)와 맞췄다.
 */
const CHROME_FILL_HEIGHT =
  'calc(100vh - var(--ft-header-h, 64px) - var(--ft-tabbar-h, 68px) - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))'

/**
 * 틀 밖 제목 글꼴 — 포스터 글꼴 변수(--font-poster)가 있으면 그것, 없으면(global-error) 이름으로 찾고,
 * 그것도 없으면 시스템 한글 글꼴의 가장 굵은 굵기. 포스터 글꼴은 굵기가 400 하나라 가짜 굵게를 막는다.
 */
const STANDALONE_TITLE: CSSProperties = {
  fontFamily:
    "var(--font-poster, 'Black Han Sans'), 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
  fontWeight: 900,
  fontSynthesis: 'none',
  letterSpacing: '-0.02em',
}

const ACTION_BASE: CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  height: 58,
  borderRadius: V3Radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  fontFamily: 'inherit',
  fontSize: 17,
  fontWeight: 800,
  lineHeight: 1.2,
  textDecoration: 'none',
  cursor: 'pointer',
}
const PRIMARY: CSSProperties = { ...ACTION_BASE, border: 0, background: V3.ink, color: V3.paper }
const SECONDARY: CSSProperties = {
  ...ACTION_BASE,
  border: `1.5px solid ${V3.ink}`,
  background: V3.paper,
  color: V3.ink,
}

function StatusAction({ action, tone }: { action: AppStatusAction; tone: 'primary' | 'secondary' }) {
  const style = tone === 'primary' ? PRIMARY : SECONDARY
  const content = (
    <>
      {action.icon}
      {action.label}
    </>
  )
  if ('onClick' in action) {
    return (
      <button type="button" onClick={action.onClick} style={style}>
        {content}
      </button>
    )
  }
  if (action.fullReload) {
    return (
      <a href={action.href} style={style}>
        {content}
      </a>
    )
  }
  return (
    <Link href={action.href} style={style}>
      {content}
    </Link>
  )
}

export default function AppStatusScreen({
  icon,
  kicker,
  title,
  body,
  primary,
  secondary,
  frame = 'chrome',
}: AppStatusScreenProps) {
  const standalone = frame === 'standalone'
  // 앱 틀 안엔 이미 <main id="main"> 이 있다 — 틀 밖(global-error)에서만 main 을 연다.
  const Root = standalone ? 'main' : 'section'

  return (
    <Root
      style={{
        boxSizing: 'border-box',
        minHeight: standalone ? '100vh' : CHROME_FILL_HEIGHT,
        padding: standalone
          ? 'calc(32px + env(safe-area-inset-top, 0px)) 20px calc(48px + env(safe-area-inset-bottom, 0px))'
          : '32px 20px 12px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: V3.paper,
        color: V3.ink,
        wordBreak: 'keep-all',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 72,
          height: 72,
          flexShrink: 0,
          boxSizing: 'border-box',
          border: `2px solid ${V3.ink}`,
          borderRadius: V3Radius.sm,
          background: V3.paper,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>

      {kicker && (
        <span style={{ marginTop: 22, fontSize: 15, fontWeight: 800, lineHeight: 1.2, color: V3.inkMute }}>
          {kicker}
        </span>
      )}

      <h1
        style={{
          margin: kicker ? '8px 0 0' : '24px 0 0',
          fontSize: 38,
          lineHeight: 1.14,
          color: V3.ink,
          whiteSpace: 'pre-line',
          ...(standalone ? STANDALONE_TITLE : null),
        }}
      >
        {title}
      </h1>

      <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: V3.inkSoft, whiteSpace: 'pre-line' }}>
        {body}
      </p>

      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <StatusAction action={primary} tone="primary" />
        {secondary && <StatusAction action={secondary} tone="secondary" />}
      </div>
    </Root>
  )
}
