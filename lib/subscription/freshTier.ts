/**
 * 화식 비율 티어 라벨 — 구독 표시 통일 (2026-07-13 갈아엎기).
 *
 * 박스 구독은 배송·결제 무조건 2주마다. 사용자는 화식 비율(30/60/100)만 선택하고
 * 그 값이 subscriptions.fresh_ratio 에 저장된다. 마이페이지·계정·admin·이메일 등
 * 모든 표시가 이 헬퍼 한 곳을 쓰도록 통일 — "2주치/4주치" 옛 라벨 산재 제거.
 *
 * 레거시 구독(fresh_ratio null, 이 컬럼 도입 전)은 coverage_weeks 로 근사:
 * 4주치(풀 화식)→완전, 2주치(하이브리드 ~50%)→반반.
 */
export function freshTierLabel(
  freshRatio: number | null | undefined,
  coverageWeeks?: number | null,
): string {
  const r =
    freshRatio ?? (coverageWeeks === 4 ? 100 : coverageWeeks === 2 ? 60 : null)
  if (r === 30) return '화식 곁들임'
  if (r === 60) return '화식 반반'
  if (r === 100) return '완전 화식'
  return '맞춤 화식 박스'
}
