/**
 * 국내 휴대폰 번호 — **정본 한 곳**(2026-08-03 검수).
 *
 * # 왜 만들었나
 * 사장님 계정으로 정기배송 신청 화면을 열었더니 배송 연락처가
 * **`010-3887-885`(10자리)** 였다. 한 자리가 빠진 번호인데 그대로 저장돼 있고,
 * 결제 버튼도 막히지 않았다. 냉동식품은 기사님이 전화를 거는 배송이라
 * 연락 안 되는 번호는 곧 배송 실패다.
 *
 * 원인은 검증식이 `010` 뒤에 7자리를 허용한 것:
 *     /^01[016789]\d{7,8}$/     ← 0103887885 통과
 * `010` 은 도입부터 **11자리 고정**이다(010-XXXX-XXXX). 7자리 뒷번호를 가진
 * 010 번호는 존재하지 않는다. 7~8 자리를 허용해도 되는 건 옛 식별번호
 * (011·016·017·018·019)뿐이다 — 그쪽은 010 으로 통합되기 전 10자리가 많았다.
 *
 * # 왜 파일로 뺐나
 * 같은 규칙이 **네 곳에 따로** 살아 있었고 넷 다 같은 구멍이 있었다:
 *   · app/(main)/dogs/[id]/order/OrderClient.tsx   (주문 화면 — 웹·앱 공용)
 *   · app/api/subscriptions/create/route.ts        (서버 검증)
 *   · components/account/ProfileForm.tsx           (프로필 저장)
 *   · lib/api/schemas.ts                           (형태가 또 달랐다)
 * 규칙이 여러 곳에 있으면 갈라진다는 걸 이 저장소에서 여러 번 확인했다.
 * 고칠 곳이 하나여야 다음에 또 안 갈라진다.
 */

/** 숫자만 남긴다. `+82 10-1234-5678` 같은 국제 표기도 0 으로 되돌린다. */
export function phoneDigits(raw: string): string {
  const s = (raw ?? '').trim()
  const intl = s.replace(/[^0-9+]/g, '')
  if (intl.startsWith('+82')) return '0' + intl.slice(3).replace(/[^0-9]/g, '')
  return s.replace(/[^0-9]/g, '')
}

/**
 * 국내 휴대폰 번호인가.
 *
 *   010            → 뒤 **8자리 고정** (총 11자리)
 *   011·016~019    → 뒤 7~8자리 (총 10~11자리)
 *
 * 하이픈·공백·국제표기는 알아서 벗긴다.
 */
export function isKoreanMobile(raw: string): boolean {
  const d = phoneDigits(raw)
  if (d.startsWith('010')) return /^010\d{8}$/.test(d)
  return /^01[16789]\d{7,8}$/.test(d)
}

/** 화면 표기용 하이픈 — 010-1234-5678 / 011-234-5678. 형식이 아니면 원본 그대로. */
export function formatKoreanMobile(raw: string): string {
  const d = phoneDigits(raw)
  if (!isKoreanMobile(d)) return raw
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
}

/** 폼·API 가 함께 쓰는 안내 문구 — 문구도 갈라지지 않게 여기 둔다. */
export const PHONE_ERROR = '휴대폰 번호를 다시 확인해 주세요 (010-1234-5678).'
