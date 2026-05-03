/**
 * Farmer's Tail — 다음 cycle 비율 결정 알고리즘 v1.
 *
 * 첫 박스 (decideFirstBox) 는 설문 만으로 결정. 2cycle+ 부터는 보호자의
 * 체크인 응답 (변/털/식욕/만족도) 을 신호로 비율 미세 조정.
 *
 * # 핵심 원칙
 *
 * 1. **점진 변화** — 매 cycle 큰 swing 은 churn 유발. 보통 ±5~15% 만 조정.
 *    예외: GI 적응 실패 (지속 무름) → 단일 단백질 강제 collapse.
 *
 * 2. **이전 처방 baseline** — 효과적이면 유지가 기본. 신호 없는 강아지는
 *    같은 비율로 다음 cycle. 응답 안 한 cycle 은 "변화 없음" 으로 처리.
 *
 * 3. **week_4 우선** — week_2 는 위장 적응 (단기), week_4 는 종합 (장기).
 *    충돌 시 week_4 가 이김.
 *
 * 4. **설문 변경 권한** — 보호자가 설문을 다시 제출하면 그게 우선. 알레르기
 *    추가 / 케어 목표 변경 시 decideFirstBox 를 다시 호출하는 게 더 적절
 *    (caller 책임).
 *
 * 5. **만족도 5 freeze** — overall_satisfaction === 5 면 적극 변경 회피.
 *    "잘 되고 있는데 왜 바꿔" 의 함정.
 */

import type {
  AlgorithmInput,
  Checkin,
  Formula,
  FoodLine,
  NextBoxInput,
  Ratio,
  Reasoning,
  TransitionStrategy,
} from './types.ts'
import { FOOD_LINE_META, ALL_LINES } from './lines.ts'

const ALGORITHM_VERSION = 'v1.1.0'
const QUANTIZE_STEP = 0.1

// ──────────────────────────────────────────────────────────────────────────
// 메인 진입점
// ──────────────────────────────────────────────────────────────────────────

export function decideNextBox(input: NextBoxInput): Formula {
  const { previousFormula, checkins, surveyInput, cycleNumber } = input
  const reasoning: Reasoning[] = []

  // 알레르기는 매 cycle 검증 — 설문이 갱신되어 새 알레르기 추가됐을 수도.
  const blocked = recomputeBlockedLines(surveyInput.allergies, reasoning)

  // 시작점: 이전 처방. 0% 라인은 그대로 유지 (알레르기 / 위장 민감 등).
  let lineRatios: Record<FoodLine, Ratio> = { ...previousFormula.lineRatios }

  // 새 알레르기 발견 → 강제 0%.
  for (const line of ALL_LINES) {
    if (blocked.has(line) && lineRatios[line] > 0) {
      lineRatios[line] = 0
    }
  }

  const week2 = checkins.find((c) => c.checkpoint === 'week_2')
  const week4 = checkins.find((c) => c.checkpoint === 'week_4')

  // 응답 없음 → "잘 됐다" 로 간주, 변화 최소.
  if (!week2 && !week4) {
    reasoning.push({
      trigger: '체크인 응답 없음',
      action: '이전 비율 유지 (큰 변화 회피)',
      chipLabel: '응답 없음 → 유지',
      priority: 0,
      ruleId: 'next-no-checkin',
    })
  }

  // week_2 신호 — 위장 적응 (지방 / 야채 미세 조정).
  if (week2) {
    lineRatios = applyWeek2StoolSignal(lineRatios, week2, reasoning)
  }

  // week_4 신호 — 종합 평가.
  if (week4) {
    // 만족도 5 → freeze 우선 룰. 다른 어떤 조정보다 우선.
    if (week4.overallSatisfaction === 5) {
      reasoning.push({
        trigger: '만족도 5/5',
        action: '큰 변화 없음 — 잘 되고 있을 때 건드리지 않기',
        chipLabel: '만족 → 유지',
        priority: 1,
        ruleId: 'next-freeze-satisfied',
      })
      return finalize(
        lineRatios,
        previousFormula,
        surveyInput,
        cycleNumber,
        reasoning,
        blocked,
      )
    }

    // 변 신호 (지속) — week_2 와 같은 신호면 더 적극 조정.
    lineRatios = applyWeek4StoolSignal(
      lineRatios,
      week4,
      week2 ?? null,
      reasoning,
    )

    // 털 — Skin (오메가-3) ↑.
    lineRatios = applyCoatSignal(lineRatios, week4, blocked, reasoning)

    // 식욕 — 선호 단백질 / 토퍼.
    lineRatios = applyAppetiteSignal(
      lineRatios,
      week4,
      surveyInput,
      blocked,
      reasoning,
    )

    // 만족도 1~2 — 큰 swing 권고 (수의사 상담 chip).
    if (week4.overallSatisfaction !== null && week4.overallSatisfaction <= 2) {
      reasoning.push({
        trigger: `만족도 ${week4.overallSatisfaction}/5`,
        action: '재설문 + 수의사 상담 권장. 다음 cycle 까지 base 유지.',
        chipLabel: '만족도 낮음 → 상담',
        priority: 2,
        ruleId: 'next-low-satisfaction',
      })
    }
  }

  return finalize(
    lineRatios,
    previousFormula,
    surveyInput,
    cycleNumber,
    reasoning,
    blocked,
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function recomputeBlockedLines(
  allergies: string[],
  reasoning: Reasoning[],
): Set<FoodLine> {
  const blocked = new Set<FoodLine>()
  for (const line of ALL_LINES) {
    const meta = FOOD_LINE_META[line]
    const conflict = meta.blockingAllergies.find((a) => allergies.includes(a))
    if (conflict) {
      blocked.add(line)
      // 새 알레르기는 우선순위 0 (가장 중요).
      reasoning.push({
        trigger: `${conflict} 알레르기 (재설문 반영)`,
        action: `${meta.name} 라인 0% 유지/차단`,
        chipLabel: `${conflict} 차단`,
        priority: 0,
        ruleId: `next-allergy-${line}`,
      })
    }
  }
  return blocked
}

function shiftRatio(
  ratios: Record<FoodLine, Ratio>,
  from: FoodLine,
  to: FoodLine,
  amount: number,
  blocked: Set<FoodLine>,
): Record<FoodLine, Ratio> {
  if (blocked.has(to) || blocked.has(from)) return ratios
  const actual = Math.min(amount, ratios[from])
  return {
    ...ratios,
    [from]: ratios[from] - actual,
    [to]: ratios[to] + actual,
  }
}

/** 비율 정규화 + 0.1 단위 quantize. blocked 라인은 강제 0. */
function quantizeAndNormalize(
  ratios: Record<FoodLine, Ratio>,
  blocked: Set<FoodLine>,
): Record<FoodLine, Ratio> {
  // 1) blocked → 0
  const cleaned: Record<FoodLine, Ratio> = { ...ratios }
  for (const line of ALL_LINES) {
    if (blocked.has(line)) cleaned[line] = 0
  }
  // 2) sum > 0 보장
  const sum = ALL_LINES.reduce((s, l) => s + cleaned[l], 0)
  if (sum <= 0) {
    const fallback = ALL_LINES.find((l) => !blocked.has(l)) ?? 'skin'
    cleaned[fallback] = 1
  } else {
    for (const line of ALL_LINES) cleaned[line] = cleaned[line] / sum
  }
  // 3) 0.1 단위 round + 잔차 흡수
  const rounded = ALL_LINES.reduce(
    (acc, l) => {
      acc[l] = Math.round(cleaned[l] / QUANTIZE_STEP) * QUANTIZE_STEP
      return acc
    },
    {} as Record<FoodLine, Ratio>,
  )
  const total = ALL_LINES.reduce((s, l) => s + rounded[l], 0)
  const diff = 1 - total
  if (Math.abs(diff) > 1e-9) {
    const target =
      ALL_LINES.reduce<FoodLine | null>(
        (best, l) =>
          rounded[l] > 0 && (best === null || rounded[l] > rounded[best])
            ? l
            : best,
        null,
      ) ?? 'basic'
    rounded[target] = Math.max(0, Math.round((rounded[target] + diff) * 10) / 10)
  }
  return rounded
}

// ──────────────────────────────────────────────────────────────────────────
// week_2 신호 — 위장 적응
// ──────────────────────────────────────────────────────────────────────────

function applyWeek2StoolSignal(
  ratios: Record<FoodLine, Ratio>,
  week2: Checkin,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  if (week2.stoolScore === null) return ratios

  // 변 무름 (5-7) — 지방 ↓: Skin/Premium 줄이고 Weight 늘림.
  if (week2.stoolScore >= 5) {
    const skinShift = Math.min(0.05, ratios.skin)
    const premShift = Math.min(0.05, ratios.premium)
    const weight = ratios.weight + skinShift + premShift
    reasoning.push({
      trigger: `2주차 변 #${week2.stoolScore} (무름)`,
      action: `Skin/Premium 비중 -5%, Weight +${((skinShift + premShift) * 100).toFixed(0)}%`,
      chipLabel: '2주차 무름 → 지방 ↓',
      priority: 4,
      ruleId: 'next-week2-stool-soft',
    })
    return {
      ...ratios,
      skin: ratios.skin - skinShift,
      premium: ratios.premium - premShift,
      weight,
    }
  }

  // 변비 (1-2) — 변화 없음 (week_4 가 종합 판단). 단지 reasoning 만 기록.
  if (week2.stoolScore <= 2) {
    reasoning.push({
      trigger: `2주차 변 #${week2.stoolScore} (변비)`,
      action: '관찰 (week_4 까지). 야채 토퍼 ↑ 권장 — 토퍼 단계에서 처리.',
      chipLabel: '2주차 변비 → 관찰',
      priority: 4,
      ruleId: 'next-week2-stool-hard',
    })
  }

  return ratios
}

// ──────────────────────────────────────────────────────────────────────────
// week_4 신호 — 종합 평가
// ──────────────────────────────────────────────────────────────────────────

function applyWeek4StoolSignal(
  ratios: Record<FoodLine, Ratio>,
  week4: Checkin,
  week2: Checkin | null,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  if (week4.stoolScore === null) return ratios

  // week_2 와 week_4 둘 다 무름 — 적응 실패. 단일 단백질로 collapse.
  if (
    week4.stoolScore >= 5 &&
    week2?.stoolScore !== null &&
    (week2?.stoolScore ?? 0) >= 5
  ) {
    let mainLine: FoodLine = 'basic'
    let max = 0
    for (const line of ALL_LINES) {
      if (ratios[line] > max) {
        max = ratios[line]
        mainLine = line
      }
    }
    const collapsed: Record<FoodLine, Ratio> = {
      basic: 0,
      weight: 0,
      skin: 0,
      premium: 0,
      joint: 0,
    }
    collapsed[mainLine] = 1
    reasoning.push({
      trigger: '2주+4주 변 무름 지속',
      action: `${FOOD_LINE_META[mainLine].name} 100% (단일 단백질로 위장 reset)`,
      chipLabel: '지속 무름 → 단일 단백질',
      priority: 3,
      ruleId: 'next-stool-persistent-collapse',
    })
    return collapsed
  }

  // week_4 만 무름 — 약하게 조정.
  if (week4.stoolScore >= 5) {
    const skinShift = Math.min(0.05, ratios.skin)
    const weight = ratios.weight + skinShift
    reasoning.push({
      trigger: `4주차 변 #${week4.stoolScore} (무름)`,
      action: `Skin -5%, Weight +5%`,
      chipLabel: '4주차 무름 → 지방 ↓',
      priority: 4,
      ruleId: 'next-week4-stool-soft',
    })
    return { ...ratios, skin: ratios.skin - skinShift, weight }
  }

  return ratios
}

function applyCoatSignal(
  ratios: Record<FoodLine, Ratio>,
  week4: Checkin,
  blocked: Set<FoodLine>,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  if (week4.coatScore === null) return ratios
  if (blocked.has('skin')) return ratios

  // coatScore <= 2 — 적극 조정 (오메가-3 ↑).
  if (week4.coatScore <= 2) {
    const target = Math.min(0.5, ratios.skin + 0.15)
    const delta = target - ratios.skin
    if (delta > 0) {
      // basic / weight 에서 가져옴 (이쪽이 보통 비중 큼).
      let remaining = delta
      const newRatios = { ...ratios, skin: target }
      for (const line of ['basic', 'weight'] as FoodLine[]) {
        const take = Math.min(remaining, newRatios[line])
        newRatios[line] -= take
        remaining -= take
        if (remaining <= 0) break
      }
      reasoning.push({
        trigger: `4주차 털 ${week4.coatScore}/5 (윤기 부족)`,
        action: `Skin ${(ratios.skin * 100).toFixed(0)}% → ${(target * 100).toFixed(0)}% (오메가-3 ↑)`,
        chipLabel: '털 윤기↓ → Skin ↑',
        priority: 5,
        ruleId: 'next-coat-low',
      })
      return newRatios
    }
  }

  // coatScore 3 — 약하게 조정.
  if (week4.coatScore === 3 && ratios.skin < 0.3) {
    return shiftRatio(ratios, 'basic', 'skin', 0.05, blocked)
  }

  return ratios
}

function applyAppetiteSignal(
  ratios: Record<FoodLine, Ratio>,
  week4: Checkin,
  surveyInput: AlgorithmInput,
  blocked: Set<FoodLine>,
  reasoning: Reasoning[],
): Record<FoodLine, Ratio> {
  if (week4.appetiteScore === null) return ratios
  if (week4.appetiteScore >= 4) return ratios

  // appetite <= 3 — 선호 단백질이 있다면 그쪽 ↑. 없으면 기호성 좋은 Premium ↑.
  const prefLine =
    surveyInput.preferredProteins.length > 0
      ? lineForProtein(surveyInput.preferredProteins[0])
      : 'premium'
  if (!prefLine || blocked.has(prefLine)) return ratios
  const target = Math.min(0.5, ratios[prefLine] + 0.1)
  const delta = target - ratios[prefLine]
  if (delta <= 0) return ratios
  // 가장 비중 큰 다른 라인에서 가져옴.
  const donor = ALL_LINES.filter(
    (l) => l !== prefLine && !blocked.has(l) && ratios[l] > 0,
  ).sort((a, b) => ratios[b] - ratios[a])[0]
  if (!donor) return ratios
  const taken = Math.min(delta, ratios[donor])
  reasoning.push({
    trigger: `4주차 식욕 ${week4.appetiteScore}/5`,
    action: `기호성 우선 — ${FOOD_LINE_META[prefLine].name} ↑${(taken * 100).toFixed(0)}%`,
    chipLabel: '식욕 ↓ → 선호 ↑',
    priority: 6,
    ruleId: 'next-appetite-low',
  })
  return {
    ...ratios,
    [prefLine]: ratios[prefLine] + taken,
    [donor]: ratios[donor] - taken,
  }
}

function lineForProtein(protein: string): FoodLine | null {
  const map: Record<string, FoodLine> = {
    chicken: 'basic',
    duck: 'weight',
    salmon: 'skin',
    beef: 'premium',
    pork: 'joint',
  }
  return map[protein] ?? null
}

// ──────────────────────────────────────────────────────────────────────────
// finalize — quantize + transition + Formula 조립
// ──────────────────────────────────────────────────────────────────────────

function finalize(
  lineRatios: Record<FoodLine, Ratio>,
  previous: Formula,
  surveyInput: AlgorithmInput,
  cycleNumber: number,
  reasoning: Reasoning[],
  blocked: Set<FoodLine>,
): Formula {
  const finalized = quantizeAndNormalize(lineRatios, blocked)

  // 토퍼 — 이전과 동일 유지 (cycle 별로 토퍼 큰 변화 회피). 단 GI 신호가
  // 강하면 nextStool 룰이 이미 비율을 collapse 했으니 토퍼도 최소.
  let toppers = { ...previous.toppers }
  const allCollapsed = ALL_LINES.filter((l) => finalized[l] > 0).length === 1
  if (allCollapsed) {
    toppers = { protein: 0, vegetable: Math.min(0.05, toppers.vegetable) }
  }

  // 전환 전략 — cycle 2+ 는 항상 'gradual' (이미 적응 단계).
  const transitionStrategy: TransitionStrategy = 'gradual'

  return {
    lineRatios: finalized,
    toppers,
    reasoning: reasoning.sort((a, b) => a.priority - b.priority),
    transitionStrategy,
    dailyKcal: surveyInput.dailyKcal,
    dailyGrams: surveyInput.dailyGrams,
    cycleNumber,
    algorithmVersion: ALGORITHM_VERSION,
    userAdjusted: false,
  }
}
