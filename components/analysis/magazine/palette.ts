/**
 * Farmer's Tail — Magazine Edition palette (2026-05-21).
 *
 * 분석 페이지 디자인. CSS var 가 아닌 inline style 로 전달.
 *
 * 2026-06-19 (사장님 "분석결과도 구독 글랜스 카드 느낌으로 갈아엎어") — 웜 크림
 * surface → **v3 토큰 흰 카드 on paper** 로 통일. bg=paper(#F7F5F0)·card=흰색·
 * line=중성 rule 로 바꿔 /order 클린 카드 언어와 일치(텍스트 대비도 ↑). ink/
 * brand 계열은 이미 v3 정렬(#1 회차). 카테고리색(olive/wine/ochre/blush)은
 * 차트 구분성 + FOOD_LINE_META 와의 일원화는 다음 회차.
 */

import { FOOD_LINE_META } from '@/lib/personalization/lines'

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
  bg: '#F7F5F0',
  bgDeep: '#EDE8D9',
  card: '#FFFFFF',
  cardSoft: '#F0EBE0',
  ink: '#16140f',
  ink2: '#3a342a',
  muted: '#706854',
  line: '#E4DFD3',
  brand: '#C86B45',
  brandDeep: '#782E22',
  accentOlive: '#3C725E',
  accentWine: '#8E4D4D',
  accentOchre: '#e6b942',
  accentBlush: '#C99CA5',
}

/**
 * 5종 박스 시맨틱 색 — 2026-06-19 사장님 "분석↔박스↔주문 색 통일" → FOOD_LINE_META
 * (주문·formula 카드와 동일 SSOT)에서 가져와 페이지 간 라인색 일치. (이전엔
 * 매거진 전용 accent라 같은 '닭'이 페이지마다 다른 색이었음.) `_p`는 시그니처
 * 호환용(미사용). FOOD_LINE_META.color 는 일부 var(--token) → 알파 합성 시
 * `${color}22` 대신 color-mix 사용할 것(BoxMixCard).
 */
export function lineColors(_p: MagazinePalette) {
  return {
    basic: FOOD_LINE_META.basic.color,
    weight: FOOD_LINE_META.weight.color,
    skin: FOOD_LINE_META.skin.color,
    premium: FOOD_LINE_META.premium.color,
    joint: FOOD_LINE_META.joint.color,
  } as const
}

export type BoxLineKey = keyof ReturnType<typeof lineColors>
