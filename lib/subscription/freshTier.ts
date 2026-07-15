/**
 * 화식 비율 티어 라벨 — 구독 표시 통일 (2026-07-13 갈아엎기).
 *
 * 박스 구독은 배송·결제 무조건 2주마다. 사용자는 화식 비율(30/60/100)만 고르고
 * 그 값이 subscriptions.fresh_ratio 에 저장된다. 마이페이지·계정·admin·이메일 등
 * 모든 표시가 이 헬퍼 한 곳을 쓴다 — "2주치/4주치" 옛 라벨 산재 제거.
 *
 * 2026-07-16: coverageWeeks 로 비율을 **추측**하던 레거시 폴백 제거
 * (4주치→완전, 2주치→반반). fresh_ratio 가 없던 시절 구독을 위한 근사였는데
 * 실 데이터에 그런 행이 0건이고, 무엇보다 coverage_weeks 는 이제 전부 2라
 * 폴백이 살아 있으면 값 없는 구독을 죄다 '화식 반반'으로 단정해 버린다.
 */
export function freshTierLabel(freshRatio: number | null | undefined): string {
  if (freshRatio === 30) return '화식 곁들임'
  if (freshRatio === 60) return '화식 반반'
  if (freshRatio === 100) return '완전 화식'
  return '맞춤 화식 박스'
}
