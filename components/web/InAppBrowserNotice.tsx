'use client'

/**
 * 인앱 브라우저 안내 배너 — 인스타·페북 등 미니 브라우저로 열렸을 때만 뜬다.
 *
 * 왜: 인앱 브라우저는 저장소가 분리돼 로그인이 풀려 보이고, 결제·가입 흐름이
 * 매끄럽지 않을 수 있다. 서포터즈 DM·프로필 링크가 정확히 이 환경으로 열린다.
 *  · 안드로이드: 크롬으로 여는 intent 버튼 제공 (실동작)
 *  · iOS: 강제 전환이 불가 — ⋯ 메뉴 안내만
 * 자동 리다이렉트는 하지 않는다(예고 없는 화면 전환은 더 나쁜 UX).
 *
 * 플랫폼 상태(UA·쿼리·sessionStorage)는 React 소유가 아니므로
 * useSyncExternalStore 로 읽는다 — useIsStandalone 과 같은 관례이자
 * react-hooks/set-state-in-effect 를 피하는 정석 경로.
 *
 * 테스트용: ?inapp=ios|android 쿼리로 강제 표시(실 UA 를 흉내낼 수 없는
 * 로컬 검증용 — 감지 로직 자체는 lib/inapp-browser.test.ts 가 커버).
 */
import { useReducer, useSyncExternalStore } from 'react'
import { chromeIntentUrl, detectInAppBrowser, isAndroidUa } from '@/lib/inapp-browser'

const DISMISS_KEY = 'ft_inapp_notice_dismissed'

function readMode(): 'android' | 'ios' | null {
  if (typeof window === 'undefined') return null
  try {
    if (sessionStorage.getItem(DISMISS_KEY)) return null
  } catch {
    /* 프라이빗 모드 등 — 배너는 그냥 진행 */
  }
  const qs = new URLSearchParams(window.location.search).get('inapp')
  if (qs === 'android' || qs === 'ios') return qs
  if (!detectInAppBrowser(navigator.userAgent)) return null
  return isAndroidUa(navigator.userAgent) ? 'android' : 'ios'
}

const subscribe = () => () => {}
const serverSnapshot = () => null

export default function InAppBrowserNotice() {
  // 닫기는 sessionStorage(외부 상태)에 쓰고, 리렌더만 이벤트 핸들러에서 유발.
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const mode = useSyncExternalStore(subscribe, readMode, serverSnapshot)

  if (!mode) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* 무시 — 닫기가 안 남아도 이번 렌더는 숨긴다 */
    }
    bump()
  }

  return (
    <div
      role="status"
      style={{
        background: '#FFF7EC',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        padding: '10px 16px',
        fontSize: 13,
        lineHeight: 1.5,
        color: '#4A4234',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span style={{ flex: 1 }}>
        인스타그램 안 브라우저로 열려 있어요.{' '}
        {mode === 'android' ? (
          <>가입·결제가 매끄럽지 않으면 크롬으로 열어 주세요.</>
        ) : (
          <>
            가입·결제가 매끄럽지 않으면 오른쪽 위 <b>⋯</b> 메뉴에서{' '}
            <b>외부 브라우저로 열기</b>를 눌러 주세요.
          </>
        )}
      </span>
      {mode === 'android' && (
        <button
          onClick={() => {
            const u = chromeIntentUrl(window.location.href)
            if (u) window.location.href = u
          }}
          style={{
            flexShrink: 0,
            border: '1px solid rgba(0,0,0,0.15)',
            background: '#FFFFFF',
            borderRadius: 999,
            padding: '6px 12px',
            fontSize: 12.5,
            fontWeight: 700,
            color: '#1E1A14',
          }}
        >
          크롬으로 열기
        </button>
      )}
      <button
        aria-label="안내 닫기"
        onClick={dismiss}
        style={{ flexShrink: 0, fontSize: 16, color: '#9A9282', background: 'none', border: 'none', padding: 4 }}
      >
        ✕
      </button>
    </div>
  )
}
