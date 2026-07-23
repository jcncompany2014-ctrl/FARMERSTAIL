/**
 * Farmer's Tail — Formula 한국어 포매터.
 *
 * `Formula` 객체를 사용자 / 운영자에게 노출할 수 있는 한국어 텍스트로 변환.
 * email / push body / admin 로그 / 디버그 등 여러 곳에서 동일 표현 유지.
 *
 * 모두 pure function — DB / 네트워크 / Date 호출 없음.
 */
import { FOOD_LINE_META, ALL_LINES } from './lines.ts'
import type { Formula, FoodLine } from './types.ts'

/**
 * 메인 라인 (가장 비중 큰) 식별 + 메타 반환. 모든 라인이 0% 면 'basic' fallback.
 */
export function mainLineOf(formula: Formula): {
  line: FoodLine
  pct: number
  name: string
  subtitle: string
} {
  let mainLine: FoodLine = 'basic'
  let max = -1
  for (const line of ALL_LINES) {
    if (formula.lineRatios[line] > max) {
      max = formula.lineRatios[line]
      mainLine = line
    }
  }
  return {
    line: mainLine,
    pct: Math.round(max * 100),
    name: FOOD_LINE_META[mainLine].name,
    subtitle: FOOD_LINE_META[mainLine].subtitle,
  }
}

/**
 * 고객 알림용 원물(레시피) 이름 — 비율(%) 없이 원물명만.
 *
 * 박스는 최대 2종(섞으면 반반)이라, 비중 있는 라인 최대 2개의 고객표시명
 * (nameKo: 치킨·오리·흑돼지·한우)을 뽑아 "한우·치킨 레시피"처럼 만든다.
 * 형용사가 붙은 subtitle('프레시 한우 레시피')이 아니라 nameKo 를 쓰므로
 * '프레시'·'무항생제' 같은 수식어는 자동 배제된다.
 *
 * (사장님 2026-07-23: 알림에 "소고기 60% 메인" 같은 비율 표기 금지 —
 *  두 원물을 섞으면 무조건 반반이므로 %는 오해를 부른다. 원물+레시피로.)
 */
export function recipeName(formula: Formula): string {
  const active = ALL_LINES.filter((l) => formula.lineRatios[l] > 0)
    .sort((a, b) => formula.lineRatios[b] - formula.lineRatios[a])
    .slice(0, 2)
    .map((l) => FOOD_LINE_META[l].nameKo)
  const label = active.length > 0 ? active.join('·') : '맞춤'
  return `${label} 레시피`
}

const ALLERGY_PROTEIN_KO: Record<string, string> = {
  chicken: '닭',
  duck: '오리',
  pork: '돼지',
  beef: '소',
  salmon: '연어',
}

/**
 * 다음 박스 변경 사유를 고객 언어 한 문장으로 — 구독페이지 동의 모달·알림용.
 * forced(알레르기·건강)는 안전 프레이밍, 그 외(몸무게 등)는 담백하게.
 * 개발 문구(diff.forceReasons)를 그대로 노출하지 않기 위함(사장님 2026-07-23).
 */
export function friendlyChangeReason(
  reasoning: Array<{ ruleId: string }>,
  forced: boolean,
): string {
  if (forced) {
    const allergy = reasoning.find(
      (r) =>
        r.ruleId.startsWith('allergy-') || r.ruleId.startsWith('next-allergy-'),
    )
    if (allergy) {
      const key = allergy.ruleId.replace(/^next-/, '').replace(/^allergy-/, '')
      const ko = ALLERGY_PROTEIN_KO[key]
      return ko
        ? `새로 등록한 ${ko} 알레르기를 반영하려고요.`
        : '새로 등록한 알레르기를 반영하려고요.'
    }
    return '건강 상태(만성질환)를 반영하려고요.'
  }
  return '그동안의 체크인과 몸무게 변화를 반영했어요.'
}

/**
 * 라인 비율을 한 줄 문자열로. 0% 라인 제외, 비중 내림차순.
 *
 *   "Joint 60% / Premium 30% / Skin 10%"
 */
export function formatLineRatios(formula: Formula): string {
  return ALL_LINES.filter((l) => formula.lineRatios[l] > 0)
    .sort((a, b) => formula.lineRatios[b] - formula.lineRatios[a])
    .map((l) => `${FOOD_LINE_META[l].name} ${Math.round(formula.lineRatios[l] * 100)}%`)
    .join(' / ')
}

/**
 * 토퍼 한 줄 — 야채/육류 둘 다 0 이면 빈 문자열.
 *
 *   "야채 +10%, 육류 +5%"
 */
export function formatToppers(formula: Formula): string {
  // audit #35: 이전엔 야채 → 육류 순서 hardcoded. 비중 큰 토퍼 먼저 표시
  // — 사용자 시각 우선순위와 일치.
  const items = [
    { label: '야채', value: formula.toppers.vegetable },
    { label: '육류', value: formula.toppers.protein },
  ]
  items.sort((a, b) => b.value - a.value)
  return items
    .filter((it) => it.value > 0)
    .map((it) => `${it.label} +${Math.round(it.value * 100)}%`)
    .join(', ')
}

/**
 * 전환 전략 → 한국어 라벨.
 */
export function transitionLabel(formula: Formula): string {
  switch (formula.transitionStrategy) {
    case 'aggressive':
      return '즉시 풀비율 적용'
    case 'gradual':
      return '2주 점진 전환'
    case 'conservative':
      return '4주 보수적 전환'
  }
}

/**
 * 1주분 / 4주분 그램 합계. dailyGrams * 7 / 30 (캘린더 월).
 * 박스 정기배송 portion (4주치 = 30일) 와 정합. 이전 28일은 portion 모델
 * 도입 전 기준 — audit 통일.
 */
export function totalGrams(formula: Formula, scale: '1w' | '4w' = '1w'): number {
  const days = scale === '1w' ? 7 : 30
  return formula.dailyGrams * days
}

/**
 * 전체 요약 — 한 단락. push body / email subtitle / admin 로그.
 *
 *   "Joint 60% / Premium 30% / Skin 10% · 야채 +10% · 4주 보수적 전환 · 280 kcal/일"
 */
export function formatFormulaSummary(formula: Formula): string {
  const parts = [formatLineRatios(formula)]
  const toppers = formatToppers(formula)
  if (toppers) parts.push(toppers)
  parts.push(transitionLabel(formula))
  parts.push(`${formula.dailyKcal} kcal/일`)
  return parts.join(' · ')
}

/**
 * Reasoning 의 chipLabel 들을 priority 오름차순으로 max N 개. UI 가 직접
 * formula.reasoning 을 받아 처리하는 게 더 일반적이지만, 단순한 텍스트
 * 노출용 (push body 같은 좁은 자리) 에 사용.
 *
 *   "닭 알레르기 차단 · 시니어 → Joint 가산 · BCS 6/9 → Weight ↑"
 */
export function formatReasoningSummary(
  formula: Formula,
  maxItems = 3,
): string {
  return [...formula.reasoning]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxItems)
    .map((r) => r.chipLabel)
    .join(' · ')
}
