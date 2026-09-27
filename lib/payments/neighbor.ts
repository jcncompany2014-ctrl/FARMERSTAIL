/**
 * 이웃 할인 — 순수 규칙 (테스트: neighbor.test.ts).
 *
 * 지인·쓰레드 등에서 온 특정 고객에게 어드민이 붙이는 첫 박스 1회 할인율
 * (사장님 2026-09-27, 이름 "이웃 할인"). 판정은 resolveAutoDiscount 가 하되,
 * "어느 할인을 쓰나"의 규칙은 여기 순수 함수 하나에 둔다.
 */

/** 어드민 선택지 — 자유 입력 금지(0.9 오타로 첫 박스가 공짜가 되는 사고 방지). */
export const NEIGHBOR_RATES = [0.1, 0.15, 0.2, 0.3, 0.5] as const

/** 고객 화면·영수증에 보이는 이름. */
export const NEIGHBOR_LABEL = '이웃 할인'

export type DiscountCandidate = { rate: number; label: string }

/**
 * 등급/이벤트 중 이미 고른 것(picked)과 이웃 할인을 비교 — **더 큰 쪽 하나만**.
 * 같으면 picked 를 유지한다: 이웃 할인은 1회 소진이라, 같은 값이면 안 쓰고 남겨
 * 두는 편이 고객에게 유리하다(등급 할인은 매번 붙는다).
 */
export function pickWithNeighbor<T extends DiscountCandidate>(
  picked: T,
  neighbor: { rate: number } | null | undefined,
): { useNeighbor: boolean; rate: number; label: string } {
  const n = neighbor ? Math.max(0, neighbor.rate) : 0
  if (n > Math.max(0, picked.rate)) return { useNeighbor: true, rate: n, label: NEIGHBOR_LABEL }
  return { useNeighbor: false, rate: picked.rate, label: picked.label }
}
