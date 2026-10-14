/**
 * 어드민 수동 처리의 밤 알림 확인 — 조용시간(KST 22:00~07:59)에 손님 휴대폰 알림이 나가기 전에 사장님에게 묻는다
 * (2026-10-14 메일 점검 M5, 규칙239).
 *
 * # 왜
 * 10/08 22:43 사장님이 서포터즈 6명의 주문을 '배송 완료'로 바꾸자 6명 휴대폰에 "배송이 완료됐어요" 알림이 그대로 나갔다.
 * 조용시간은 손님이 설정 화면에서 켠 경우에만 lib/push 가 막는데(선호 행이 없으면 안 막힌다), 크론은 시각을 옮겨 피했지만
 * (AGENTS 규칙9) **사람이 누르는 경로**는 아무 장치가 없었다. 미뤄 보내는 예약 장치(큐)가 없어서 — 만들면 DB 표와 크론이
 * 늘어난다 — 확인을 받는다: 밤이면 서버가 409 NIGHT_PUSH_CONFIRM 을 돌려주고, 화면이 사장님에게 묻는다.
 *   · 취소 — 아무것도 바꾸지 않는다(아침에 다시 누른다).
 *   · 알림 없이 바꾸기(nightPush: 'skip') — 상태는 바꾸고 앱 알림만 보내지 않는다. 메일은 그대로 간다(남는 기록이고,
 *     송장번호를 받는 다른 길이다).
 *   · 지금 보내기(nightPush: 'send') — 밤이라도 알림을 보낸다(사장님이 고른 경우만).
 *
 * 쓰는 곳: app/api/admin/orders/[id]/status(발송·배송 완료·취소) · app/api/admin/orders/[id]/tracking(송장 변경 알림).
 * 화면: app/admin/orders/[id]/OrderStatusControl · ShippingControl.
 */

/** 조용시간 — 알림 설정 화면의 기본값(22→8)과 같다. KST 시(0~23). */
export const NIGHT_PUSH_START_HOUR = 22
export const NIGHT_PUSH_END_HOUR = 8

/** API 가 409 와 함께 돌려주는 코드 — 화면이 이 코드면 밤 알림 확인 창을 띄운다. */
export const NIGHT_PUSH_CONFIRM = 'NIGHT_PUSH_CONFIRM'

export type NightPushChoice = 'send' | 'skip'

/** 이 KST 시각이 손님에게 알림을 보내면 안 되는 밤인가. */
export function isNightPushHourKst(kstHour: number): boolean {
  return kstHour >= NIGHT_PUSH_START_HOUR || kstHour < NIGHT_PUSH_END_HOUR
}

/** 요청 본문의 nightPush 값 — 'send' · 'skip' 외에는 null(아직 안 물었다). */
export function parseNightPushChoice(v: unknown): NightPushChoice | null {
  return v === 'send' || v === 'skip' ? v : null
}

/** 409 와 함께 보내는 안내 — 어떤 알림이 가는지 말한다. */
export function nightPushMessage(pushTitle: string): string {
  return `지금은 밤(22시~아침 8시)이에요. 지금 처리하면 손님 휴대폰에 "${pushTitle}" 알림이 바로 가요.`
}

/**
 * 화면용 — 확인 창 두 번으로 고른다. null = 바꾸지 않기(아침에 다시). confirmFn 은 시험용(기본 window.confirm).
 */
export function askNightPushChoice(
  message: string,
  confirmFn: (m: string) => boolean = (m) => window.confirm(m),
): NightPushChoice | null {
  const proceed = confirmFn(
    `${message}\n\n지금 처리할까요?\n[취소] 바꾸지 않기 — 아침 8시 이후에 다시 눌러 주세요\n[확인] 지금 처리하기 — 다음 창에서 알림을 보낼지 고릅니다`,
  )
  if (!proceed) return null
  return confirmFn(
    '손님에게 지금 앱 알림을 보낼까요?\n\n[확인] 지금 보내기 — 밤에 알림이 가요\n[취소] 알림 없이 바꾸기 — 메일은 그대로 가요',
  )
    ? 'send'
    : 'skip'
}
