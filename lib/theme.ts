/**
 * Theme mode helper — Farmer's Tail dark/light toggle surface.
 *
 * 현재(2026-04) 다크 모드는 globals.css 의 `prefers-color-scheme: dark` 를
 * 통해 자동 적용되고, `html[data-theme="light|dark"]` 로 사용자 수동 선택이
 * OS 기본값을 이긴다. 이 모듈은 그 "수동 선택" 상태를 관리하는 얇은 래퍼:
 *
 *   - `readThemeChoice()`         : localStorage 에서 저장된 선택 복원
 *   - `writeThemeChoice(choice)`  : 선택 저장 + `<html data-theme>` 반영
 *   - `resolveEffectiveTheme(c)`  : choice + matchMedia 로 실제 활성 모드 계산
 *
 * 토글 UI 는 이 step 범위 밖. 미래의 Settings 페이지 / 헤더 switcher 가 이
 * 헬퍼를 호출하면 CSS 는 이미 준비돼 있어 바로 동작한다.
 *
 * 브라우저 전용 — `window` 가 없으면(서버 렌더) 기본값 'system' 으로 안전하게
 * 떨어진다. Next.js App Router 의 SSR 단계에서 호출돼도 예외 던지지 않음.
 */

export type ThemeChoice = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ft_theme'

const CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system']

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/**
 * localStorage 에 저장된 사용자 선택을 읽는다. 값이 없거나 손상된 경우 'system'.
 * 서버 환경에서는 'system' — 초기 SSR 은 OS 기본값을 존중한다는 정책.
 */
export function readThemeChoice(): ThemeChoice {
  if (!isBrowser()) return 'system'
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (raw && (CHOICES as readonly string[]).includes(raw)) {
      return raw as ThemeChoice
    }
  } catch {
    /* private mode / storage disabled — fall through */
  }
  return 'system'
}

/**
 * 선택을 저장하고 `<html>` 의 `data-theme` 속성을 업데이트한다.
 *
 *   - 'light' / 'dark' : attribute 를 설정 → CSS 의 수동 override 경로 활성화
 *   - 'system'         : attribute 제거 → `prefers-color-scheme` 미디어에 위임
 *
 * localStorage 쓰기는 try/catch 로 감싼다 (Safari private mode).
 */
export function writeThemeChoice(choice: ThemeChoice): void {
  if (!isBrowser()) return
  try {
    if (choice === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY)
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, choice)
    }
  } catch {
    /* ignore — UI 는 여전히 반영되게 아래로 진행 */
  }
  const html = document.documentElement
  if (choice === 'system') {
    html.removeAttribute('data-theme')
  } else {
    html.setAttribute('data-theme', choice)
  }
}

/**
 * 선택값 + 운영체제 설정 → 실제로 화면에 적용되는 모드. 헤더 아이콘 (sun/moon)
 * 같은 UI 가 "지금 다크인가?" 를 물을 때 이걸 호출한다.
 *
 * matchMedia 가 없는 환경(SSR/old browser)은 'light' 로 폴백.
 */
export function resolveEffectiveTheme(choice: ThemeChoice): EffectiveTheme {
  if (choice === 'light' || choice === 'dark') return choice
  if (!isBrowser() || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

/**
 * `<html>` 의 현재 `data-theme` 속성값을 읽어 ThemeChoice 로 정규화한다.
 * SSR/CSR hydration mismatch 를 디버깅할 때나, 외부 스크립트가 속성을 바꾸는
 * 상황에서 상태 재동기화용.
 */
export function readDomThemeChoice(): ThemeChoice {
  if (!isBrowser()) return 'system'
  const v = document.documentElement.getAttribute('data-theme')
  if (v === 'light' || v === 'dark') return v
  return 'system'
}
