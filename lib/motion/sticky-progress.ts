/**
 * sticky 트랙의 스크롤 진행도 → 화면 인덱스.
 * (2026-08-05, /why-app 모바일 쇼케이스)
 *
 * # 왜 순수 함수로 뺐나
 * 이 계산은 브라우저 이벤트 안에서 도는데, 그 이벤트가 오는지는 실기기에서만
 * 확인된다(개발 패널에서는 scroll 이벤트·rAF 가 얼어 검증이 안 된다 — 실측).
 * 그렇다고 "확인 못 했다"로 두면 안 되므로, **판단 로직만 떼어내 테스트로
 * 고정한다.** 이벤트 배선은 얇게 두고, 틀릴 수 있는 산수는 여기서 지킨다.
 *
 * # 어떻게 도나
 * 바깥 트랙은 `100svh + N×620px` 높이를 갖고, 안쪽 화면은 `position: sticky`
 * 로 그 동안 붙어 있는다. 트랙 상단이 뷰포트 위로 얼마나 지나갔는지가 곧
 * 진행도이고, 그걸 N등분해 지금 몇 번째 화면인지 정한다.
 */

/**
 * @param trackTop  트랙의 뷰포트 기준 top (getBoundingClientRect().top)
 * @param trackHeight 트랙 전체 높이
 * @param viewportHeight 뷰포트 높이
 * @param count 화면 수
 * @returns 0 ~ count-1. 계산 불가(트랙이 뷰포트보다 짧음)면 0 —
 *   화면이 없는 게 아니라 "아직 첫 장"이 맞는 답이다.
 */
export function stickyScreenIndex(
  trackTop: number,
  trackHeight: number,
  viewportHeight: number,
  count: number,
): number {
  if (!(count > 0)) return 0
  const total = trackHeight - viewportHeight
  if (!(total > 0)) return 0
  const p = Math.min(1, Math.max(0, -trackTop / total))
  return Math.min(count - 1, Math.floor(p * count))
}
