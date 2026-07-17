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
 *  - **청구 금액 변동 — 임계값 없음(1원이라도 다르면 동의 대상)** ⬅ 2026-07-17 추가
 *
 * # 왜 금액을 따로 보나 (2026-07-17 · 사장님 "처방 → 가격 연동")
 * 위 임계값은 전부 **처방의 모양**만 본다. 그런데 금액은 모양이 조금만 달라도
 * 바뀔 수 있다 — 예: kcal +9%(임계 10% 미만 → '미세 조정'으로 자동 적용)인데
 * 1팩 분량이 170g→190g 으로 올라 2주 청구액이 68,000→74,600원이 된다.
 * 즉 **동의 없이 더 청구되는 경로**가 열려 있었다(§13의2 위반 소지).
 * 그래서 금액이 바뀌면 크기와 무관하게 항상 meaningful 로 올린다.
 *
 * 이 함수는 순수하게 유지한다(제품·재고·화식비율을 모름). 금액은 **호출부가
 * `lib/personalization/boxPricing` 정본으로 계산해서 넘긴다.**
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
  /**
   * 청구 금액이 바뀌는가 (price 옵션을 준 경우만 판정).
   *
   * ⚠️ `forced` 와 **독립**이다. 알레르기 차단은 안전 문제라 동의 없이 적용해야
   * 하지만, 그렇다고 **더 청구해도 된다는 뜻은 아니다.** 청구액 변경은 언제나
   * 명시적 동의가 필요하다 → 호출부는 `forced` 여도 금액은 동의 전까지 유지할 것.
   */
  priceChanged: boolean
  /** 새 금액 − 이전 금액 (원). priceChanged=false 면 0. */
  priceDelta: number
}

export type DiffOptions = {
  /**
   * 이전/새 처방의 **2주 청구액**. `boxPricing.priceForFormula` 로 계산해 넘긴다.
   * 안 주면 금액 판정은 건너뛴다(모양만 비교 — 기존 동작 그대로).
   */
  price?: { prevTotal: number; nextTotal: number }
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
  opts?: DiffOptions,
): FormulaDiff {
  const changes: string[] = []
  const forceReasons: string[] = []
  let meaningful = false
  let forced = false
  let priceChanged = false
  let priceDelta = 0

  // 1. 라인 비율 비교
  for (const line of ['basic', 'weight', 'skin', 'premium', 'joint'] as const) {
    const p = prev.lineRatios[line] ?? 0
    const n = next.lineRatios[line] ?? 0
    const delta = n - p

    // 라인 추가/제거
    if (p === 0 && n > 0) {
      // 0 → >0 라인 추가. 추천 v3 시드는 여러 라인이 0(희소)이라, cycle-2 의
      // 작은 체크인 nudge(+5~10%)도 "새 라인"으로 잡혀 불필요한 동의 요청이
      // 폭주한다. 분산 baseline 의 delta 기준과 동일하게 — n 이 임계(≈10%)
      // 이상일 때만 meaningful. 그 미만의 작은 추가는 자동 적용(micro-adjust).
      // 알레르기·만성질환 강제 경로(아래 section 4)는 이와 무관하게 항상 forced.
      if (n >= LINE_RATIO_DELTA) {
        meaningful = true
        changes.push(`${LINE_NAMES[line]} 라인 추가 (${Math.round(n * 100)}%)`)
      }
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

  // 3-b. 청구 금액 — **임계값 없음.** 1원이라도 다르면 동의 대상.
  //
  // 위 1~3 은 처방의 '모양'만 본다. 금액은 모양이 임계값 미만으로 움직여도
  // 바뀔 수 있다(kcal +9% → 1팩 170g→190g → 68,000→74,600원). 그 경로로
  // 동의 없이 더 청구되면 §13의2 위반이다. 그래서 금액엔 관용 구간을 두지 않는다.
  // (금액은 이미 100원 단위로 반올림돼 있어 '푼돈 진동' 은 생기지 않는다.)
  if (opts?.price && opts.price.prevTotal > 0) {
    priceDelta = opts.price.nextTotal - opts.price.prevTotal
    if (priceDelta !== 0) {
      priceChanged = true
      meaningful = true
      const won = (n: number) => n.toLocaleString('ko-KR')
      changes.push(
        `2주 결제 금액 ${won(opts.price.prevTotal)}원 → ${won(opts.price.nextTotal)}원`,
      )
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

  // 만성질환 새로 추가 또는 severity 변경 → 강제 (식이 안전성).
  // audit #40: 이전엔 ruleId 만 비교 → 같은 chronic rule 의 severity 변경 (mild
  // → severe 같은 action 변경) 감지 못 함 → 전자상거래법 §13의2 동의 흐름
  // missed. ruleId + action hash 로 비교.
  function chronicSignature(reasoning: typeof prev.reasoning): Map<string, string> {
    const m = new Map<string, string>()
    for (const r of reasoning) {
      if (r.ruleId.startsWith('chronic-')) {
        m.set(r.ruleId, r.action ?? '')
      }
    }
    return m
  }
  const prevChronicSig = chronicSignature(prev.reasoning)
  const nextChronicSig = chronicSignature(next.reasoning)

  for (const [rule, action] of nextChronicSig) {
    const prevAction = prevChronicSig.get(rule)
    if (prevAction === undefined) {
      forced = true
      meaningful = true
      forceReasons.push(`만성질환 추가 (${rule}) — 강제 적용`)
    } else if (prevAction !== action) {
      // 같은 rule 의 severity / 처방 변경.
      forced = true
      meaningful = true
      forceReasons.push(`만성질환 처방 변경 (${rule}) — 강제 적용`)
    }
  }

  // 임신/수유 시작/종료 — 칼로리 차이가 크니까 보통 위 KCAL_DELTA 에서 잡힘.
  // 안 잡히면 별도 룰. 여기선 생략 (kcal_delta 가 거의 모두 잡음).

  return {
    meaningful,
    changes,
    forced,
    forceReasons,
    priceChanged,
    priceDelta,
  }
}
