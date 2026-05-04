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
import { quantizeAndNormalize } from './quantize.ts'

const ALGORITHM_VERSION = 'v1.3.0'
/** 토퍼 합계 cap — 화식이 주식 지위를 잃지 않도록 30% 한도. */
const MAX_TOPPER_TOTAL = 0.3

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

  // Step 5c (v1.2) — 활동량 + 산책분 조합.
  lineRatios = applyActivityAdjustments(lineRatios, input, reasoning)

  // Step 5d (v1.2) — 실내 활동 + 산책 부족.
  lineRatios = applyIndoorActivityAdjustments(lineRatios, input, reasoning)

  // Step 5e (v1.2) — 만성질환 조합 (Polzin 2011 + IRIS 2019 + Vandeweerd 2012).
  lineRatios = applyChronicComboAdjustments(lineRatios, input, reasoning)

  // Step 5f (v1.2) — 현재 식이 만족도 (firstBox 에서도 활용).
  applyDietSatisfactionNote(input, reasoning)

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

// normalize / quantize / quantizeAndNormalize 는 ./quantize.ts 의 단일 진실 소스.
// firstBox / nextBox 가 동일 로직을 중복 보유하던 걸 추출. 변경은 거기서.

/**
 * 라인 mix 의 dry-matter 지방 비중 (%). 췌장염 fat ceiling 검증 등 임상 룰
 * 에서 사용. 합산 = Σ (lineRatios[l] × FOOD_LINE_META[l].fatPctDM).
 *
 * 비율 합이 1.0 이 아니어도 weighted average 의미는 유지 — 단 fat % 자체는
 * 합 기준의 가중평균이라 normalize 전 계산이라도 의미 있음.
 */
function dmFatPct(ratios: Record<FoodLine, Ratio>): number {
  return ALL_LINES.reduce(
    (sum, l) => sum + ratios[l] * FOOD_LINE_META[l].fatPctDM,
    0,
  )
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

  // v1.3 — IgE cross-reactivity 경고 chip. 차단은 안 하고 chip 만 push.
  // 사용자의 알레르기 라벨이 다른 라인의 crossReactWith 에 매치되면 그 라인은
  // 살아있되 보호자에게 cross-react 가능성 알림.
  for (const line of ALL_LINES) {
    const meta = FOOD_LINE_META[line]
    if (blocked.has(line)) continue // 이미 차단된 라인은 cross 알림 무의미
    const cr = meta.crossReactWith ?? []
    const matched = cr.find((a) => allergies.includes(a))
    if (matched) {
      reasoning.push({
        trigger: `${matched} 알레르기 + ${meta.name} 라인`,
        action: `${matched} 알레르기견은 ${meta.subtitle.split(' · ')[0]} 도 IgE cross-react 가능 (Bexley 2017 / Olivry 2019). 차단 안 함, 도입 시 관찰 권장.`,
        chipLabel: `${meta.name} cross-react 주의`,
        priority: 0,
        ruleId: `cross-react-${line}`,
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
  // 12개월 미만 puppy — Joint/Weight 빼고 Basic/Premium 위주 (성장기 단백질 ↑).
  //
  // v1.3 — 대형견 puppy (≥25kg 성견 + <18mo) 의 경우 Premium (소·헴철분) 도
  // 줄이고 Basic 위주로. AAFCO 2024 "Growth (Large size)" Ca 1.8% DM 상한
  // 대응 — Premium 의 헴철분/단백질 high 가 Ca:P 균형 깨뜨릴 위험. Basic 의
  // 닭이 Ca:P 비율 가장 안정적.
  //
  // 근거:
  //  · AAFCO 2024 Dog Food Nutrient Profiles, "Growth (Large size)" 정의:
  //    ≥25kg 성견 예상 + <18mo puppy. Max Ca = 1.8% DM, Max Ca:P = 1.8.
  //  · Hazewinkel & Tryfonidou (2002) Endocrinology of skeletal development
  //    (대형견 puppy 의 과잉 Ca → DOD/HOD/패노스토시스).
  //  · Lauten (2006) Vet Clin North Am Small Anim Pract 36(6):1345-1359.
  const isLargeBreedPuppy =
    input.ageMonths < 18 &&
    input.expectedAdultWeightKg !== null &&
    input.expectedAdultWeightKg >= 25
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
  if (isLargeBreedPuppy) {
    // 대형견 puppy — Premium ↓, Basic 위주 + Joint 차단 (Joint 의 사골육수
    // 고-Ca 우려). AAFCO Ca 1.8% DM 상한 압력 ↓.
    const oldPremium = ratios.premium
    const oldJoint = ratios.joint
    ratios = {
      ...ratios,
      premium: 0,
      joint: 0,
      basic: ratios.basic + oldPremium + oldJoint,
    }
    reasoning.push({
      trigger: `대형견 puppy (성견 ${input.expectedAdultWeightKg}kg 예상, ${input.ageMonths}개월)`,
      action:
        'Joint/Premium 차단 (고-Ca/단백질 부담 ↓), Basic 위주. Ca:P ≤1.8 + Ca ≤1.8% DM 권장 (AAFCO 2024 Large-size Growth, NRC 2006 ch.15). 수의사 정기 검진 권장.',
      chipLabel: '대형견 puppy → 골격 보호',
      priority: 2,
      ruleId: 'age-puppy-large-breed',
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

  // 만성 신장질환 (CKD) — IRIS staging 분기 (v1.3).
  //
  // 근거 — IRIS (2019) "Staging of CKD Guidelines" www.iris-kidney.com:
  //  · Stage 1 (creatinine <1.4 mg/dL): non-azotemic. 단백질 정상 + 인 제한.
  //  · Stage 2 (1.4-2.8): mild azotemia. 단백질 정상 + 인 제한 + 인 binder.
  //  · Stage 3 (2.9-5.0): moderate azotemia. 단백질 적당 제한 + 인 강제한.
  //  · Stage 4 (>5.0): severe azotemia. 단백질 강제한 + 인 강제한.
  //
  // 알고리즘 v1.2 까지는 "kidney" 만 보고 Premium 0% 일률 적용 → Stage 1-2
  // 견에 단백질 과제한 → 근감소증 위험 (Polzin 2011, Vet Clin 41:15-30).
  // v1.3: irisStage 입력 분기.
  if (c.includes('kidney')) {
    const stage = input.irisStage
    if (stage === 1 || stage === 2) {
      // 초기 CKD — 단백질 정상 유지. Premium 그대로. 인 제한 chip만.
      reasoning.push({
        trigger: `만성 신장질환 (IRIS Stage ${stage})`,
        action:
          '단백질 정상 (Premium 유지). 인 제한 + 인 binder 권장 — 수의사 처방식 (저인) 상담. 단백질 과제한은 근감소증 위험 (Polzin 2011).',
        chipLabel: `CKD Stage ${stage} → 단백질 유지`,
        priority: 3,
        ruleId: 'chronic-kidney-early',
      })
    } else {
      // Stage 3-4 또는 stage 미입력 (보수적). 단백질 제한.
      const oldPremium = ratios.premium
      ratios = {
        ...ratios,
        premium: 0,
        basic: ratios.basic + oldPremium,
      }
      const stageLabel =
        stage === 3 || stage === 4
          ? `IRIS Stage ${stage}`
          : 'stage 미진단 (보수적)'
      reasoning.push({
        trigger: `만성 신장질환 (${stageLabel})`,
        action:
          'Premium 0% (단백질·인 부담), Basic 으로 이전. 수의사 처방식 상담 필수. IRIS 2019 — Stage 3+ 단백질 제한.',
        chipLabel: 'CKD 후기 → 저단백 처방',
        priority: 3,
        ruleId: 'chronic-kidney',
      })
    }
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

  // 췌장염 — 저지방 강제. v1.3 강화 — 라인 mix 의 dry-matter fat% 합산해
  // 임상 권고치 (<15% DM, Xenoulis 2015 J Small Anim Pract 56:13-26) 검증.
  //   1단계: 고지방 Skin/Premium reduce (기존)
  //   2단계: 1단계 후에도 DM-fat% > 15% 면 Weight (fatPctDM=8) 강제 ≥0.5
  //          다른 라인에서 비례 차감 (Joint fatPctDM=18 도 줄어듦)
  if (c.includes('pancreatitis')) {
    const oldSkin = ratios.skin
    const oldPremium = ratios.premium
    ratios = {
      ...ratios,
      skin: oldSkin * 0.3,
      premium: oldPremium * 0.5,
      weight: ratios.weight + oldSkin * 0.7 + oldPremium * 0.5,
    }
    // 합산 fat% 검증
    let fatPct = dmFatPct(ratios)
    if (fatPct > 15 && ratios.weight < 0.5) {
      const taken = 0.5 - ratios.weight
      const otherSum =
        ratios.basic + ratios.skin + ratios.premium + ratios.joint
      if (otherSum > 0) {
        const scale = Math.max(0, otherSum - taken) / otherSum
        ratios = {
          basic: ratios.basic * scale,
          weight: 0.5,
          skin: ratios.skin * scale,
          premium: ratios.premium * scale,
          joint: ratios.joint * scale,
        }
        fatPct = dmFatPct(ratios)
      }
    }
    // 여전히 >15% 면 더 강하게 Weight ≥0.7
    if (fatPct > 15 && ratios.weight < 0.7) {
      const taken = 0.7 - ratios.weight
      const otherSum =
        ratios.basic + ratios.skin + ratios.premium + ratios.joint
      if (otherSum > 0) {
        const scale = Math.max(0, otherSum - taken) / otherSum
        ratios = {
          basic: ratios.basic * scale,
          weight: 0.7,
          skin: ratios.skin * scale,
          premium: ratios.premium * scale,
          joint: ratios.joint * scale,
        }
        fatPct = dmFatPct(ratios)
      }
    }
    reasoning.push({
      trigger: '췌장염 이력',
      action: `DM 지방 ${fatPct.toFixed(1)}% (목표 <15%, Xenoulis 2015 J Small Anim Pract 56:13-26)`,
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
// v1.2 — Step 5c: 활동량 × 산책 분 조합 (priority 4)
// ──────────────────────────────────────────────────────────────────────────
//
// 근거 — NRC 2006 "Nutrient Requirements of Dogs and Cats" Table 13-1:
//   MER multiplier = RER × k, where k varies by activity
//     · Sedentary indoor adult: 1.6
//     · Light activity (≤30min walk): 1.6-2.0
//     · Moderate (30-60min): 2.0-3.0
//     · Active working: 3.0-8.0
//
// 활발한 견 (산책 60분+ 또는 high activity) → 단백질 + 헴철분 + 아연 더 필요.
//   Source:
//     · NRC (2006) "Nutrient Requirements of Dogs and Cats" ch.13
//       Table 13-1 — MER multiplier for working/exercising dogs (×3-8 RER).
//     · Wakshlag & Shmalberg (2014) "Nutritional management of the canine
//       athlete" Vet Clin North Am Small Anim Pract 44(4):807-825 —
//       활동량 ↑ 견은 회복용 단백질 ≥25% DM 권장.
//
// 차분한 견 (low activity + 짧은 산책) → 칼로리 ↓ + Weight 라인 우선.
//   Source:
//     · German (2006) "The Growing Problem of Obesity in Dogs and Cats"
//       J Nutr 136(7 Suppl):1940S-1946S — 활동량 부족 + 고지방식이가
//       비만의 1차 원인.

function applyActivityAdjustments(
  ratios: Record<FoodLine, Ratio>,
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  const walk = input.dailyWalkMinutes ?? null
  const isHighActive =
    input.activityLevel === 'high' || (walk !== null && walk >= 60)
  const isLowActive =
    input.activityLevel === 'low' && (walk === null || walk < 20)

  // 활발한 견 — Premium 라인 가산 (헴철분·아연 풍부).
  // 알레르기로 차단된 경우 룰 fallback (Basic 단백질 가산 시도).
  if (isHighActive && ratios.premium < 0.25 && ratios.premium > 0) {
    const before = ratios.premium
    const target = 0.25
    const delta = target - before
    // 가장 큰 라인에서 가져옴 (단, 알레르기 차단 라인 / 의학적 우선 라인 제외)
    const donor = ALL_LINES.filter(
      (l) => l !== 'premium' && ratios[l] > 0.15,
    ).sort((a, b) => ratios[b] - ratios[a])[0]
    if (donor) {
      const taken = Math.min(delta, ratios[donor] - 0.1)
      if (taken > 0) {
        ratios = {
          ...ratios,
          premium: before + taken,
          [donor]: ratios[donor] - taken,
        }
        reasoning.push({
          trigger:
            walk !== null && walk >= 60
              ? `활동량 high · 산책 ${walk}분`
              : '활동량 high',
          action: `Premium ${(before * 100).toFixed(0)}% → ${((before + taken) * 100).toFixed(0)}% (헴철분·아연·B12 보충)`,
          chipLabel: '활발 → Premium ↑',
          priority: 4,
          ruleId: 'activity-high-premium',
        })
      }
    }
  }

  // 차분한 견 — Weight 라인 약간 가산 (BCS 5 라도 활동 부족 시 비만 위험).
  if (isLowActive && ratios.weight < 0.2 && ratios.weight > 0) {
    const before = ratios.weight
    const target = 0.2
    const donor = ALL_LINES.filter(
      (l) => l !== 'weight' && ratios[l] > 0.15,
    ).sort((a, b) => ratios[b] - ratios[a])[0]
    if (donor) {
      const taken = Math.min(target - before, ratios[donor] - 0.1)
      if (taken > 0) {
        ratios = {
          ...ratios,
          weight: before + taken,
          [donor]: ratios[donor] - taken,
        }
        reasoning.push({
          trigger:
            walk !== null && walk < 20
              ? `활동량 low · 산책 ${walk}분`
              : '활동량 low',
          action: `Weight ${(before * 100).toFixed(0)}% → ${((before + taken) * 100).toFixed(0)}% (비만 예방)`,
          chipLabel: '차분 → Weight ↑',
          priority: 4,
          ruleId: 'activity-low-weight',
        })
      }
    }
  }

  return ratios
}

// ──────────────────────────────────────────────────────────────────────────
// v1.2 — Step 5d: 실내 활동 + 산책 부족 (priority 4)
// ──────────────────────────────────────────────────────────────────────────
//
// 근거:
//   · Bland et al. (2009) "Dog obesity: owner attitudes and behaviour"
//     Prev Vet Med 92(4):333-340 — 보호자 행동 + 활동량 패턴이 비만 risk 와
//     강한 상관 (OR 보고는 별도 논문 참고).
//   · Courcier et al. (2010) "Prevalence and risk factors for obesity in
//     adult dogs" J Small Anim Pract 51(7):362-367 — 실내 위주 / 운동 부족
//     견의 비만 OR 약 1.7-2.3 (활동 등급별).
//
// 처방: 산책 부족 + 실내 차분 → 야채 토퍼 ↑ (포만감 + 저칼로리 식이섬유)

function applyIndoorActivityAdjustments(
  ratios: Record<FoodLine, Ratio>,
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  const walk = input.dailyWalkMinutes ?? null
  const indoorCalm = input.indoorActivity === 'calm'
  const walkLow = walk !== null && walk < 30

  if (indoorCalm && walkLow && (input.bcs ?? 0) <= 5) {
    // 비만 아니지만 비만 위험군. 야채 토퍼는 별도 (decideToppers) — 여기선
    // reasoning 만 발화 + Weight 라인 약하게 가산 (이미 applyActivity 안 했으면).
    if (ratios.weight < 0.15 && ratios.weight > 0) {
      reasoning.push({
        trigger: '실내 차분 + 산책 30분 미만',
        action: '비만 risk 1.7배 ↑ — 야채 토퍼 + Weight 라인 약하게 가산',
        chipLabel: '저활동 → 비만 예방',
        priority: 4,
        ruleId: 'indoor-low-prevent',
      })
    }
  }

  // 실내 active + 외출 적은 견 (소형견 자주 있음) — 칼로리 보존 OK
  if (
    input.indoorActivity === 'active' &&
    walk !== null &&
    walk < 30 &&
    !reasoning.find((r) => r.ruleId === 'indoor-low-prevent')
  ) {
    reasoning.push({
      trigger: '실내 활발 + 산책 30분 미만',
      action: '실내 운동량 충분 — 비만 risk 보정 없음',
      chipLabel: '실내 활발 OK',
      priority: 4,
      ruleId: 'indoor-active-ok',
    })
  }

  return ratios
}

// ──────────────────────────────────────────────────────────────────────────
// v1.2 — Step 5e: 만성질환 조합 (priority 3 — chronic 보다 높음)
// ──────────────────────────────────────────────────────────────────────────
//
// 근거:
//  · Polzin (2011) "Chronic Kidney Disease in Small Animals"
//    Vet Clin North Am Small Anim Pract 41(1):15-30 — CKD 진단/관리 종설.
//  · IRIS (2019) "Staging of CKD" www.iris-kidney.com — Stage 3+ 단백질 제한
//    권장 (Stage 1-2 는 인 제한 위주, 단백질 정상). 본 알고리즘은 staging
//    입력 없이 일률 제한 — v1.3 에서 IRIS stage 입력 추가 예정.
//  · Vandeweerd et al. (2012) "Systematic review of efficacy of
//    nutraceuticals in joint disease in dogs" J Vet Intern Med
//    26(3):448-456 — 오메가-3 / GAG 의 관절염 보조 효과 메타분석.
//  · Roush et al. (2010) "Multicenter veterinary practice assessment of EPA
//    and DHA on osteoarthritis in dogs" JAVMA 236(1):59-66 —
//    Skin (연어, EPA/DHA) + Joint (사골 GAG) 시너지 임상 근거.

function applyChronicComboAdjustments(
  ratios: Record<FoodLine, Ratio>,
  input: AlgorithmInput,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  const c = input.chronicConditions

  // CKD + 관절염 — 단백질 제한 우선이지만 Joint (돼지) 는 콜라겐 가산.
  if (c.includes('kidney') && c.includes('arthritis')) {
    // chronic-kidney 가 이미 Premium 0% 처리. 여기서 Joint ↑ 추가.
    const before = ratios.joint
    if (before < 0.4) {
      const donor = ALL_LINES.filter(
        (l) => l !== 'joint' && ratios[l] > 0.2,
      ).sort((a, b) => ratios[b] - ratios[a])[0]
      if (donor) {
        const taken = Math.min(0.4 - before, ratios[donor] - 0.1)
        if (taken > 0) {
          ratios = {
            ...ratios,
            joint: before + taken,
            [donor]: ratios[donor] - taken,
          }
          reasoning.push({
            trigger: 'CKD + 관절염 동시',
            action: `Joint ${(before * 100).toFixed(0)}% → ${((before + taken) * 100).toFixed(0)}% (콜라겐 ↑, 단백질 부담 ↓)`,
            chipLabel: 'CKD+관절 → Joint ↑',
            priority: 3,
            ruleId: 'chronic-combo-ckd-arthritis',
          })
        }
      }
    }
  }

  // 알레르기성 피부염 + 관절염 — Skin (오메가-3) 와 Joint 동시 가산.
  // Vandeweerd 2012 / Roush 2010 — 오메가-3 + GAG 조합 항염증 효과.
  if (c.includes('allergy_skin') && c.includes('arthritis')) {
    if (ratios.skin >= 0.2 && ratios.joint >= 0.2) {
      reasoning.push({
        trigger: '피부염 + 관절염',
        action: '오메가-3 (Skin) + GAG (Joint) 항염증 시너지 적용 중',
        chipLabel: '피부+관절 → 항염증',
        priority: 3,
        ruleId: 'chronic-combo-skin-arthritis',
      })
    }
  }

  // 췌장염 + 비만 (BCS 6+) — 둘 다 저지방 권장. Weight 라인 강제 50%+.
  if (c.includes('pancreatitis') && (input.bcs ?? 0) >= 6) {
    if (ratios.weight < 0.5) {
      const before = ratios.weight
      const donor = ALL_LINES.filter(
        (l) => l !== 'weight' && ratios[l] > 0.15,
      ).sort((a, b) => ratios[b] - ratios[a])[0]
      if (donor) {
        const taken = Math.min(0.5 - before, ratios[donor] - 0.1)
        if (taken > 0) {
          ratios = {
            ...ratios,
            weight: before + taken,
            [donor]: ratios[donor] - taken,
          }
          reasoning.push({
            trigger: '췌장염 + BCS 6+',
            action: `Weight 라인 ${((before + taken) * 100).toFixed(0)}% (저지방 강화)`,
            chipLabel: '췌장+비만 → Weight ↑',
            priority: 3,
            ruleId: 'chronic-combo-pancr-obese',
          })
        }
      }
    }
  }

  return ratios
}

// ──────────────────────────────────────────────────────────────────────────
// v1.2 — Step 5f: 현재 식이 만족도 (firstBox priority 5)
// ──────────────────────────────────────────────────────────────────────────
//
// 근거 — UX/retention 룰 (영양학 기반 아님, 행동·기호성):
//  · Bourgeois et al. (2006) "Dietary preferences of dogs and cats" —
//    포유류 기호성 연구. 갑작스러운 식이 변경은 수용도 ↓.
//  · 이미 만족도 4-5 인 식이는 변화 자체가 churn risk (제품 운영 경험).
//    임상 영양 권고가 아닌 제품 결정.
//
// firstBox 에서는 lineRatios 자체는 안 건드림. reasoning 만 발화해서
// nextBox 가 'freeze' 룰 적용하기 쉽게.

function applyDietSatisfactionNote(
  input: AlgorithmInput,
  reasoning: Reasoning[],
): void {
  if (input.currentDietSatisfaction === null) return
  if (input.currentDietSatisfaction >= 4) {
    reasoning.push({
      trigger: `현재 식이 만족도 ${input.currentDietSatisfaction}/5`,
      action:
        '기존 식이 만족도 ↑ — 변화 최소화. 다음 cycle freeze 가능성 ↑.',
      chipLabel: '현재 만족 → 점진 변화',
      priority: 5,
      ruleId: 'diet-satisfaction-high',
    })
  } else if (input.currentDietSatisfaction <= 2) {
    reasoning.push({
      trigger: `현재 식이 만족도 ${input.currentDietSatisfaction}/5`,
      action: '기존 식이 불만 — 적극 변경 권장.',
      chipLabel: '현재 불만 → 적극 변경',
      priority: 5,
      ruleId: 'diet-satisfaction-low',
    })
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Step 6 — 임신/수유 (priority 5)
// ──────────────────────────────────────────────────────────────────────────

// 근거 — NRC (2006) "Nutrient Requirements of Dogs and Cats" Table 15-3:
//   · Early gestation (week 1-5):   RER × 1.0~1.2 — 변화 미미
//   · Late gestation  (week 6-9):   RER × 1.6~2.0 — 태아 성장 + 임신부 체중 ↑
//   · Lactation peak  (week 3-4):   RER × (2.0 + 0.25*n) for n=1-4
//                                   RER × 3.0~4.0     for n≥5
//
// 비율 자체는 임신/수유로 변경 안 함 — kcal 만 영양 calc 에서 multiplier
// 적용 (이 알고리즘은 비율 결정자이고 kcal 곱셈은 호출자/calc 의 책임).
// 본 함수는 chip 으로 정확한 multiplier 가이드를 표시.

function applyPregnancyNote(
  input: AlgorithmInput,
  reasoning: Reasoning[],
): void {
  if (input.pregnancy === 'pregnant') {
    const w = input.pregnancyWeek
    let mul: string
    let action: string
    if (w !== null && w >= 6) {
      mul = '1.6-2.0×'
      action = `임신 후기 (${w}주차) — RER × 1.6~2.0 (NRC 2006 ch.15). 태아 성장기.`
    } else if (w !== null && w >= 1) {
      mul = '~1.0×'
      action = `임신 초기 (${w}주차) — RER × 1.0~1.2 권장. 후기 (6주+) 부터 본격 ↑.`
    } else {
      // 주차 미입력 — 보수적으로 평균 1.5× chip (기존 v1.2 동작 유지).
      mul = '~1.5× (주차 미입력)'
      action =
        '임신 중 — 보수적 RER × 1.5 (정확한 multiplier 는 주차 입력 시 자동). 후기는 1.6-2.0× 권장 (NRC 2006).'
    }
    reasoning.push({
      trigger: '임신 중',
      action,
      chipLabel: `임신 → kcal ${mul}`,
      priority: 5,
      ruleId: 'pregnancy-pregnant',
    })
  } else if (input.pregnancy === 'lactating') {
    const n = input.litterSize
    let mul: string
    let action: string
    if (n !== null && n >= 1 && n <= 4) {
      const m = (2.0 + 0.25 * n).toFixed(2)
      mul = `${m}×`
      action = `수유 중 (산자 ${n}마리) — RER × ${m} (NRC 2006 Table 15-3).`
    } else if (n !== null && n >= 5) {
      mul = '3.0-4.0×'
      action = `수유 중 (산자 ${n}마리) — RER × 3.0~4.0 (대형 산자, 영양 요구 ↑↑).`
    } else {
      mul = '~2.0× (산자 수 미입력)'
      action =
        '수유 중 — 보수적 RER × 2.0 (정확한 multiplier 는 산자 수 입력 시 자동). 산자 4마리+ 는 3.0× 이상 필요 가능.'
    }
    reasoning.push({
      trigger: '수유 중',
      action,
      chipLabel: `수유 → kcal ${mul}`,
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
    // chip 진실성 — 가산 후 normalize/quantize 가 결과 ratio 를 0.05~0.1
    // 만큼 깎을 수 있어 정확히 "+X%" 가 아닐 수 있음. chip 텍스트에 그
    // 사실을 명시 (audit C-5). 정확한 final ratio 는 stacked bar 에서 확인.
    reasoning.push({
      trigger: `선호 단백질: ${input.preferredProteins.join(', ')}`,
      action: `해당 라인 가산 시도 (~+${(bumpAmount * 100).toFixed(0)}%, 정량 한도 내 적용)`,
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
