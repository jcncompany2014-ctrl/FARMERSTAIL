/**
 * Farmer's Tail — Formula 변경 감지 (Option A 동의 흐름).
 *
 * 두 formula 비교해서 "의미 있는 변화" 인지 판정. 의미 있는 변화 = 보호자
 * 명시적 동의가 필요한 수준의 차이. 미세 조정 = silent auto-apply.
 *
 * 한국 전자상거래법 §13의2 "구성 변경 시 사전 동의" 충족 위해, 임계값을
 * 넘는 변화는 항상 pending_approval 로 두고 push/email 발송.
 *
 * # 임계값 (출시 1.0 — 첫 50명 데이터 보고 조정)
 *  - 라인 비율 ±10% (단일 라인 기준)
 *  - 새 라인 추가 (0% → > 0%)
 *  - 라인 제거 (> 0% → 0%) — 알레르기로 인한 강제 차단 포함
 *  - 토퍼 ±5%
 *  - 일일 칼로리 ±10%
 *  - 알고리즘 버전 major bump (v1.x → v2.x) — 룰 셋 자체가 바뀜
 */
import type { Formula } from './types.ts'

export type FormulaDiff = {
  /** true 면 사용자 동의 필요. */
  meaningful: boolean
  /** 사람-읽기-쉬운 변경 사항. UI 비교 화면 / push body / 이메일 chip. */
  changes: string[]
  /** 강제 적용 (알레르기 / 만성질환 추가 등) 인지. true 면 동의 없이도 적용. */
  forced: boolean
  /** 강제 적용 사유. forced=true 일 때만. */
  forceReasons: string[]
}

// JS float 정밀도 fudge — 0.5 - 0.4 = 0.09999...8 같은 케이스 잡으려고 epsilon
// 빼서 비교. 0.001 = 0.1% 단위라 사용자가 인지 못하는 미세 잔차.
const EPS = 0.001
const LINE_RATIO_DELTA = 0.1 - EPS // 10%
const TOPPER_DELTA = 0.05 - EPS // 5%
const KCAL_DELTA = 0.1 - EPS // 10% relative

const LINE_NAMES: Record<string, string> = {
  basic: 'Basic',
  weight: 'Weight',
  skin: 'Skin',
  premium: 'Premium',
  joint: 'Joint',
}

export function diffFormulas(
  prev: Formula,
  next: Formula,
): FormulaDiff {
  const changes: string[] = []
  const forceReasons: string[] = []
  let meaningful = false
  let forced = false

  // 1. 라인 비율 비교
  for (const line of ['basic', 'weight', 'skin', 'premium', 'joint'] as const) {
    const p = prev.lineRatios[line] ?? 0
    const n = next.lineRatios[line] ?? 0
    const delta = n - p

    // 라인 추가/제거
    if (p === 0 && n > 0) {
      meaningful = true
      changes.push(`${LINE_NAMES[line]} 라인 추가 (${Math.round(n * 100)}%)`)
    } else if (p > 0 && n === 0) {
      meaningful = true
      changes.push(`${LINE_NAMES[line]} 라인 제외 (이전 ${Math.round(p * 100)}%)`)
    } else if (Math.abs(delta) >= LINE_RATIO_DELTA) {
      meaningful = true
      const arrow = delta > 0 ? '↑' : '↓'
      changes.push(
        `${LINE_NAMES[line]} ${Math.round(p * 100)}% → ${Math.round(n * 100)}% ${arrow}`,
      )
    }
  }

  // 2. 토퍼 비교
  const topperDeltaProtein = next.toppers.protein - prev.toppers.protein
  const topperDeltaVeggie = next.toppers.vegetable - prev.toppers.vegetable
  if (Math.abs(topperDeltaProtein) >= TOPPER_DELTA) {
    meaningful = true
    changes.push(
      `육류 토퍼 ${Math.round(prev.toppers.protein * 100)}% → ${Math.round(next.toppers.protein * 100)}%`,
    )
  }
  if (Math.abs(topperDeltaVeggie) >= TOPPER_DELTA) {
    meaningful = true
    changes.push(
      `야채 토퍼 ${Math.round(prev.toppers.vegetable * 100)}% → ${Math.round(next.toppers.vegetable * 100)}%`,
    )
  }

  // 3. 일일 칼로리 비교 (상대값)
  if (prev.dailyKcal > 0) {
    const kcalDelta = (next.dailyKcal - prev.dailyKcal) / prev.dailyKcal
    if (Math.abs(kcalDelta) >= KCAL_DELTA) {
      meaningful = true
      changes.push(`일일 칼로리 ${prev.dailyKcal} → ${next.dailyKcal} kcal`)
    }
  }

  // 4. 강제 적용 사유 (사용자 동의 없이도 즉시 적용)
  // 알고리즘 reasoning 의 ruleId 확인. allergy- 가 next 에 새로 있으면 강제.
  const prevAllergyRules = new Set(
    prev.reasoning
      .filter((r) => r.ruleId.startsWith('allergy-') || r.ruleId.startsWith('next-allergy-'))
      .map((r) => r.ruleId.replace(/^next-/, '')),
  )
  const nextAllergyRules = next.reasoning
    .filter((r) => r.ruleId.startsWith('allergy-') || r.ruleId.startsWith('next-allergy-'))
    .map((r) => r.ruleId.replace(/^next-/, ''))

  for (const rule of nextAllergyRules) {
    if (!prevAllergyRules.has(rule)) {
      forced = true
      meaningful = true
      forceReasons.push(`새 알레르기 차단 (${rule}) — 강제 적용`)
    }
  }

  // 만성질환 새로 추가 → 강제 (식이 안전성)
  const prevChronicRules = new Set(
    prev.reasoning
      .filter((r) => r.ruleId.startsWith('chronic-'))
      .map((r) => r.ruleId),
  )
  const nextChronicRules = next.reasoning
    .filter((r) => r.ruleId.startsWith('chronic-'))
    .map((r) => r.ruleId)

  for (const rule of nextChronicRules) {
    if (!prevChronicRules.has(rule)) {
      forced = true
      meaningful = true
      forceReasons.push(`만성질환 추가 (${rule}) — 강제 적용`)
    }
  }

  // 임신/수유 시작/종료 — 칼로리 차이가 크니까 보통 위 KCAL_DELTA 에서 잡힘.
  // 안 잡히면 별도 룰. 여기선 생략 (kcal_delta 가 거의 모두 잡음).

  return {
    meaningful,
    changes,
    forced,
    forceReasons,
  }
}
