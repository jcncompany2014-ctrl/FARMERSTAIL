/**
 * 추천 v3 — 라이브 입력 → v3 추천 브리지.
 *
 * compute route 가 이미 만든 AlgorithmInput + 활성 제품 slug 로 v3 추천을
 * 뽑는 얇은 결합층. 라이브 v2(decideFirstBox)와 **독립** — 같은 입력에서
 * 별도로 v3 결과를 계산해 shadow 저장/표시(라이브 박스는 v2 가 계속 구동).
 */
import type { AlgorithmInput } from '../types.ts'
import type { BaseSku, RecommendationResult } from './types.ts'
import { BASE_SKUS } from './catalog.ts'
import { recommend } from './engine.ts'
import { toNeedProfile } from './profile.ts'

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
  input: AlgorithmInput,
  opts: { appetite?: string | null; activeSlugs?: readonly string[] | null } = {},
): RecommendationResult {
  const profile = toNeedProfile(input, { appetite: opts.appetite })
  return recommend(profile, input.dailyKcal, {
    catalog: gateBaseSkus(opts.activeSlugs),
    treatReductionPct: input.treatReductionPct,
  })
}
