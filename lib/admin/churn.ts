/**
 * 해지 판정 — '진짜 해지'만 해지로 센다 + 해지율은 표본 크기를 본다 (2026-10-14 어드민 B3, 규칙251).
 *
 * # 왜 — 운영 DB 로 확인한 '해지 2명'의 정체(2026-10-14 SELECT)
 * 어드민 홈 '구독 해지(30일) 2명 · 해지율 25%'(빨강)의 두 건은 둘 다
 *  · 카드를 한 번도 등록하지 않았고(결제 0회·발송 0회),
 *  · 신청 다음 날 03:30 에 정리 크론(subscription-cleanup — 카드 미등록 1시간 지난 신청을 자동 cancelled)이 닫았고,
 *  · 같은 강아지로 곧바로 다시 신청해 지금 진행 중이다(서포터즈 두 분).
 * 즉 '카드 등록 전 포기 + 다시 신청'이지 떠난 고객이 아니다. 진짜 해지 = **한 번이라도 결제된 뒤** 끊었고, 그 강아지가
 * 지금 다른 구독으로 이어지고 있지 않은 것.
 *
 * # 해지율
 * 해지율 = 진짜 해지 ÷ (진행 중 + 진짜 해지). 그런데 진행 중이 7건이면 한 명만 떠나도 12.5%라 빨간불이 켜진다 — 숫자가
 * 사실이어도 판단 근거로는 약하다. 분모가 CHURN_MIN_SAMPLE 보다 작으면 비율 대신 '표본 적음'과 사람 수를 보여 주고
 * 빨간색을 쓰지 않는다.
 */

export type CancelledSubLike = {
  id: string
  dog_id: string | null
  /** 마지막으로 결제가 성공한 시각 — 한 번도 결제 안 됐으면 null. */
  last_charged_at: string | null
  total_deliveries: number | null
}

export type CancelKind = 'real' | 'never_charged' | 'resubscribed'

export const CANCEL_KIND_LABEL: Record<CancelKind, string> = {
  real: '진짜 해지',
  never_charged: '카드 등록 전 포기·중복 신청 정리(결제 0회)',
  resubscribed: '같은 강아지로 다시 구독 중',
}

/**
 * 해지된 구독 한 건이 '진짜 해지'인가.
 * 결제가 한 번도 없었으면(카드 등록 전 포기·정리 크론) → never_charged.
 * 결제는 있었지만 같은 강아지가 지금 다른 구독(진행·일시정지)으로 이어지면 → resubscribed.
 * 그 밖 = real.
 */
export function classifyCancellation(sub: CancelledSubLike, liveDogIds: ReadonlySet<string>): CancelKind {
  if (!sub.last_charged_at && (sub.total_deliveries ?? 0) <= 0) return 'never_charged'
  if (sub.dog_id && liveDogIds.has(sub.dog_id)) return 'resubscribed'
  return 'real'
}

/** 이보다 분모가 작으면 비율로 판단하지 않는다(한두 명이 두 자릿수 %를 만든다). */
export const CHURN_MIN_SAMPLE = 20
/** 표본이 충분할 때 빨간색 기준(%). */
export const CHURN_RED_PCT = 5

export type ChurnSummary = {
  real: number
  denominator: number
  /** 표본이 충분할 때만 숫자. 적으면 null. */
  ratePct: number | null
  smallSample: boolean
  tone: 'neutral' | 'red'
  /** 카드 아래 한 줄. */
  caption: string
}

export function churnSummary(i: { activeCount: number; realCancelled: number; excludedCancelled?: number }): ChurnSummary {
  const denominator = Math.max(0, i.activeCount) + Math.max(0, i.realCancelled)
  const excluded = i.excludedCancelled ?? 0
  const tail = excluded > 0 ? ` · 결제 전 포기·재신청 ${excluded}건은 뺐어요` : ''
  if (denominator < CHURN_MIN_SAMPLE) {
    return {
      real: i.realCancelled,
      denominator,
      ratePct: null,
      smallSample: true,
      tone: 'neutral',
      caption: `표본 적음 — 구독 ${denominator}건 중 ${i.realCancelled}명 해지${tail}`,
    }
  }
  const ratePct = (i.realCancelled / denominator) * 100
  return {
    real: i.realCancelled,
    denominator,
    ratePct,
    smallSample: false,
    tone: ratePct > CHURN_RED_PCT ? 'red' : 'neutral',
    caption: `해지율 ${ratePct.toFixed(1)}% (구독 ${denominator}건 기준)${tail}`,
  }
}
