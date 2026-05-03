/**
 * Farmer's Tail — 첫 박스 결정 알고리즘 v1.
 *
 * 설문 응답 + 강아지 프로필 + 영양 calc 결과를 받아 5종 화식 + 토퍼의 비율
 * 처방 (Formula) 을 출력하는 pure function.
 *
 * # 설계 원칙
 *
 * 1. **Pure function** — 외부 의존성 없음. DB / 네트워크 / Date.now() 호출
 *    안 함. 호출처가 input 을 모두 준비. 테스트 가능, 결정적.
 *
 * 2. **Audit trail** — 모든 룰 발화는 `Reasoning` 으로 기록. UI 에 chip 으로
 *    노출되어 보호자가 "왜 이 비율로 결정됐는지" 항상 확인 가능. 운영 시
 *    클레임 대응에도 핵심.
 *
 * 3. **우선순위 순서** — 알레르기(0) → 케어목표(1) → 만성질환(2) → BCS(3) →
 *    임신(4) → GI 민감도(5) → 선호단백질(6) → 토퍼(7) → 정규화(8). 후순위 룰이
 *    선순위 결정 (예: 알레르기로 0% 된 라인) 을 덮지 않음.
 *
 * 4. **Quantize 0.1 단위** — 운영 단순화. 미리 만든 36개 베이스 패치 조합으로
 *    피킹 가능. 사용자가 "63.7% 닭" 보다 "60% 닭" 이 직관적.
 *
 * 5. **Conservative defaults** — 모호한 상황에선 단순 조합 + 토퍼 최소. 위장
 *    적응을 알고리즘이 망치지 않게.
 *
 * # 알고리즘 v1.0 = 단순 if-else 룰
 *
 * 30+ 룰 시작. 데이터 쌓이면 룰 정교화 (v1.x), 충분히 쌓이면 ML (v2). v1 은
 * 모든 결정이 사람이 읽을 수 있는 룰이라 디버깅이 쉽고 출시 직후 운영
 * 부담이 적다.
 */

import type {
  AlgorithmInput,
  Formula,
  FoodLine,
  Ratio,
  Reasoning,
  TransitionStrategy,
} from './types.ts'
import { FOOD_LINE_META, ALL_LINES, PROTEIN_TO_LINE } from './lines.ts'

const ALGORITHM_VERSION = 'v1.0.0'
/** 토퍼 합계 cap — 화식이 주식 지위를 잃지 않도록 30% 한도. */
const MAX_TOPPER_TOTAL = 0.3
/** 비율 quantize 단위 (10%). */
const QUANTIZE_STEP = 0.1

// ──────────────────────────────────────────────────────────────────────────
// 메인 진입점
// ──────────────────────────────────────────────────────────────────────────

export function decideFirstBox(input: AlgorithmInput): Formula {
  const reasoning: Reasoning[] = []

  // Step 1 — 알레르기 차단. 0% 가 된 라인은 이후 어떤 룰도 비율 못 줌.
  const blocked = filterByAllergies(input.allergies, reasoning)

  // Step 2 — 케어 목표 → 메인 라인 선택. blocked 라인은 후보 제외.
  let lineRatios = applyCareGoal(input, blocked, reasoning)

  // Step 3 — 시니어 자동 보정 (7세+). 케어목표가 다른 거여도 약간 가산.
  lineRatios = applyAgeStage(lineRatios, input, reasoning)

  // Step 4 — 만성질환 분기 (kidney / IBD / pancreatitis 등).
  lineRatios = applyChronicAdjustments(lineRatios, input, reasoning)

  // Step 5 — BCS 기반 미세 조정.
  lineRatios = applyBcsAdjustments(lineRatios, input, reasoning)

  // Step 5b — 체중 추세 (BCS 와 함께 사용).
  lineRatios = applyWeightTrendAdjustments(lineRatios, input, reasoning)

  // Step 6 — 임신/수유 (라인 비율은 그대로, kcal 만 ↑ — 영양 calc 가 처리).
  applyPregnancyNote(input, reasoning)

  // Step 7 — GI 민감도 → 자주/매번이면 메인 단일화.
  lineRatios = applyGiSensitivity(lineRatios, input, reasoning)

  // Step 8 — 선호 단백질 가산점.
  lineRatios = applyPreferredProteinBonus(lineRatios, input, reasoning)

  // Step 9 — quantize + 정규화.
  lineRatios = quantizeAndNormalize(lineRatios, blocked)

  // Step 10 — 토퍼 결정.
  const toppers = decideToppers(input, reasoning)

  // Step 11 — 전환 전략.
  const transitionStrategy = decideTransition(input)

  return {
    lineRatios,
    toppers,
    reasoning: reasoning.sort((a, b) => a.priority - b.priority),
    transitionStrategy,
    dailyKcal: input.dailyKcal,
    dailyGrams: input.dailyGrams,
    cycleNumber: 1,
    algorithmVersion: ALGORITHM_VERSION,
    userAdjusted: false,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function emptyRatios(): Record<FoodLine, Ratio> {
  return { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0 }
}

/** blocked 라인은 0 으로 강제하고, 나머지를 정규화. */
function normalize(
  ratios: Record<FoodLine, Ratio>,
  blocked: Set<FoodLine>,
): Record<FoodLine, Ratio> {
  const out: Record<FoodLine, Ratio> = { ...ratios }
  for (const line of ALL_LINES) {
    if (blocked.has(line)) out[line] = 0
  }
  const total = ALL_LINES.reduce((s, l) => s + out[l], 0)
  if (total <= 0) {
    // 모든 라인이 0 — 알레르기 다수 + 룰 충돌. fallback: blocked 가 아닌 첫 라인 100%.
    const fallback = ALL_LINES.find((l) => !blocked.has(l)) ?? 'skin'
    out[fallback] = 1
    return out
  }
  for (const line of ALL_LINES) {
    out[line] = out[line] / total
  }
  return out
}

/** 0.1 단위로 round, 합 1.0 보장. 가장 큰 라인이 잔차 흡수. */
function quantize(ratios: Record<FoodLine, Ratio>): Record<FoodLine, Ratio> {
  const rounded = ALL_LINES.reduce(
    (acc, l) => {
      acc[l] = Math.round(ratios[l] / QUANTIZE_STEP) * QUANTIZE_STEP
      return acc
    },
    {} as Record<FoodLine, Ratio>,
  )
  const sum = ALL_LINES.reduce((s, l) => s + rounded[l], 0)
  const diff = 1 - sum
  if (Math.abs(diff) > 1e-9) {
    // 잔차를 가장 큰 라인에 흡수. 큰 라인이 없으면 첫 non-zero.
    const target =
      ALL_LINES.reduce<FoodLine | null>(
        (best, l) =>
          rounded[l] > 0 && (best === null || rounded[l] > rounded[best])
            ? l
            : best,
        null,
      ) ?? 'basic'
    rounded[target] += diff
    rounded[target] = Math.max(0, Math.round(rounded[target] * 10) / 10)
  }
  return rounded
}

function quantizeAndNormalize(
  ratios: Record<FoodLine, Ratio>,
  blocked: Set<FoodLine>,
): Record<FoodLine, Ratio> {
  return quantize(normalize(ratios, blocked))
}

// ──────────────────────────────────────────────────────────────────────────
// Step 1 — 알레르기 차단 (priority 0)
// ──────────────────────────────────────────────────────────────────────────

function filterByAllergies(
  allergies: string[],
  reasoning: Reasoning[],
): Set<FoodLine> {
  const blocked = new Set<FoodLine>()
  for (const line of ALL_LINES) {
    const meta = FOOD_LINE_META[line]
    const conflict = meta.blockingAllergies.find((a) => allergies.includes(a))
    if (conflict) {
      blocked.add(line)
      reasoning.push({
        trigger: `${conflict} 알레르기`,
        action: `${meta.name} 라인 0% 차단 (메인 단백질 충돌)`,
        chipLabel: `${conflict} 차단`,
        priority: 0,
        ruleId: `allergy-${line}`,
      })
    }
  }
  return blocked
}

// ──────────────────────────────────────────────────────────────────────────
// Step 2 — 케어 목표 → 메인 라인 선택 (priority 1)
// ──────────────────────────────────────────────────────────────────────────

/** 케어 목표별 권장 비율. 알레르기로 막힌 라인은 후속 normalize 가 처리. */
const CARE_GOAL_RECIPES: Record<
  NonNullable<AlgorithmInput['careGoal']>,
  { ratios: Record<FoodLine, number>; chipLabel: string; trigger: string }
> = {
  weight_management: {
    ratios: { basic: 0.3, weight: 0.7, skin: 0, premium: 0, joint: 0 },
    chipLabel: '체중관리 → Weight 메인',
    trigger: '케어 목표 = 체중 관리',
  },
  skin_coat: {
    ratios: { basic: 0.3, weight: 0, skin: 0.7, premium: 0, joint: 0 },
    chipLabel: '피부·털 → Skin 메인',
    trigger: '케어 목표 = 피부·털 개선',
  },
  joint_senior: {
    ratios: { basic: 0, weight: 0, skin: 0.1, premium: 0.3, joint: 0.6 },
    chipLabel: '시니어 → Joint 메인',
    trigger: '케어 목표 = 관절·시니어',
  },
  allergy_avoid: {
    // allergy_avoid 는 사용자가 알레르기를 명시했을 때 — 차단 후 남은 라인
    // 균등 분배. 보통 Skin/Weight 가 살아남음.
    ratios: { basic: 0.1, weight: 0.4, skin: 0.4, premium: 0.05, joint: 0.05 },
    chipLabel: '알레르기 회피 → 노블 프로틴',
    trigger: '케어 목표 = 알레르기·민감 회피',
  },
  general_upgrade: {
    ratios: { basic: 0.5, weight: 0.1, skin: 0.2, premium: 0.1, joint: 0.1 },
    chipLabel: '일반 업그레이드 → Basic 메인',
    trigger: '케어 목표 = 일반 영양 업그레이드',
  },
}

function applyCareGoal(
  input: AlgorithmInput,
  blocked: Set<FoodLine>,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  const goal = input.careGoal ?? 'general_upgrade'
  const recipe = CARE_GOAL_RECIPES[goal]
  reasoning.push({
    trigger: recipe.trigger,
    action: `초기 비율: ${formatRatios(recipe.ratios)}`,
    chipLabel: recipe.chipLabel,
    priority: 1,
    ruleId: `goal-${goal}`,
  })
  return { ...recipe.ratios }
}

// ──────────────────────────────────────────────────────────────────────────
// Step 3 — 나이 기반 보정 (priority 2)
// ──────────────────────────────────────────────────────────────────────────

function applyAgeStage(
  ratios: Record<FoodLine, Ratio>,
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  // 7세+ 시니어 — Joint 라인이 0% 면 약간 옮겨와줌 (단, 케어목표 = joint_senior
  // 면 이미 60% 라 추가 가산 안 함).
  if (input.ageMonths >= 84 && ratios.joint < 0.2 && input.careGoal !== 'joint_senior') {
    const before = ratios.joint
    ratios = { ...ratios, joint: 0.2, basic: Math.max(0, ratios.basic - 0.2) }
    reasoning.push({
      trigger: `${Math.floor(input.ageMonths / 12)}세 시니어`,
      action: `Joint ${(before * 100).toFixed(0)}% → 20% (B1·콜린 가산)`,
      chipLabel: '시니어 → Joint 가산',
      priority: 2,
      ruleId: 'age-senior-joint',
    })
  }
  // 12개월 미만 puppy — Joint/Weight 빼고 Basic/Premium 위주 (성장기 단백질 ↑)
  if (input.ageMonths < 12) {
    const oldJoint = ratios.joint
    const oldWeight = ratios.weight
    ratios = {
      ...ratios,
      joint: 0,
      weight: 0,
      basic: ratios.basic + oldJoint + oldWeight * 0.5,
      premium: ratios.premium + oldWeight * 0.5,
    }
    reasoning.push({
      trigger: '12개월 미만 puppy',
      action: 'Weight/Joint 0%, 성장기 단백질 위주 (Basic + Premium)',
      chipLabel: '강아지 → 성장기 처방',
      priority: 2,
      ruleId: 'age-puppy',
    })
  }
  return ratios
}

// ──────────────────────────────────────────────────────────────────────────
// Step 4 — 만성질환 (priority 3)
// ──────────────────────────────────────────────────────────────────────────

function applyChronicAdjustments(
  ratios: Record<FoodLine, Ratio>,
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  const c = input.chronicConditions

  // 만성 신장질환 — 단백질 양 ↓ + 인 ↓. Premium (소·헴철분) 줄이고 Basic (저인)
  // 늘림. 사용자에게 "수의사 상담 권장" 강하게 reasoning.
  if (c.includes('kidney')) {
    const oldPremium = ratios.premium
    ratios = {
      ...ratios,
      premium: 0,
      basic: ratios.basic + oldPremium,
    }
    reasoning.push({
      trigger: '만성 신장질환',
      action: 'Premium 0% (단백질·인 부담), Basic 으로 이전. 수의사 처방식 상담 권장.',
      chipLabel: '신장질환 → 저단백 조정',
      priority: 3,
      ruleId: 'chronic-kidney',
    })
  }

  // IBD — 단일 단백질 + 저자극. 가장 안전한 Skin (연어) 또는 Joint (돼지) 위주.
  if (c.includes('ibd')) {
    reasoning.push({
      trigger: '염증성 장질환 (IBD)',
      action: '저자극 단일 단백질 권장. 위장 적응 후 점진 추가.',
      chipLabel: 'IBD → 단일 단백질',
      priority: 3,
      ruleId: 'chronic-ibd',
    })
    // 단일화는 Step 7 의 GI 민감도 룰이 처리 (giSensitivity 강제 'always')
  }

  // 췌장염 — 저지방. 지방이 높은 Skin (연어) 줄이고 Basic / Weight 위주.
  if (c.includes('pancreatitis')) {
    const oldSkin = ratios.skin
    const oldPremium = ratios.premium
    ratios = {
      ...ratios,
      skin: oldSkin * 0.3,
      premium: oldPremium * 0.5,
      weight: ratios.weight + oldSkin * 0.7 + oldPremium * 0.5,
    }
    reasoning.push({
      trigger: '췌장염 이력',
      action: '고지방 라인 (Skin/Premium) ↓, 저지방 Weight ↑',
      chipLabel: '췌장염 → 저지방',
      priority: 3,
      ruleId: 'chronic-pancreatitis',
    })
  }

  // 관절염 — Joint 라인 가산.
  if (c.includes('arthritis') && ratios.joint < 0.3) {
    const before = ratios.joint
    ratios = { ...ratios, joint: 0.3, basic: Math.max(0, ratios.basic - 0.3 + before) }
    reasoning.push({
      trigger: '관절염 진단',
      action: `Joint ${(before * 100).toFixed(0)}% → 30% (콜라겐·B1)`,
      chipLabel: '관절염 → Joint ↑',
      priority: 3,
      ruleId: 'chronic-arthritis',
    })
  }

  // 알레르기성 피부염 — Skin (연어 오메가-3) 가산.
  if (c.includes('allergy_skin') && ratios.skin < 0.3) {
    const before = ratios.skin
    ratios = { ...ratios, skin: 0.3, basic: Math.max(0, ratios.basic - 0.3 + before) }
    reasoning.push({
      trigger: '알레르기성 피부염',
      action: `Skin ${(before * 100).toFixed(0)}% → 30% (오메가-3 항염)`,
      chipLabel: '피부염 → Skin ↑',
      priority: 3,
      ruleId: 'chronic-allergy-skin',
    })
  }

  return ratios
}

// ──────────────────────────────────────────────────────────────────────────
// Step 5 — BCS 미세 조정 (priority 4)
// ──────────────────────────────────────────────────────────────────────────

function applyBcsAdjustments(
  ratios: Record<FoodLine, Ratio>,
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  if (input.bcs === null) return ratios

  // BCS 6+ — 과체중. Weight 라인 가산.
  if (input.bcs >= 6 && input.bcs <= 7 && ratios.weight < 0.4) {
    const before = ratios.weight
    ratios = { ...ratios, weight: 0.4, basic: Math.max(0, ratios.basic + before - 0.4) }
    reasoning.push({
      trigger: `BCS ${input.bcs}/9 (과체중)`,
      action: `Weight ${(before * 100).toFixed(0)}% → 40%`,
      chipLabel: `BCS ${input.bcs}/9 → Weight ↑`,
      priority: 4,
      ruleId: 'bcs-overweight',
    })
  }
  // BCS 8-9 — 비만. Weight 라인 메인.
  if (input.bcs >= 8 && ratios.weight < 0.6) {
    const before = ratios.weight
    ratios = { ...ratios, weight: 0.6, basic: Math.max(0, ratios.basic + before - 0.6) }
    reasoning.push({
      trigger: `BCS ${input.bcs}/9 (비만)`,
      action: `Weight 메인 60%, 강한 칼로리 제한 + 식이섬유 ↑`,
      chipLabel: `BCS ${input.bcs}/9 → Weight 메인`,
      priority: 4,
      ruleId: 'bcs-obese',
    })
  }
  // BCS 1-3 — 저체중. Premium (단백질 ↑) 가산.
  if (input.bcs <= 3 && ratios.premium < 0.3) {
    const before = ratios.premium
    ratios = { ...ratios, premium: 0.3, basic: Math.max(0, ratios.basic + before - 0.3) }
    reasoning.push({
      trigger: `BCS ${input.bcs}/9 (저체중)`,
      action: `Premium ${(before * 100).toFixed(0)}% → 30% (헴철분·단백질)`,
      chipLabel: `BCS ${input.bcs}/9 → Premium ↑`,
      priority: 4,
      ruleId: 'bcs-underweight',
    })
  }

  return ratios
}

// ──────────────────────────────────────────────────────────────────────────
// Step 5b — 체중 추세 (priority 4, BCS 와 함께)
// ──────────────────────────────────────────────────────────────────────────

function applyWeightTrendAdjustments(
  ratios: Record<FoodLine, Ratio>,
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  if (!input.weightTrend6mo || input.weightTrend6mo === 'unknown') return ratios

  // 의도되지 않은 감량 (BCS 정상+ 인데 빠짐) — 수의사 상담 chip.
  if (
    input.weightTrend6mo === 'lost' &&
    input.bcs !== null &&
    input.bcs >= 5
  ) {
    reasoning.push({
      trigger: '6개월 체중 감소 + BCS 정상',
      action: '의도되지 않은 감량 가능성 — 수의사 상담 권장',
      chipLabel: '체중감소 → 상담',
      priority: 4,
      ruleId: 'weight-trend-unintended-loss',
    })
  }

  // 의도된 감량 (BCS 6+ 이고 빠지는 중) — 잘 되고 있으니 그대로 유지.
  // reasoning chip 만 발화 (다음 cycle 비교 시 신호).
  if (
    input.weightTrend6mo === 'lost' &&
    input.bcs !== null &&
    input.bcs >= 6
  ) {
    reasoning.push({
      trigger: '6개월 체중 감소 + BCS 과체중',
      action: '의도된 감량 진행 중 — 비율 유지',
      chipLabel: '감량 진행 중',
      priority: 4,
      ruleId: 'weight-trend-intended-loss',
    })
  }

  // 의도되지 않은 증량 (BCS 정상 이하인데 늘어남) — Weight 라인 ↑.
  if (
    input.weightTrend6mo === 'gained' &&
    input.bcs !== null &&
    input.bcs >= 6 &&
    ratios.weight < 0.5
  ) {
    const before = ratios.weight
    ratios = {
      ...ratios,
      weight: 0.5,
      basic: Math.max(0, ratios.basic + before - 0.5),
    }
    reasoning.push({
      trigger: '6개월 체중 증가 + BCS 6+',
      action: `Weight ${(before * 100).toFixed(0)}% → 50% (적극 관리)`,
      chipLabel: '증량 추세 → Weight ↑',
      priority: 4,
      ruleId: 'weight-trend-active-gain',
    })
  }

  return ratios
}

// ──────────────────────────────────────────────────────────────────────────
// Step 6 — 임신/수유 (priority 5)
// ──────────────────────────────────────────────────────────────────────────

function applyPregnancyNote(input: AlgorithmInput, reasoning: Reasoning[]): void {
  // 비율은 그대로. 칼로리는 영양 calc 에서 이미 1.5~2배 처리됨.
  if (input.pregnancy === 'pregnant') {
    reasoning.push({
      trigger: '임신 중',
      action: '일일 kcal 1.5x (영양 calc 자동 보정). 라인 비율 유지.',
      chipLabel: '임신 → kcal ↑',
      priority: 5,
      ruleId: 'pregnancy-pregnant',
    })
  } else if (input.pregnancy === 'lactating') {
    reasoning.push({
      trigger: '수유 중',
      action: '일일 kcal 2.0x (영양 calc 자동 보정). 라인 비율 유지.',
      chipLabel: '수유 → kcal 2x',
      priority: 5,
      ruleId: 'pregnancy-lactating',
    })
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Step 7 — GI 민감도 (priority 6)
// ──────────────────────────────────────────────────────────────────────────

function applyGiSensitivity(
  ratios: Record<FoodLine, Ratio>,
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  const sensitive =
    input.giSensitivity === 'frequent' ||
    input.giSensitivity === 'always' ||
    input.chronicConditions.includes('ibd')

  if (!sensitive) return ratios

  // 가장 비중이 높은 라인 1개로 collapse.
  let mainLine: FoodLine = 'basic'
  let max = 0
  for (const line of ALL_LINES) {
    if (ratios[line] > max) {
      max = ratios[line]
      mainLine = line
    }
  }
  const collapsed = emptyRatios()
  collapsed[mainLine] = 1.0
  reasoning.push({
    trigger:
      input.chronicConditions.includes('ibd')
        ? 'IBD + 위장 적응'
        : `위장 민감 (${input.giSensitivity === 'always' ? '매번' : '자주'})`,
    action: `${FOOD_LINE_META[mainLine].name} 100% (단일 단백질) — 위장 적응 후 다른 라인 추가`,
    chipLabel: '위장민감 → 단일 단백질',
    priority: 6,
    ruleId: 'gi-sensitive',
  })
  return collapsed
}

// ──────────────────────────────────────────────────────────────────────────
// Step 8 — 선호 단백질 가산 (priority 7)
// ──────────────────────────────────────────────────────────────────────────

function applyPreferredProteinBonus(
  ratios: Record<FoodLine, Ratio>,
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  if (input.preferredProteins.length === 0) return ratios
  // 선호 단백질이 단일이면 +5%, 다수면 골고루 +3%. 0% 라인엔 가산 안 함
  // (알레르기 차단 + 룰 결정 0%).
  const out = { ...ratios }
  let bumped = false
  const bumpAmount = input.preferredProteins.length === 1 ? 0.05 : 0.03
  for (const protein of input.preferredProteins) {
    const line = PROTEIN_TO_LINE[protein]
    if (!line || out[line] === 0) continue
    out[line] += bumpAmount
    bumped = true
  }
  if (bumped) {
    reasoning.push({
      trigger: `선호 단백질: ${input.preferredProteins.join(', ')}`,
      action: `해당 라인 +${(bumpAmount * 100).toFixed(0)}% (기호성 보정)`,
      chipLabel: '선호 단백질 가산',
      priority: 7,
      ruleId: 'preferred-protein-bonus',
    })
  }
  return out
}

// ──────────────────────────────────────────────────────────────────────────
// Step 10 — 토퍼 결정
// ──────────────────────────────────────────────────────────────────────────

function decideToppers(
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Formula['toppers'] {
  // Default — 야채 10%, 단백질 토퍼 0% (화식 자체에 단백질 충분).
  let vegetable = 0.1
  let protein = 0

  // 화식 처음 — 토퍼 0% (적응 우선).
  if (input.homeCookingExperience === 'first') {
    reasoning.push({
      trigger: '화식 처음',
      action: '토퍼 0% — 4주 전환기 후 추가',
      chipLabel: '첫 화식 → 토퍼 0',
      priority: 7,
      ruleId: 'topper-first-zero',
    })
    return { protein: 0, vegetable: 0 }
  }

  // 자주/매일 — 토퍼 풍성하게.
  if (input.homeCookingExperience === 'frequent') {
    vegetable = 0.15
    protein = 0.1
  }

  // 식욕 까다로움/감퇴 — 단백질 토퍼 ↑ (기호성).
  // appetite 정보는 input 에 없음 — survey.taste 가 따로. v1.1 에서 추가.

  // BCS 6+ — 야채 토퍼 ↑ (포만감, 저칼로리).
  if (input.bcs !== null && input.bcs >= 6) {
    vegetable = Math.min(0.2, vegetable + 0.05)
    reasoning.push({
      trigger: `BCS ${input.bcs}/9`,
      action: `야채 토퍼 ${(vegetable * 100).toFixed(0)}% (포만감 + 저칼로리)`,
      chipLabel: '과체중 → 야채 ↑',
      priority: 7,
      ruleId: 'topper-bcs-veg',
    })
  }

  // 만성질환 + GI 민감 — 토퍼 최소.
  if (
    input.giSensitivity === 'always' ||
    input.chronicConditions.includes('ibd') ||
    input.chronicConditions.includes('pancreatitis')
  ) {
    vegetable = Math.min(vegetable, 0.05)
    protein = 0
    reasoning.push({
      trigger: '위장 민감 / 만성질환',
      action: '토퍼 최소화 (변화 신호 줄이기)',
      chipLabel: '민감 → 토퍼 최소',
      priority: 7,
      ruleId: 'topper-sensitive-min',
    })
  }

  // Cap.
  const total = vegetable + protein
  if (total > MAX_TOPPER_TOTAL) {
    const factor = MAX_TOPPER_TOTAL / total
    vegetable *= factor
    protein *= factor
  }

  return {
    vegetable: Math.round(vegetable * 100) / 100,
    protein: Math.round(protein * 100) / 100,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Step 11 — 전환 전략
// ──────────────────────────────────────────────────────────────────────────

function decideTransition(input: AlgorithmInput): TransitionStrategy {
  if (input.homeCookingExperience === 'first') return 'conservative'
  if (input.giSensitivity === 'frequent' || input.giSensitivity === 'always') {
    return 'conservative'
  }
  if (input.homeCookingExperience === 'occasional') return 'gradual'
  return 'aggressive'
}

// ──────────────────────────────────────────────────────────────────────────
// 디버그용 포매터
// ──────────────────────────────────────────────────────────────────────────

function formatRatios(ratios: Record<FoodLine, Ratio>): string {
  return ALL_LINES.filter((l) => ratios[l] > 0)
    .map((l) => `${FOOD_LINE_META[l].name} ${Math.round(ratios[l] * 100)}%`)
    .join(' / ')
}
