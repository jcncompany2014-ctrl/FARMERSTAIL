/**
 * 제품 패키지 실사 — 라인/단백질 → `public/pkg/*.webp` 경로 (정본 한 곳).
 *
 * # 왜 DB(products.image_url) 가 아니라 여기인가 (사장님 2026-08-25)
 * 앱 화면(주문·플랜·구독)은 **DB 이미지를 한 번도 그리지 않았다** — 원형 자리는
 * 🍲 이모지였다. 그런데 DB 엔 이미지가 들어 있어서 "있는데 안 보인다"는 착시가
 * 있었다(사장님이 정확히 그렇게 기억하셨고 맞았다). 실사 패키지가 나왔으니
 * 앱이 실제로 그리게 하되, 경로는 **번들 자산**으로 둔다:
 *   · 앱 화면은 라인(FoodLine)만 알고 상품 행을 안 읽는 자리가 많다
 *   · 재고 0·판매중지로 상품 행이 빠져도 "무엇을 담는지" 그림은 보여야 한다
 *   · 스토리지 URL 은 CDN 캐시·권한 변경에 걸리지만 번들 자산은 배포와 함께 간다
 * DB image_url 은 어드민·주문 상세(운영 화면)가 계속 쓴다 — 거긴 실제 상품 행을
 * 다루는 자리라 정본이 맞다.
 *
 * 파일: `public/pkg/{protein}.webp`(정사각 400, 원형 슬롯용) ·
 *       `{protein}-wide.webp`(가로 1000, 카드·상세용). 원본은 사장님 실촬영.
 */
import type { FoodLine } from './types.ts'
import { LEGACY_LINE_TO_PROTEIN } from './skuModel.ts'

/** 패키지 사진이 있는 단백질 — 4종 SKU. 연어·양은 판매 안 함(사진 없음). */
const HAS_PACKAGE = new Set(['chicken', 'duck', 'pork', 'beef'])

/**
 * 단백질 키 → 패키지 사진 경로. 없으면 null(호출부가 이모지 등으로 폴백).
 * @param wide true 면 가로판(카드·상세), false 면 정사각(원형 슬롯).
 */
export function packageImageForProtein(
  protein: string | null | undefined,
  wide = false,
): string | null {
  if (!protein || !HAS_PACKAGE.has(protein)) return null
  return `/pkg/${protein}${wide ? '-wide' : ''}.webp`
}

/** 라인(FoodLine) → 패키지 사진 경로. skin(연어)은 판매 SKU 가 아니라 null. */
export function packageImageForLine(
  line: FoodLine | null | undefined,
  wide = false,
): string | null {
  if (!line) return null
  return packageImageForProtein(LEGACY_LINE_TO_PROTEIN[line], wide)
}
