/**
 * 생년월일 → 나이 파생 (2026-07-16 사장님: 나이 직접입력 대신 생일 넣고 자동계산).
 *
 * dogs.age_value / age_unit 는 칼로리 알고리즘(생애주기·성장계수)이 읽으므로,
 * 생일만 받아도 이 값을 채워 downstream 을 그대로 유지한다. 12개월 미만은 '개월',
 * 이상은 '살'. nowMs 주입으로 순수 함수(SSR·테스트 안전).
 */
export function deriveAgeFromBirth(
  birthISO: string | null | undefined,
  nowMs: number,
): { value: number; unit: 'years' | 'months' } | null {
  if (!birthISO) return null
  const birth = new Date(birthISO + 'T00:00:00Z')
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date(nowMs)

  let months =
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - birth.getUTCMonth())
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1
  if (months < 0) months = 0

  if (months < 12) return { value: months, unit: 'months' }
  return { value: Math.floor(months / 12), unit: 'years' }
}

/** 사람이 읽는 나이 문구. 예: "3살", "5개월", "0개월"(갓 태어남). */
export function ageLabelFromBirth(
  birthISO: string | null | undefined,
  nowMs: number,
): string | null {
  const a = deriveAgeFromBirth(birthISO, nowMs)
  if (!a) return null
  return `${a.value}${a.unit === 'years' ? '살' : '개월'}`
}
