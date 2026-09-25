/**
 * 광고성 푸시(category 'marketing')의 법정 표시·시간 규칙 — 정본 (2026-09-25 출시 전 점검 4차).
 *
 * 정보통신망법 §50 · 시행령 §61(별표 6) · KISA 불법스팸 방지 안내서:
 *   ③ 21시~08시 광고 전송은 **별도 동의**가 필요하다 — 우리는 그 동의를 받지 않으므로 보내지 않는다.
 *   ④ 광고성 정보는 시작 부분에 `(광고)`, 그리고 **수신거부 방법**을 적는다.
 *      (앱 푸시는 알림에 앱 이름이 함께 떠서 전송자 명칭이 드러난다.)
 *
 * # 왜 pushToUser 한 곳에서 거나
 * 예전엔 야간 차단이 push-lifecycle 크론에만 있어서, 사장님이 어드민에서 밤에 캠페인을
 * 누르면 그대로 나갔다. 표시도 제목 `[광고]` 뿐이고 수신거부 방법이 없었다. 발송 관문
 * 하나에 걸면 새 광고 발송 경로가 생겨도 자동으로 지켜진다.
 */
import { MARKETING_HOUR_MAX, MARKETING_HOUR_MIN } from './automation-settings.ts'

export const AD_LABEL = '(광고)'
export const AD_OPT_OUT_LINE = '수신거부: 앱 마이페이지 > 알림 설정'

/** KST 시(0~23)가 광고 푸시를 보내도 되는 시간인가 — 08:00~20:59. */
export function isMarketingSendHour(kstHour: number): boolean {
  return kstHour >= MARKETING_HOUR_MIN && kstHour <= MARKETING_HOUR_MAX
}

/** 이미 붙어 있을 수 있는 `[광고]`·`(광고)` 접두를 떼고 법정 표기로 다시 붙인다(중복 없음). */
export function stampMarketingPayload<T extends { title: string; body?: string }>(
  payload: T,
): T & { body: string } {
  const bareTitle = payload.title.replace(/^\s*[[(（]\s*광고\s*[\])）]\s*/, '')
  const body = payload.body?.trim()
    ? payload.body.includes(AD_OPT_OUT_LINE)
      ? payload.body
      : `${payload.body}\n${AD_OPT_OUT_LINE}`
    : AD_OPT_OUT_LINE
  return { ...payload, title: `${AD_LABEL} ${bareTitle}`, body }
}
