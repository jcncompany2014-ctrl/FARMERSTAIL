/**
 * 카드 등록 실패 문구를 **고객의 말**로 바꾼다 (2026-08-31).
 *
 * # 왜 (사장님 실기기 제보)
 * 카드 등록에 실패하자 우리 실패 화면에 **`A0: 카드번호 오류`** 가 그대로 떴다.
 * `A0` 는 토스 구 모듈 에러 코드표의 카드사 응답코드다(공식 문서 확인).
 * 우리 코드가 코드를 붙인 게 아니라 **토스가 `message` 자체에 붙여서 보낸다** —
 * 실패 화면이 그 값을 그대로 렌더하고 있었다.
 *
 * 고객은 `A0` 가 뭔지 알 수 없고, 알 필요도 없다. 결제 첫 관문에서 개발자 문자열을
 * 보여주면 "이 서비스 괜찮은 건가" 로 읽힌다. 고객 문구 원칙(전문용어 금지)에도 어긋난다.
 *
 * # 방침
 * ① 앞에 붙은 코드(`A0:`, `INVALID_CARD_NUMBER -` 등)를 떼어낸다.
 * ② 아는 사유는 **무엇을 하면 되는지**까지 알려준다("다시 확인해 주세요").
 * ③ 모르는 값이면 **그대로 보여주지 않고** 일반 문구로 덮는다. 토스가 어떤 문자열을
 *    보낼지 우리가 통제하지 못하므로, 화이트리스트 방식이 아니면 또 새어나온다.
 * ④ 원문은 화면에서만 지운다 — 호출부가 Sentry 로 따로 보낸다(진단은 남긴다).
 *
 * ⚠️ 카드 브랜드별 지원 여부(예: 아멕스)는 **확인되기 전까지 문구로 단정하지 않는다.**
 *    토스에 확인 전이라 "아멕스는 안 됩니다" 같은 말은 넣지 않았다.
 */

/** 문구 앞에 붙어 오는 코드 접두사. `A0: `, `INVALID_CARD - ` 등. */
const CODE_PREFIX = /^\s*[A-Z][A-Z0-9_]{0,29}\s*[:\-–]\s*/

/** 고객에게 그대로 보여도 되는 한국어인가 (영문 코드·기호 범벅이면 아니다). */
const LOOKS_KOREAN = /[가-힣]/

/**
 * 사유별 안내. 키는 **소문자로 비교**하며 코드와 메시지 양쪽에서 찾는다.
 * 순서가 의미를 가진다 — 먼저 맞는 것이 이긴다(구체적인 것을 위에).
 */
const HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/카드번호|card_number|invalid_card\b/i, '카드 번호를 다시 확인해 주세요.'],
  [/유효기간|expir/i, '카드 유효기간을 다시 확인해 주세요.'],
  [/비밀번호|password/i, '카드 비밀번호를 다시 확인해 주세요.'],
  [/생년월일|사업자|birth/i, '생년월일(또는 사업자번호)을 다시 확인해 주세요.'],
  [/한도|잔액|limit|balance/i, '카드 한도나 잔액을 확인한 뒤 다시 시도해 주세요.'],
  [
    /정지|분실|도난|사용할 수 없|stopped|lost|stolen/i,
    '지금은 사용할 수 없는 카드예요. 다른 카드로 등록해 주세요.',
  ],
  [
    /거절|reject|declin/i,
    '카드사에서 등록이 거절됐어요. 다른 카드로 등록하거나 카드사에 문의해 주세요.',
  ],
]

const GENERIC = '카드 등록이 완료되지 않았어요. 다시 시도해 주세요.'

/**
 * 토스가 준 `code`/`message` 를 고객용 한 문장으로.
 * 취소 여부 판정은 여기서 하지 않는다 — `isUserCancelledPayment` 가 정본이다.
 */
export function billingFailMessage(input: {
  code?: string | null
  message?: string | null
}): string {
  const rawMessage = (input.message ?? '').trim()
  const cleaned = rawMessage.replace(CODE_PREFIX, '').trim()
  const haystack = `${input.code ?? ''} ${rawMessage}`

  for (const [pattern, text] of HINTS) {
    if (pattern.test(haystack)) return text
  }

  // 아는 사유가 없을 때: 한국어 문장으로 보이면 그대로, 아니면 일반 문구.
  // (코드만 남거나 영문 원문이면 고객에게 의미가 없다)
  if (cleaned && LOOKS_KOREAN.test(cleaned) && !CODE_PREFIX.test(cleaned)) {
    return cleaned
  }
  return GENERIC
}
