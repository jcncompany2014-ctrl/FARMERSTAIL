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
 *   import { V3 } from '@/lib/design/tokens'
 *
 *   if (contrastRatio(V3.ink, V3.paper) < 4.5) {
 *     // 본문 텍스트로 부적합
 *   }
 *
 * 표준 조합은 `V3_CONTRAST_PAIRS` 에 있고 **토큰에서 직접 파생**된다 —
 * 손으로 적은 hex 는 토큰이 바뀌면 조용히 낡는다(실제로 그랬다, 아래 주석 참조).
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

// `.ts` 확장자를 붙인다 — 이 repo 의 lib 값 import 관례이고
// (tsconfig allowImportingTsExtensions), 안 붙이면 `npm test` 의
// `node --experimental-strip-types` 가 ERR_MODULE_NOT_FOUND 로 죽는다.
// 단독 실행(tsx)에서는 통과해서 그 차이를 놓치기 쉽다.
import { V3 } from './tokens.ts'

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
 * # ★ 왜 hex 를 직접 안 적는가 (2026-07-30)
 * 예전엔 이 표에 hex 를 손으로 적어 뒀는데, 그 사이 토큰이 바뀌어 **8쌍 중 4쌍이
 * 이제 아무 데도 안 쓰는 색을 검사**하고 있었다(paper #f4ede0 → #F7F5F0,
 * paperHi, accent #c44a26 → #C86B45, sage #4f6a48 → #3C725E).
 * 게다가 테스트는 `1 < r <= 21` 만 봐서 **AA 미달을 잡을 수가 없었다** —
 * 초록이지만 아무것도 검증하지 않는 표였다.
 * 이제 `V3` 에서 직접 읽으므로 토큰을 바꾸면 그 즉시 이 표가 따라온다.
 *
 * # `use` 의 뜻
 *  · `text`  — 본문·라벨 글자색으로 쓴다. **AA 4.5:1 을 반드시 통과해야 한다**
 *              (테스트가 강제). 여기 넣었는데 통과 못 하면 테스트가 깨진다.
 *  · `large` — 18.66px bold 이상 큰 글자 전용(WCAG 3:1).
 *  · `deco`  — 테두리·아이콘·마커 배경 등 **글자색으로 쓰면 안 되는 것**.
 *              비율만 기록해 둔다(왜 텍스트로 못 쓰는지 근거가 남게).
 */
export const V3_CONTRAST_PAIRS = [
  { name: 'ink/paper', fg: V3.ink, bg: V3.paper, use: 'text', purpose: 'body 본문' },
  { name: 'ink/paperHi', fg: V3.ink, bg: V3.paperHi, use: 'text', purpose: 'card 본문' },
  { name: 'inkSoft/paper', fg: V3.inkSoft, bg: V3.paper, use: 'text', purpose: 'secondary body' },
  { name: 'inkSoft/paperHi', fg: V3.inkSoft, bg: V3.paperHi, use: 'text', purpose: 'secondary body' },
  {
    name: 'inkMute/paper',
    fg: V3.inkMute,
    bg: V3.paper,
    use: 'text',
    purpose: '보조 본문 (마스터피스 P1-A2 darken)',
  },
  { name: 'accentDeep/paper', fg: V3.accentDeep, bg: V3.paper, use: 'text', purpose: '강조 텍스트' },
  { name: 'sage/paper', fg: V3.sage, bg: V3.paper, use: 'text', purpose: '완료·정상 텍스트' },
  { name: 'sale/paper', fg: V3.sale, bg: V3.paper, use: 'text', purpose: '오류·할인 텍스트' },
  { name: 'blue/paper', fg: V3.blue, bg: V3.paper, use: 'text', purpose: '정보 텍스트' },
  {
    name: 'yellowInk/paper',
    fg: V3.yellowInk,
    bg: V3.paper,
    use: 'text',
    purpose: "'시작 전' 등 대기 상태 텍스트 (2026-07-30 신설)",
  },

  // ── 글자색으로 쓰면 안 되는 것들 — 비율을 근거로 남긴다 ──
  {
    name: 'accent/paper',
    fg: V3.accent,
    bg: V3.paper,
    use: 'deco',
    purpose:
      '3.41:1 — 테두리·아이콘·강조 띠 전용. 텍스트는 accentDeep(8.71:1). ' +
      '⚠️ 지금 accent 를 글자색으로 쓰는 곳이 15군데 남아 있다(디자인 동결 중이라 사장님 확인 후 일괄 교체).',
  },
  {
    name: 'sageSoft/paper',
    fg: V3.sageSoft,
    bg: V3.paper,
    use: 'deco',
    purpose: '3.32:1 — 배경·테두리 전용',
  },
  {
    name: 'yellow/paper',
    fg: V3.yellow,
    bg: V3.paper,
    use: 'deco',
    purpose: '1.69:1 — 마커 **배경** 전용. 글자색으로 쓰면 사실상 안 보인다',
  },
  {
    name: 'inkFaint/paper',
    fg: V3.inkFaint,
    bg: V3.paper,
    use: 'deco',
    purpose: '1.69:1 — UI hint(구분선·비활성 아이콘) 전용',
  },
] as const
