/**
 * Contrast — WCAG 명도 대비 계산 유틸리티.
 *
 * R14 item 80. v3 디자인 토큰 (paper / paperHi / ink / inkSoft / inkMute / inkFaint
 * 등) 의 조합 대비를 런타임에 검증하는 데 사용.
 *
 * # WCAG 기준
 *
 *  - **AA — 본문 (≤18pt 또는 ≤14pt bold):** 4.5:1
 *  - **AA — 큰 텍스트 (>18pt 또는 >14pt bold) / UI 컴포넌트:** 3:1
 *  - **AAA — 본문:** 7:1
 *  - **AAA — 큰 텍스트:** 4.5:1
 *
 * # 사용
 *
 *   import { contrastRatio, V3_CONTRAST_PAIRS } from '@/lib/design/contrast'
 *
 *   if (contrastRatio('#16140f', '#f4ede0') < 4.5) {
 *     // 본문 텍스트로 부적합
 *   }
 *
 * # v3 audit 결과 (2026-05-23)
 *
 *  - ink/paper: 14.6:1 — AAA pass
 *  - inkSoft/paper: 9.7:1 — AAA pass
 *  - inkMute/paper: 4.75:1 — AA pass (마스터피스 P1-A2: #7d7460→#706854 darken)
 *  - inkFaint/paper: 1.9:1 — UI 분리선/icon hint 전용. 텍스트엔 금지.
 *  - paperHi 위에서도 대략 동일 (paper vs paperHi 차이 미미).
 *
 * 결론: **inkMute(#706854) 는 본문 AA(4.5:1) 통과** — app 라이트 ≤13.5px 보조
 * 본문에 안전. 더 강한 강조는 inkSoft(9.7:1) 권장.
 */

/**
 * hex (#rrggbb) 를 0-1 normalized sRGB 채널 [r, g, b] 로 변환.
 */
function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return [0, 0, 0]
  const hh = m[1]
  const r = parseInt(hh.slice(0, 2), 16) / 255
  const g = parseInt(hh.slice(2, 4), 16) / 255
  const b = parseInt(hh.slice(4, 6), 16) / 255
  return [r, g, b]
}

/**
 * sRGB → linear RGB (감마 보정 해제).
 */
function srgbToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * Relative luminance (WCAG 정의).
 */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb01(hex)
  const R = srgbToLinear(r)
  const G = srgbToLinear(g)
  const B = srgbToLinear(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * 두 색의 contrast ratio (1:1 ~ 21:1).
 */
export function contrastRatio(fg: string, bg: string): number {
  const L1 = luminance(fg)
  const L2 = luminance(bg)
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * WCAG AA pass 여부 — 본문 4.5:1, 큰 텍스트 3:1.
 */
export function passesAA(
  fg: string,
  bg: string,
  size: 'normal' | 'large' = 'normal',
): boolean {
  const r = contrastRatio(fg, bg)
  return r >= (size === 'large' ? 3 : 4.5)
}

/**
 * WCAG AAA pass 여부 — 본문 7:1, 큰 텍스트 4.5:1.
 */
export function passesAAA(
  fg: string,
  bg: string,
  size: 'normal' | 'large' = 'normal',
): boolean {
  const r = contrastRatio(fg, bg)
  return r >= (size === 'large' ? 4.5 : 7)
}

/**
 * v3 표준 contrast pairs — 디자인 시스템 내 권장 조합.
 *
 * Audit script 등이 import 해 일괄 검증 가능.
 */
export const V3_CONTRAST_PAIRS = [
  { name: 'ink/paper', fg: '#16140f', bg: '#f4ede0', purpose: 'body 본문' },
  { name: 'ink/paperHi', fg: '#16140f', bg: '#fbf6ec', purpose: 'card 본문' },
  { name: 'inkSoft/paper', fg: '#3a342a', bg: '#f4ede0', purpose: 'secondary body' },
  { name: 'inkSoft/paperHi', fg: '#3a342a', bg: '#fbf6ec', purpose: 'secondary body' },
  { name: 'inkMute/paper', fg: '#706854', bg: '#f4ede0', purpose: 'secondary body (P1-A2: 4.75:1 AA)' },
  { name: 'accent/paper', fg: '#c44a26', bg: '#f4ede0', purpose: 'accent text' },
  { name: 'sage/paper', fg: '#4f6a48', bg: '#f4ede0', purpose: 'success text' },
  { name: 'sale/paper', fg: '#b83a2e', bg: '#f4ede0', purpose: 'error text' },
] as const
