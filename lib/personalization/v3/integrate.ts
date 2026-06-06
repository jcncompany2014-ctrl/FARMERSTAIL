/**
 * 추천 v3 — 라이브 입력 → v3 추천 브리지.
 *
 * compute route 가 이미 만든 AlgorithmInput + 활성 제품 slug 로 v3 추천을
 * 뽑는 얇은 결합층. 라이브 v2(decideFirstBox)와 **독립** — 같은 입력에서
 * 별도로 v3 결과를 계산해 shadow 저장/표시(라이브 박스는 v2 가 계속 구동).
 */
import type { FoodLine, Ratio } from '../types.ts'
import { PROTEIN_TO_LINE } from '../lines.ts'
import type { BaseSku, RecommendationResult, SkuPick } from './types.ts'
import { BASE_SKUS } from './catalog.ts'
import { recommend } from './engine.ts'
import { toNeedProfile, type V3SourceInput } from './profile.ts'

/**
 * v3 Layer A 픽 → v2 라인 비율(시드).
 *
 * v3 베이스 단백질 ↔ v2 라인은 1:1(chicken→weight, duck→basic, pork→joint,
 * beef→premium, skuModel.legacyLine). 이 매핑으로 v3 가 고른 베이스를
 * decideFirstBox 의 시작 비율(baseRatiosOverride)로 넘기면, v2 의 임상 안전
 * 룰이 그 위에서 그대로 적용된다("v3 추천 + v2 안전망"). 합 = picks 비율 합(=1).
 */
export function v3PicksToLineRatios(
  picks: readonly SkuPick[],
): Record<FoodLine, Ratio> {
  const ratios: Record<FoodLine, Ratio> = {
    basic: 0,
    weight: 0,
    skin: 0,
    premium: 0,
    joint: 0,
  }
  for (const p of picks) {
    const line = PROTEIN_TO_LINE[p.protein]
    if (line) ratios[line] += p.ratio
  }
  return ratios
}

/**
 * 활성 제품 slug 로 v3 베이스 SKU 게이트.
 *
 * v3 베이스 4종 id = 활성 제품 slug(chicken-basic/duck-weight/pork-joint/
 * beef-premium). admin 이 특정 제품을 비활성화하면 그 베이스는 추천에서 제외.
 * **fail-open**: activeSlugs 미제공/빈 값(쿼리 실패 등)이면 전부 가용 — 쿼리
 * 한 번 헛나갔다고 모든 견을 상담 라우팅으로 보내지 않게(라이브 게이트와 동일).
 */
export function gateBaseSkus(
  activeSlugs?: readonly string[] | null,
): readonly BaseSku[] {
  if (!activeSlugs || activeSlugs.length === 0) return BASE_SKUS
  const gated = BASE_SKUS.filter((s) => activeSlugs.includes(s.id))
  return gated.length > 0 ? gated : BASE_SKUS // 전부 비활성이면 fail-open
}

/**
 * AlgorithmInput → v3 RecommendationResult.
 * @param opts.appetite 설문 식욕(answers.appetite) — AlgorithmInput 밖.
 * @param opts.activeSlugs 활성 제품 slug — 베이스 게이트.
 */
export function buildV3Recommendation(
  input: V3SourceInput,
  opts: { appetite?: string | null; activeSlugs?: readonly string[] | null } = {},
): RecommendationResult {
  const profile = toNeedProfile(input, { appetite: opts.appetite })
  return recommend(profile, input.dailyKcal, {
    catalog: gateBaseSkus(opts.activeSlugs),
    treatReductionPct: input.treatReductionPct,
  })
}
