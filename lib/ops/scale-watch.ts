/**
 * 규모 경보 — 조용히 깨지는 처리 한도에 **다가가면** 아침 브리핑에서 미리 알린다.
 *
 * 2026-09-26 출시 전 점검 6차에서 "고객이 N명이 되면 조용히 깨지는 곳"이 10곳 나왔다.
 * 지금 규모(구독 1·처방 12·주문 2)에선 전부 수십 배 멀어서 지금 고치진 않았다. 대신
 * **한도의 약 60%** 에서 경보를 낸다 — 기억에 기대지 않고, 넘치기 전에 고칠 시간을 번다.
 *
 * 숫자를 바꾸면 해당 코드의 한도도 같이 본다(주석의 파일). 한도를 없애면 항목을 지운다.
 */

export type ScaleCounts = {
  /** 활성·카드 있는 구독 수 — 같은 화요일 청구 대상의 상한 근사 */
  activeBilledSubs: number | null
  /** dog_formulas 행 수 — 재제안 크론 후보 조회 상한 */
  formulas: number | null
  /** 결제된 주문 누적 — 대시보드 누적 매출 합산 */
  paidOrders: number | null
  /** 최근 365일 결제 원장 행 — 재무 365일 보기 */
  ledgerRows365d: number | null
}

type Limit = {
  key: keyof ScaleCounts
  warnAt: number
  label: string
  where: string
}

/**
 * 한도 정본. warnAt = 실제로 깨지는 지점의 약 60%.
 *  · 청구 크론: MAX_PER_RUN 100 + 시간 예산 240초(건당 약 3초 → 약 80건) — subscription-charge
 *    같은 화요일 대상 ≤ 활성 구독이므로 활성 구독으로 보수적으로 잰다. 사전고지(D-2)는 120초에 약 70건.
 *  · 재제안 크론: 후보 조회 limit 300 을 구독 게이트 **전에** 건다 — personalization-progression
 *  · 대시보드·재무·월 리포트 합계: PostgREST max-rows 1000 에서 조용히 잘린다 — admin/page·finance·reports
 */
export const SCALE_LIMITS: readonly Limit[] = [
  { key: 'activeBilledSubs', warnAt: 40, label: '활성 구독', where: '청구·사전고지 크론 처리량(같은 화요일 약 70건)' },
  { key: 'formulas', warnAt: 180, label: '처방 기록', where: '재제안 크론 후보 상한(300)' },
  { key: 'paidOrders', warnAt: 600, label: '결제 주문 누적', where: '대시보드 누적 매출(1,000행 잘림)' },
  { key: 'ledgerRows365d', warnAt: 600, label: '1년 결제 원장', where: '재무 365일 보기(1,000행 잘림)' },
]

/** 경보 문구 목록. 조회 실패(null)는 경보로 만들지 않는다 — 브리핑의 '못 센 항목'이 따로 알린다. */
export function scaleWarnings(counts: ScaleCounts): string[] {
  const out: string[] = []
  for (const l of SCALE_LIMITS) {
    const n = counts[l.key]
    if (n == null || n < l.warnAt) continue
    out.push(`${l.label} ${n.toLocaleString('ko-KR')} — ${l.where}`)
  }
  return out
}
