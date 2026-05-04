/**
 * nutrientPanel.ts — 라인 mix 의 영양 단면 (DM%) 합산.
 *
 * formula.lineRatios 와 라인별 메타 (FOOD_LINE_META 또는 admin override) 를
 * 가중평균해 총 protein/fat/Ca/P/Na DM% 계산. UI 가 이 값으로 nutrient
 * breakdown 카드 + 임상 권고 만족 여부 (췌장염 fat <15%, IRIS Stage 3+
 * protein factor 등) 시각.
 *
 * # 사용처
 *  - 분석 페이지 RecommendationBox — nutrient panel 카드
 *  - admin Simulator — 처방 결과의 영양 검증
 *  - approve 페이지 — 이전/새 비율의 영양 단면 비교
 *
 * # 캐비어트
 *  - 토퍼는 별도 차원 — 본 panel 은 메인 5종 ratio 기준만 (Spec A).
 *  - DM 값이 null 인 라인 (Ca/P/Na 미입력) 은 합산에서 제외 + 'unknown' 표시.
 */

import { ALL_LINES, FOOD_LINE_META } from './lines.ts'
import type { AlgorithmInput, Formula } from './types.ts'

export type NutrientPanel = {
  /** Σ ratio × proteinPctDM. 항상 값 있음 (모든 라인 hardcoded 기본). */
  proteinPctDM: number
  /** Σ ratio × fatPctDM. 항상 값 있음. */
  fatPctDM: number
  /** Σ ratio × kcalPer100g. 100g 기준 평균 kcal. */
  kcalPer100g: number
  /** Σ ratio × calciumPctDM. 일부 라인 null 면 'partial' 또는 unknown. */
  calciumPctDM: number | null
  phosphorusPctDM: number | null
  sodiumPctDM: number | null
  /** Ca:P 비율 (대형견 puppy 1.8 상한). 둘 중 하나 null 이면 null. */
  calciumPhosphorusRatio: number | null
}

export function computeNutrientPanel(
  lineRatios: Formula['lineRatios'],
  override?: AlgorithmInput['foodLineMetaOverride'],
): NutrientPanel {
  let protein = 0
  let fat = 0
  let kcal = 0
  let ca = 0
  let p = 0
  let na = 0
  let caKnown = true
  let pKnown = true
  let naKnown = true

  for (const line of ALL_LINES) {
    const ratio = lineRatios[line] ?? 0
    if (ratio <= 0) continue
    const ov = override?.[line]
    const meta = FOOD_LINE_META[line]

    const lp = ov?.proteinPctDM ?? meta.proteinPctDM
    const lf = ov?.fatPctDM ?? meta.fatPctDM
    const lk = ov?.kcalPer100g ?? meta.kcalPer100g

    protein += ratio * lp
    fat += ratio * lf
    kcal += ratio * lk

    // Ca/P/Na — admin override 만 있고 lines.ts hardcoded 엔 없음 (v1.4
    // 시점). null 이면 partial 처리.
    const lca = ov?.calciumPctDM ?? null
    const lpp = ov?.phosphorusPctDM ?? null
    const lna = ov?.sodiumPctDM ?? null

    if (lca === null) caKnown = false
    else ca += ratio * lca
    if (lpp === null) pKnown = false
    else p += ratio * lpp
    if (lna === null) naKnown = false
    else na += ratio * lna
  }

  const calciumPctDM = caKnown ? round2(ca) : null
  const phosphorusPctDM = pKnown ? round2(p) : null
  const sodiumPctDM = naKnown ? round3(na) : null
  const calciumPhosphorusRatio =
    calciumPctDM !== null && phosphorusPctDM !== null && phosphorusPctDM > 0
      ? round2(calciumPctDM / phosphorusPctDM)
      : null

  return {
    proteinPctDM: round1(protein),
    fatPctDM: round1(fat),
    kcalPer100g: Math.round(kcal),
    calciumPctDM,
    phosphorusPctDM,
    sodiumPctDM,
    calciumPhosphorusRatio,
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * AAFCO 2024 기준 임상 권고치 검증.
 *
 *   - 일반 성견 protein ≥18% DM, puppy ≥22.5%
 *   - 일반 성견 fat ≥5.5% DM
 *   - 췌장염 fat <15% DM (Xenoulis 2015)
 *   - 대형견 puppy Ca:P ≤1.8 (AAFCO Large-size Growth)
 *   - 심장병 Na <0.3% DM 권장 (Freeman 2018)
 *
 * 반환 — 위반된 권고치 배열 (사용자에게 chip 으로 노출).
 */
export type ClinicalCheck = {
  passed: boolean
  warnings: Array<{
    code: string
    label: string
    actual: string
    target: string
  }>
}

export function clinicalCheckForPanel(
  panel: NutrientPanel,
  context: {
    isPuppy: boolean
    isLargeBreedPuppy: boolean
    hasPancreatitis: boolean
    hasCardiac: boolean
    irisStage: number | null
  },
): ClinicalCheck {
  const w: ClinicalCheck['warnings'] = []

  // AAFCO 단백질 최소
  const proteinMin = context.isPuppy ? 22.5 : 18
  if (panel.proteinPctDM < proteinMin) {
    w.push({
      code: 'protein-low',
      label: 'AAFCO 단백질 최소 미달',
      actual: `${panel.proteinPctDM}% DM`,
      target: `≥${proteinMin}%`,
    })
  }

  // AAFCO 지방 최소
  if (panel.fatPctDM < 5.5) {
    w.push({
      code: 'fat-low',
      label: 'AAFCO 지방 최소 미달',
      actual: `${panel.fatPctDM}% DM`,
      target: '≥5.5%',
    })
  }

  // 췌장염 fat ceiling
  if (context.hasPancreatitis && panel.fatPctDM > 15) {
    w.push({
      code: 'pancreatitis-fat-high',
      label: '췌장염 지방 상한 초과',
      actual: `${panel.fatPctDM}% DM`,
      target: '<15% (Xenoulis 2015)',
    })
  }

  // 대형견 puppy Ca:P
  if (
    context.isLargeBreedPuppy &&
    panel.calciumPhosphorusRatio !== null &&
    panel.calciumPhosphorusRatio > 1.8
  ) {
    w.push({
      code: 'large-puppy-ca-p',
      label: '대형견 puppy Ca:P 비율 초과',
      actual: panel.calciumPhosphorusRatio.toFixed(2),
      target: '≤1.8 (AAFCO Large-size Growth)',
    })
  }

  // 심장병 저나트륨
  if (
    context.hasCardiac &&
    panel.sodiumPctDM !== null &&
    panel.sodiumPctDM > 0.3
  ) {
    w.push({
      code: 'cardiac-sodium-high',
      label: '심장병 나트륨 권고 초과',
      actual: `${panel.sodiumPctDM}% DM`,
      target: '<0.3% (Freeman 2018)',
    })
  }

  // CKD Stage 3+ 단백질 권고치
  if (
    context.irisStage !== null &&
    context.irisStage >= 3 &&
    panel.proteinPctDM > 22
  ) {
    w.push({
      code: 'ckd-protein-high',
      label: 'CKD Stage 3+ 단백질 권고 초과',
      actual: `${panel.proteinPctDM}% DM`,
      target: '<22% (IRIS 2019)',
    })
  }

  return { passed: w.length === 0, warnings: w }
}
