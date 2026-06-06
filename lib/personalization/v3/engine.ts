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
  ConcernKey,
  CrossReactWarning,
  LayerAResult,
  LayerBResult,
  NeedKey,
  NeedProfile,
  RecommendationResult,
  SkuPick,
  SourceRoute,
  TraceEntry,
} from './types.ts'
import { BASE_SKUS, FUNCTIONAL_SOURCES } from './catalog.ts'
import { LAYER_A_CONFIG, LAYER_B_CONFIG } from './config.ts'

const ENGINE_VERSION = 'v3.0.0'

// 튜닝 상수는 config.ts 가 SSOT — 호출처 편의를 위해 재노출.
export { LAYER_A_CONFIG, LAYER_B_CONFIG }

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
  opts: {
    catalog?: readonly BaseSku[]
    /**
     * 간식 칼로리 차감 비율(0~0.1). 간식만큼 밥을 줄여 총섭취를 MER 로 유지
     * (AAFCO/WSAVA 10% 룰 — 간식 위 풀 밥 = 과급·비만). 빈도→비율 매핑은
     * nutrition.ts `treatCalorieFraction`(SSOT). 미입력=0(무변경).
     */
    treatReductionPct?: number
  } = {},
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

  // ── Step 4: 간식 칼로리 차감 → 믹스 가중 칼로리 → 급여 그램 ──
  // 간식만큼 밥(완전식)을 줄여 총섭취를 MER 로 유지(10% 룰). dailyKcal(요구량)은
  // 그대로 두고 급여 그램만 줄인다 — 라이브 firstBox.ts Step 10.7 과 동일.
  const treatPct = Math.min(
    LAYER_A_CONFIG.treat.maxFraction,
    Math.max(LAYER_A_CONFIG.treat.minFraction, opts.treatReductionPct ?? 0),
  )
  const feedKcal = Math.round(dailyKcal * (1 - treatPct))
  if (treatPct > 0) {
    trace.push({
      step: '간식 차감',
      detail: `간식 약 ${Math.round(treatPct * 100)}% 만큼 밥 ↓ (총섭취 MER 유지, 10% 룰) — ${dailyKcal} → ${feedKcal}kcal/일`,
    })
  }

  const blendedKcalPer100g = round2(
    picks.reduce((sum, p) => sum + p.ratio * p.kcalPer100g, 0),
  )
  // 엣지 가드: 잘못된 MER(0 이하)이 음수 그램으로 새지 않게 0 하한.
  const dailyGrams =
    blendedKcalPer100g > 0
      ? Math.max(0, Math.round((feedKcal / blendedKcalPer100g) * 100))
      : 0
  trace.push({
    step: '급여 그램',
    detail: `혼합 ${blendedKcalPer100g}kcal/100g · ${feedKcal}kcal/일 → ${dailyGrams}g/일`,
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

// ──────────────────────────────────────────────────────────────────────────
// 레이어 B — 기능성 우려 → 소스 라우팅 (Phase 3)
// ──────────────────────────────────────────────────────────────────────────

/** concern → 소스 (catalog 파생, 데이터 주도). */
const SOURCE_BY_CONCERN = new Map(
  FUNCTIONAL_SOURCES.map((s) => [s.targetConcern, s]),
)

/**
 * 레이어 B 실행 — 기능성 우려를 기능성 소스로 라우팅.
 *
 * 현재 소스 전부 coming_soon → 라우팅은 하되 available=false(대기열).
 * 베이스 SKU 에 의학적 효능을 박지 않고 소스가 효능을 책임지는 분리 구조.
 * 우려 없으면 빈 결과.
 */
export function runLayerB(concerns: ConcernKey[]): LayerBResult {
  const trace: TraceEntry[] = []
  const order = LAYER_B_CONFIG.concernPriority
  // 중복 제거 + 우선순위 정렬.
  const uniq = [...new Set(concerns)].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  )

  const routes: SourceRoute[] = uniq.map((concern) => {
    const src = SOURCE_BY_CONCERN.get(concern)
    if (!src) {
      trace.push({
        step: '소스 라우팅',
        detail: `'${concern}' 우려 — 매칭 소스 없음`,
      })
      return {
        concern,
        sourceId: null,
        sourceNameKr: null,
        status: 'none',
        available: false,
      }
    }
    const available = src.status === 'available'
    trace.push({
      step: '소스 라우팅',
      detail: `'${concern}' → ${src.nameKr}${available ? '(출시)' : '(준비중 — 대기열)'}`,
    })
    return {
      concern,
      sourceId: src.id,
      sourceNameKr: src.nameKr,
      status: src.status,
      available,
    }
  })

  const waitlistConcerns = routes
    .filter((r) => r.status === 'coming_soon')
    .map((r) => r.concern)

  return { routes, waitlistConcerns, trace }
}

// ──────────────────────────────────────────────────────────────────────────
// 최종 추천 — 레이어 A(밥) + 레이어 B(소스)
// ──────────────────────────────────────────────────────────────────────────

/**
 * 추천 v3 메인 — 설문 NeedProfile + 일일 칼로리(MER) → 베이스 SKU + 기능성 소스.
 * 순수 함수. 호출처(compute route)가 MER·간식비율·가용성을 준비해 주입.
 */
export function recommend(
  profile: NeedProfile,
  dailyKcal: number,
  opts: { catalog?: readonly BaseSku[]; treatReductionPct?: number } = {},
): RecommendationResult {
  const layerA = runLayerA(profile, dailyKcal, opts)
  const layerB = runLayerB(profile.functionalConcerns)
  return { layerA, layerB, engineVersion: ENGINE_VERSION }
}

/** 엔진 버전 (formula 메타·디버그). */
export { ENGINE_VERSION }
