// 카카오 OAuth 메타데이터에서 전화번호·출생연도 추출(방어적 파서).
//
// 사장님 2026-07-20: 카카오 동의항목을 [전화번호·출생연도]로 축소 재신청하기로
// 하면서, "요청=실사용" 을 맞추려면 이 값을 실제로 써야 한다(안 그러면 또 반려).
// 여기서 OIDC 메타데이터를 파싱해 profiles.phone / profiles.birth_year 를 채운다.
//
// ★불확실성: 카카오→Supabase(OIDC)가 이 값을 정확히 어느 키로 싣는지는 동의항목
//   스코프 승인 + 실기기 로그인 전엔 확정 불가. 그래서 알려진 후보 위치를 폭넓게
//   훑는다 — user_metadata 직속 / kakao_account 중첩. 없으면 null → 호출측이
//   기존 폴백(age-gate·주문폼 입력)으로. 승인 후 실기기에서 실제 키를 확인해
//   후보 목록만 좁히면 된다(파싱/정규화 로직은 그대로).

type Meta = Record<string, unknown>

/** 직속 키 → 없으면 중첩 kakao_account 키에서 첫 non-empty 값. */
function deepGet(meta: Meta, keys: string[]): unknown {
  for (const k of keys) {
    const v = meta[k]
    if (v != null && v !== '') return v
  }
  const acc = meta['kakao_account']
  if (acc && typeof acc === 'object') {
    const accObj = acc as Meta
    for (const k of keys) {
      const v = accObj[k]
      if (v != null && v !== '') return v
    }
  }
  return undefined
}

/**
 * 출생연도(YYYY) 추출. 만 14세~100세 범위 밖이거나 파싱 실패면 null
 * (= "제공 안 됨"으로 간주 → age-gate 가 처리). nowYear 주입으로 순수 함수.
 */
export function pickKakaoBirthYear(
  meta: Meta | null | undefined,
  nowYear: number,
): number | null {
  if (!meta) return null
  const raw = deepGet(meta, ['birthyear', 'birth_year'])
  const n =
    typeof raw === 'number' ? raw : parseInt(String(raw ?? '').trim(), 10)
  if (!Number.isInteger(n)) return null
  if (n < nowYear - 100 || n > nowYear - 14) return null
  return n
}

/**
 * 전화번호 추출 → 국내 휴대폰 형식 정규화(숫자만, +82→0).
 *   "+82 10-1234-5678" / "010-1234-5678" → "01012345678"
 * 유효 국내 휴대폰(01x 10~11자리)이 아니면 null.
 */
export function pickKakaoPhone(meta: Meta | null | undefined): string | null {
  if (!meta) return null
  const raw = deepGet(meta, ['phone_number', 'phone'])
  if (typeof raw !== 'string' || !raw.trim()) return null
  let digits = raw.replace(/[^\d]/g, '')
  if (digits.startsWith('82')) digits = '0' + digits.slice(2)
  if (!/^01\d{8,9}$/.test(digits)) return null
  return digits
}
