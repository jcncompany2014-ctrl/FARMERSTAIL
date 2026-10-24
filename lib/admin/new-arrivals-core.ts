/**
 * 어드민 홈 '새로 들어온 것' — 순수 판정만(DB·서버 의존 없음, 테스트가 직접 부른다). 조회·조립은 lib/admin/new-arrivals.
 *
 * # 왜 (2026-10-24 사장님 "보돌이 지금 주문해지건이 두개가 있는데 관리자 홈에서 또 겹쳐서 뜬다 좀 제대로 해줘", 규칙323)
 * 보돌 보호자님이 같은 날 정기배송을 세 번 신청했다 — 16:28 신청→16:36 해지(카드 없음), 16:38 신청→16:43 카드 등록→
 * 17:00 해지, 17:02 신청→17:03 카드 등록(진행 중). '새 정기배송'은 첫 카드 등록을 구독마다 한 줄로 세서, 해지된 둘째 신청이
 * 초록 줄로 남았다. 해지라 할인 계산을 건너뛰어 '다음 결제 97,200원(정가) · 발송일 없음'으로 떴고, 그 위에 진짜 보돌
 * (48,600원 · 이벤트 할인)이 한 줄 더 있어 같은 강아지가 두 번 보였다.
 *
 * # 판정
 *  · 새 정기배송 줄 = **지금 이어지는 구독만**(해지된 구독은 '새 정기배송'이 아니다). 결제된 뒤 해지면 아래 '해지' 칸이 말한다
 *    (classifyCancellation 'real'). 결제 전 해지는 해지 칸에도 안 뜬다(규칙251 — 카드 등록 전 포기·중복 신청 정리).
 *  · 그 대신 남은 줄에 '결제 전에 해지한 신청 N건이 더 있어요'(같은 보호자·같은 강아지, 결제 0회로 닫힌 것) — 정기배송 목록에
 *    흐리게 남은 해지 줄이 뭔지 홈에서 바로 안다.
 *  · 같은 강아지에 진행 중인 구독이 둘이면 합치지 않는다 — 이중 결제 위험이라 둘 다 보여야 한다.
 */
import { classifyCancellation, type CancelledSubLike } from './churn.ts'

/** '새 정기배송' 줄로 남길 구독 — 해지된 것을 뺀다(진행·일시정지·카드 문제는 남는다). */
export function keepLiveNewSubs<T extends { status: string }>(rows: readonly T[]): T[] {
  return rows.filter((r) => r.status !== 'cancelled')
}

/** 같은 보호자·같은 강아지로 결제 전에 해지한 **다른** 신청 수(받은 해지 목록 안에서 — 홈은 최근 7일). */
export function abandonedBeforeCount(
  sub: { id: string; user_id: string; dog_id: string | null },
  cancelled: ReadonlyArray<CancelledSubLike & { user_id: string }>,
): number {
  if (!sub.dog_id) return 0
  const none = new Set<string>()
  return cancelled.filter(
    (c) => c.id !== sub.id && c.user_id === sub.user_id && c.dog_id === sub.dog_id && classifyCancellation(c, none) === 'never_charged',
  ).length
}
