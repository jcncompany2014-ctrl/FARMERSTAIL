/**
 * 자견 성장곡선 — 나이·현재 체중으로 "다 크면 몇 kg쯤이고, 지금 얼마나 컸나"를 추정한다.
 *
 * # 왜 (2026-10-01 사장님)
 * 앱 설문이 보호자에게 "다 자라면 몇 kg쯤 될까요?"를 물었는데, 보호자는 알 수가 없다
 * ("이걸 보호자가 대체 어케 알아"). 그런데 이 답이 자견 칼로리 전체를 좌우했다
 * (7개월 웨스티에 20kg 를 잘못 넣으면 1,214kcal — 적정의 1.7배). 질문을 없애고 수의 영양
 * 가이드라인의 성장곡선으로 추정한다. 체중이 새로 기록되면 그 체중으로 다시 맞춘다.
 *
 * # 출처
 * FEDIAF Nutritional Guidelines 2025 Table VII-8a (GfE 1989 / Meyer & Zentek 1992 수정),
 * 이유기(8주)~1년 유효: 성견체중 대비 % = a·ln(주령) − b, 예상 성견체중 구간별.
 * 여기서 나온 비율이 자견 칼로리 식(Klein 2019, FEDIAF Table VII-8b)의 p 다
 * (lib/nutrition.ts 자견 분기).
 *
 * 순수 함수만 — 화면·크론·테스트가 같은 값을 쓴다.
 */

export type GrowthCurve = {
  /** 이 곡선을 쓰는 예상 성견체중 상한(kg, 포함). */
  maxAdultKg: number
  a: number
  b: number
}

/** FEDIAF 2025 Table VII-8a — 작은 구간부터. 구간 경계는 원문 표기(≤7 / >7–15 / …). */
export const GROWTH_CURVES: readonly GrowthCurve[] = [
  { maxAdultKg: 7, a: 36.92, b: 43.57 },
  { maxAdultKg: 15, a: 36.86, b: 48.22 },
  { maxAdultKg: 27.5, a: 39.88, b: 60.7 },
  { maxAdultKg: 47.5, a: 36.96, b: 56.18 },
  { maxAdultKg: Infinity, a: 36.61, b: 62.39 },
]

/** 한 달 평균 주 수 (365.25 / 12 / 7). */
export const WEEKS_PER_MONTH = 4.348

/** 곡선 유효 시작(이유기). 더 어린 주령은 8주로 본다. */
const MIN_WEEKS = 8
/** 0 나눗셈·말도 안 되는 추정 방지 하한. 곡선상 최솟값은 초대형견 8주 ≈ 0.137. */
const MIN_FRACTION = 0.1

/** 주령에서 "다 큰 몸무게의 몇 할" (0.1~1). 곡선이 100% 를 넘는 주령부터는 1. */
export function grownFraction(ageWeeks: number, curve: GrowthCurve): number {
  const w = Math.max(MIN_WEEKS, ageWeeks)
  const pct = curve.a * Math.log(w) - curve.b
  return Math.min(1, Math.max(MIN_FRACTION, pct / 100))
}

export function curveForAdultKg(adultKg: number): GrowthCurve {
  return GROWTH_CURVES.find((c) => adultKg <= c.maxAdultKg) ?? GROWTH_CURVES[GROWTH_CURVES.length - 1]!
}

export type GrowthEstimate = {
  /** 예상 성견체중 kg (소수 둘째 자리). */
  adultKg: number
  /** 지금 다 큰 정도 0.1~1 — 칼로리 식의 p. */
  fraction: number
}

/**
 * 현재 체중·주령 → 예상 성견체중·지금 다 큰 정도.
 *
 * 작은 구간 곡선부터 대입해 "그 곡선으로 추정한 성견체중이 그 구간 안"인 첫 곡선을 고른다.
 * 같은 주령에선 작은 구간일수록 많이 자라 있어(8주: 33·28·22·21·14%) 추정 성견체중이 구간이
 * 커질수록 단조 증가하므로 항상 한 구간이 정해진다(마지막 구간 상한 = ∞).
 */
export function estimateGrowth(currentKg: number, ageWeeks: number): GrowthEstimate {
  const kg = Math.max(0.1, currentKg)
  for (const c of GROWTH_CURVES) {
    const fraction = grownFraction(ageWeeks, c)
    const adult = kg / fraction
    if (adult <= c.maxAdultKg) return { adultKg: Math.round(adult * 100) / 100, fraction }
  }
  const last = GROWTH_CURVES[GROWTH_CURVES.length - 1]!
  const fraction = grownFraction(ageWeeks, last)
  return { adultKg: Math.round((kg / fraction) * 100) / 100, fraction }
}

/** 예상 성견체중 + 주령 → 그 주령의 예상 체중(체중 기록이 없을 때 이번 달 체중 추정). */
export function projectWeightKg(adultKg: number, ageWeeks: number): number {
  return adultKg * grownFraction(ageWeeks, curveForAdultKg(adultKg))
}

/** 생일(YYYY-MM-DD) → 지금 주령. 생일이 없거나 미래면 null. */
export function ageWeeksFromBirth(birthISO: string | null | undefined, nowMs: number): number | null {
  if (!birthISO) return null
  const birth = Date.parse(birthISO.slice(0, 10) + 'T00:00:00Z')
  if (Number.isNaN(birth) || birth > nowMs) return null
  return (nowMs - birth) / (7 * 86_400_000)
}
