/**
 * Farmer's Tail v3 design tokens (2026-05-21).
 *
 * Inline-style 에서 쓸 수 있는 TS export. globals.css 의 CSS variable 과 1:1
 * 미러링 — 컴포넌트는 `style={{ background: V3.paper }}` 또는
 * `style={{ background: 'var(--paper)' }}` 둘 다 가능.
 *
 * # 원칙
 *  1. 어떤 컴포넌트도 hex 를 직접 쓰지 않는다 — 이 파일이 single source.
 *  2. legacy alias 는 globals.css 의 :root 에서 같은 값으로 매핑되어 있어
 *     기존 `var(--terracotta)` 같은 참조는 자동으로 v3 색으로 렌더.
 *  3. dark variant 는 별도 export 객체로 — black hero 카드 등에서 의도적
 *     반전이 필요한 자리에만 명시적으로 사용.
 *  4. typography scale 은 8단계만 — 그 외 사이즈는 디자인 합의 후 추가.
 */

// ──────────────────────────────────────────────────────────────────
// Palette
// ──────────────────────────────────────────────────────────────────
export const V3 = {
  // Surface — 종이 paper. Light cream 베이스.
  paper: '#f4ede0',
  paperHi: '#fbf6ec', // 카드 / sheet / raised surface
  paperDeep: '#ebe2d1', // 프레임 outer / scroll shadow

  // Ink — 본문 텍스트 + 강조 검정.
  ink: '#16140f',
  inkSoft: '#3a342a',
  inkMute: '#7d7460',
  inkFaint: '#b6ab93',

  // Rule — 경계선 / 분리선.
  rule: 'rgba(22,20,15,0.12)',
  ruleSoft: 'rgba(22,20,15,0.07)',
  ruleInk: '#16140f', // 2px ink hairline (섹션 분리용)

  // Accent — 시그니처 clay red.
  accent: '#c44a26',
  accentDeep: '#8a2e15',

  // Highlight — 노란 마커 (텍스트 강조).
  yellow: '#e6b942',

  // Sage — 안정 / 완료 / 사용 가능.
  sage: '#4f6a48',
  sageSoft: '#7e9376',

  // Blue — 분석용 / 정보.
  blue: '#3b5a78',

  // Sale — 가격 할인 / 재고 경고. accent 와 분리해 둠.
  sale: '#b83a2e',
} as const

// ──────────────────────────────────────────────────────────────────
// Dark variant — black hero cards ("오늘의 한 가지" 류) 전용 반전 팔레트
// ──────────────────────────────────────────────────────────────────
export const V3Dark = {
  bg: V3.ink, // #16140f
  fg: V3.paper, // #f4ede0
  fgMute: 'rgba(244,237,224,0.65)',
  fgFaint: 'rgba(244,237,224,0.36)',
  rule: 'rgba(244,237,224,0.18)',
  ruleSoft: 'rgba(244,237,224,0.10)',
  accent: V3.accent,
  yellow: V3.yellow,
} as const

// ──────────────────────────────────────────────────────────────────
// Typography scale — 8단계. 그 외 fontSize 금지.
// ──────────────────────────────────────────────────────────────────
export const V3FontSize = {
  /** 마이크로 캡션 / 메타 / 페이지네이션 카운터. */
  xxs: 9,
  /** Mono kicker / 메타데이터 / 작은 라벨. */
  xs: 10.5,
  /** 보조 본문 / 가격 보조 / 부연 설명. */
  sm: 12,
  /** 기본 본문. 한국어 가독성 하한. */
  base: 13.5,
  /** 상품명 / 카드 제목 / 강조 본문. */
  md: 16,
  /** 섹션 제목 (h2). */
  lg: 22,
  /** 페이지 헤더 (h1 small). */
  xl: 32,
  /** Hero display (h1 large). */
  xxl: 54,
} as const

export const V3FontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 800,
  // 900 은 hero/display 만. 본문에서 사용 금지.
  display: 900,
} as const

export const V3LineHeight = {
  tight: 0.95, // hero display
  snug: 1.1, // h2-h3
  normal: 1.35, // 카드 제목
  body: 1.55, // 본문 / paragraph
} as const

export const V3LetterSpacing = {
  /** Hero display — 54px 큰 글자 압축. */
  hero: '-0.025em',
  /** H2-H3 — 22/32px 헤딩. */
  heading: '-0.02em',
  /** 본문 — 한국어 미세 압축. */
  body: '-0.015em',
  /** Mono kicker — letter-spacing 늘려 ALL CAPS 가독성 확보. */
  kicker: '0.16em',
} as const

// ──────────────────────────────────────────────────────────────────
// Border radius — 4단계만.
// ──────────────────────────────────────────────────────────────────
export const V3Radius = {
  /** badge / chip / small ribbon. */
  xs: 2,
  /** card / button / input. v3 의 시그니처 radius. */
  sm: 4,
  /** modal / sheet header. */
  md: 12,
  /** pill / fully rounded. */
  pill: 999,
} as const

// ──────────────────────────────────────────────────────────────────
// Spacing scale — 8pt 베이스.
// ──────────────────────────────────────────────────────────────────
export const V3Space = {
  '1': 4,
  '2': 8,
  '3': 12,
  '4': 16,
  '5': 20, // 섹션 좌우 padding 표준
  '7': 28,
  '10': 40,
  '16': 64,
} as const

// ──────────────────────────────────────────────────────────────────
// Font families — Pretendard + IBM Plex Mono 2종만.
// ──────────────────────────────────────────────────────────────────
export const V3Font = {
  sans: "var(--font-sans), 'Pretendard Variable', 'Noto Sans KR', system-ui, sans-serif",
  mono: "var(--font-mono), 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace",
  /**
   * 폐기된 serif family — 레거시 코드 호환을 위해 유지. 새로 작성하는 코드는
   * `V3Font.sans` 만 사용. globals.css 에서 `--font-serif` / `--font-display`
   * 변수도 모두 sans 로 alias 되어 있음.
   */
  legacySerif: 'var(--font-sans)',
} as const

// ──────────────────────────────────────────────────────────────────
// Shadow — v3 에서는 그림자 대신 1px ink rule 사용.
// 아래 토큰은 어쩔 수 없이 elevation 이 필요한 자리에만.
// ──────────────────────────────────────────────────────────────────
export const V3Shadow = {
  /** 카드 elevation — 가능하면 사용하지 말 것. paperHi + rule 우선. */
  card: '0 1px 0 rgba(22,20,15,0.04)',
  /** Sticky / modal — viewport 위에 떠 있는 surface. */
  sheet: '0 -4px 24px rgba(22,20,15,0.08)',
  /** Accent CTA — bottom CTA / FAB 등. */
  accent: '0 12px 26px rgba(196,74,38,0.32)',
} as const

// ──────────────────────────────────────────────────────────────────
// Transition — prefers-reduced-motion 보호는 globals.css 에서.
// ──────────────────────────────────────────────────────────────────
export const V3Transition = {
  fast: '160ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '240ms cubic-bezier(0.16, 1, 0.3, 1)',
  slow: '420ms cubic-bezier(0.16, 1, 0.3, 1)',
} as const

export type V3PaletteKey = keyof typeof V3
export type V3FontSizeKey = keyof typeof V3FontSize
export type V3RadiusKey = keyof typeof V3Radius
