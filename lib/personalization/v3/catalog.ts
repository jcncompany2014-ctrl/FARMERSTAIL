import type { BaseSku, FunctionalSource } from './types.ts'

/**
 * Layer A 베이스 SKU 카탈로그 — 확정 4종 SSOT.
 *
 * # 효능 문구 검증 (근거있는 추천)
 * 마스터레시피(파머스테일_화식_마스터레시피.xlsx) 「7.영양검증결과」의
 * 4 SKU × 25영양소 충족률로 검증. 충족률 = SKU 함량 / 채택값.
 * 채택값 = MAX(FEDIAF 2024, AAFCO 2024) × 1.15.
 *
 * **T1("~풍부한") 컷오프 = 충족률 ≥ 250%.** 레시피 자체가 250%+ 를
 * "안전과잉 = 자연 원물 풍부"로 분류 → 그 기준선을 객관 컷오프로 채택(임의 X).
 * T2 = 일반 영양 특성(메커니즘). T3 = "도움이 될 수 있는"(완곡).
 * 질병 치료·예방 표방은 전면 금지(사료법) — catalog.test 가드.
 *
 * # 정직성 교정 (2026-06, 원본 충족률 재확인)
 *  - 소 철 164% · 아연 165% < 250% → "철·아연 풍부"(T1) 미사용. 헴철은 형태
 *    (T2)로만. 소의 T1 강점은 B12(464%)·구리(365%).
 *  - 오리 피부·모질은 불포화지방(지방 434% 최다) 메커니즘 T3 보조. 오리 1차
 *    T1 강점은 철(292%)·구리(283%)·엽산(825%).
 *  - 미량영양 강점은 내장 2종(간+심장)에서 옴 — 완제 SKU 검증값.
 *  - id 는 현 활성 제품 slug 와 일치(products 매칭).
 */
export const BASE_SKUS: readonly BaseSku[] = [
  {
    id: 'chicken-basic',
    protein: 'chicken',
    nameKr: '치킨',
    nameEn: 'Daily Chicken Recipe',
    kcalPer100g: 115, // 2026-07-11 검정 확정
    fitTags: { weight_loss: 0.9, maintain: 0.7, activity_low: 0.6, palatability: 0.5 },
    claims: [
      {
        text: '낮은 열량 밀도(115kcal)로 체중 관리에 적합',
        grade: 'T2',
        basis: '4 SKU 중 최저 kcal/100g — 돼지와 동률 (검정 확정 115)',
      },
      {
        text: '비타민 B3·B6가 풍부한',
        grade: 'T1',
        basis: '충족률 B3 1246% · B6 871% (≥250%)',
      },
      {
        text: '비교적 소화가 수월한 일상식',
        grade: 'T3',
        basis: '저지방 + 균형 단백 메커니즘',
      },
    ],
    excludeIfAllergy: ['닭·칠면조'],
    crossReactWith: [],
  },
  {
    id: 'duck-weight',
    protein: 'duck',
    nameKr: '오리',
    nameEn: 'Care Duck Recipe',
    kcalPer100g: 120, // 2026-07-11 검정 확정
    fitTags: { sensitive: 0.9, maintain: 0.6, palatability: 0.5, weight_loss: 0.4 },
    claims: [
      {
        text: '철분·구리·엽산이 풍부한',
        grade: 'T1',
        basis: '충족률 철 292% · 구리 283% · 엽산 825% (≥250%)',
      },
      {
        text: '불포화지방이 많아 피부·모질에 도움이 될 수 있는',
        grade: 'T3',
        basis: '지방 충족률 434% 최다 + 오메가 함유 (메커니즘)',
      },
      {
        text: '흔한 단백질(닭·소)을 피한 제한식 옵션',
        grade: 'T3',
        basis: 'novel 단백 — 해당 단백 미노출 견 한정(조건부)',
      },
    ],
    excludeIfAllergy: ['오리'],
    crossReactWith: ['닭·칠면조'],
  },
  {
    id: 'pork-joint',
    protein: 'pork',
    nameKr: '흑돼지',
    nameEn: 'Mild Pork Recipe',
    kcalPer100g: 115, // 2026-07-11 검정 확정
    fitTags: {
      palatability: 0.9,
      recovery: 0.9,
      senior: 0.7,
      sensitive: 0.6,
      maintain: 0.5,
    },
    claims: [
      {
        text: '비타민 B1(티아민)이 풍부한',
        grade: 'T1',
        basis: '충족률 714% — 4 SKU 중 최강 (≥250%)',
      },
      {
        text: '기호성이 높아 입맛이 까다롭거나 회복기인 아이에게',
        grade: 'positioning',
        basis: '돼지 안심 기호성 — 매칭용(효능 아님)',
      },
    ],
    excludeIfAllergy: ['돼지고기'],
    crossReactWith: [],
  },
  {
    id: 'beef-premium',
    protein: 'beef',
    nameKr: '한우',
    nameEn: 'Energy Beef Recipe',
    kcalPer100g: 120, // 2026-07-11 검정 확정
    fitTags: { weight_gain: 0.9, activity_high: 0.9, palatability: 0.6, maintain: 0.5 },
    claims: [
      {
        text: '지방 에너지 비중이 높아(지방 28.7%DM 최다) 고활동·증량에 적합',
        grade: 'T2',
        basis: '지방 %DM 4 SKU 최고 · kcal 120 (오리와 동률 최고, 검정 확정)',
      },
      {
        text: '비타민 B12·구리가 풍부한',
        grade: 'T1',
        basis: '충족률 B12 464% · 구리 365% (≥250%)',
      },
      {
        text: '흡수가 잘 되는 헴철 형태로 함유',
        grade: 'T2',
        basis: '한우 목심 헴철(형태 주장) — 철 충족률 164%라 "풍부"는 미사용',
      },
    ],
    excludeIfAllergy: ['소고기', '양고기'],
    crossReactWith: ['양고기'],
  },
]

/**
 * Layer B 기능성 소스 카탈로그.
 *
 * 전부 coming_soon — 실제 소스 상품 출시 시 status='available' +
 * ingredientBasis 확정. **효능 책임은 소스가 진다(베이스 SKU 아님).**
 * 베이스 레시피에 의학적 효능을 박지 않기 위한 분리. (사료법: 치료 효능 표방 X.)
 */
export const FUNCTIONAL_SOURCES: readonly FunctionalSource[] = [
  {
    id: 'source-skin',
    nameKr: '피부·모질 보완',
    targetConcern: 'skin',
    status: 'coming_soon',
    ingredientBasis: '오메가3(EPA/DHA) 계열 — 출시 시 확정',
  },
  {
    id: 'source-joint',
    nameKr: '관절 보완',
    targetConcern: 'joint',
    status: 'coming_soon',
    ingredientBasis: '글루코사민·콘드로이틴 계열 — 출시 시 확정',
  },
  {
    id: 'source-digestion',
    nameKr: '장·소화 보완',
    targetConcern: 'digestion',
    status: 'coming_soon',
    ingredientBasis: '프로바이오틱스·식이섬유 계열 — 출시 시 확정',
  },
  {
    id: 'source-immune',
    nameKr: '면역 보완',
    targetConcern: 'immune',
    status: 'coming_soon',
    ingredientBasis: '항산화·베타글루칸 계열 — 출시 시 확정',
  },
]

/** id → BaseSku 조회. */
export const BASE_SKU_BY_ID: Record<string, BaseSku> = Object.fromEntries(
  BASE_SKUS.map((s) => [s.id, s]),
)
