/**
 * shipping-schedule 단위 테스트 — 발송은 화요일 하루.
 *
 * 핵심 회귀 방지:
 *  1. 어느 날 주문해도 배송일은 **항상 화요일**. (화면이 "매주 화요일"이라고
 *     쓰는데 스케줄러가 다른 날을 잡으면 그 자체로 거짓말)
 *  2. 조리 리드타임 — 월요일에 주문해도 '내일(화)' 발송으로 잡지 않는다.
 *  3. 2주 뒤도 화요일이 유지된다 (14일 = 정확히 2주).
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  nextCycleDateAligned,
  nextShipDate,
  nextCycleDate,
  weekdayOf,
  weekdayKo,
  SHIP_WEEKDAY,
  SHIP_WEEK,
} from './shipping-schedule.ts'

// 2026-07-13 = 월요일 (기준 앵커). 이하 요일 검증은 weekdayOf 로 교차확인.
const MON = '2026-07-13'
const TUE = '2026-07-14'
const WED = '2026-07-15'
const THU = '2026-07-16'
const FRI = '2026-07-17'
const SAT = '2026-07-18'
const SUN = '2026-07-19'

describe('앵커 날짜 요일 검증 (테스트 자체의 전제)', () => {
  it('요일 매핑이 맞다', () => {
    assert.equal(weekdayKo(MON), '월')
    assert.equal(weekdayKo(TUE), '화')
    assert.equal(weekdayKo(WED), '수')
    assert.equal(weekdayKo(SUN), '일')
    assert.equal(weekdayOf(TUE), SHIP_WEEKDAY)
  })
})

describe('nextShipDate — 언제 주문하든 화요일', () => {
  it('어느 요일에 주문해도 결과는 화요일', () => {
    for (const d of [MON, TUE, WED, THU, FRI, SAT, SUN]) {
      const ship = nextShipDate(d)
      assert.equal(
        weekdayOf(ship),
        SHIP_WEEKDAY,
        `${d}(${weekdayKo(d)}) → ${ship}(${weekdayKo(ship)}) 가 화요일이 아님`,
      )
    }
  })

  it('월요일 주문 → 내일(화)이 아니라 다음 주 화요일 (마감은 일요일)', () => {
    // 월요일에 그 주 주문을 확정해 원료를 받는다 → 월요일 주문은 못 태운다.
    // 가장 오래 기다리는 경우(8일)라 여기서 못박아 둔다.
    assert.equal(nextShipDate(MON), '2026-07-21')
  })

  it('일요일 주문 → 이틀 뒤 화요일 (마감 직전에 턱걸이)', () => {
    assert.equal(nextShipDate(SUN), '2026-07-21')
  })

  it('화요일 주문 → 그 다음 주 화요일 (오늘 발송분은 이미 나감)', () => {
    assert.equal(nextShipDate(TUE), '2026-07-21')
  })

  it('수요일 주문 → 가장 가까운 다음 화요일 (6일 대기)', () => {
    assert.equal(nextShipDate(WED), '2026-07-21')
  })

  it('첫 박스 대기는 최대 8일 (월요일 주문이 최악)', () => {
    for (const d of [MON, TUE, WED, THU, FRI, SAT, SUN]) {
      const ship = nextShipDate(d)
      const gap =
        (new Date(ship + 'T00:00:00Z').getTime() -
          new Date(d + 'T00:00:00Z').getTime()) /
        86_400_000
      assert.ok(gap >= 2 && gap <= 8, `${d} → ${ship} 대기 ${gap}일`)
    }
  })
})

describe('nextCycleDate — 2주 뒤도 화요일', () => {
  it('화요일 + 2주 = 화요일', () => {
    const first = nextShipDate(WED)
    let cur = first
    for (let i = 0; i < 12; i++) {
      cur = nextCycleDate(cur)
      assert.equal(
        weekdayOf(cur),
        SHIP_WEEKDAY,
        `${i + 1}번째 배송 ${cur}(${weekdayKo(cur)}) 이 화요일 아님`,
      )
    }
  })

  it('정확히 14일 뒤', () => {
    assert.equal(nextCycleDate('2026-07-21'), '2026-08-04')
  })

  it('월 경계를 넘어도 화요일 유지', () => {
    assert.equal(weekdayKo(nextCycleDate('2026-07-28')), '화')
  })
})

describe('SHIP_WEEK — 주간 리듬 문구', () => {
  it('7일 전부 있다', () => {
    assert.equal(SHIP_WEEK.length, 7)
    assert.deepEqual(
      SHIP_WEEK.map((d) => d.dow).sort((a, b) => a - b),
      [0, 1, 2, 3, 4, 5, 6],
    )
  })

  it('발송일은 화요일 하나뿐', () => {
    const ship = SHIP_WEEK.filter((d) => d.isShip)
    assert.equal(ship.length, 1)
    assert.equal(ship[0]!.dow, SHIP_WEEKDAY)
  })

  it('도착은 발송 다음 날(수)', () => {
    const arrive = SHIP_WEEK.filter((d) => d.isArrive)
    assert.equal(arrive.length, 1)
    assert.equal(arrive[0]!.dow, SHIP_WEEKDAY + 1)
  })

  it('모든 날에 무슨 일을 하는지 적혀 있다', () => {
    for (const d of SHIP_WEEK) assert.ok(d.what.length > 0, `${d.ko} 비어 있음`)
  })
})

// ── 최종감사 #3 (2026-07-29): 크론이 밀려도 화요일 정렬이 살아남는가 ──
it('nextCycleDateAligned — 제때(화요일) 청구면 기존과 동일하게 +14 화요일', () => {
  // 2026-07-07 은 화요일
  assert.equal(nextCycleDateAligned('2026-07-07', '2026-07-07'), '2026-07-21')
  assert.equal(weekdayKo('2026-07-21'), '화')
})

it('★ 크론이 이틀 밀려 목요일에 청구돼도 다음 배송일은 화요일', () => {
  // 예정일 07-07(화), 실제 실행 07-09(목) — 실측된 결손 패턴
  const next = nextCycleDateAligned('2026-07-07', '2026-07-09')
  assert.equal(next, '2026-07-21')
  assert.equal(weekdayKo(next), '화')
})

it('★ 이미 이탈한(비화요일) 예정일도 화요일로 자가치유된다', () => {
  // 과거 버그·수동 입력으로 목요일(07-09)이 박혀 있던 구독
  const next = nextCycleDateAligned('2026-07-09', '2026-07-09')
  assert.equal(weekdayKo(next), '화')
  assert.equal(next, '2026-07-28') // 07-14 스냅 + 14
})

it('★ 여러 주 밀렸어도 결과는 반드시 미래 — 다음날 재청구 루프 방지', () => {
  // 예정일이 3주 전인데 오늘에서야 청구되는 극단 케이스
  const next = nextCycleDateAligned('2026-07-07', '2026-07-27')
  assert.ok(next > '2026-07-27', `미래여야 함: ${next}`)
  assert.equal(weekdayKo(next), '화')
})
