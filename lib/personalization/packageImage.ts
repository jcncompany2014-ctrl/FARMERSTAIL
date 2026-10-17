/**
 * 레시피 팩·그릇 사진 — 라인/단백질 → `public/*` 경로 (정본 한 곳).
 *
 * # 왜 DB(products.image_url) 가 아니라 여기인가 (사장님 2026-08-25)
 * 앱 화면(주문·플랜·구독)은 라인(FoodLine)만 알고 상품 행을 안 읽는 자리가 많고, 재고 0·판매중지로
 * 상품 행이 빠져도 "무엇을 담는지" 그림은 보여야 한다. 그래서 경로는 **번들 자산**으로 둔다.
 * DB image_url 은 어드민·주문 상세(운영 화면)가 계속 쓴다.
 *
 * # 2026-10-17 사장님 "이 사진 3개는 아예 삭제해 안 써 이제" — 쓰는 사진은 두 가지뿐이다
 *   · 팩 = **스튜디오 컷**(`/pouch-*.webp`, 밝은 무지 배경). 예전 주황·하늘색 폰 스냅샷(`/pkg/*`, 정사각·가로판)은 지웠다.
 *   · 그릇 = **사장님 실촬영 한 장**(`/bowl/fresh.webp`). 토핑을 올려 AI 로 만든 레시피별 그릇 4장(`/bowl/{protein}.webp`)은 지웠다.
 *   · 옛 흰 봉투 사진(`/meal-recipe.webp`)도 지웠다. 규칙289 가 이 셋이 돌아오는 걸 막는다.
 */
import type { FoodLine } from './types.ts'
import { LEGACY_LINE_TO_PROTEIN } from './skuModel.ts'

/**
 * 파우치 **스튜디오 컷** — 밝은 회색·흰 무지 배경(1200² 정사각, 파우치가 가운데 가로 ~78%).
 * 웹 랜딩·레시피 상세(`app/recipe/[protein]`)·앱 레시피 시트가 쓰는 원본. 무지 배경이라 호출부가
 * `mix-blend-mode: multiply` 로 시트 배경에 녹일 수 있다(사장님 2026-10-02).
 */
const STUDIO_POUCH_BY_PROTEIN: Record<string, string> = {
  chicken: '/pouch-chicken.webp',
  duck: '/pouch-duck.webp',
  pork: '/pouch-blackpork.webp',
  beef: '/pouch-hanwoo.webp',
}

/** 단백질 키 → 스튜디오 파우치 컷. 판매 안 하는 단백질(연어·양)·빈 값은 null(호출부가 폴백). */
export function studioPouchImage(
  protein: string | null | undefined,
): string | null {
  if (!protein) return null
  return STUDIO_POUCH_BY_PROTEIN[protein] ?? null
}

/** 라인(FoodLine) → 스튜디오 파우치 컷. skin(연어)은 판매 SKU 가 아니라 null. */
export function studioPouchImageForLine(
  line: FoodLine | null | undefined,
): string | null {
  if (!line) return null
  return studioPouchImage(LEGACY_LINE_TO_PROTEIN[line])
}

/**
 * 완성된 화식 그릇 — **사장님 실촬영 한 장, 4종 공용**. 4종 다 강황 베이스로 곱게 갈아 담아 겉모습이
 * 비슷하다 — 레시피 구분은 사진이 아니라 테두리·띠 색이 맡는다(없는 차이를 사진으로 지어내지 않는다).
 * 팩 사진이 없는 라인(연어)의 폴백으로도 쓴다.
 */
export const FRESH_BOWL_IMAGE = '/bowl/fresh.webp'
