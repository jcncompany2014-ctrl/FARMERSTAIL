/**
 * 저장된 `analyses.mer` 이 **물리적으로 가능한 값인가** — 정본 한 곳.
 * (2026-08-05 병렬 보안 감사)
 *
 * # 왜 필요한가
 * dog_formulas 는 20260805000000 으로 잠갔다(고객 쓰기 회수). 그런데 그 행을
 * 만드는 compute 라우트의 **입력**이 `analyses.mer` 이고, analyses 는 브라우저가
 * 직접 INSERT 한다(설문 완료 SurveyClient · 익명설문→가입 applyAutosignupDraft).
 * 즉 잠금을 한 층 위로 올렸을 뿐, mer 을 임의 값으로 넣고 compute 를 호출하면
 * 같은 결과가 된다:
 *     mer → dailyKcal → dog_formulas.daily_kcal → boxPricing → total_amount
 *
 * # 왜 "서버에서 전면 재계산" 이 아닌가
 * `calculateNutrition(dog, answers)` 는 순수 함수지만 입력이 20개+ 필드고
 * (체중신뢰도·성별·견종·체형 3분해·임신상태…) compute 가 읽는 dog/survey 열은
 * 그 부분집합이다. 일부만으로 다시 세면 **고객이 분석 화면에서 본 kcal 과
 * 처방의 kcal 이 갈린다** — 사장님이 "급여량이 세 화면 다 다르다"고 지적한 바로
 * 그 병을 새로 만드는 셈이다. 규칙5 와도 같은 결이다(저장값으로 청구한다).
 *
 * # 그래서 무엇을 하나
 * 금액을 재계산해 **깎지 않는다.** 대신 저장값이 물리적으로 가능한 범위 안인지만
 * 본다. RER(휴식기 에너지)은 체중 하나로 정해지는 대사 상수이고
 * (70 × kg^0.75, lib/nutrition computeRer), MER 은 그 배수다. 이 저장소의
 * factor 는 극단까지 0.5~5.0 인데, 여기서는 그보다 **더 넓게** 0.4~6.0 을 쓴다 —
 * 정상 고객은 어떤 조합으로도 안 걸리고, 조작(`{"mer":1}`)은 확실히 걸린다.
 *
 * 이 함수는 "맞는 값인가"를 판정하지 않는다. "**말이 되는 값인가**"만 본다.
 * 통과했다고 정확한 것은 아니다 — 그 정확도는 계산 엔진의 책임이다.
 */

import { computeRer } from '../nutrition.ts'

/** MER ÷ RER 의 허용 하한. 실제 최소 factor(0.5)보다 넉넉하다. */
export const MER_FACTOR_MIN = 0.4
/** MER ÷ RER 의 허용 상한. 실제 최대 factor(5.0 — 수유견)보다 넉넉하다. */
export const MER_FACTOR_MAX = 6.0

/**
 * 저장된 mer 이 그 체중에서 나올 수 있는 값인가.
 *
 * @returns 판정 불가(체중 없음·mer 없음)면 `false` — "검증 못 하면 통과"는
 *   그 자체가 탈출구다(AGENTS 규칙2). 호출부는 거부하고 사람에게 알린다.
 */
export function isPlausibleMer(
  mer: number | null | undefined,
  weightKg: number | null | undefined,
): boolean {
  if (typeof mer !== 'number' || !Number.isFinite(mer) || mer <= 0) return false
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg <= 0) {
    return false
  }
  const rer = computeRer(weightKg)
  if (!(rer > 0)) return false
  const factor = mer / rer
  return factor >= MER_FACTOR_MIN && factor <= MER_FACTOR_MAX
}

/**
 * 타당성 검사의 기준 체중 — 보통은 등록 체중(dogs.weight).
 *
 * 자견 월간 자동 갱신 행(source growth_auto, 2026-10-01)은 성장곡선으로 추정한 이번 달 체중으로
 * 계산되고, 추정치는 dogs.weight 를 덮지 않는다(실측만 실측). 그래서 몇 달 체중을 안 잰 강아지는
 * 그 행의 mer 이 등록 체중 기준 범위를 벗어나 처방 화면이 "분석을 다시 진행해 주세요"로 막힐 수
 * 있다. 그 행에 한해 행이 쓴 체중(weight_kg)과 등록 체중 중 큰 쪽을 쓴다.
 *
 * ★source·weight_kg 는 고객이 못 쓴다 — analyses_lock_server_columns 트리거가 고객 역할의 쓰기를
 *   되돌린다(20261001180000). 그 잠금이 없으면 이 함수가 그대로 탈출구가 된다(AGENTS 규칙2).
 */
export function plausibilityWeightKg(
  dogWeightKg: number | null | undefined,
  analysis: { source?: string | null; weight_kg?: number | string | null } | null | undefined,
): number | null {
  const dogW = typeof dogWeightKg === 'number' && Number.isFinite(dogWeightKg) && dogWeightKg > 0 ? dogWeightKg : null
  if (analysis?.source !== 'growth_auto') return dogW
  const rowW = analysis.weight_kg == null ? NaN : Number(analysis.weight_kg)
  if (!Number.isFinite(rowW) || rowW <= 0) return dogW
  return dogW == null ? rowW : Math.max(dogW, rowW)
}
