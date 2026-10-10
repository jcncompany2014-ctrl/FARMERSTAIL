/**
 * WebResultScreen — 카드 등록 결과 화면의 웹 모양(웹 시안 WEB-A25 완료 · A26 실패, 2026-10-10 웹 리뉴얼).
 *
 * 앱 모양(components/v3/billing/AppResultScreen)과 **같은 쓰임새**(mark · title · chip · body · actions · alert)라
 * billing-success·billing-fail 의 웹 갈래가 앱 갈래와 같은 판정·같은 이동 주소를 그대로 쓴다 — 갈리는 건 그리기와
 * 앱에 없는 이름('정기배송 관리')뿐. 가게 메뉴 없는 집중 화면: 위에 로고 + 닫기, 왼쪽 정렬 · 네모 표식 · 포스터 제목.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import '@/components/store/store.css'
import type { ResultMark } from '@/components/v3/billing/AppResultScreen'

function Mark({ kind, alert }: { kind: ResultMark; alert: boolean }) {
  if (kind === 'spin') {
    return (
      <span
        aria-hidden
        className="animate-spin"
        style={{ width: 56, height: 56, boxSizing: 'border-box', borderRadius: 28, border: '5px solid #EFEDEE', borderTopColor: '#141414', borderRightColor: '#141414' }}
      />
    )
  }
  if (kind === 'done') {
    return (
      <span aria-hidden style={{ width: 72, height: 72, background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    )
  }
  const ink = alert ? '#B3261E' : '#141414'
  return (
    <span aria-hidden style={{ width: 72, height: 72, boxSizing: 'border-box', border: `2.5px solid ${ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {kind === 'fail' ? (
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 6.5v7.5M12 17.6v.4" />
        </svg>
      ) : (
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
          <path d="M3 9.5h18" />
        </svg>
      )}
    </span>
  )
}

/** 등록한 결제수단(시안 A25) — 먹색 2px 테 · 카드 그림 · "신한카드 **** 1234". */
export function WebPayMethodChip({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 18,
        minHeight: 60,
        boxSizing: 'border-box',
        padding: '0 16px',
        borderRadius: 4,
        border: '2px solid #141414',
        display: 'grid',
        gridTemplateColumns: '30px 1fr',
        columnGap: 10,
        alignItems: 'center',
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
        <path d="M3 9.5h18" />
      </svg>
      <span style={{ fontSize: 18, fontWeight: 800, overflowWrap: 'anywhere' }}>{text}</span>
    </div>
  )
}

const primaryStyle = {
  height: 60,
  boxSizing: 'border-box' as const,
  border: 0,
  borderRadius: 4,
  background: '#141414',
  color: '#FFFFFF',
  fontFamily: 'inherit',
  fontSize: 18,
  fontWeight: 800,
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  cursor: 'pointer',
}

const secondaryStyle = {
  ...primaryStyle,
  height: 58,
  border: '2px solid #141414',
  background: '#FFFFFF',
  color: '#141414',
}

/** 아래 버튼 — 링크(href) **또는** 동작(onClick) 중 하나는 꼭 받는다(죽은 버튼 금지 — 규칙38). 첫째 = 먹색, 둘째 = 먹선. */
type WebResultActionProps = {
  primary?: boolean
  children: ReactNode
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never })

export function WebResultAction(props: WebResultActionProps) {
  const style = props.primary ? primaryStyle : secondaryStyle
  if (props.href !== undefined) {
    return (
      <Link href={props.href} style={style}>
        {props.children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={props.onClick} style={style}>
      {props.children}
    </button>
  )
}

export default function WebResultScreen({
  mark,
  title,
  chip,
  body,
  actions,
  alert = false,
  closeHref,
}: {
  mark: ResultMark
  title: ReactNode
  chip?: ReactNode
  body: ReactNode
  actions?: ReactNode
  /** 실패 — 화면 읽기 프로그램이 즉시 끊고 알린다(role=alert). 그 밖엔 status(polite). */
  alert?: boolean
  /** 위 '닫기' — 정기배송 관리로. 처리 중엔 없다(닫으면 등록이 끊긴다). */
  closeHref?: string
}) {
  return (
    <main className="fts" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div className="fts-page" style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            height: 'calc(56px + env(safe-area-inset-top, 0px))',
            boxSizing: 'border-box',
            // 최상위 경로라 AppChrome 이 safe-area 를 안 챙긴다 — 설치형 앱(standalone)에서 상태바가 덮지 않게.
            padding: 'env(safe-area-inset-top, 0px) 8px 0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #E5E5E5',
          }}
        >
          <Link href="/" aria-label="파머스테일 홈" style={{ display: 'flex', alignItems: 'center', height: 48 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-ink.png" alt="파머스테일" width={105} height={18} style={{ height: 18, width: 'auto', display: 'block' }} />
          </Link>
          {closeHref && (
            <Link href={closeHref} style={{ width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: '#141414', textDecoration: 'none' }}>
              닫기
            </Link>
          )}
        </header>
        <section
          role={alert ? 'alert' : 'status'}
          aria-live={alert ? 'assertive' : 'polite'}
          style={{ padding: '44px 20px 48px', display: 'flex', flexDirection: 'column', wordBreak: 'keep-all' }}
        >
          <Mark kind={mark} alert={alert} />
          <h1 className="d" style={{ margin: '24px 0 0', fontSize: mark === 'done' ? 42 : 36, lineHeight: mark === 'done' ? 1.1 : 1.15 }}>
            {title}
          </h1>
          {chip}
          <div style={{ margin: chip ? '20px 0 0' : '16px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>{body}</div>
          {actions && <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>{actions}</div>}
        </section>
      </div>
    </main>
  )
}
