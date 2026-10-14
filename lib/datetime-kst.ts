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

/**
 * timestamptz(UTC ISO) → **KST 달력 날짜** 'YYYY-MM-DD'.
 *
 * `iso.slice(0,10)` 로 자르면 UTC 날짜라 KST 00:00~09:00 사이 기록이 전날로
 * 밀린다("어제 실패한 건가?" 오판). 날짜 비교는 항상 이걸 거친다.
 * (lib/dashboard/streaks 의 kstDayKeyFromTs 와 같은 계산 — 여기가 정본이다.)
 */
export function kstDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
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

/**
 * `<input type="datetime-local">` 값("2026-11-02T10:00" — 오프셋 없음)을 **KST 시각**으로 읽는다.
 * 서버(UTC)에서 `new Date(v)` 는 로컬=UTC 로 읽어 9시간 늦어진다 — 프로모션 기간이 실제로
 * 그렇게 저장됐다(2026-09-26 출시 전 점검 6차: 17:11 입력 → 다음 날 02:11 KST 시작).
 * 오프셋·Z 가 이미 붙은 값은 그대로 파싱한다.
 */
export function parseKstLocalDateTime(v: string): Date {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/.exec(v.trim())
  if (m) return new Date(`${m[1]}T${m[2]}${m[3] ?? ':00'}+09:00`)
  return new Date(v)
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

/**
 * 숫자만 뽑는 포맷터(KST, 24시간). '오전/오후' 는 여기서 붙인다 —
 *
 * # 왜 (2026-10-09 앱 영수증 점검)
 * `toLocaleString('ko-KR', { hour: '2-digit' })` 의 오전/오후 글자는 실행 환경 ICU 가 정한다. 이 PC 의
 * Node(ICU 78)는 **"AM 07:00"** 을 냈다 — 서버에서 그리는 영수증·주문 상세에 영어가 섞인다. 브라우저는
 * "오전" 을 내서 같은 화면이 서버/클라이언트로 갈리기도 한다(위 KST_DATETIME_FMT 를 만든 이유와 같다).
 * hourCycle 'h23' — hour12:false 는 엔진에 따라 자정을 "24" 로 낸 적이 있다.
 */
const KST_NUM_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** ISO → KST { date: "2026. 09. 26.", time: "오전 07:00" } — 영수증·주문 상세(앱)의 한국어 날짜. 잘못된 값은 null. */
export function kstKoDateTimeParts(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = kstParts(KST_NUM_FMT, d)
  const h = Number(p.hour) % 24
  const h12 = h % 12 === 0 ? 12 : h % 12
  return {
    date: `${p.year}. ${p.month}. ${p.day}.`,
    time: `${h < 12 ? '오전' : '오후'} ${String(h12).padStart(2, '0')}:${p.minute}`,
  }
}

/** ISO → KST "2026. 09. 26. 오전 07:00". null/invalid → '-'. */
export function formatKstKoDateTime(iso: string | null | undefined): string {
  const p = kstKoDateTimeParts(iso)
  return p ? `${p.date} ${p.time}` : '-'
}

/** ISO timestamp → KST "yyyy.mm.dd". null/invalid → '-'. */
export function formatKstDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = kstParts(KST_DATE_FMT, d)
  return `${p.year}.${p.month}.${p.day}`
}

/**
 * ISO timestamp → KST "2026년 8월 6일". null/invalid → '-'.
 *
 * # 왜 필요한가 (2026-08-07 앱 화면 감사)
 * 동의 이력·알림 기기 목록이 `toLocaleDateString('ko-KR')` 을 옵션 없이 써서
 * **"2026. 8. 6."** 로 나왔다. 앱의 다른 화면은 전부 "2026년 8월 4일" /
 * "8월 4일 (화)" 라 그 두 화면만 시스템 기본 포맷처럼 튀었다.
 *
 * 옵션 없는 toLocaleDateString 은 **브라우저 로컬 시간대**도 함께 쓴다 —
 * 해외에서 접속하면 날짜가 하루 어긋난다. 여기선 KST 로 고정한다.
 */
export function formatKstLongDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const p = kstParts(KST_DATE_FMT, d)
  return `${p.year}년 ${Number(p.month)}월 ${Number(p.day)}일`
}

const WEEKDAY_KO_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] as const

/**
 * 고객에게 보내는 **월·일** — "12월 1일" · 요일을 붙이면 "12월 1일 화요일". 메일·푸시가 같이 쓰는 정본이다.
 *
 * # 왜 (2026-10-14 메일 점검 M2, 규칙237)
 * 서포터즈 가격 안내가 메일은 "12월 01일 화요일"(메일 템플릿이 0을 채운 자체 포맷), 같은 일을 알리는 푸시는 "12월 1일"
 * (크론 안 한 줄짜리 포맷)이라 한 사람이 받은 두 안내의 날짜 모양이 달랐다. 앱 화면도 전부 0을 안 붙인다.
 *
 * 입력은 'YYYY-MM-DD'(이미 KST 달력 날짜 — next_delivery_date 같은 칸) 또는 시각(ISO, KST 날짜로 바꿔 읽는다).
 * 읽을 수 없으면 빈 문자열.
 */
export function formatKoMonthDay(iso: string | null | undefined, opts?: { weekday?: boolean }): string {
  if (!iso) return ''
  let ymd = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : ''
  if (!ymd) {
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return ''
    ymd = kstDateOf(iso)
  }
  const month = Number(ymd.slice(5, 7))
  const day = Number(ymd.slice(8, 10))
  if (!month || !day) return ''
  const md = `${month}월 ${day}일`
  if (!opts?.weekday) return md
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay()
  return `${md} ${WEEKDAY_KO_FULL[dow]}`
}
