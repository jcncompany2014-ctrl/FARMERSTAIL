/**
 * 고객에게 보여줄 **원재료명 목록** — 4 SKU 정본 (이름만, 배합% 없음).
 *
 * # 출처 — 사장님 확정 배합표 (v4.0 LAST · 생 기준 · 정제수 0% · 육즙 분산)
 * 2026-08-25 사장님이 직접 보여준 마스터 표가 유일한 정본이다.
 *
 * ## ★내가 틀렸던 것 (2026-08-25, 사장님 지적)
 * 구글드라이브의 **옛 문서**(제조공정 표준 v8)만 보고 "강황은 닭 전용"이라고
 * 단정해 강황을 3종에서 빼고, 컨셉 토핑(브로콜리·비트·애호박·양배추·사과·
 * 블루베리)까지 "배합표에 없는 유령 재료"로 몰아 지웠다. **전부 실재하는
 * 재료였다.** 확정 배합표에는:
 *   · 강황 0.10% — **전 SKU 공통** (사장님 기억이 맞았다)
 *   · 컨셉 토핑이 **2종**이다 — hero 1.5%(4종 전부 다름) + support 1.0%
 *   · 난각분말 0.53% — v4 신규(Ca:P 교정), 전 SKU 공통
 * 옛 문서를 정본으로 삼은 것이 원인이다. 배합은 사장님 확정 표만 본다.
 *
 * ## 확정 배합표 구조 (이름만 옮김 — %는 여기 두지 않는다)
 *   메인 단백질 · 내장 2종(간·심장) · 채소 3종(당근·단호박·시금치) ·
 *   곡물 2종(현미·고구마) · 오일 2종(올리브유·연어유) · 강황(공통) ·
 *   컨셉 토핑 hero + support · 프리믹스 v1.4 · 난각분말
 *
 * # 배합% 는 여기에 절대 넣지 않는다
 * 배합비는 대외비(영업비밀)이고 어드민 라벨 화면(`/admin/label/[sku]`)만
 * products.ingredients 로 본다. 규칙63 테스트가 숫자 유출을 막는다.
 */
import type { FoodLine } from './personalization/types.ts'

export type RecipeIngredients = {
  /** 메인 단백질 — 카드 첫 줄. */
  main: string
  /** 내장 2종(간·심장). */
  organs: string[]
  /** 컨셉 토핑 — [hero, support]. hero 는 4종 전부 다르다. */
  toppings: [string, string]
  /** 공통 채소·곡물. */
  veg: string[]
  /** 공통 오일·보충(강황·프리믹스·난각분말 포함). */
  base: string[]
}

/** 4종 공통 — 확정 배합표의 채소 3종 + 곡물 2종. */
const COMMON_VEG = ['당근', '단호박', '시금치', '현미', '고구마']
/**
 * 4종 공통 — 오일 2종 + **강황(전 SKU 공통)** + 자체 프리믹스 + 난각분말.
 * 프리믹스는 사장님 지시로 브랜드명(2026-08-25), 난각분말은 v4 신규.
 */
const COMMON_BASE = [
  '올리브유',
  '연어유',
  '강황',
  '파머스테일 뉴트리 코어(비타민·미네랄 프리믹스)',
  '난각분말',
]

export const RECIPE_INGREDIENTS: Record<FoodLine, RecipeIngredients | null> = {
  weight: {
    main: '닭가슴살',
    organs: ['닭간', '닭염통'],
    toppings: ['브로콜리', '블루베리'],
    veg: COMMON_VEG,
    base: COMMON_BASE,
  },
  basic: {
    main: '오리 안심',
    organs: ['오리간', '오리염통'],
    toppings: ['애호박', '사과'],
    veg: COMMON_VEG,
    base: COMMON_BASE,
  },
  joint: {
    // 부위 변경 — 안심 → 뒷다리살 (사장님 2026-08-25)
    main: '흑돼지 뒷다리살',
    organs: ['흑돼지간', '흑돼지염통'],
    toppings: ['무', '양배추'],
    veg: COMMON_VEG,
    base: COMMON_BASE,
  },
  premium: {
    main: '한우 목심',
    organs: ['한우간', '한우염통'],
    toppings: ['비트', '블루베리'],
    veg: COMMON_VEG,
    base: COMMON_BASE,
  },
  // 연어(skin)는 판매 SKU 가 아니다 — 없는 레시피의 재료를 지어내지 않는다.
  skin: null,
}

/**
 * 카드 노출용 발췌 — 메인 + 내장 + 컨셉 토핑 2종.
 * 전체가 아니므로 호출부가 끝에 '등'을 붙인다(사장님 2026-08-25).
 */
export function cardIngredientNames(line: FoodLine): string[] {
  const r = RECIPE_INGREDIENTS[line]
  return r ? [r.main, ...r.organs, ...r.toppings] : []
}

/** 상세 시트용 전체 목록 — 이름만. */
export function fullIngredientNames(line: FoodLine): string[] {
  const r = RECIPE_INGREDIENTS[line]
  return r ? [r.main, ...r.organs, ...r.veg, ...r.toppings, ...r.base] : []
}
