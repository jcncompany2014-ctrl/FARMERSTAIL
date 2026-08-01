/**
 * 스크롤 속도 → 마퀴 배속 (2026-08-02).
 *
 * 재료 스트립(랜딩 `data-gsap-marquee`)은 등속으로 흐르다가 스크롤 속도와
 * 방향을 탄다. 그 변환이 이 함수 하나다 — **컴포넌트에 인라인으로 두지 않은
 * 이유**: 브라우저에서 역주행을 확인하려 했더니 합성 스크롤(setInterval +
 * scrollBy)의 속도 측정치가 회차마다 -228 ~ -1560 으로 튀어서 "역주행이 되는지"
 * 를 눈으로 판정할 수 없었다. 매핑은 순수 산수이므로 테스트로 못 박는 게 정확하다.
 *
 * 계수 400: 800 으로 뒀을 때 보통 스크롤에서 0.55~1.5 배라 **눈에 안 띄었다**(실측).
 * 400 이면 살짝만 굴려도 두 배, 위로 튕기면(v < -400) 음수가 되어 되감긴다.
 * clamp ±5: 관성 스크롤 끝의 속도 폭주로 스트립이 순간이동하는 것을 막는다.
 */

/** 배속 상·하한 — 이 밖으로는 절대 나가지 않는다. */
export const SPEED_CLAMP = 5
/** 속도 나눗수. 작을수록 민감하다. */
export const SPEED_DIVISOR = 400

/**
 * @param velocity ScrollTrigger `self.getVelocity()` — px/s. 위로 스크롤하면 음수.
 * @returns 마퀴 트윈에 넣을 timeScale. 1 = 등속, 음수 = 역주행.
 */
export function scrollSpeedFactor(velocity: number): number {
  if (!Number.isFinite(velocity)) return 1 // NaN/Infinity 가 timeScale 로 새면 트윈이 죽는다
  const raw = 1 + velocity / SPEED_DIVISOR
  return Math.min(SPEED_CLAMP, Math.max(-SPEED_CLAMP, raw))
}
