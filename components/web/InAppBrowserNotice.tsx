'use client'

/**
 * 인앱 브라우저 안내 배너 — 인스타·페북·카톡 등 미니 브라우저로 열렸을 때만 뜬다.
 *
 * 왜: 인앱 브라우저는 저장소가 분리돼 로그인이 풀려 보이고, 결제·가입 흐름이
 * 매끄럽지 않을 수 있다. 서포터즈 DM·프로필 링크가 정확히 이 환경으로 열린다.
 *  · 안드로이드: 크롬으로 여는 intent 버튼 제공 (실동작)
 *  · iOS: 강제 전환이 불가 — ⋯ 메뉴 안내만
 * 자동 리다이렉트는 하지 않는다(예고 없는 화면 전환은 더 나쁜 UX).
 *
 * ★어디에 붙이나 (출시점검 5차, 2026-09-26): /start **첫 화면**과 /link 에만.
 *   설문·결과 화면에 두면 '크롬으로 열기'가 초안(localStorage)이 없는 크롬으로
 *   보내 survey/page 가 /start 로 되돌리고 답과 이벤트 코드가 함께 사라진다.
 *   크롬 전환 URL 에는 초안의 이벤트 코드를 ?p= 로 되붙인다(withPromoParam).
 *
 * 플랫폼 상태(UA·쿼리·sessionStorage)는 React 소유가 아니므로
 * useSyncExternalStore 로 읽는다 — useIsStandalone 과 같은 관례이자
 * react-hooks/set-state-in-effect 를 피하는 정석 경로. 스냅샷은 **문자열**
 * (객체를 돌려주면 매 호출 새 참조라 무한 리렌더).
 *
 * 테스트용: ?inapp=ios|android 쿼리로 강제 표시(실 UA 를 흉내낼 수 없는
 * 로컬 검증용 — 감지·문구·코드 복원 로직은 lib/inapp-browser.test.ts 가 커버).
 */
import { useReducer, useSyncExternalStore } from 'react'
import {
  chromeIntentUrl,
  detectInAppBrowser,
  inAppBrowserLabel,
  isAndroidUa,
  withPromoParam,
  type InAppKind,
} from '@/lib/inapp-browser'
import { loadAutosignupDraft } from '@/lib/autosignup-draft'

const DISMISS_KEY = 'ft_inapp_notice_dismissed'

/** 스냅샷 = `${kind}/${android|ios}` 또는 null. */
function readSnapshot(): string | null {
  if (typeof window === 'undefined') return null
  try {
    if (sessionStorage.getItem(DISMISS_KEY)) return null
  } catch {
    /* 프라이빗 모드 등 — 배너는 그냥 진행 */
  }
  const qs = new URLSearchParams(window.location.search).get('inapp')
  if (qs === 'android' || qs === 'ios') return `instagram/${qs}`
  const kind = detectInAppBrowser(navigator.userAgent)
  if (!kind) return null
  return `${kind}/${isAndroidUa(navigator.userAgent) ? 'android' : 'ios'}`
}

const subscribe = () => () => {}
const serverSnapshot = () => null

export default function InAppBrowserNotice() {
  // 닫기는 sessionStorage(외부 상태)에 쓰고, 리렌더만 이벤트 핸들러에서 유발.
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const snap = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot)

  if (!snap) return null
  const [kind, platform] = snap.split('/') as [InAppKind, 'android' | 'ios']
  const appName = inAppBrowserLabel(kind)

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* 무시 — 닫기가 안 남아도 이번 렌더는 숨긴다 */
    }
    bump()
  }

  const openInChrome = () => {
    // 초안에만 있는 이벤트 코드를 URL 로 되살린다 — 크롬은 이 초안을 못 본다.
    const promo = loadAutosignupDraft()?.promo ?? null
    const u = chromeIntentUrl(withPromoParam(window.location.href, promo))
    if (u) window.location.href = u
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
        {appName} 안 브라우저로 열려 있어요.{' '}
        {platform === 'android' ? (
          <>가입·결제가 매끄럽지 않으면 크롬으로 열어 주세요.</>
        ) : (
          <>
            가입·결제가 매끄럽지 않으면 오른쪽 위 <b>⋯</b> 메뉴에서{' '}
            <b>외부 브라우저로 열기</b>를 눌러 주세요.
          </>
        )}
      </span>
      {platform === 'android' && (
        <button
          onClick={openInChrome}
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
