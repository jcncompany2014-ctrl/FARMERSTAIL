/**
 * Farmer's Tail — 5종 SKU 영양 매트릭스 (Round C1, 2026-05-20)
 *
 * 5종 SKU 의 핵심 영양 5축 — 단백 / 지방 / Ca:P / EPA+DHA / 셀레늄(Se).
 *
 * # 기준
 * - 모든 % 는 dry matter (DM) 기준. NRC 2006 + FEDIAF 2024 가이드라인 권장량
 *   비교용. **최종 마스터 레시피 v2.1 유도값** (skuModel.ts 와 동일 DM 단면 —
 *   protein/fat/Ca/P/omega3 는 sheet7 충족률 × target, Se 는 충족률 × 40.25
 *   μg/100gDM × 10). 연어(S03) 만 제품 보류라 USDA 추정.
 * - EPA+DHA 는 % DM (omega3PctDM). 0.3% 이상이면 관절·심혈관 supportive.
 * - Selenium 은 mcg/kg 사료 (DM). FEDIAF 최소 350 / 최대 1,300 권장.
 *
 * # 5축 선정 근거
 *   protein  — 단백질량 (NRC adult 최소 18% DM)
 *   fat      — 지방 (NRC adult 최소 5.5% DM)
 *   ca_p     — 칼슘/인 비율 (NSH 가드 — 1.0-2.0 권장)
 *   epa_dha  — 오메가-3 EPA+DHA (관절·노령·심혈관)
 *   selenium — 면역·갑상선 (Se)
 *
 * # 사용처
 * - app/compare/page.tsx (5종 스파이더 차트)
 * - app/(main)/dogs/[id]/analysis/* (38영양소 게이지 — Round C2)
 */

import { type SkuKey, SKU_META } from './allergy-sku-matrix.ts'

/** 영양 매트릭스 1행 — DM 기준 */
export interface SkuNutritionRow {
  sku: SkuKey
  /** 단백질 % (DM 기준) */
  protein_pct: number
  /** 지방 % (DM 기준) */
  fat_pct: number
  /** Ca:P 비율 — 1.0 ~ 2.0 권장 */
  ca_p_ratio: number
  /** EPA + DHA % (DM 기준) */
  epa_dha_pct: number
  /** Selenium mcg/kg (DM 기준) */
  selenium_mcg_per_kg: number
  /** 한 줄 요약 — 카드용 */
  highlight_ko: string
  /** 추천 페르소나 */
  persona: SkuPersona[]
}

/**
 * /compare 의 '우리 아이에 맞게 골라보기' 칩. **판매 4종 안에서만** 성립해야 한다.
 *
 * 'senior' 를 뺀 이유(사장님 2026-07-15 "이거 지금 이제 노령 안 뜨니까 없애고"):
 * 노령은 연어(EPA/DHA)만 가리켰는데 연어를 목록에서 빼면서 고를 SKU 가 0개가 됐고,
 * 누르면 차트가 통째로 비었다. 4종으로 답할 수 없는 칩은 두면 안 된다.
 */
export type SkuPersona =
  | 'beginner'      // 입문 — 기본 균형형
  | 'diet'          // 다이어트 — 4종 중 지방 최저(치킨)
  | 'allergy'       // 알레르기 의심 — 흔치 않은 단백질
  | 'active'        // 활동多 — 고단백·고지방
  | 'sensitive'     // 소화 민감 — 가벼운 단백
  | 'palatability'  // 기호성 — 풍미가 진해 입 짧은 아이도 잘 먹는 쪽

/**
 * 5종 SKU 영양 매트릭스 — 자사 레시피 명세 기반.
 *
 * ⚠️ 이 값들은 **실험실 분석 결과가 아니라 레시피 설계값에서 유도한 추정치**다
 * (skuModel.ts 근거 주석: sheet3 목표 × sheet7 충족률, 오메가는 USDA 추정).
 * AAFCO 2024 / FEDIAF / NRC 기준값과 교차검증만 한 상태. 실제 시험 성적은 정식
 * 출시 후 자가품질검사(KAPA 분석)로 받아 갱신한다.
 * 고객 노출 문구에 '시제품 분석 결과' 처럼 적으면 안 된다 — 하지 않은 시험을
 * 했다고 표시하는 게 된다(2026-07-15 정정).
 */
export const SKU_NUTRITION: Record<SkuKey, SkuNutritionRow> = {
  C01: {
    sku: 'C01',
    protein_pct: 49.5,
    fat_pct: 19.1,
    ca_p_ratio: 1.11,
    epa_dha_pct: 0.17,
    selenium_mcg_per_kg: 688,
    highlight_ko: '고단백 저지방이라 담백해요. 체중 관리가 필요하거나 실내 생활이 많은 아이에게.',
    persona: ['beginner', 'diet'],
  },
  D02: {
    sku: 'D02',
    protein_pct: 40.6,
    fat_pct: 27.5,
    ca_p_ratio: 1.22,
    epa_dha_pct: 0.33,
    selenium_mcg_per_kg: 547,
    highlight_ko: '닭·소를 뺀 흔치 않은 단백질. 알레르기가 걱정되거나 속이 예민한 아이에게.',
    persona: ['allergy', 'sensitive'],
  },
  S03: {
    sku: 'S03',
    protein_pct: 26.0,
    fat_pct: 16.0,
    ca_p_ratio: 1.25,
    epa_dha_pct: 6.7,
    selenium_mcg_per_kg: 600,
    highlight_ko: '천연 EPA/DHA 최다. 피부·노령 supportive (준비 중).',
    persona: [],
  },
  P04: {
    sku: 'P04',
    protein_pct: 45.1,
    fat_pct: 21.8,
    ca_p_ratio: 1.10,
    epa_dha_pct: 0.17,
    selenium_mcg_per_kg: 986,
    highlight_ko: '제주산 흑돼지 안심으로 부드럽고 잘 먹어요. 속이 예민한 아이·노령견에게.',
    persona: ['allergy', 'sensitive', 'palatability'],
  },
  B05: {
    sku: 'B05',
    // 2026-07-14 사장님: DM 기준 단백질 38.7 → 40.2 로 상향.
    protein_pct: 40.2,
    fat_pct: 28.7,
    ca_p_ratio: 1.23,
    epa_dha_pct: 0.10,
    selenium_mcg_per_kg: 515,
    highlight_ko: '한우의 철분이 풍부해요. 활동량이 많은 아이의 활력에.',
    persona: ['active', 'palatability'],
  },
}

/**
 * 국제 영양 기준 (성견 유지) — AAFCO 2024 / FEDIAF.
 *
 * ⚠️ **'최소'와 '범위'는 다르다** (사장님 2026-07-15 "이 부분 보면 오히려 우리가
 *    충족을 안 해 다 오바하지, 이거는 괜찮은 거야?").
 *
 * 단백질·지방은 **최소 기준만** 있다 — AAFCO 성견 유지 프로파일은 조단백 18%DM
 * 이상, 조지방 5.5%DM 이상을 요구하고 **상한을 두지 않는다**. 우리 화식이 단백
 * 38~49%DM 인 건 기준 미달이 아니라 최소치를 넉넉히 넘긴 것이고, 고기가 많은
 * 화식이라 당연한 결과다(그게 파는 이유다). 그런데 표가 이걸 '18-35 범위'처럼
 * 보여줘서 우리가 상한을 넘긴 것처럼 읽혔다 → `kind` 로 최소/범위를 구분한다.
 *
 * 진짜 상한이 있는 건 과잉이 해로운 것들 — 비타민D·셀레늄·구리·비타민A. 판매
 * 4종은 전부 그 안에 있다(비타민D 680~1,270 IU/kg DM, 상한 3,000).
 * 연어가 12,000 IU/kg 로 4배 초과라 제품 보류 중인 것도 이 때문(skuModel 참고).
 *
 * TODO(사장님 확인): 셀레늄 상한 1,300 mcg/kg 의 출처. AAFCO 상한은 2 mg/kg
 * (=2,000 mcg/kg) 이고 EU 법정 상한은 그보다 낮다 — 어느 기준으로 표기할지
 * 확정 필요. 현재 4종(515~986)은 어느 쪽으로 봐도 범위 안이라 급하진 않다.
 */
export const FEDIAF_REFERENCE = {
  /** kind: 'min' = 이 값 **이상**이면 충족(상한 없음) / 'range' = 범위 안이어야 함. */
  protein_pct: { kind: 'min', min: 18, ideal: 25, max: 35 },
  fat_pct: { kind: 'min', min: 5.5, ideal: 13, max: 20 },
  ca_p_ratio: { kind: 'range', min: 1.0, ideal: 1.4, max: 2.0 },
  epa_dha_pct: { kind: 'min', min: 0.1, ideal: 0.4, max: 1.5 },
  selenium_mcg_per_kg: { kind: 'range', min: 350, ideal: 500, max: 1300 },
} as const

/**
 * 레이더 축 정규화 스케일 (차트 전용 — 표의 FEDIAF 권장 범위와 분리).
 *
 * 우리 화식은 고단백(38~49%DM)·고지방(19~29%DM)이라 FEDIAF 권장 상한(단백 35·
 * 지방 20)을 넘어선다. 정규화에 FEDIAF max 를 쓰면 4종 육류가 전부 100%로
 * 캡핑돼 스파이더가 뭉개지므로, 우리 제품군 실제 분포를 담는 별도 상한을 둔다.
 * (표의 "국제 기준" 행은 FEDIAF_REFERENCE 의 실제 기준값 그대로 사용.
 *  차트 하단 문구도 'FEDIAF 상한' 이라 쓰면 안 된다 — 이 축은 우리 분포다.)
 */
const RADAR_AXIS_MAX = {
  protein_pct: 55,
  fat_pct: 32,
  ca_p_ideal: 1.4,
  epa_dha_pct: 1.5,
  selenium_mcg_per_kg: 1300,
} as const

/**
 * 5축을 0-100 스케일로 정규화 — Recharts Radar 차트 입력용.
 *
 * 각 축은 RADAR_AXIS_MAX 대비 % (Ca:P 는 ideal 1.4 대비 %, EPA+DHA 는 연어가
 * 압도해 1.5 상한에서 캡핑 — 의도된 표현).
 */
export function normalizeForRadar(row: SkuNutritionRow): {
  '단백': number
  '지방': number
  'Ca:P': number
  'EPA+DHA': number
  'Se': number
} {
  return {
    '단백': Math.min(100, (row.protein_pct / RADAR_AXIS_MAX.protein_pct) * 100),
    '지방': Math.min(100, (row.fat_pct / RADAR_AXIS_MAX.fat_pct) * 100),
    'Ca:P': Math.min(100, (row.ca_p_ratio / RADAR_AXIS_MAX.ca_p_ideal) * 100),
    'EPA+DHA': Math.min(
      100,
      (row.epa_dha_pct / RADAR_AXIS_MAX.epa_dha_pct) * 100,
    ),
    'Se': Math.min(
      100,
      (row.selenium_mcg_per_kg / RADAR_AXIS_MAX.selenium_mcg_per_kg) * 100,
    ),
  }
}

/**
 * 페르소나 → 추천 SKU 리스트 (우선순위 순).
 */
export function recommendByPersona(persona: SkuPersona): SkuKey[] {
  return (Object.entries(SKU_NUTRITION) as Array<[SkuKey, SkuNutritionRow]>)
    .filter(([, row]) => row.persona.includes(persona))
    .map(([sku]) => sku)
}

