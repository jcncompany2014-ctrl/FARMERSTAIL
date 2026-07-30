/**
 * 크론 워치독 — "돌았어야 하는데 기록이 없는 자동작업" 판정 (2026-07-29).
 *
 * # 왜
 * 최종감사 실측: Vercel 이 크론을 조용히 거른다 — 청구 크론이 30일 중 25일만
 * 실행됐고, 화요일(발송일) 결손도 실제로 있었다(07-07). 코드로 실행률 자체는
 * 못 고치므로, **안 돈 걸 다음날 아침에 알게 만드는 것**이 현실적인 방어다.
 * 조용히 안 도는 게 제일 위험하다 — 결제·배송이 멈춰도 몇 주를 모른다.
 *
 * # 어떻게
 * vercel.json 의 crons 배열(스케줄 정본)을 기준으로, 주어진 시간창 안에서
 * 실행됐어야 하는 시각들을 계산하고 cron_health 기록과 대조한다.
 * 소비자는 daily-briefing — 아침 푸시에 "어제 안 돈 자동작업" 줄이 붙는다.
 *
 * # 파서 범위
 * 이 리포의 스케줄 형태만 지원한다: 분 = 고정 숫자, 시 = 고정 숫자 또는 '*'
 * (매시간), 일·월·요일 = '*' · 고정 숫자 · 콤마 목록.
 * 예: "0 0 * * *" · "0 9 * * 2" · "0 0 1 1,4,7,10 *" · "30 * * * *"(매시간).
 * 범위(1-5)·간격(*\/2)은 이 리포에 없으므로 **의도적으로 미지원** —
 * 만나면 null 을 돌려주고 워치독이 그 크론을 건너뛴다(오탐보다 낫다).
 * vercel.json 에 새 형태를 쓰면 lib/cron-watchdog.test.ts 가 알려준다.
 */

export type CronEntry = { path: string; schedule: string }

type ParsedSchedule = {
  minute: number
  hour: number | null // null = * (매시간)
  dayOfMonth: number[] | null // null = *
  month: number[] | null // 콤마 목록 지원 (분기 리포트 "1,4,7,10")
  dayOfWeek: number[] | null // 0=일 … 6=토 (UTC 기준 — Vercel cron 은 UTC)
}

/** "0 19 * * *" → 구조체. 지원 밖 형태면 null. */
export function parseSchedule(schedule: string): ParsedSchedule | null {
  const parts = schedule.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [min, hour, dom, mon, dow] = parts as [string, string, string, string, string]
  const single = (s: string): number | undefined =>
    /^\d+$/.test(s) ? parseInt(s, 10) : undefined
  const list = (s: string): number[] | null | undefined => {
    if (s === '*') return null
    if (/^\d+(,\d+)*$/.test(s)) return s.split(',').map((x) => parseInt(x, 10))
    return undefined // 지원 밖 (범위·간격)
  }
  const m = single(min)
  // 시는 고정 숫자 또는 '*'(매시간). 분은 고정 숫자만 — 분단위 크론은 없다.
  const h = hour === '*' ? null : single(hour)
  const d = list(dom)
  const mo = list(mon)
  const w = list(dow)
  if (m === undefined || h === undefined) return null
  if (d === undefined || mo === undefined || w === undefined) return null
  return { minute: m, hour: h, dayOfMonth: d, month: mo, dayOfWeek: w }
}

/**
 * [startUtc, endUtc) 창 안에서 이 스케줄이 실행됐어야 하는 UTC 시각들.
 * 창은 최대 8일로 제한(무한 루프 방지 — 워치독은 하루 창만 쓴다).
 */
export function expectedRunsInWindow(
  schedule: string,
  startUtc: Date,
  endUtc: Date,
): Date[] {
  const parsed = parseSchedule(schedule)
  if (!parsed) return []
  const runs: Date[] = []
  const limit = new Date(
    Math.min(endUtc.getTime(), startUtc.getTime() + 8 * 24 * 3600 * 1000),
  )
  // 창 시작일 00:00 UTC 부터 하루씩 — 각 날짜의 (hour:minute) 인스턴트를 검사
  const cursor = new Date(
    Date.UTC(
      startUtc.getUTCFullYear(),
      startUtc.getUTCMonth(),
      startUtc.getUTCDate(),
    ),
  )
  // 시가 '*' 면 그 날의 0~23시 전부가 후보다(매시간 크론).
  const hours = parsed.hour === null ? [...Array(24).keys()] : [parsed.hour]
  while (cursor < limit) {
    for (const hh of hours) {
      const instant = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
          hh,
          parsed.minute,
        ),
      )
      const domOk =
        parsed.dayOfMonth === null || parsed.dayOfMonth.includes(instant.getUTCDate())
      const monOk =
        parsed.month === null || parsed.month.includes(instant.getUTCMonth() + 1)
      const dowOk =
        parsed.dayOfWeek === null || parsed.dayOfWeek.includes(instant.getUTCDay())
      if (domOk && monOk && dowOk && instant >= startUtc && instant < limit) {
        runs.push(instant)
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return runs
}

/** cron_health 기록 한 줄 (판정에 필요한 최소 필드). */
export type HealthRecord = { path: string; executed_at: string }

/**
 * 실행 지터 허용치. Vercel Hobby/Pro 크론은 예약 대비 수십 분 밀리는 게
 * 정상 동작으로 관측됐다(+7~49분 실측) — 3시간까지는 "돌았다"로 본다.
 */
export const RUN_GRACE_MS = 3 * 60 * 60 * 1000

/**
 * 창 안에서 "돌았어야 했는데 기록이 없는" 크론 이름 목록.
 *
 * @param crons vercel.json 의 crons (path 는 /api/cron/이름)
 * @param records 창+지터 범위의 cron_health 행들
 * @returns path 끝 세그먼트(크론 이름) 배열 — 중복 없음, 등장 순서 유지
 */
export function findMissedCrons(
  crons: CronEntry[],
  records: HealthRecord[],
  startUtc: Date,
  endUtc: Date,
): string[] {
  // path 별 실행 시각 목록 (cron_health.path 는 이름만 저장됨)
  const ranAt = new Map<string, number[]>()
  for (const r of records) {
    const t = new Date(r.executed_at).getTime()
    const list = ranAt.get(r.path) ?? []
    list.push(t)
    ranAt.set(r.path, list)
  }
  const missed: string[] = []
  for (const cron of crons) {
    const name = cron.path.replace(/\/+$/, '').split('/').pop() ?? cron.path
    const expected = expectedRunsInWindow(cron.schedule, startUtc, endUtc)
    if (expected.length === 0) continue // 지원 밖 스케줄 or 창에 예정 없음
    const times = ranAt.get(name) ?? []
    const allRan = expected.every((inst) =>
      times.some(
        (t) => t >= inst.getTime() - 15 * 60 * 1000 && t <= inst.getTime() + RUN_GRACE_MS,
      ),
    )
    if (!allRan && !missed.includes(name)) missed.push(name)
  }
  return missed
}
