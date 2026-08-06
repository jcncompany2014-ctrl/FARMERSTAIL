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

/**
 * 세로 예산에서 폰 목업 폭을 역산한다 — 화면 하단에 20%만 잠기게.
 * (2026-08-05, 사장님 실기기 스크린샷)
 *
 * # 왜 상수를 그냥 고르면 안 되나
 * 처음엔 "빼는 값"을 감으로 208 로 잡았다. 세로 814 기기에서는 멀쩡했는데
 * **세로 660(Safari 주소창이 차지한 실효 높이)에서 폰이 32% 나 잘렸다.**
 * 위쪽 고정분(패딩·제목·점·캡션)을 정확히 빼야 어떤 세로에서도 같은 비율이 된다.
 */
/** 폰 위에 항상 놓이는 것들의 합 — 패딩 96 + 제목 118 + 점·캡션·간격 ≈58. */
export const PHONE_TOP_RESERVED = 272
/** 9/19.5 비율에서 하단 20% 를 잠글 때의 폭 계수 (= 9/19.5 ÷ 0.8). */
export const PHONE_WIDTH_FACTOR = 0.577

/**
 * @returns 세로 예산이 허용하는 폰 폭(px). 음수가 되면 0 —
 *   호출부는 상한(350)·가로 제약(100vw-72)과 함께 min 을 취한다.
 */
export function phoneWidthForHeight(viewportHeight: number): number {
  const usable = viewportHeight - PHONE_TOP_RESERVED
  return usable > 0 ? usable * PHONE_WIDTH_FACTOR : 0
}
