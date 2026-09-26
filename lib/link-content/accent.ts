/**
 * /link 배너 포인트 컬러 — 순수 모듈 (테스트: accent.test.ts).
 *
 * 사장님 2026-09-26: "인스타로 모집하면 인스타 특유의 그라데이션, 네이버 스마트스토어면
 * 초록, 쿠팡·자사몰도 각각 느낌에 맞춰 라인이 있으면". 카드의 상단 라인·배지·화살표·
 * 테두리 틴트가 이 테마를 따른다. 어드민 저장값이 'auto' 면 링크 주소로 추정한다.
 */

export type AccentKey = 'none' | 'instagram' | 'naver' | 'coupang' | 'farmerstail'
export type AccentSetting = AccentKey | 'auto'

export const ACCENT_SETTINGS: AccentSetting[] = ['auto', 'none', 'instagram', 'naver', 'coupang', 'farmerstail']

export const ACCENT_LABELS: Record<AccentSetting, string> = {
  auto: '자동 (링크 주소로 판단)',
  none: '없음',
  instagram: '인스타그램 (그라데이션)',
  naver: '네이버 스마트스토어 (초록)',
  coupang: '쿠팡 (빨강)',
  farmerstail: '자사몰 · 파머스테일 (테라코타)',
}

export function isAccentSetting(v: unknown): v is AccentSetting {
  return typeof v === 'string' && (ACCENT_SETTINGS as string[]).includes(v)
}

/** 링크 주소로 브랜드 추정 — 모르면 none. 상대경로는 자사(farmerstail). */
export function inferAccent(href: string): AccentKey {
  const h = href.trim().toLowerCase()
  if (h.startsWith('/')) return 'farmerstail'
  let host = ''
  try {
    host = new URL(h).hostname
  } catch {
    return 'none'
  }
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram'
  if (host === 'naver.com' || host.endsWith('.naver.com') || host.endsWith('.naver.me')) return 'naver'
  if (host === 'coupang.com' || host.endsWith('.coupang.com') || host.endsWith('.coupa.ng')) return 'coupang'
  if (host === 'farmerstail.kr' || host.endsWith('.farmerstail.kr')) return 'farmerstail'
  return 'none'
}

export function resolveAccent(setting: string | null | undefined, href: string): AccentKey {
  if (setting && setting !== 'auto' && isAccentSetting(setting)) return setting as AccentKey
  return inferAccent(href)
}

/** 인라인 스타일용 테마 — Tailwind 임의값으로는 그라데이션 배지가 번거로워 색은 여기서. */
export type AccentTheme = {
  /** 카드 상단 라인 background (없으면 라인 생략). */
  line: string | null
  badgeBg: string
  badgeFg: string
  arrowBg: string
  arrowFg: string
  /** 카드 테두리 색. */
  border: string
}

const IG_GRADIENT = 'linear-gradient(90deg, #F58529 0%, #DD2A7B 45%, #8134AF 75%, #515BD4 100%)'

export const ACCENT_THEMES: Record<AccentKey, AccentTheme> = {
  none: {
    line: null,
    badgeBg: '#1E1A14',
    badgeFg: '#FAF9F5',
    arrowBg: 'rgba(30,26,20,0.08)',
    arrowFg: '#1E1A14',
    border: 'rgba(0,0,0,0.05)',
  },
  instagram: {
    line: IG_GRADIENT,
    // 배지는 단색 — 그라데이션 위 흰 글자가 안 읽혔다(사장님 2026-09-26). 라인만 그라데이션.
    badgeBg: '#DD2A7B',
    badgeFg: '#FFFFFF',
    arrowBg: 'rgba(221,42,123,0.12)',
    arrowFg: '#DD2A7B',
    border: 'rgba(221,42,123,0.28)',
  },
  naver: {
    line: '#03C75A',
    badgeBg: '#03C75A',
    badgeFg: '#FFFFFF',
    arrowBg: 'rgba(3,199,90,0.12)',
    arrowFg: '#03C75A',
    border: 'rgba(3,199,90,0.30)',
  },
  coupang: {
    line: '#E52528',
    badgeBg: '#E52528',
    badgeFg: '#FFFFFF',
    arrowBg: 'rgba(229,37,40,0.12)',
    arrowFg: '#E52528',
    border: 'rgba(229,37,40,0.28)',
  },
  farmerstail: {
    line: '#C86B45',
    badgeBg: '#C86B45',
    badgeFg: '#FFFFFF',
    arrowBg: 'rgba(200,107,69,0.12)',
    arrowFg: '#C86B45',
    border: 'rgba(200,107,69,0.30)',
  },
}
