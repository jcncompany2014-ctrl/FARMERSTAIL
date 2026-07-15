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

// addMonthsKst 제거 (2026-07-16) — 옛 '4주치=캘린더 월' 배송 분기 전용이었다.
// 배송 주기가 2주 하나로 고정되면서(박스가 14일치) 소비처가 0이 됐다. 월 단위 날짜
// 계산이 다시 필요해지면 그때 되살릴 것 — 지금 남겨두면 월 배송을 되살리는 씨앗이 된다.

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

// ── 표시용 포맷터 ──
// 서버(Vercel)는 UTC 라 new Date(iso).getHours() 등 raw getter 로 포맷하면
// 9시간 어긋난다. 아래 포맷터는 timeZone:'Asia/Seoul' 을 명시해 서버/브라우저
// 어디서든 KST 로 일관 표시. admin 표/상세의 날짜·시각 표시에 사용.

const KST_DATETIME_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const KST_DATE_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function kstParts(fmt: Intl.DateTimeFormat, d: Date): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value
  return out
}

/** ISO timestamp → KST "yyyy.mm.dd HH:mm". null/invalid → '-'. */
export function formatKstDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = kstParts(KST_DATETIME_FMT, d)
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`
}

/** ISO timestamp → KST "mm.dd HH:mm" (연도 생략, 컴팩트 표용). null/invalid → '-'. */
export function formatKstShortDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = kstParts(KST_DATETIME_FMT, d)
  return `${p.month}.${p.day} ${p.hour}:${p.minute}`
}

/** ISO timestamp → KST "yyyy.mm.dd". null/invalid → '-'. */
export function formatKstDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = kstParts(KST_DATE_FMT, d)
  return `${p.year}.${p.month}.${p.day}`
}
