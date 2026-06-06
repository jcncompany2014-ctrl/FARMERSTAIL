/**
 * 추천 엔진 v3 — 레이어 A (베이스 SKU 선택).
 *
 * "무슨 밥?" 을 결정. 설문 NeedProfile + 일일 칼로리(MER)를 받아
 * 베이스 SKU 1~2종 + 믹스 비율 + 급여 그램을 출력하는 **순수 함수**.
 *
 * # 설계 (라이브 firstBox.ts 와 동일 철학)
 *  1. Pure — DB·네트워크·Date.now() 없음. 호출처가 입력 준비. 결정적·테스트 가능.
 *  2. Trace — 모든 단계를 TraceEntry 로 기록(설문→need→필터→점수→믹스→그램).
 *     admin 에 노출(Phase 5) — "왜 이 추천?" 항상 추적.
 *  3. 최대 2-SKU 믹스 — 운영 단순화(피킹). 두 강한 need 가 충돌할 때만 보조 SKU.
 *  4. 안전 우선 — 알레르기는 hard filter(0 후보면 상담 라우팅). 교차반응은 chip만.
 *
 * # 레이어 분리
 *  레이어 A(여기) = 베이스 SKU(단백질·칼로리·기호성 적합). 의학적 효능 단정 X.
 *  레이어 B(Phase 3) = 기능성 소스(피부/관절/소화/면역) add-on. status 보유.
 *  효능 문구는 catalog.ts 가 마스터레시피 충족률로 검증(사료법 정합).
 *
 * # config 외부화 (Phase 3 예정)
 *  튜닝 상수는 LAYER_A_CONFIG 한 곳에 모음 — Phase 3 에서 config.ts 분리.
 */

import type {
  BaseSku,
  CrossReactWarning,
  LayerAResult,
  NeedKey,
  NeedProfile,
  ProteinKey,
  SkuPick,
  TraceEntry,
} from './types.ts'
import { BASE_SKUS } from './catalog.ts'

const ENGINE_VERSION = 'v3.0.0-layerA'

/**
 * 레이어 A 튜닝 상수 — **단일 소스**(Phase 3 에서 config.ts 외부화).
 * 임의값 아님: 아래 근거.
 *  - needWeights: 설문 신호 강도. weightGoal/palatability(picky) = 최강 1.0
 *    (1차 동인), activity/senior = 0.8, activity_low/recovery/sensitive = 0.6
 *    (보조 신호). 절대 스케일은 비교용이라 무관, 상대 순위만 의미.
 *  - mix: 보조 SKU 는 "주 SKU 가 약한(<0.6) 강한 need(가중치 ≥0.7)를 다른
 *    SKU 가 잘(≥0.7) 커버"할 때만. 그 외 단일. 70/30 = 주식 지위 유지.
 */
export const LAYER_A_CONFIG = {
  needWeights: {
    weightLoss: 1.0,
    weightGain: 1.0,
    /** maintain 은 모든 비-감량/증량 견의 baseline — 믹스 트리거 임계(0.7)
     * 아래로 둬 균형 기본값(닭)만 고르고 보조 SKU 를 남발하지 않게. */
    maintain: 0.6,
    activityHigh: 0.8,
    activityLow: 0.6,
    /** picky = 기호성 1차 동인. */
    palatabilityPicky: 1.0,
    /** 식욕 저하 = 기호성 보조 + 회복기 신호. */
    palatabilityLow: 0.7,
    recoveryLow: 0.6,
    senior: 0.8,
    /** 알레르기 보유 견 → 노블/제한식 단백 선호. */
    sensitiveFromAllergy: 0.6,
    /** 소화 우려 → sensitive 보조. */
    sensitiveFromDigestion: 0.5,
  },
  mix: {
    /** 주 SKU 가 이 값 미만으로 커버하는 need 는 "약함". */
    poorCoverage: 0.6,
    /** 보조 SKU 후보는 이 값 이상 커버해야 채택. */
    strongCoverage: 0.7,
    /** 보조를 부를 만큼 강한 need 의 최소 가중치. */
    secondaryNeedMinWeight: 0.7,
    primaryRatio: 0.7,
    secondaryRatio: 0.3,
  },
} as const

// ──────────────────────────────────────────────────────────────────────────
// need 가중치 유도 (설문 → 적합도 축)
// ──────────────────────────────────────────────────────────────────────────

/**
 * NeedProfile → need 가중치. 레이어 A 스코어링 입력.
 * 기능성 우려(skin/joint/immune)는 레이어 B 가 처리 — 여기선 digestion 만
 * sensitive 보조 신호로 사용(소화 약한 견 → 부드러운 단백).
 */
export function deriveNeedWeights(
  profile: NeedProfile,
): Partial<Record<NeedKey, number>> {
  const C = LAYER_A_CONFIG.needWeights
  const w: Partial<Record<NeedKey, number>> = {}

  if (profile.weightGoal === 'loss') w.weight_loss = C.weightLoss
  else if (profile.weightGoal === 'gain') w.weight_gain = C.weightGain
  else w.maintain = C.maintain // 'maintain'

  if (profile.activityLevel === 'high') w.activity_high = C.activityHigh
  else if (profile.activityLevel === 'low') w.activity_low = C.activityLow
  // 'medium' = 중립(별도 가산 없음)

  if (profile.appetite === 'picky') {
    w.palatability = C.palatabilityPicky
  } else if (profile.appetite === 'low') {
    w.palatability = Math.max(w.palatability ?? 0, C.palatabilityLow)
    w.recovery = C.recoveryLow
  }

  if (profile.senior) w.senior = C.senior

  if (profile.allergies.length > 0) w.sensitive = C.sensitiveFromAllergy
  if (profile.functionalConcerns.includes('digestion')) {
    w.sensitive = Math.max(w.sensitive ?? 0, C.sensitiveFromDigestion)
  }

  return w
}

/** SKU 적합도 점수 = Σ (need 가중치 × SKU fitTag). 높을수록 적합. */
export function scoreSku(
  sku: BaseSku,
  weights: Partial<Record<NeedKey, number>>,
): number {
  let s = 0
  for (const [need, w] of Object.entries(weights) as Array<
    [NeedKey, number | undefined]
  >) {
    if (w === undefined) continue
    s += w * (sku.fitTags[need] ?? 0)
  }
  return s
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function toPick(sku: BaseSku, ratio: number, isPrimary: boolean): SkuPick {
  return {
    id: sku.id,
    protein: sku.protein,
    nameKr: sku.nameKr,
    ratio,
    kcalPer100g: sku.kcalPer100g,
    claims: sku.claims,
    isPrimary,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 메인 진입점
// ──────────────────────────────────────────────────────────────────────────

/**
 * 레이어 A 실행 — 베이스 SKU 선택 + 분량.
 *
 * @param profile 설문 → need 프로필
 * @param dailyKcal 일일 권장 칼로리(MER). 호출처가 nutrition.ts 로 계산해 주입.
 * @param opts.catalog 후보 SKU(기본 BASE_SKUS) — 테스트/가용성 게이트 주입용.
 */
export function runLayerA(
  profile: NeedProfile,
  dailyKcal: number,
  opts: { catalog?: readonly BaseSku[] } = {},
): LayerAResult {
  const catalog = opts.catalog ?? BASE_SKUS
  const trace: TraceEntry[] = []
  const cfg = LAYER_A_CONFIG.mix

  // ── Step 1: 알레르기 hard filter ──
  const survivors: BaseSku[] = []
  for (const sku of catalog) {
    const conflict = sku.excludeIfAllergy.find((a) =>
      profile.allergies.includes(a),
    )
    if (conflict) {
      trace.push({
        step: '알레르기 차단',
        detail: `${sku.nameKr} 제외 — '${conflict}' 알레르기와 충돌`,
      })
    } else {
      survivors.push(sku)
    }
  }

  // ── Step 1b: 교차반응 경고 (생존 SKU 한정, 차단 X) ──
  const crossReactWarnings: CrossReactWarning[] = []
  for (const sku of survivors) {
    for (const cr of sku.crossReactWith) {
      if (profile.allergies.includes(cr)) {
        crossReactWarnings.push({ protein: sku.protein, allergyLabel: cr })
        trace.push({
          step: '교차반응 주의',
          detail: `${sku.nameKr}: '${cr}' 알레르기견은 IgE 교차반응 가능(차단 안 함, 도입 시 관찰)`,
        })
      }
    }
  }

  // ── Step 1c: 후보 0 → 상담 라우팅 (다중 알레르기 엣지) ──
  if (survivors.length === 0) {
    trace.push({
      step: '상담 라우팅',
      detail: '모든 베이스 단백질이 알레르기로 차단됨 — 맞춤 상담 필요',
    })
    return {
      picks: [],
      blendedKcalPer100g: 0,
      dailyKcal,
      dailyGrams: 0,
      crossReactWarnings,
      needsConsultation: true,
      consultationReason:
        '입력하신 알레르기로 현재 베이스 4종이 모두 제외됐어요. 더 정확한 추천을 위해 맞춤 상담을 도와드릴게요.',
      scores: [],
      trace,
    }
  }

  // ── Step 2: need 가중 스코어링 ──
  const weights = deriveNeedWeights(profile)
  const weightSummary = (
    Object.entries(weights) as Array<[NeedKey, number]>
  )
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
  trace.push({
    step: 'need 가중치',
    detail: weightSummary || '(특이 신호 없음 — 균형 기본값)',
  })

  const scored = survivors
    .map((sku) => ({ sku, score: round2(scoreSku(sku, weights)) }))
    .sort((a, b) => b.score - a.score)
  trace.push({
    step: '적합도 점수',
    detail: scored.map((s) => `${s.sku.nameKr} ${s.score}`).join(' · '),
  })

  const primary = scored[0]!.sku
  trace.push({
    step: '주 SKU',
    detail: `${primary.nameKr} (점수 ${scored[0]!.score} 최고)`,
  })

  // ── Step 3: 보조 SKU (최대 2 믹스) ──
  // 주 SKU 가 약하게(<poorCoverage) 커버하는 강한(≥minWeight) need 를, 다른
  // 생존 SKU 가 강하게(≥strongCoverage) 커버하면 그 1종을 보조로.
  let secondary: BaseSku | null = null
  const needsByWeight = (
    Object.entries(weights) as Array<[NeedKey, number | undefined]>
  )
    .filter((e): e is [NeedKey, number] => e[1] !== undefined)
    .sort((a, b) => b[1] - a[1])

  for (const [need, w] of needsByWeight) {
    if (w < cfg.secondaryNeedMinWeight) break // 내림차순 — 이후는 더 작음
    if ((primary.fitTags[need] ?? 0) >= cfg.poorCoverage) continue // 주가 커버
    const cand = scored
      .slice(1)
      .map((s) => s.sku)
      .filter((s) => (s.fitTags[need] ?? 0) >= cfg.strongCoverage)
      .sort((a, b) => (b.fitTags[need] ?? 0) - (a.fitTags[need] ?? 0))[0]
    if (cand) {
      secondary = cand
      trace.push({
        step: '보조 SKU',
        detail: `${cand.nameKr} 추가 — 주(${primary.nameKr})가 약한 '${need}'(가중치 ${w}) 보완`,
      })
      break
    }
  }
  if (!secondary) {
    trace.push({ step: '믹스 결정', detail: `단일 ${primary.nameKr} 100%` })
  }

  const picks: SkuPick[] = secondary
    ? [
        toPick(primary, cfg.primaryRatio, true),
        toPick(secondary, cfg.secondaryRatio, false),
      ]
    : [toPick(primary, 1.0, true)]

  // ── Step 4: 믹스 가중 칼로리 + 급여 그램 ──
  const blendedKcalPer100g = round2(
    picks.reduce((sum, p) => sum + p.ratio * p.kcalPer100g, 0),
  )
  const dailyGrams =
    blendedKcalPer100g > 0
      ? Math.round((dailyKcal / blendedKcalPer100g) * 100)
      : 0
  trace.push({
    step: '급여 그램',
    detail: `혼합 ${blendedKcalPer100g}kcal/100g · ${dailyKcal}kcal/일 → ${dailyGrams}g/일`,
  })

  return {
    picks,
    blendedKcalPer100g,
    dailyKcal,
    dailyGrams,
    crossReactWarnings,
    needsConsultation: false,
    scores: scored.map((s) => ({ protein: s.sku.protein, score: s.score })),
    trace,
  }
}

/** 엔진 버전 (formula 메타·디버그). */
export { ENGINE_VERSION }
