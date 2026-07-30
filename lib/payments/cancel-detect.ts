/**
 * "고객이 결제창을 닫은 것"과 "정말 실패한 것"을 구분한다 (2026-07-30).
 *
 * # 왜 필요한가 (사장님 제보)
 * 토스 등록창을 닫으면 SDK 가 예외를 던진다. 우리 코드는 그걸 그대로 에러로
 * 표시해서 **빨간 글씨 "취소되었습니다." + 막다른 화면**이 떴다. 취소는 실패가
 * 아니다 — 고객이 스스로 그만둔 것이고, 마음이 바뀌면 다시 누르면 된다.
 * 실패처럼 보여주면 "결제가 고장났다"고 읽힌다.
 *
 * # 판별 방법 두 겹
 * ① **코드** — 토스가 주는 취소 계열 코드.
 * ② **메시지** — 코드가 없거나 우리가 모르는 값일 때의 안전망. 등록창에서
 *    '취소' 라는 말이 나오는 상황은 고객이 그만둔 경우뿐이므로 안전하다.
 *    (실결제 승인이 아니라 **카드/수단 등록** 단계라 돈이 얽힌 취소가 없다.)
 *
 * 코드를 하드코딩만 하지 않은 이유: 설치된 SDK 타입 정의에 취소 코드가 열거돼
 * 있지 않아 실측으로 확인할 수 없었다. 둘 다 보면 어느 쪽이 와도 잡힌다.
 */

/** 토스가 취소 상황에 쓰는 코드들. */
const CANCEL_CODES = new Set([
  'USER_CANCEL',
  'PAY_PROCESS_CANCELED',
  'USER_CANCELED',
])

/** 취소가 아닌데 '취소' 라는 말이 들어갈 수 있는 메시지 — 실패로 남겨둔다. */
const NOT_CANCEL_HINTS = ['한도', '잔액', '거절', '유효하지', '만료']

function pick(obj: unknown, key: string): string | null {
  if (typeof obj !== 'object' || obj === null) return null
  const v = (obj as Record<string, unknown>)[key]
  return typeof v === 'string' ? v : null
}

/**
 * 이 예외가 "고객이 창을 닫았다" 인가?
 *
 * @param e SDK 가 던진 값 (Error 든 평범한 객체든 문자열이든)
 */
export function isUserCancelledPayment(e: unknown): boolean {
  const code = pick(e, 'code')
  if (code && CANCEL_CODES.has(code)) return true

  const message =
    pick(e, 'message') ?? (typeof e === 'string' ? e : null) ?? ''
  if (!message) return false
  // 실패 사유가 섞인 메시지는 취소로 삼키지 않는다 — 고객이 이유를 알아야 한다.
  if (NOT_CANCEL_HINTS.some((h) => message.includes(h))) return false
  return message.includes('취소')
}
