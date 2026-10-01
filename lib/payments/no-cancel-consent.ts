/**
 * 결제 후 취소 제한 — 맞춤 제작 동의 정본 (2026-10-02 사장님 "A가 좋다").
 *
 * # 왜
 * 일정이 토·일 조리 → 월 포장 → 화 발송으로 바뀌어 일반 고객은 조리 직전 토요일에 결제되고, 결제 = 그 아이 몫의
 * 조리 시작이다. 사장님 결정(2026-10-01): 결제된 박스는 그대로 보내고 자동 환불은 없다.
 * 그런데 주문에 따라 개별 생산되는 재화의 청약철회를 막으려면 **그 거래에 대해 따로 알리고 고객 동의(전자문서
 * 포함)를 받아야** 한다(전자상거래법 §17② · 시행령 §21 — 문구는 변호사 확인 권장, docs/LEGAL_REVISION_2026_10.md §5).
 * 게시된 환불정책은 아직 "출고 전 셀프 취소"를 약속한다(개정은 공지 기간 뒤).
 *
 * # 그래서
 *  · 카드 등록(정기결제 시작) 두 입구 — 앱 주문 화면 · 카드 등록 화면 — 에 **필수 체크**를 둔다.
 *  · 동의 버전이 토스 왕복 주소(successUrl `ncc`)를 타고 billing-issue 로 가서, 카드 저장과 **같은 쓰기**로
 *    subscriptions.no_cancel_consent_at · _version 에 남는다(고객은 이 칸을 못 쓴다 — 4칸 화이트리스트).
 *  · 셀프 취소는 **그 결제 전에 동의한 박스만** 막는다(selfCancelBlockedByConsent). 동의 기록이 없는 구독
 *    (기존 서포터즈·옛 화면으로 등록)은 게시된 정책대로 발송 전 취소가 된다 — 고객에게 불리한 쪽으로 넘겨짚지 않는다.
 *
 * 문구를 바꾸면 버전도 올린다 — 어떤 문장에 동의했는지가 기록의 전부다.
 */

/**
 * 동의 문구 버전(날짜). 문구가 바뀌면 함께 바꾼다.
 *  · 2026-10-02   "결제되면 바로 …몫을 만들기 시작해요" — 서포터즈(발송일 결제)에겐 조리가 결제보다 먼저라 틀렸다.
 *  · 2026-10-02.2 결제 시점과 무관하게 참인 문장으로(동의 기록 0건일 때 교체).
 */
export const NO_CANCEL_CONSENT_VERSION = '2026-10-02.2'

/** 토스 왕복 주소(successUrl)에 싣는 쿼리 이름. */
export const NO_CANCEL_CONSENT_PARAM = 'ncc'

/** 체크박스 옆 한 줄. */
export const NO_CANCEL_CONSENT_LABEL = '결제 후 취소 안내를 확인했어요 (필수)'

/** 체크 없이 넘어가려 할 때. */
export const NO_CANCEL_CONSENT_REQUIRED_MESSAGE = '결제 후 취소 안내를 확인하고 체크해 주세요.'

/**
 * 체크박스 아래 안내 — 이 문장이 동의의 내용이다(버전과 짝).
 * ★결제 시점을 말하지 않는다: 일반 고객은 조리 직전 토요일, 서포터즈 체험 구간은 조리가 끝난 화요일에 결제된다
 *   (lib/shipping-schedule chargeTimingFor). 어느 쪽이든 참인 사실은 "결제된 박스는 맞춤으로 만들어 그대로 보낸다".
 * @param dogLabel petName 을 거친 이름("콩이"). 없으면 '우리 아이'.
 */
export function noCancelConsentBody(dogLabel?: string | null): string {
  const who = dogLabel && dogLabel.trim() ? dogLabel.trim() : '우리 아이'
  return (
    `결제된 박스는 ${who} 몫으로 맞춤 조리해 그대로 보내드려요. 그래서 결제 후에는 단순 변심으로 취소·환불할 수 없어요. ` +
    '다음 박스는 결제 전까지 정기배송 화면에서 미루거나 해지할 수 있고, 받은 박스에 문제가 있으면 환불해 드려요.'
  )
}

/** 지금 버전의 동의인가 — 옛 버전·빈 값·아무 문자열은 동의로 치지 않는다. */
export function isCurrentNoCancelConsent(v: unknown): boolean {
  return v === NO_CANCEL_CONSENT_VERSION
}

/**
 * 결제된 정기배송 박스의 **셀프 취소를 막는가.** 그 박스가 결제되기 **전에** 동의한 기록이 있을 때만 막는다.
 * 동의가 없거나, 결제 뒤에 동의했거나(카드 재등록 때 동의 — 그 전에 결제된 박스는 옛 조건), 시각을 모르면
 * 막지 않는다 — 모르는 걸 고객에게 불리하게 읽지 않는다.
 */
export function selfCancelBlockedByConsent(input: {
  consentAt: string | null | undefined
  paidAt: string | null | undefined
}): boolean {
  if (!input.consentAt || !input.paidAt) return false
  const c = Date.parse(input.consentAt)
  const p = Date.parse(input.paidAt)
  if (!Number.isFinite(c) || !Number.isFinite(p)) return false
  return c <= p
}
