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
// Palette — 'A 포스터' 앱 새 디자인 (2026-10-09, docs/APP_POSTER_REDESIGN_2026_10.md)
// ──────────────────────────────────────────────────────────────────
// 흰 바탕 · 먹색 글자 · 강조는 닭고기 파우치 머스타드(장식 전용) · 주 동작은 먹색.
// 키 이름은 그대로 두고 값만 바꿨다 — 앱 화면 491곳의 V3.* 참조가 한 번에 새 톤이 된다.
// 웹 화면(/why-app 의 AppShowcase)은 V3Classic(옛 값)을 쓴다 — 웹/앱 절대 분리.
export const V3 = {
  // Surface — 흰 바탕. 카드도 흰색(먹선·회색 면으로 구분), 들어간 칸은 회색 면.
  paper: '#FFFFFF',
  paperHi: '#FFFFFF',
  paperDeep: '#F6F4F5',

  // Ink — 본문 텍스트 + 강조 검정.
  ink: '#141414',
  inkSoft: '#3D3D3D',
  inkMute: '#595959',
  inkFaint: '#9A9A9A', // 글자 금지 — 비활성·자리표시 장식 전용

  // Rule — 경계선 / 분리선.
  rule: '#E5E5E5',
  ruleSoft: 'rgba(20,20,20,0.06)',
  ruleInk: '#141414', // 2px 먹선(도장 그림자 카드·섹션 머리)

  // Accent — 주 동작·고른 것·켜짐은 먹색(포스터). 예전 테라코타 자리를 먹색이 이어받는다.
  accent: '#141414',
  accentDeep: '#141414',

  // Highlight — 닭고기 파우치 머스타드. **배경·막대·밑줄 전용**(흰 바탕 위 2.3:1 — 글자 금지).
  yellow: '#D4A24C',
  /** 흰 바탕 위에서 읽히는 머스타드 글자(5.36:1). 꼭 색 글자가 필요할 때만. */
  yellowInk: '#8A6420',

  // 예전 초록·파랑 의미색은 먹색으로 모은다(포스터는 먹·머스타드·빨강 세 가지).
  sage: '#141414',
  sageSoft: '#595959',
  blue: '#141414',

  // Sale — 오류·경고·할인. (5.12:1)
  sale: '#C63D2A',

  // ── 새 이름 (2026-10-09) ──
  /** 닭고기 파우치 머스타드 = yellow. 진행 막대·밑줄·점·레시피 없는 핵심 카드 바탕. */
  mustard: '#D4A24C',
  /** 옅은 주황 — 큰 면(강아지 머리 띠·멤버십·도장판·내 말풍선). */
  cream: '#FCEFD9',
  /** 더 옅은 주황 — 수치 띠. */
  creamSoft: '#FFF7EA',
  /** 회색 면 — 보조 카드(+6px 색 띠)·들어간 칸. */
  soft: '#F6F4F5',
} as const

/**
 * 실제 파우치 사진에서 뽑은 레시피 색 (2026-10-09 사장님 "반반 1로 가자").
 * 박스 카드: 한 가지 = 그 색 바탕 / 두 가지 = 바탕 첫째 + 테두리 3px·그림자 5px 둘째.
 * 한우 바탕만 흰 글자(먹색 대비 3.8:1 로 모자람).
 */
export const POUCH = {
  chicken: '#D4A24C',
  duck: '#A7B9B6',
  pork: '#BEBDB6',
  beef: '#B5573A',
} as const

/**
 * 옛 v3 값 그대로(2026-10-09 이전) — **웹 화면 전용**.
 * 웹 /why-app 의 AppShowcase 가 앱 목업을 옛 톤으로 그린다. 웹 시각은 바꾸지 않는다.
 */
export const V3Classic = {
  paper: '#F7F5F0',
  paperHi: '#FCFBF7',
  paperDeep: '#EDE8D9',
  ink: '#16140f',
  inkSoft: '#3a342a',
  inkMute: '#706854',
  inkFaint: '#b6ab93',
  rule: 'rgba(22,20,15,0.12)',
  ruleSoft: 'rgba(22,20,15,0.07)',
  ruleInk: '#16140f',
  accent: '#C86B45',
  accentDeep: '#782E22',
  yellow: '#e6b942',
  yellowInk: '#8a6a12',
  sage: '#3C725E',
  sageSoft: '#7A8B7B',
  blue: '#3b5a78',
  sale: '#b83a2e',
} as const

// ──────────────────────────────────────────────────────────────────
// Dark variant — black hero cards ("오늘의 한 가지" 류) 전용 반전 팔레트
// ──────────────────────────────────────────────────────────────────
export const V3Dark = {
  bg: V3.ink, // #141414
  fg: '#FFFFFF',
  fgMute: 'rgba(255,255,255,0.7)',
  fgFaint: 'rgba(255,255,255,0.4)',
  rule: 'rgba(255,255,255,0.18)',
  ruleSoft: 'rgba(255,255,255,0.10)',
  // 먹색 면 위 강조는 머스타드(accent 가 먹색이 되어 먹 위에선 안 보인다)
  accent: V3.mustard,
  yellow: V3.mustard,
} as const

// ──────────────────────────────────────────────────────────────────
// Typography scale — 8단계. 그 외 fontSize 금지.
// ──────────────────────────────────────────────────────────────────
// ★2026-09-22 시니어 사용성 2단계 — 한 단계씩 올렸다: 9/10.5/12/13.5/16 → 12/12/14/16/18.
//   부모님 세대가 "글씨가 너무 작다". 앱 화면은 본문 16·보조 14·최소 12(뱃지)·카드 제목 18.
//   하드코딩된 Tailwind text-[Npx] 는 globals.css 의 app 스코프 매핑이 같은 표로 올린다.
//   ⚠️ 하단 탭바 라벨은 이 토큰을 쓰지 않는다(13.5 고정) — 탭바는 본문이 아니다.
export const V3FontSize = {
  /** 마이크로 캡션 / 메타 / 페이지네이션 카운터. */
  xxs: 12,
  /** Mono kicker / 메타데이터 / 작은 라벨. */
  xs: 12,
  /** 보조 본문 / 가격 보조 / 부연 설명. */
  sm: 14,
  /** 기본 본문. 한국어 가독성 하한. */
  base: 16,
  /** 상품명 / 카드 제목 / 강조 본문. */
  md: 18,
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
// Font families — 본문 Pretendard · 제목 Black Han Sans · 큰 숫자 Anton (2026-10-09)
// ──────────────────────────────────────────────────────────────────
export const V3Font = {
  sans: "var(--font-sans), 'Pretendard Variable', 'Noto Sans KR', system-ui, sans-serif",
  mono: "var(--font-mono), 'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace",
  /** 제목·레시피 이름. 굵기 400 하나뿐 — 굵게 지정하면 가짜 굵기가 생기니 400 으로. 쉼표가 마침표처럼 보여 숫자엔 쓰지 않는다. */
  poster: "var(--font-poster), var(--font-sans), 'Pretendard Variable', system-ui, sans-serif",
  /** 큰 숫자(가격·kcal·g). 뒤 단위는 작게 Pretendard 로. */
  num: "var(--font-num), var(--font-sans), system-ui, sans-serif",
} as const

// ──────────────────────────────────────────────────────────────────
// Shadow — v3 에서는 그림자 대신 1px ink rule 사용.
// 아래 토큰은 어쩔 수 없이 elevation 이 필요한 자리에만.
// ──────────────────────────────────────────────────────────────────
export const V3Shadow = {
  /** 카드 elevation — 가능하면 사용하지 말 것. paperHi + rule 우선. */
  card: '0 1px 0 rgba(20,20,20,0.04)',
  /** Sticky / modal — viewport 위에 떠 있는 surface. */
  sheet: '0 -4px 24px rgba(20,20,20,0.08)',
  /** Bottom CTA / FAB — 포스터는 번지는 빛 대신 옅은 그림자만. */
  accent: '0 6px 16px rgba(20,20,20,0.16)',
  /** 도장 그림자 — 화면당 한 곳, 그 화면의 핵심 카드(2px 먹선과 함께). */
  stamp: '4px 4px 0 #141414',
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
