/**
 * Farmer's Tail — Magazine Edition palette (2026-05-21).
 *
 * 분석 페이지 새 디자인 (Claude Design 'SURVEY TIME' handoff 기반).
 * 웜 크림 베이스 + 잡지 같은 톤. CSS var 가 아닌 inline style 로 전달 — 다크
 * 소일 / 세이지 메도우 멀티 팔레트는 별도 라운드에서.
 */

export interface MagazinePalette {
  bg: string
  bgDeep: string
  card: string
  cardSoft: string
  ink: string
  ink2: string
  muted: string
  line: string
  brand: string
  brandDeep: string
  accentOlive: string
  accentWine: string
  accentOchre: string
  accentBlush: string
}

export const WARM_CREAM: MagazinePalette = {
  bg: '#EFE7D2',
  bgDeep: '#E5DCC3',
  card: '#FBF6E7',
  cardSoft: '#F5EDD6',
  ink: '#1B1410',
  ink2: '#3B2E24',
  muted: '#7A6A5A',
  line: '#D8CDB3',
  brand: '#A0432C',
  brandDeep: '#7E3220',
  accentOlive: '#6B7E3B',
  accentWine: '#8E4D4D',
  accentOchre: '#C9A24A',
  accentBlush: '#C99CA5',
}

/** 5종 박스 시맨틱 색 매핑 (BoxMix · stacked bar). */
export function lineColors(p: MagazinePalette) {
  return {
    basic: p.brand,
    premium: p.accentWine,
    skin: p.accentOchre,
    weight: p.accentOlive,
    joint: p.accentBlush,
  } as const
}

export type BoxLineKey = keyof ReturnType<typeof lineColors>
