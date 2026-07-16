/**
 * 칼로리 알고리즘 v2 — 엔진 (docs/CALORIE_ALGORITHM_SPEC_V2.md §6·§9).
 *
 * SurveyInputV2 → FeedingPlanV2 순수 파이프라인.
 *
 * # ⚠️ 먼저 읽을 것 — 이 파일의 상위 파이프라인은 **프로덕션에 연결돼 있지 않다**
 * (2026-07-16 전수 조사). 실제로 고객 급여량을 내는 경로는 이쪽이 아니다:
 *
 *     lib/nutrition.ts  →  lib/calorie-v2/adapter.ts (legacyAdultLadder)
 *                       →  이 파일의 calculateAdultFactor · breedToFlags
 *
 * 즉 **가산 계수 사다리만 뽑아 쓰고** 나머지는 nutrition.ts 가 자체 구현한다.
 * export 10개 중 프로덕션이 부르는 건 `calculateAdultFactor`·`breedToFlags` 둘뿐이고,
 * `computeFeedingPlanV2`·`classifyPath`·`growthBranch`·`weightManagementBranch`·
 * `calculateRER`·`resolveKibbleKcal`·`allocatePortions`·`applyTreatDeduction` 은
 * **engine.test.ts 만 부른다.** 원래 계획("실 파이프라인 연결은 1~2단계에서")이
 * 사다리 이식으로 갈음되면서 상위 파이프라인은 남겨진 상태.
 *
 * 지우지 않고 두는 이유: 전체 컷오버를 할지 사장님 판단이 필요하다. 다만 아래
 * 결정 #1 처럼 **이미 뒤집힌 설계**를 담고 있으니, 여기 코드를 프로덕션 동작의
 * 근거로 읽으면 안 된다.
 *
 * # 사장님 확정 설계 결정 (2026-07-12)
 *  1. ~~임신/수유·질병 = **수의 라우팅(계산 중단)**~~ → **같은 날 뒤집힘.**
 *     "계산 중단은 구독 플로우 차단 + '긍정 먼저' 원칙과 충돌" → **계산은 제공하되**
 *     에너지 카드 직하에 수의 상담 배너 강제 노출(2e 경고 강화 절충).
 *     살아 있는 규칙은 `lib/nutrition.ts` 의 `CALORIE_VET_ROUTE_FLAGS` /
 *     `needsCalorieVetRoute()` 다. 이 파일의 `classifyPath` → 'vet_referral' 분기는
 *     **폐기된 설계**이며 아무도 안 부른다.
 *  2. RER 토이 보정(≤2kg Kleiber) **유지** — 스펙 "지수식만"의 취지는 선형식
 *     (30×BW+70) 폐지이고, 현행 토이 보정은 지수식 계열이라 충돌 없음.
 *  3. 감산 지배형의 성립 조건 = M10 재측정 루프 (3단계에서 실연결).
 *
 * # 가드레일 (스펙 §8)
 *  - 성견 계수 클램프 [1.0, 2.0], 곱셈 금지(가산+클램프만)
 *  - 감량 하한 RER(IBW)×0.8
 *  - 화식 kcal = 실측값만 (앳워터는 건사료 폴백 전용)
 *  - 자견 성장식 앞 상수 130 (70 아님)
 *  - 이중차감 금지: 견종 OB ↔ 설문 easy-keeper 는 OR 로 감산 1회
 */
import { CAL } from './constants.ts'
import type {
  BreedFlags,
  BreedKey,
  FactorLine,
  FeedingPlanV2,
  GuaranteedAnalysis,
  KibbleDb,
  PlanPath,
  SurveyInputV2,
} from './types.ts'

// ─────────────────────────────────────────────────────────────────────
// M4b — 견종 → 플래그 (kcal 델타 아님)
// ─────────────────────────────────────────────────────────────────────

const NO_FLAGS: BreedFlags = {
  obeseProne: false,
  toyOverestimate: false,
  brachycephalic: false,
  highDrive: false,
  chondrodystrophic: false,
}

function f(p: Partial<BreedFlags>): BreedFlags {
  return { ...NO_FLAGS, ...p }
}

/** 한국 인기견 16 프로파일 (스펙 §7). 목록 밖 = 플래그 없음(크기모델 기본). */
const BREED_PROFILES: Record<BreedKey, BreedFlags> = {
  maltese: f({ toyOverestimate: true }),
  poodle_toy: f({ toyOverestimate: true }),
  pomeranian: f({ toyOverestimate: true }),
  shih_tzu: f({ toyOverestimate: true, brachycephalic: true }),
  bichon: f({ toyOverestimate: true }),
  chihuahua: f({ toyOverestimate: true }),
  welsh_corgi: f({ obeseProne: true, chondrodystrophic: true }),
  dachshund: f({ obeseProne: true, chondrodystrophic: true }),
  cocker_spaniel: f({ obeseProne: true }),
  golden_retriever: f({ obeseProne: true }),
  labrador: f({ obeseProne: true }), // POMC 변이: 식욕↑ + 대사율↓ — 최고 경계
  jindo: f({ highDrive: true }), // 토종·활동적·마른편(서구 데이터셋 없음)
  schnauzer_mini: f({ obeseProne: true }), // 고지혈증 주의(지방)
  yorkshire: f({ toyOverestimate: true }),
  french_bulldog: f({ obeseProne: true, brachycephalic: true }),
  mixed: f({}),
  unknown: f({}),
}

export function breedToFlags(breed: BreedKey): BreedFlags {
  return BREED_PROFILES[breed] ?? BREED_PROFILES.unknown
}

// ─────────────────────────────────────────────────────────────────────
// M2a — 체형 3분해 → BCS 역산
// ─────────────────────────────────────────────────────────────────────

/**
 * 갈비뼈를 1차 축으로, 허리·배로 ±조정. 견주가 "7점"을 고르는 것보다 정확.
 *
 * 갈비뼈 base 매핑(3·5·6·8)에는 4·7 이 의도적으로 비어 있고, 허리·배가 한
 * 방향으로 '둘 다' 일치할 때 그 칸을 채운다:
 *   살짝 만져지는 갈비뼈(5) + 볼록 허리 + 처진 배 → 6 (초기 과체중),
 *   꾹 눌러야 하는 갈비뼈(6) + 잘록 허리 + 올라간 배 → 5.
 * 갈비뼈(촉진)가 가장 강한 단일 지표라 base 를 앵커로 삼고, 허리·배는 '둘 다'
 * 일치할 때만 ±1 보정한다(단일 신호는 애매해 흔들지 않음 — 임상 BCS 판정과 동일).
 *
 * 🔧 2026-07-12 버그 수정(사장님 리포트): 예전엔 heavy 보정이 base≥6, lean
 * 보정이 base≤5 일 때만 걸려 있어, '갈비뼈는 이상인데 허리·배는 과체중'인
 * 케이스(easy+none+sagging)가 5 로 고정됐다(허리·배가 갈비뼈와 이미 같은 방향일
 * 때만 반영되는 구조). base 방향 게이트를 제거해 허리·배가 갈비뼈 판정을 실제로
 * 보정하도록 함. 기존 통과 케이스(hard+heavy→9, visible+lean→2 등)는 그대로.
 */
export function deriveBCS(b: SurveyInputV2['bodyAssessment']): number {
  const base = { visible: 3, easy: 5, slight_pressure: 6, hard: 8 }[b.ribs]
  // 허리+배가 과체중 방향으로 둘 다 일치하면 +1, 마른 방향으로 둘 다면 −1.
  const heavy = (b.waist === 'none' ? 1 : 0) + (b.abdomen === 'sagging' ? 1 : 0)
  const lean = (b.waist === 'clear' ? 1 : 0) + (b.abdomen === 'tucked' ? 1 : 0)
  const adj = (heavy >= 2 ? 1 : 0) - (lean >= 2 ? 1 : 0)
  return Math.max(2, Math.min(9, base + adj))
}

// ─────────────────────────────────────────────────────────────────────
// M2b — 이상체중(IBW)
// ─────────────────────────────────────────────────────────────────────

/** BCS ≥ 6 이면 초과율로 나눠 이상체중 산출 — RER 은 IBW 로 계산. */
export function estimateIdealBodyWeight(currentKg: number, bcs: number): number {
  if (bcs <= 5) return currentKg
  const over = CAL.BCS_OVER_PCT[bcs] ?? 0
  return +(currentKg / (1 + over)).toFixed(2)
}

// ─────────────────────────────────────────────────────────────────────
// M3 — RER (지수식 + 토이 보정 유지)
// ─────────────────────────────────────────────────────────────────────

/**
 * RER. 선형식(30×BW+70)은 폐기(초소형견 과대추정) — 지수식만.
 * ≤2kg 토이는 Kleiber baseline 보정(사장님 확정: 현행 computeRer 로직 유지 —
 * 스펙 순수식 대비 초소형에서 소폭 상향, 신생/토이 저급 방지).
 */
export function calculateRER(ibwKg: number): number {
  if (ibwKg <= 2) {
    return +(
      CAL.RER_COEF * Math.pow(ibwKg + 2, CAL.RER_EXP) -
      CAL.RER_COEF * Math.pow(2, CAL.RER_EXP) +
      35
    ).toFixed(1)
  }
  return +(CAL.RER_COEF * Math.pow(ibwKg, CAL.RER_EXP)).toFixed(1)
}

// ─────────────────────────────────────────────────────────────────────
// M4 — 성견 계수 (감산 지배형 + 견종 플래그, 가산은 게이트)
// ─────────────────────────────────────────────────────────────────────

export function calculateAdultFactor(
  s: SurveyInputV2,
  flags: BreedFlags,
  // BCS 주입 가능 — 레거시 어댑터(현행 설문 = 9점 직접선택)가 3분해 없이 사용.
  // 미주입 시 스펙대로 3분해 역산.
  bcs: number = deriveBCS(s.bodyAssessment),
): { factor: number; lines: FactorLine[] } {
  const lines: FactorLine[] = []
  let fac: number = CAL.BASE_ADULT
  lines.push({ label: '기본(중성화 성견·실내·저활동)', delta: CAL.BASE_ADULT })

  // === 감산 ===
  if (s.ageYears >= 10) {
    fac += CAL.D_AGE_SENIOR
    lines.push({ label: '노령(10세+)', delta: CAL.D_AGE_SENIOR })
  } else if (s.ageYears >= 7) {
    fac += CAL.D_AGE_MATURE
    lines.push({ label: '중년(7~9세)', delta: CAL.D_AGE_MATURE })
  }

  // easy-keeper: 설문 OR 견종 OB → 감산 1회만 (이중차감 금지).
  if (s.isEasyKeeper || flags.obeseProne) {
    fac += CAL.D_EASY_KEEPER
    lines.push({ label: '쉽게 찌는 체질/비만경향 견종', delta: CAL.D_EASY_KEEPER })
  }
  if (s.isVeryInactive) {
    fac += CAL.D_VERY_INACTIVE
    lines.push({ label: '거의 안 움직임', delta: CAL.D_VERY_INACTIVE })
  }

  // === 가산 (증거 게이트) ===
  if (!s.isNeutered) {
    fac += CAL.A_INTACT
    lines.push({ label: '미중성화', delta: CAL.A_INTACT })
  }
  if (bcs <= 3) {
    fac += CAL.A_UNDERWEIGHT
    lines.push({ label: '저체중', delta: CAL.A_UNDERWEIGHT })
  }

  // 활동 가산: 단두종이면 억제. 자가보고 +0.1, 객관 증거만 +0.2.
  if (s.activityIntensity === 'high' && !flags.brachycephalic) {
    const a =
      s.activityEvidence === 'objective'
        ? CAL.A_VIGOROUS_OBJECTIVE_MIN
        : CAL.A_VIGOROUS_SELF
    fac += a
    lines.push({
      label:
        s.activityEvidence === 'objective'
          ? '규칙적 격한 운동(측정)'
          : '활발(자가보고)',
      delta: a,
    })
  }
  if (s.coldExposure && s.housing === 'outdoor') {
    fac += CAL.A_OUTDOOR_COLD
    lines.push({ label: '실외·한랭', delta: CAL.A_OUTDOOR_COLD })
  }

  const clamped = Math.min(
    Math.max(fac, CAL.FACTOR_FLOOR_MAINTENANCE),
    CAL.FACTOR_CEIL_ADULT,
  )
  // 클램프 발동 시 사다리에도 기록 — 6단계 UI 가 라인 합계 = 최종 계수를
  // 보여주므로, 보정 없이 잘라내면 합이 안 맞는 표가 노출된다.
  if (Math.abs(clamped - fac) > 0.001) {
    lines.push({
      label:
        clamped > fac
          ? `안전 하한 ×${CAL.FACTOR_FLOOR_MAINTENANCE} 적용`
          : `안전 상한 ×${CAL.FACTOR_CEIL_ADULT} 적용`,
      delta: +(clamped - fac).toFixed(2),
    })
  }
  return { factor: +clamped.toFixed(2), lines }
}

// ─────────────────────────────────────────────────────────────────────
// M5 — 감량 분기
// ─────────────────────────────────────────────────────────────────────

export function weightManagementBranch(flags: BreedFlags): {
  factor: number
  notes: string[]
} {
  const notes = [
    '감량 목표: 주당 0.5~2% 속도로 판단(저울 목표치 아님).',
    '종료는 체중 숫자가 아니라 갈비뼈·허리(BCS)로.',
    '2~4주 재측정 후 감량 없으면 계수를 0.8까지 단계 인하(수의 감독 권장).',
    'BCS 8~9 또는 동반질환 시 수의 상담 필수.',
  ]
  if (flags.chondrodystrophic) {
    notes.push('연골이형성 견종 — 마른 체형 유지가 디스크·관절에 특히 중요.')
  }
  return { factor: CAL.WEIGHT_LOSS_FACTOR_START, notes }
}

// ─────────────────────────────────────────────────────────────────────
// M6 — 성장 분기 (NRC 2006 정확식, 앞 상수 130 + 토이 하향)
// ─────────────────────────────────────────────────────────────────────

export function growthBranch(
  s: SurveyInputV2,
  flags: BreedFlags,
): { rer: number; factor: number; der: number; notes: string[] } {
  const adult = s.expectedAdultWeightKg ?? s.currentWeightKg
  const p = s.currentWeightKg / adult

  // 정확식(권장): NRC 2006. ⚠️ 앞 상수 130 (70 이면 약 46% 과소).
  let der =
    CAL.GROWTH_ME_COEF *
    Math.pow(s.currentWeightKg, 0.75) *
    CAL.GROWTH_P_MULT *
    (Math.exp(-CAL.GROWTH_P_DECAY * p) - CAL.GROWTH_P_OFFSET)

  // 간이식(참고): RER × 3.0/2.0 — factor 필드로 병기.
  const rer = calculateRER(s.currentWeightKg)
  const simpleFactor =
    p < 0.5 ? CAL.GROWTH_MULT_UNDER_4MO : CAL.GROWTH_MULT_4MO_TO_ADULT

  const notes = ['자견은 시작 추정치 — 주 1회 체중·BCS로 조정해요.']
  if (flags.toyOverestimate) {
    der *= CAL.GROWTH_TOY_DISCOUNT
    notes.push('토이 견종: 표준식 과대추정 보정(~15% 하향). BCS 기준 조정 우선.')
  }

  return { rer, factor: simpleFactor, der: Math.round(der), notes }
}

// ─────────────────────────────────────────────────────────────────────
// M8 — 간식 차감 (10% 룰)
// ─────────────────────────────────────────────────────────────────────

/**
 * 간식만큼 밥(완전식)을 줄여 총섭취를 DER 로 유지. 단 차감은 DER 의 10% 까지만
 * — 그 이상 깎으면 완전균형식 비중 < 90% 로 미량영양소 희석(WSAVA 10% 룰).
 * 초과분은 경고 노트(헤비유저 식별) + M10 재측정 루프가 체중으로 수렴.
 */
export function applyTreatDeduction(
  der: number,
  s: SurveyInputV2,
): { treatKcal: number; mainPool: number; note: string | undefined } {
  if (!s.givesTreats) return { treatKcal: 0, mainPool: der, note: undefined }
  const cap = der * CAL.TREAT_MAX_FRACTION
  const treatKcal = Math.min(s.treatKcalPerDay ?? 0, cap)
  const note =
    (s.treatKcalPerDay ?? 0) > cap
      ? `간식이 하루 필요량의 10%(${Math.round(cap)}kcal)를 초과해요 — 줄이기를 권장해요.`
      : undefined
  return { treatKcal: Math.round(treatKcal), mainPool: der - treatKcal, note }
}

// ─────────────────────────────────────────────────────────────────────
// M_aux — 모디파이드 앳워터 (건사료 폴백 전용)
// ─────────────────────────────────────────────────────────────────────

export function modifiedAtwaterKcalPer100g(ga: GuaranteedAnalysis): number {
  const nfe =
    100 - (ga.crudeProtein + ga.crudeFat + ga.crudeFiber + ga.moisture + ga.ash)
  const mePerKg =
    10 *
    (CAL.ATWATER_PROTEIN * ga.crudeProtein +
      CAL.ATWATER_FAT * ga.crudeFat +
      CAL.ATWATER_NFE * Math.max(nfe, 0))
  return +(mePerKg / 10).toFixed(1)
}

// ─────────────────────────────────────────────────────────────────────
// M9b — 건사료 kcal 3단 폴백 (DB → 라벨 → 앳워터)
// ─────────────────────────────────────────────────────────────────────

export async function resolveKibbleKcal(
  s: SurveyInputV2,
  db: KibbleDb,
): Promise<{ kcalPer100g: number | null; source: 'db' | 'label' | 'atwater' | 'none' }> {
  if (s.kibbleProductId) {
    const p = await db.getProduct(s.kibbleProductId)
    if (p?.kcalPer100g) return { kcalPer100g: p.kcalPer100g, source: 'db' }
  }
  if (s.kibbleKcalPer100g != null) {
    return { kcalPer100g: s.kibbleKcalPer100g, source: 'label' }
  }
  if (s.kibbleGA) {
    return { kcalPer100g: modifiedAtwaterKcalPer100g(s.kibbleGA), source: 'atwater' }
  }
  if (s.kibbleRawInput) await db.logMissing(s.kibbleRawInput) // 다음 매장투어 우선순위
  return { kcalPer100g: null, source: 'none' }
}

// ─────────────────────────────────────────────────────────────────────
// M9 — 배분 + 그램 환산
// ─────────────────────────────────────────────────────────────────────

export function allocatePortions(
  mainPool: number,
  s: SurveyInputV2,
  kibbleKcalPer100g: number | null,
): {
  hwasik: { kcal: number; grams: number; sku: string }
  kibble: { kcal: number; grams: number | null }
} {
  const share = s.hwasikShare ?? CAL.DEFAULT_HWASIK_SHARE
  const hwasikKcal = mainPool * share
  const kibbleKcal = mainPool * (1 - share)
  const hwasikGrams = Math.round(hwasikKcal / (s.hwasikKcalPer100g / 100)) // 화식 = 실측값만
  const kibbleGrams = kibbleKcalPer100g
    ? Math.round(kibbleKcal / (kibbleKcalPer100g / 100))
    : null
  return {
    hwasik: { kcal: Math.round(hwasikKcal), grams: hwasikGrams, sku: s.hwasikSku },
    kibble: { kcal: Math.round(kibbleKcal), grams: kibbleGrams },
  }
}

// ─────────────────────────────────────────────────────────────────────
// M10 — 재측정 피드백 (감산 지배형의 수렴 엔진 — 3단계에서 실연결)
// ─────────────────────────────────────────────────────────────────────

export type FeedbackGoal = 'maintain' | 'lose' | 'gain'

export function feedbackAdjustment(
  prevDer: number,
  weightDeltaPct: number,
  days: number,
  goal: FeedbackGoal,
): { newDer: number; note: string } {
  const weeks = days / 7
  const rate = weightDeltaPct / weeks
  if (goal === 'maintain') {
    if (Math.abs(weightDeltaPct) <= CAL.MAINTAIN_TOLERANCE_PCT) {
      return { newDer: prevDer, note: '유지 양호.' }
    }
    const dir = weightDeltaPct > 0 ? -1 : +1
    return {
      newDer: Math.round(prevDer * (1 + dir * CAL.FEEDBACK_STEP_PCT)),
      note: dir < 0 ? '체중 증가 → −10%' : '예상외 감량 → +10%',
    }
  }
  if (goal === 'lose') {
    // ⚠️ 스펙 원문 버그 교정(0단계 하네스에서 발견): 원문은 rate(부호 있는
    // 변화율)를 그대로 MIN/MAX(양수 감량속도)와 비교해, 잘 빠지는 개(음수
    // rate)도 항상 "정체"로 판정 → −10% 폭주. 감량 속도 = −rate 로 정정.
    const lossRatePctWk = -rate
    if (lossRatePctWk < CAL.LOSS_RATE_MIN_PCT_WK) {
      return {
        newDer: Math.round(prevDer * (1 - CAL.FEEDBACK_STEP_PCT)),
        note: '감량 정체 → −10%',
      }
    }
    if (lossRatePctWk > CAL.LOSS_RATE_MAX_PCT_WK) {
      return {
        newDer: Math.round(prevDer * (1 + CAL.FEEDBACK_STEP_PCT)),
        note: '감량 과속 → +10%',
      }
    }
    return { newDer: prevDer, note: '감량 속도 적정.' }
  }
  return rate <= 0
    ? {
        newDer: Math.round(prevDer * (1 + CAL.FEEDBACK_STEP_PCT)),
        note: '증량 정체 → +10%',
      }
    : { newDer: prevDer, note: '증량 진행.' }
}

// ─────────────────────────────────────────────────────────────────────
// 경로 분류 + 오케스트레이터
// ─────────────────────────────────────────────────────────────────────

export function classifyPath(s: SurveyInputV2, bcs: number): PlanPath {
  // 질병/투약 → 수의 라우팅 (계산 중단 — 사장님 확정, 기존 계산 제공 방식 폐기).
  if (s.healthFlags.some((h) => h !== 'none')) return 'vet_referral'
  if (s.isPregnant || s.isLactating) return 'reproduction'
  if (s.lifeStage === 'puppy') return 'growth'
  if (bcs >= 6) return 'weight_loss'
  return 'adult'
}

const ESTIMATE_NOTE =
  '이 값은 2~4주 시작 추정치예요(개체차 ±30%). 재측정 후 조정해요.'

function vetReferralPlan(
  s: SurveyInputV2,
  flags: BreedFlags,
  bcs: number,
  notes: string[],
  path: PlanPath = 'vet_referral',
): FeedingPlanV2 {
  return {
    path,
    derivedBcs: bcs,
    breedFlags: flags,
    idealWeightKg: estimateIdealBodyWeight(s.currentWeightKg, bcs),
    rer: calculateRER(s.currentWeightKg),
    factor: 0,
    factorBreakdown: [],
    der: 0,
    treatKcal: 0,
    mainPoolKcal: 0,
    hwasik: { kcal: 0, grams: 0, sku: s.hwasikSku },
    kibble: { kcal: 0, grams: null, source: 'none' },
    notes,
    isEstimate: true,
  }
}

export async function computeFeedingPlanV2(
  s: SurveyInputV2,
  db: KibbleDb,
): Promise<FeedingPlanV2> {
  const flags = breedToFlags(s.breed)
  const bcs = deriveBCS(s.bodyAssessment)
  const path = classifyPath(s, bcs)
  const notes: string[] = []

  if (path === 'vet_referral') {
    return vetReferralPlan(s, flags, bcs, [
      '건강 상태가 있어 자동 산출 대신 수의사 상담이 필요해요.',
    ])
  }
  if (path === 'reproduction') {
    return vetReferralPlan(
      s,
      flags,
      bcs,
      [
        '임신·수유기는 요구량 변동이 커서(임신 말기 ×1.6~2.0 · 수유 ×2~6) 수의사와 함께 정해요.',
      ],
      'reproduction',
    )
  }

  if (path === 'growth') {
    const g = growthBranch(s, flags)
    return assemble(s, db, flags, bcs, {
      path,
      ibw: s.currentWeightKg,
      rer: g.rer,
      factor: g.factor,
      lines: [{ label: `성장기 ×${g.factor}(근사 병기)`, delta: g.factor }],
      der: g.der,
      notes: [...g.notes, ...notes],
    })
  }

  const ibw = estimateIdealBodyWeight(s.currentWeightKg, bcs)
  const rer = calculateRER(ibw)
  let factor: number
  let lines: FactorLine[]
  if (path === 'weight_loss') {
    const w = weightManagementBranch(flags)
    factor = w.factor
    lines = [{ label: '감량(RER×1.0 시작)', delta: w.factor }]
    notes.push(...w.notes)
  } else {
    const a = calculateAdultFactor(s, flags)
    factor = a.factor
    lines = a.lines
    if (flags.chondrodystrophic) {
      notes.push('연골이형성 견종 — 마른 체형 유지를 권장해요(디스크·관절).')
    }
  }

  return assemble(s, db, flags, bcs, {
    path,
    ibw,
    rer,
    factor,
    lines,
    der: Math.round(rer * factor),
    notes,
  })
}

async function assemble(
  s: SurveyInputV2,
  db: KibbleDb,
  flags: BreedFlags,
  bcs: number,
  x: {
    path: PlanPath
    ibw: number
    rer: number
    factor: number
    lines: FactorLine[]
    der: number
    notes: string[]
  },
): Promise<FeedingPlanV2> {
  const t = applyTreatDeduction(x.der, s)
  if (t.note) x.notes.push(t.note)
  const k = await resolveKibbleKcal(s, db)
  const alloc = allocatePortions(t.mainPool, s, k.kcalPer100g)
  x.notes.push(ESTIMATE_NOTE)
  if (alloc.kibble.grams == null && (s.hwasikShare ?? CAL.DEFAULT_HWASIK_SHARE) < 1) {
    x.notes.push('건사료 kcal 정보가 없어 건사료 그램은 계산하지 못했어요.')
  }
  return {
    path: x.path,
    derivedBcs: bcs,
    breedFlags: flags,
    idealWeightKg: x.ibw,
    rer: x.rer,
    factor: x.factor,
    factorBreakdown: x.lines,
    der: x.der,
    treatKcal: t.treatKcal,
    mainPoolKcal: Math.round(t.mainPool),
    hwasik: alloc.hwasik,
    kibble: { ...alloc.kibble, source: k.source },
    notes: x.notes,
    isEstimate: true,
  }
}
