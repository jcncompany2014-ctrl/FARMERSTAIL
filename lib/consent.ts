/**
 * Marketing consent policy version.
 *
 * 정보통신망법 §50 에 따른 광고성 정보 수신동의 약관 버전. 약관을 개정할 때마다
 * 이 상수를 bump 해서 재동의가 필요한 유저를 식별할 수 있게 한다.
 *
 * 표기는 `vN` (N=1 부터). 변경 이력:
 *   • v1 (2026-04-24) — 최초 분리 동의. 이메일·SMS 별도 체크.
 */
export const MARKETING_POLICY_VERSION = 'v1'

export type ConsentChannel = 'email' | 'sms'

/**
 * 마케팅 수신 사용자에게 문구를 고르게 하려면 채널별 라벨을 중앙화.
 * 법적으로 "광고·마케팅 정보" 라는 표현이 명시돼야 한다.
 */
export const CONSENT_LABEL: Record<ConsentChannel, string> = {
  email: '혜택·이벤트 이메일 수신',
  sms: '혜택·이벤트 SMS·카카오톡 수신',
}
