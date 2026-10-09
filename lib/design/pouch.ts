/**
 * 박스 카드 색 — 실제 레시피 파우치 색 규칙 (앱 새 디자인 'A 포스터', 2026-10-09).
 *
 * # 왜 (사장님 10/9 "실제 우리 레시피 파우치 색들로 바꾸면 안되나 반반은 그냥 테두리를 바꾼다던지" → "반반 1로 가자")
 * 홈의 '이번 박스'·'다음 정기배송' 카드가 늘 머스타드였다. 박스에 든 레시피 파우치 색을 입혀
 * 무엇이 오는지 색으로 바로 알게 한다(캔버스 BoxColor-* 시안).
 *  · 레시피 한 가지 = 그 파우치 색 바탕 + 먹색 2px 테두리·4px 그림자(도장 그림자)
 *  · 두 가지(반반) = 첫째 색 바탕 + 둘째 색 3px 테두리·5px 그림자
 *  · 레시피를 모르거나 강아지 여러 마리를 한 카드에 묶을 때 = 머스타드 바탕 + 먹색 도장 그림자
 *  · 한우 바탕만 흰 글자 — 먹 글자는 3.8:1 이라 본문 글자로 못 쓴다(lib/design/contrast 장식 쌍).
 *
 * 레시피 이름(subscription_items.product_name — "닭고기 화식 (120g 한 끼)" 꼴)에서 파우치를 읽는다.
 * 토퍼(채소 토퍼 등)는 파우치가 아니라 색에서 뺀다.
 *
 * 순서가 색을 정하므로(첫째 = 바탕) **DB 순서에 맡기지 않는다** — 정렬 없는 조회는 새로고침마다
 * 순서가 바뀔 수 있어 카드 색이 깜빡인다. 팩 수가 많은 레시피가 먼저, 같으면 닭 → 흑돼지 → 한우 → 오리.
 */

import { POUCH, V3 } from './tokens.ts'
import type { FoodLine } from '../personalization/types'

export type PouchLine = keyof typeof POUCH

/**
 * 레시피 라인(FoodLine) → 파우치. lib/personalization/skuModel 의 LEGACY_LINE_TO_PROTEIN 과 같은 짝이다
 * (weight=닭 · basic=오리 · premium=한우 · joint=흑돼지). 연어(skin)는 판매 레시피가 아니라 없다.
 * 레시피 고르기·주문하기가 이름 앞 네모·사진 테두리 색을 여기서 읽는다.
 */
export const FOOD_LINE_POUCH: Partial<Record<FoodLine, PouchLine>> = {
  weight: 'chicken',
  basic: 'duck',
  premium: 'beef',
  joint: 'pork',
}

/**
 * 앱 화면의 레시피 이름 — 상품 이름(products.name "닭고기 화식")·캔버스 시안과 같은 말.
 * 엔진 표시명(FOOD_LINE_META.nameKo '치킨', 2026-07-15)과 갈려 있어서, 앱 새 디자인(2026-10-09)은 시안을 따라
 * 한 화면 안에서 '닭고기'로 맞춘다(홈·정기배송은 상품 이름을 그대로 써서 이미 '닭고기'). 웹은 손대지 않았다.
 */
export const POUCH_NAME: Record<PouchLine, string> = {
  chicken: '닭고기',
  duck: '오리',
  pork: '흑돼지',
  beef: '한우',
}

/** 같은 팩 수일 때의 순서(시안: 닭+흑돼지 = 닭 바탕, 한우+오리 = 한우 바탕). */
const LINE_ORDER: readonly PouchLine[] = ['chicken', 'pork', 'beef', 'duck']

/** 레시피 이름 → 파우치. 토퍼·모르는 이름은 null. */
export function pouchLineFromName(name: string): PouchLine | null {
  const n = name.replace(/\s*\([^)]*\)\s*$/, '')
  if (/토퍼/.test(n)) return null
  if (/닭|치킨/.test(n)) return 'chicken'
  if (/오리/.test(n)) return 'duck'
  if (/돼지/.test(n)) return 'pork'
  if (/한우|소고기/.test(n)) return 'beef'
  return null
}

export type RecipeItem = { name: string; quantity?: number | null }

/**
 * 박스 레시피 → 표시 순서대로 정리. 같은 파우치는 하나로 합친다.
 * label = 화면 한 줄("닭고기 · 흑돼지 화식"), lines = 색 순서.
 */
export function boxRecipes(items: RecipeItem[]): { lines: PouchLine[]; label: string | null } {
  const byLine = new Map<PouchLine, { qty: number; name: string }>()
  const others: string[] = []
  for (const it of items) {
    const line = pouchLineFromName(it.name)
    const clean = it.name.replace(/\s*\([^)]*\)\s*$/, '').trim()
    if (!line) {
      if (clean && !/토퍼/.test(clean)) others.push(clean)
      continue
    }
    const prev = byLine.get(line)
    const qty = (prev?.qty ?? 0) + Math.max(0, it.quantity ?? 1)
    byLine.set(line, { qty, name: prev?.name ?? clean })
  }
  const lines = [...byLine.entries()]
    .sort((a, b) => b[1].qty - a[1].qty || LINE_ORDER.indexOf(a[0]) - LINE_ORDER.indexOf(b[0]))
    .map(([l]) => l)
  const names = lines.map((l) => byLine.get(l)!.name)
  if (names.length === 0) return { lines, label: others.length > 0 ? others.join(' · ') : null }
  // "닭고기 화식" + "흑돼지 화식" → "닭고기 · 흑돼지 화식" (같은 꼬리말은 한 번만)
  const tail = names.every((x) => / 화식$/.test(x)) ? ' 화식' : ''
  const heads = tail ? names.map((x) => x.replace(/ 화식$/, '')) : names
  return { lines, label: heads.join(' · ') + tail }
}

export type BoxCardColors = {
  /** 카드 바탕 */
  face: string
  /** 테두리 색 */
  edge: string
  /** 테두리 두께(px) */
  edgeWidth: number
  /** 그림자 거리(px) — 테두리 색으로 */
  shadow: number
  /** 바탕 위 글자색 */
  text: string
  /** 진행 막대 — 지난 단계 / 남은 단계 */
  barOn: string
  barOff: string
  /** 카드 안 나눔선 */
  divider: string
}

/** 레시피 파우치 목록(표시 순서) → 카드 색. 빈 목록·여러 마리 묶음은 머스타드. */
export function boxCardColors(lines: readonly PouchLine[]): BoxCardColors {
  const first = lines[0]
  const face = first ? POUCH[first] : V3.mustard
  const lightText = first === 'beef'
  const text = lightText ? '#FFFFFF' : V3.ink
  const barOn = lightText ? '#FFFFFF' : V3.ink
  const barOff = lightText ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)'
  const divider = lightText ? 'rgba(255,255,255,0.35)' : 'rgba(20,20,20,0.18)'
  const second = lines[1]
  if (second) {
    return { face, edge: POUCH[second], edgeWidth: 3, shadow: 5, text, barOn, barOff, divider }
  }
  return { face, edge: V3.ink, edgeWidth: 2, shadow: 4, text, barOn, barOff, divider }
}

/** 카드 테두리·그림자 스타일 한 번에. */
export function boxCardFrame(c: BoxCardColors): { background: string; border: string; boxShadow: string; color: string } {
  return {
    background: c.face,
    border: `${c.edgeWidth}px solid ${c.edge}`,
    boxShadow: `${c.shadow}px ${c.shadow}px 0 ${c.edge}`,
    color: c.text,
  }
}
