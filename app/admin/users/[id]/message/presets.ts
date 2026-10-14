/**
 * 고객 화면(/admin/users/[id])에서 '안내 보내기'로 넘어올 때 1:1 메시지를 미리 채우는 문구 (2026-10-14 C5, 규칙257).
 *
 * 화식 비율·금액은 어드민이 바꾸지 않는다 — 금액이 바뀌는 변경은 고객 동의가 필요하다. 그래서 고객이 앱 정기배송 화면에서
 * 새 금액을 보고 직접 고르도록 안내한다(그 선택이 곧 동의 — app/api/subscriptions/[id]/fresh-ratio 머리말).
 * 고객에게 나가는 글이라 금지어(처방·언제든·영양소 %·도착 요일·'맞춤'·경쟁사·효능)를 쓰지 않는다 — 규칙 테스트가 본다.
 *
 * `@/` 값 import 없음 — node 테스트가 그대로 읽는다.
 */
export type MessagePreset = { title: string; body: string; url: string }

export const MESSAGE_PRESETS: Readonly<Record<string, MessagePreset>> = {
  ratio: {
    title: '화식 비율 바꾸기 안내',
    body: '말씀하신 화식 비율은 앱 정기배송 화면에서 직접 고르실 수 있어요. 비율을 바꾸면 2주 금액도 함께 바뀌는데, 고르는 화면에서 바뀐 금액을 먼저 보여드려요.',
    url: '/mypage/subscriptions',
  },
}

export function messagePreset(key: string | null | undefined): MessagePreset | null {
  return (key && Object.prototype.hasOwnProperty.call(MESSAGE_PRESETS, key) && MESSAGE_PRESETS[key]) || null
}
