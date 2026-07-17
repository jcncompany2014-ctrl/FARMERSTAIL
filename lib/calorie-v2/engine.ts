/**
 * 칼로리 알고리즘 v2 — 순수 계산 모듈 (docs/CALORIE_ALGORITHM_SPEC_V2.md §6·§9).
 *
 * # 이 파일의 위치 — 부품 모음이지 파이프라인이 아니다
 *
 * 고객 급여량을 실제로 내는 정본은 **`lib/nutrition.ts` 의 `calculateNutrition`**
 * 하나다. 이 파일은 그 정본이 가져다 쓰는 v2 부품만 담는다:
 *
 *     lib/nutrition.ts ─┬─ adapter.ts(legacyAdultLadder) ─ calculateAdultFactor · breedToFlags
 *                       └─ estimateIdealBodyWeight
 *     survey(Body·SurveyClient) ── deriveBCS
 *     reweigh.ts ── feedbackAdjustment ── cron/weight-change-detect
 *
 * export 5개가 전부이고 **전부 프로덕션에서 살아 있다.** 예전엔 여기에 스펙대로
 * 짠 상위 파이프라인(`computeFeedingPlanV2`·`classifyPath`·`growthBranch`·
 * `weightManagementBranch`·`calculateRER`·`resolveKibbleKcal`·`allocatePortions`·
 * `applyTreatDeduction`)이 함께 있었으나, **테스트만 부르는 死코드**인 데다
 * ① 사장님이 뒤집은 옛 설계(질병 시 계산 중단)를 담고 ② RER 공식을 nutrition.ts
 * 와 중복 보유해 "여기가 프로덕션 동작"이라는 오독을 유발했다. 사장님 결정으로
 * **2026-07-17 삭제**(창고 정리). 스펙 원문은 docs/CALORIE_ALGORITHM_SPEC_V2.md 에
 * 그대로 있으니 설계 근거는 그쪽을 볼 것.
 *
 * ⚠️ 새 계산 로직을 여기 추가하지 말 것. 정본은 nutrition.ts 이며, 이 파일은
 * 정본이 호출하는 부품만 유지한다(중복 = 조용히 갈라지는 원인).
 *
 * # 사장님 확정 설계 결정 (2026-07-12)
 *  1. 임신/수유·질병 = **계산은 제공하되** 에너지 카드 직하에 수의 상담 배너 강제
 *     노출(스펙의 "계산 중단"은 구독 플로우 차단 + '긍정 먼저' 원칙과 충돌해 폐기).
 *     살아 있는 규칙 = `lib/nutrition.ts` 의 `CALORIE_VET_ROUTE_FLAGS` /
 *     `needsCalorieVetRoute()`.
 *  2. RER 토이 보정(≤2kg Kleiber) **유지** — 스펙 "지수식만"의 취지는 선형식
 *     (30×BW+70) 폐지이고, 현행 토이 보정은 지수식 계열이라 충돌 없음.
 *     실제 RER 구현 = `lib/nutrition.ts` 의 `computeRer` (여기 중복 사본은 삭제됨).
 *  3. 감산 지배형의 성립 조건 = M10 재측정 루프 = `feedbackAdjustment`(연결 완료).
 *
 * # 가드레일 (스펙 §8) — 이 파일이 책임지는 것
 *  - 성견 계수 클램프 [1.0, 2.0], 곱셈 금지(가산+클램프만)
 *  - 이중차감 금지: 견종 OB ↔ 설문 easy-keeper 는 OR 로 감산 1회
 *  (감량 하한 RER(IBW)×0.8 · 화식 kcal 실측값만 · 자견 성장식 앞 상수 130 은
 *   정본 nutrition.ts 가 책임진다.)
 */
import { CAL } from './constants.ts'
import type {
  BreedFlags,
  BreedKey,
  FactorLine,
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
