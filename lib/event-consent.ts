/**
 * 이벤트 화면(/p/코드) 가입 카드의 광고 수신 동의(선택) 보관 키 — 카카오·애플은 화면 밖으로 나갔다 오므로
 * 가입 카드(FirstScreenFlow event)가 폰에 잠깐 들고 있고, 가입 완료(/p/코드/done)가 서버 함수(set_marketing_consent)로 저장한 뒤 지운다.
 */
export const EVENT_CONSENT_KEY = 'ft:event-consent'
