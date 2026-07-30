import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  parseSchedule,
  expectedRunsInWindow,
  findMissedCrons,
  type CronEntry,
} from './cron-watchdog.ts'

/**
 * 크론 워치독 (2026-07-29) — "조용히 안 도는 크론"을 다음날 아침에 알게 하는
 * 장치. 실측 근거: 청구 크론 30일 중 25일 실행, 화요일(발송일) 결손 실재.
 */

test('parseSchedule — 이 리포의 실제 형태들', () => {
  assert.deepEqual(parseSchedule('0 19 * * *'), {
    minute: 0, hour: 19, dayOfMonth: null, month: null, dayOfWeek: null,
  })
  assert.deepEqual(parseSchedule('0 9 * * 2'), {
    minute: 0, hour: 9, dayOfMonth: null, month: null, dayOfWeek: [2],
  })
  assert.deepEqual(parseSchedule('0 5 1 * *'), {
    minute: 0, hour: 5, dayOfMonth: [1], month: null, dayOfWeek: null,
  })
  // 분기 리포트 실물 형태 — 콤마 목록
  assert.deepEqual(parseSchedule('0 0 1 1,4,7,10 *'), {
    minute: 0, hour: 0, dayOfMonth: [1], month: [1, 4, 7, 10], dayOfWeek: null,
  })
  // 매시간 — 환불 재시도가 이 형태(결제 감사 #6 로 하루1회→매시간 변경)
  assert.deepEqual(parseSchedule('30 * * * *'), {
    minute: 30, hour: null, dayOfMonth: null, month: null, dayOfWeek: null,
  })
  // 지원 밖 형태는 null — 워치독이 건너뛴다(오탐 방지)
  assert.equal(parseSchedule('*/5 * * * *'), null)
  assert.equal(parseSchedule('0 1-5 * * *'), null)
  assert.equal(parseSchedule('0 0 * *'), null)
})

test('★ vercel.json 의 모든 크론 스케줄을 파서가 이해한다', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    crons: CronEntry[]
  }
  const unsupported = cfg.crons.filter((c) => parseSchedule(c.schedule) === null)
  assert.deepEqual(
    unsupported.map((c) => `${c.path} (${c.schedule})`),
    [],
    '파서가 못 읽는 스케줄 — 그 크론은 워치독 감시에서 빠진다. ' +
      'lib/cron-watchdog.ts 파서를 확장하거나 스케줄을 단순 형태로.',
  )
})

test('expectedRunsInWindow — 매일 크론은 창 안의 그 시각들', () => {
  const runs = expectedRunsInWindow(
    '0 19 * * *',
    new Date('2026-07-27T00:00:00Z'),
    new Date('2026-07-29T00:00:00Z'),
  )
  assert.deepEqual(
    runs.map((d) => d.toISOString()),
    ['2026-07-27T19:00:00.000Z', '2026-07-28T19:00:00.000Z'],
  )
})

test('expectedRunsInWindow — 주간(화요일) 크론은 그 요일만', () => {
  // 2026-07-28 은 화요일 (UTC)
  const runs = expectedRunsInWindow(
    '0 9 * * 2',
    new Date('2026-07-26T00:00:00Z'),
    new Date('2026-08-02T00:00:00Z'),
  )
  assert.deepEqual(runs.map((d) => d.toISOString()), ['2026-07-28T09:00:00.000Z'])
})

const CRONS: CronEntry[] = [
  { path: '/api/cron/subscription-charge', schedule: '0 19 * * *' },
  { path: '/api/cron/daily-briefing', schedule: '0 0 * * *' },
]

test('★ 재현 케이스: 청구 크론이 하루 안 돌면 잡힌다', () => {
  const start = new Date('2026-07-27T12:00:00Z')
  const end = new Date('2026-07-28T12:00:00Z')
  // 창 안 예정: charge 07-27T19:00, briefing 07-28T00:00
  const missed = findMissedCrons(
    CRONS,
    [{ path: 'daily-briefing', executed_at: '2026-07-28T00:31:00Z' }], // 지터 +31분
    start,
    end,
  )
  assert.deepEqual(missed, ['subscription-charge'])
})

test('지터(+49분 실측)까지는 정상 실행으로 본다', () => {
  const missed = findMissedCrons(
    CRONS,
    [
      { path: 'subscription-charge', executed_at: '2026-07-27T19:49:00Z' },
      { path: 'daily-briefing', executed_at: '2026-07-28T02:59:00Z' }, // +3h 직전
    ],
    new Date('2026-07-27T12:00:00Z'),
    new Date('2026-07-28T12:00:00Z'),
  )
  assert.deepEqual(missed, [])
})

test('지터 한도(3시간)를 넘긴 기록은 실행으로 안 쳐준다', () => {
  const missed = findMissedCrons(
    CRONS,
    [{ path: 'subscription-charge', executed_at: '2026-07-27T23:30:00Z' }], // +4.5h
    new Date('2026-07-27T12:00:00Z'),
    new Date('2026-07-28T00:00:00Z'), // briefing 은 창 밖
    )
  assert.deepEqual(missed, ['subscription-charge'])
})

test('창에 예정이 없는 크론(주간·월간)은 조용하다', () => {
  const weekly: CronEntry[] = [
    { path: '/api/cron/protein-rotation', schedule: '0 4 * * 1' }, // 월요일
  ]
  // 수요일 하루 창 — 예정 없음
  const missed = findMissedCrons(
    weekly,
    [],
    new Date('2026-07-29T00:00:00Z'),
    new Date('2026-07-30T00:00:00Z'),
  )
  assert.deepEqual(missed, [])
})

test('매시간 크론은 창 안의 매 시각이 예정으로 잡힌다', () => {
  const runs = expectedRunsInWindow(
    '30 * * * *',
    new Date('2026-07-28T00:00:00Z'),
    new Date('2026-07-28T05:00:00Z'),
  )
  assert.deepEqual(
    runs.map((d) => d.toISOString().slice(11, 16)),
    ['00:30', '01:30', '02:30', '03:30', '04:30'],
  )
})
