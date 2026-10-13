/**
 * 메일 태그(sendEmail 의 tag) 분류 — 정본 한 곳 (2026-10-14 메일 점검 M4, 규칙238).
 *
 * # 왜
 * 수신차단 목록(email_suppressions — 하드바운스·스팸 신고)에 걸린 주소로는 거래 메일까지 전부 안 나간다. 그 사실은 거래 메일이면
 * error 로 올려 사장님이 보게 하는데(lib/email/client), 판정이 태그 **앞머리**(order·subscription·va-·personalization)였다.
 * 실제 태그는 'virtual-account-waiting'(입금 대기 — 기한 안에 안 내면 주문이 사라진다)·'trial-price-change'(서포터즈 가격
 * 변경 고지 — 전자상거래법상 증액 사전 고지)라 둘 다 앞머리에 안 걸려 warning 으로 묻혔다.
 *
 * 이제 태그를 표로 나눈다. 새 태그를 만들면 둘 중 한 표에 넣는다 — 규칙238 이 발송처의 태그가 전부 표에 있는지 본다.
 */

/** 거래 메일 — 주문·결제·입금·배송·정기배송·가격 변경. 못 받으면 손님이 돈·박스 일을 모른다. */
export const TRANSACTIONAL_EMAIL_TAGS = [
  'order-placed',
  'virtual-account-waiting',
  'order-shipped',
  'order-delivered',
  'order-cancelled',
  'subscription-reminder',
  'subscription-charge-failed',
  'trial-price-change',
  'personalization-approval',
  'personalization-kept',
  'personalization-cycle',
] as const

/** 거래 아님 — 가입 인사·뉴스레터·수신 동의 안내·분기 리포트·문의 접수·운영 점검. */
export const NON_TRANSACTIONAL_EMAIL_TAGS = [
  'welcome',
  'newsletter-confirm',
  'newsletter-welcome',
  'newsletter-vol-01',
  'newsletter-vol-01-test',
  'unsubscribe-ack',
  'consent-result',
  'quarterly-report',
  'contact-admin',
  'contact-user',
  'ops-digest',
] as const

export type EmailTag = (typeof TRANSACTIONAL_EMAIL_TAGS)[number] | (typeof NON_TRANSACTIONAL_EMAIL_TAGS)[number]

/**
 * 이 태그의 메일이 거래 메일인가. 표에 없는 새 태그는 이름으로 짐작한다 — 돈·배송 쪽 이름이면 거래로 본다
 * (막혔을 때 묻히는 쪽보다 시끄러운 쪽이 낫다).
 */
export function isTransactionalEmailTag(tag: string | null | undefined): boolean {
  if (!tag) return false
  if ((TRANSACTIONAL_EMAIL_TAGS as readonly string[]).includes(tag)) return true
  if ((NON_TRANSACTIONAL_EMAIL_TAGS as readonly string[]).includes(tag)) return false
  return /^(order|subscription|va-|virtual-account|trial|personalization|payment|refund|billing|charge)/.test(tag)
}
