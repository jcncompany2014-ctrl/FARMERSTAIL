/**
 * 고객에게 보여줄 **원재료명 목록** — 4 SKU 정본 (이름만, 배합% 없음).
 *
 * # 출처 (2026-08-25 대조 확인)
 * 사장님 마스터 문서 `파머스테일_화식_제조공정_표준`(v8 배합표) · 사료성분등록
 * 서류 `붙임2_화식`(정부 제출) · 프로덕션 `products.ingredients` — **세 곳이
 * 일치**한다. 이 파일은 그 이름 순서(함량 많은 순)를 그대로 옮긴 것이다.
 *
 * # 왜 하드코딩된 옛 목록을 버렸나
 * PlanClient 안에 있던 목록은 **정본과 달랐다**: 존재하지 않는 토핑(브로콜리·
 * 비트·애호박·양배추)을 넣고, 강황을 4종 전부에 붙이고, 정제수까지 적었다.
 * 원재료 표시는 사료관리법 표시사항이라 화면이 서류와 달라선 안 된다.
 *
 * # ★강황은 닭 SKU 전용이다
 * 사장님 기억("전 재료 전부 강황")과 달리 마스터·서류·DB 모두 **닭에만** 강황
 * 0.5% 다. 나머지는 SKU 토핑이 각각 사과(오리)·무(돼지)·블루베리(소)다.
 * 4종이 다 노란 것은 강황이 아니라 공통 채소(단호박·고구마·당근) 때문이다.
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
  /** 공통 채소·곡물 (4종 동일). */
  veg: string[]
  /** 오일·보충 (4종 동일). */
  base: string[]
  /** 이 SKU 만의 토핑 1종 — 여기가 SKU 성격을 가른다. */
  topping: string
}

/** 4종 공통 — 마스터 v8 배합표의 채소·곡물. */
const COMMON_VEG = ['현미', '고구마', '당근', '단호박', '시금치']
/** 4종 공통 — 오일 2종 + 자체 프리믹스(사장님 2026-08-25 브랜드명). */
const COMMON_BASE = [
  '올리브유',
  '연어유',
  '파머스테일 뉴트리 코어(비타민·미네랄 프리믹스)',
]

export const RECIPE_INGREDIENTS: Record<FoodLine, RecipeIngredients | null> = {
  weight: {
    main: '닭가슴살',
    organs: ['닭간', '닭염통'],
    veg: COMMON_VEG,
    base: COMMON_BASE,
    topping: '강황',
  },
  basic: {
    main: '오리 안심',
    organs: ['오리간', '오리염통'],
    veg: COMMON_VEG,
    base: COMMON_BASE,
    topping: '사과',
  },
  joint: {
    main: '흑돼지 뒷다리살',
    organs: ['흑돼지간', '흑돼지염통'],
    veg: COMMON_VEG,
    base: COMMON_BASE,
    topping: '무',
  },
  premium: {
    main: '한우 목심',
    organs: ['한우간', '한우염통'],
    veg: COMMON_VEG,
    base: COMMON_BASE,
    topping: '블루베리',
  },
  // 연어(skin)는 판매 SKU 가 아니다 — 없는 레시피의 재료를 지어내지 않는다.
  skin: null,
}

/**
 * 카드 노출용 발췌 — 메인 + 내장 + 그 SKU 토핑.
 * 전체가 아니므로 호출부가 끝에 '등'을 붙인다(사장님 2026-08-25).
 */
export function cardIngredientNames(line: FoodLine): string[] {
  const r = RECIPE_INGREDIENTS[line]
  return r ? [r.main, ...r.organs, r.topping] : []
}

/** 상세 시트용 전체 목록 — 서류 순서(함량 많은 순)에 맞춰 이름만. */
export function fullIngredientNames(line: FoodLine): string[] {
  const r = RECIPE_INGREDIENTS[line]
  return r ? [r.main, ...r.organs, ...r.veg, ...r.base, r.topping] : []
}
