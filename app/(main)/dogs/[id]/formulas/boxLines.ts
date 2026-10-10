/**
 * 맞춤 박스 기록(/formulas)·새 식단 확인(/approve) 화면이 같이 쓰는 '박스에 담기는 레시피 줄' 정리.
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 S20·S21·S22).
 *
 *  · 화면에 그리는 박스는 snapBoxLines 로 스냅한 것 — 최대 2종(1종 100% / 2종 50:50). 원시 임상 비율을
 *    그리면 본 것과 받는 것이 달라진다(규칙34, boxComposition.ts 첫 문단).
 *  · 순서 = 비율 큰 것 먼저, 같으면 닭 → 흑돼지 → 한우 → 오리(lib/design/pouch 의 같은 팩 수일 때 순서와 같다 —
 *    카드 바탕색이 홈·정기배송 카드와 같은 레시피로 정해지게). 파우치가 없는 줄(연어)은 맨 뒤.
 *  · 이름 = lib/design/pouch 의 POUCH_NAME(앱 화면 레시피 이름 '닭고기'·'오리'·'흑돼지'·'한우').
 *  · 막대·범례 네모 색 = 분석 화면 정본 RECIPE_COLOR(components/analysis/display — 띠·점·막대 전용,
 *    시안 S20~S22 막대의 흑돼지 #2E3338). 파우치 색(POUCH)은 카드 바탕·테두리에만 쓴다(boxCardColors) —
 *    흑돼지 파우치 색(#BEBDB6)을 막대에 쓰면 닭 바탕(#D4A24C) 위에서 거의 안 보인다.
 */

import { snapBoxLines } from '@/lib/personalization/boxComposition'
import { FOOD_LINE_META } from '@/lib/personalization/lines'
import type { FoodLine, Ratio } from '@/lib/personalization/types'
import { recipeColorOfLine } from '@/components/analysis/display'
import { FOOD_LINE_POUCH, POUCH_NAME, type PouchLine } from '@/lib/design/pouch'

/** 같은 비율일 때의 순서 — lib/design/pouch 의 LINE_ORDER(닭 → 흑돼지 → 한우 → 오리)와 같다. */
const TIE_ORDER: readonly PouchLine[] = ['chicken', 'pork', 'beef', 'duck']

const tieRank = (line: FoodLine): number => {
  const p = FOOD_LINE_POUCH[line]
  return p ? TIE_ORDER.indexOf(p) : TIE_ORDER.length
}

export type BoxLine = { line: FoodLine; ratio: number }

/** 처방 비율 → 박스에 담기는 줄(스냅·표시 순서). 비율이 비었으면 빈 배열. */
export function orderedBoxLines(lineRatios: Record<string, number>): BoxLine[] {
  return snapBoxLines(lineRatios as Record<FoodLine, Ratio>)
    .slice()
    .sort((a, b) => b.ratio - a.ratio || tieRank(a.line) - tieRank(b.line))
}

/** 박스 줄 → 파우치 목록(boxCardColors 입력). 파우치가 없는 줄(연어)은 뺀다. */
export function pouchLinesOf(lines: readonly BoxLine[]): PouchLine[] {
  return lines
    .map((l) => FOOD_LINE_POUCH[l.line])
    .filter((p): p is PouchLine => p !== undefined)
}

/** 화면의 레시피 이름 — POUCH_NAME('닭고기' 등). 파우치가 없는 줄만 엔진 표시명. */
export function boxLineName(line: FoodLine): string {
  const p = FOOD_LINE_POUCH[line]
  return p ? POUCH_NAME[p] : FOOD_LINE_META[line].nameKo
}

/** 막대·범례 네모 색 — RECIPE_COLOR(시안 막대 색). 한곳에서만 정한다. */
export function boxLineColor(line: FoodLine): string {
  return recipeColorOfLine(line)
}
