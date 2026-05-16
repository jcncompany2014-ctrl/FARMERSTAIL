/**
 * 발명 핵심 알고리즘 feature flag — PCT 출원 전 kill switch.
 *
 * # 배경
 * 발명 명세서 9개 모듈 중 핵심 청구항 (메타학습 H, 반사실 깊이 G, 페르소나
 * 클러스터링, W_image 산출 등) 의 알고리즘이 GitHub public repo 에 들어가면
 * PCT 출원 시 신규성(novelty) 주장이 약화될 수 있다.
 *
 * # 정책
 * - **default 모두 OFF.** 환경변수로 명시적 ON 만 동작.
 * - 사용자(=창업자) 가 "꺼" 라고 하면 Vercel env 한 줄 변경 + redeploy → 2분 OFF.
 * - 핵심 lib·cron·UI 카드가 모두 이 flag 를 체크 — 단일 진입점.
 *
 * # 환경변수
 *  - NEXT_PUBLIC_INVENTION_CORE=on              전체 발명 기능 토글
 *  - NEXT_PUBLIC_INVENTION_META_LEARNING=on     모듈 H (메타학습 가중치)
 *  - NEXT_PUBLIC_INVENTION_COUNTERFACTUAL=on    모듈 G 반사실 깊은 부분
 *  - NEXT_PUBLIC_INVENTION_PERSONA=on           4 페르소나 클러스터링
 *  - NEXT_PUBLIC_INVENTION_W_IMAGE=on           모듈 B W_image 산출
 *
 * # 사용
 *
 *   import { isInventionEnabled } from '@/lib/invention-flags'
 *   if (!isInventionEnabled('meta_learning')) return null
 *
 * # 가시화
 * /admin/invention-flags 페이지에서 현재 ON/OFF 상태 확인 가능 (별도 phase).
 */

export type InventionFeature =
  | 'core'
  | 'meta_learning'
  | 'counterfactual'
  | 'persona'
  | 'w_image'

const ENV_VAR_MAP: Record<InventionFeature, string> = {
  core: 'NEXT_PUBLIC_INVENTION_CORE',
  meta_learning: 'NEXT_PUBLIC_INVENTION_META_LEARNING',
  counterfactual: 'NEXT_PUBLIC_INVENTION_COUNTERFACTUAL',
  persona: 'NEXT_PUBLIC_INVENTION_PERSONA',
  w_image: 'NEXT_PUBLIC_INVENTION_W_IMAGE',
}

/**
 * default OFF — env var 가 명시적으로 'on' 일 때만 true.
 * 'core' 가 OFF 면 모든 sub-feature 자동 OFF (cascade).
 */
export function isInventionEnabled(feature: InventionFeature): boolean {
  // Next.js 가 NEXT_PUBLIC_* env var 를 빌드 시 inline. 런타임 평가가 아니라
  // process.env.NEXT_PUBLIC_X 직접 비교가 best practice.
  const coreOn =
    process.env.NEXT_PUBLIC_INVENTION_CORE === 'on'

  if (!coreOn) return false
  if (feature === 'core') return true

  // env 시그니처는 NEXT_PUBLIC_* 라 client/server 모두 접근 가능.
  // ENV_VAR_MAP 은 envVarFor() 에서 사용 — 여기선 process.env 직접 비교 (Next.js inline).
  const value =
    feature === 'meta_learning'
      ? process.env.NEXT_PUBLIC_INVENTION_META_LEARNING
      : feature === 'counterfactual'
        ? process.env.NEXT_PUBLIC_INVENTION_COUNTERFACTUAL
        : feature === 'persona'
          ? process.env.NEXT_PUBLIC_INVENTION_PERSONA
          : feature === 'w_image'
            ? process.env.NEXT_PUBLIC_INVENTION_W_IMAGE
            : undefined

  // sub-feature 는 자체 env var 가 'on' 이거나 'inherit' (core 와 동일).
  // 미지정 (undefined) 도 'inherit' 와 같은 처리 — core ON 이면 동작.
  if (value === 'off') return false
  return true
}

/**
 * 전체 상태 dump — admin 페이지 / 진단용.
 */
export function getAllFlags(): Record<InventionFeature, boolean> {
  return {
    core: isInventionEnabled('core'),
    meta_learning: isInventionEnabled('meta_learning'),
    counterfactual: isInventionEnabled('counterfactual'),
    persona: isInventionEnabled('persona'),
    w_image: isInventionEnabled('w_image'),
  }
}

export function envVarFor(feature: InventionFeature): string {
  return ENV_VAR_MAP[feature]
}
