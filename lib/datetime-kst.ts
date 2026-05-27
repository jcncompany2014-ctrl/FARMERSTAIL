/**
 * Farmer's Tail — KST (Asia/Seoul, UTC+9) datetime helpers.
 *
 * # 왜 필요한가
 *
 * Vercel 서버는 UTC. `new Date()` 의 `getDate()/getHours()` 도 환경 기본 (UTC).
 * `.toISOString().slice(0,10)` 은 UTC 기준 yyyy-mm-dd 반환. → KST 자정 직후
 * 09시간 동안 (KST 00:00-08:59) 는 UTC 가 아직 전날 → date string 이 KST 의도
 * 보다 **1일 빠른** 값으로 저장됨. 사용자가 "내일 일시정지" 클릭했는데 실제론
 * 오늘 정지되는 off-by-one 버그 (R85-D 6-agent audit 발견).
 *
 * # 패턴
 *
 *   const today = todayKstIsoDate()       // 오늘 (KST) yyyy-mm-dd
 *   const tomorrow = addDaysKst(today, 1) // 다음 날 yyyy-mm-dd
 *   const inTwoWeeks = addDaysKst(today, 14)
 *   const kstHour = currentKstHour()       // 0-23 (KST 기준)
 *
 * 한국은 DST 없음 → 단순 +9h 산수 안전.
 */

/** 오늘 KST yyyy-mm-dd (UTC 자정 경계 후 9시간 보정). */
export function todayKstIsoDate(): string {
  const now = Date.now()
  const kst = new Date(now + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

/** ISO yyyy-mm-dd 에 days 일 추가. 음수로 빼기. */
export function addDaysKst(isoDate: string, days: number): string {
  // 입력은 KST 의미의 date string. UTC midnight 으로 계산하면 일 단위라 timezone
  // 무관 — 단 'T00:00:00Z' 로 명시해서 환경 default 영향 차단.
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** ISO yyyy-mm-dd 에 weeks 주 추가. */
export function addWeeksKst(isoDate: string, weeks: number): string {
  return addDaysKst(isoDate, weeks * 7)
}

/** ISO yyyy-mm-dd 에 months 개월 추가. 월말 보정: 31일 → 다음 달 말일. */
export function addMonthsKst(isoDate: string, months: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  // 원래 day 가 새 월에 존재하는지 확인 (예: 1/31 + 1month = 2/31 X → 2/28).
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate()
  d.setUTCDate(Math.min(day, lastDay))
  return d.toISOString().slice(0, 10)
}

/** 현재 KST hour (0-23). cron 내부 시간 비교에 사용. */
export function currentKstHour(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.getUTCHours()
}

/** 현재 KST millisecond timestamp (Date.now 의 KST 보정 변형). */
export function nowKstMs(): number {
  return Date.now() + 9 * 60 * 60 * 1000
}

/** 두 ISO date 의 일수 차이 (a - b). DST 없으므로 단순 차이. */
export function diffDaysKst(a: string, b: string): number {
  const dA = new Date(a + 'T00:00:00Z').getTime()
  const dB = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((dA - dB) / 86_400_000)
}
