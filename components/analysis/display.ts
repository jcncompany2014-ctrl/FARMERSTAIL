/**
 * 분석·리포트 화면의 "보여 주는 말과 색" 정본 — 2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08·D09·A01~A10).
 *
 * 계산 값(kcal·g·체형 점수)은 그대로 두고, 화면에 쓰는 이름·색·날짜 꼴만 정한다.
 *  · 레시피 이름은 박스·주문과 같은 말(닭고기·오리·흑돼지·한우). 엔진 라인 키(weight 등)를 화면에 드러내지 않는다.
 *  · 레시피 색은 시안의 레시피 색(띠·점·막대에만 — 큰 면은 칠하지 않는다).
 *  · 체형은 'BCS 4-5' 같은 저장 라벨 대신 보호자가 아는 말(규칙44). 판정 구간은 lib/bcs-consistency 의 bcsWord 와 같다.
 */

import type { FoodLine } from '@/lib/personalization/types'
import { LEGACY_LINE_TO_PROTEIN, type ProteinKey } from '@/lib/personalization/skuModel'
import { FOOD_LINE_POUCH, POUCH_NAME, POUCH_NAME_EN, POUCH_PRODUCT_KO } from '@/lib/design/pouch'

/** 화면에 쓰는 레시피 이름 — 앱 정본(lib/design/pouch POUCH_NAME '닭고기'…)과 같은 말. 연어는 판매 안 함(이름만). */
export const RECIPE_NAME: Record<ProteinKey, string> = {
  ...POUCH_NAME,
  salmon: '연어',
}

/** 레시피 색 — 띠·점·막대 전용(시안 D08 추천 레시피·A10 비교). */
export const RECIPE_COLOR: Record<ProteinKey, string> = {
  chicken: '#D4A24C',
  duck: '#2F8F8B',
  pork: '#2E3338',
  beef: '#C63D2A',
  salmon: '#9A9A9A',
}

/** 작은 칩·긴 막대용 — 흑돼지 먹색은 칩·막대에선 너무 무거워 회색으로(시안 D09 고르기 칸·A10 막대). */
export const RECIPE_CHIP: Record<ProteinKey, string> = {
  ...RECIPE_COLOR,
  pork: '#9AA0A6',
}

export function proteinOfLine(line: FoodLine): ProteinKey {
  return LEGACY_LINE_TO_PROTEIN[line]
}

export function recipeNameOfLine(line: FoodLine): string {
  return RECIPE_NAME[proteinOfLine(line)]
}

/**
 * 레시피 '제목' — 큰 이름은 팩에 찍힌 영어, 아래 회색은 한글 상품 이름(사장님 2026-10-10 — 손님이 냉동실 팩과 바로 맞춰 본다).
 * 팩이 없는 라인(연어 — 판매 안 함)은 en = null 이라 한글 이름만. 두 레시피를 한 줄에 잇는 자리는 recipeNameOfLine 그대로.
 */
export function recipeTitleOfLine(line: FoodLine): { en: string | null; ko: string } {
  const pouch = FOOD_LINE_POUCH[line]
  return pouch ? { en: POUCH_NAME_EN[pouch], ko: POUCH_PRODUCT_KO[pouch] } : { en: null, ko: recipeNameOfLine(line) }
}

export function recipeColorOfLine(line: FoodLine): string {
  return RECIPE_COLOR[proteinOfLine(line)]
}

export function recipeChipOfLine(line: FoodLine): string {
  return RECIPE_CHIP[proteinOfLine(line)]
}

/**
 * 체형 — 보호자가 아는 말. 구간은 bcsWord(lib/bcs-consistency)와 같다(≤3 마름 · ≤5 알맞음 · 6 살짝 통통 · 7+ 통통).
 *  · `phrase` = "알맞은 체형"(시안 D08 요약 줄·칩·문장)
 *  · `word`   = "알맞음"(시안 A06 기록 칸·"체형 알맞음")
 * 체형 답이 없던 분석(저장 라벨 '…미입력')은 점수가 기본값 5라 "알맞음"으로 말하면 거짓이 된다 — 미입력이라고 말한다.
 */
export function bodyShape(
  score: number | null | undefined,
  storedLabel?: string | null,
): { phrase: string; word: string } {
  if ((storedLabel ?? '').includes('미입력') || score == null || !Number.isFinite(score)) {
    return { phrase: '체형 미입력', word: '미입력' }
  }
  if (score <= 3) return { phrase: '마른 체형', word: '마름' }
  if (score <= 5) return { phrase: '알맞은 체형', word: '알맞음' }
  if (score <= 6) return { phrase: '살짝 통통한 체형', word: '살짝 통통' }
  return { phrase: '통통한 체형', word: '통통' }
}

/** 생애 단계 칩 — '성견 (유지기)' → '성견'(시안 D08). 괄호 속 덧말(퍼피·시니어 등)은 뺀다. */
export function stageChip(stage: string | null | undefined): string {
  const s = (stage ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  return s || '성견'
}

/** 계수 표기 — 1.40 → "1.4", 1.25 → "1.25"(시안 "기초 에너지 429 × 1.4"). */
export function factorText(n: number): string {
  return (Math.round(Math.abs(n) * 100) / 100).toString()
}

/** 숫자 + 은/는 — 끝자리 읽는 소리로 고른다(1.4는 · 1.6은 · 1.25는). */
export function numTopic(text: string): string {
  const last = text.replace(/[^0-9]/g, '').slice(-1)
  return `${text}${last !== '' && '013678'.includes(last) ? '은' : '는'}`
}

/**
 * 분석 날짜 — 올해 것은 "9월 30일"(시안 D08), 지난해 것·지난 분석 보기는 "2026년 6월 2일"(시안 A07).
 * 보는 사람 기기의 날짜로 센다(클라이언트 화면).
 */
export function analysisDateText(iso: string, opts: { withYear?: boolean } = {}): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const md = `${d.getMonth() + 1}월 ${d.getDate()}일`
  return opts.withYear || !sameYear ? `${d.getFullYear()}년 ${md}` : md
}
