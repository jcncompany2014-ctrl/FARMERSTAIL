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
  nextChargeDateAfterSuccess,
  chargeTimingFor,
  chargeDateFor,
  onTimeChargeDeadline,
  describeUpcomingBox,
  paidBoxShipIso,
  leadDaysFor,
  shipWeekFor,
  resumeShipDate,
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

  it('월요일 주문 → 내일(화)이 아니라 다음 주 화요일', () => {
    // 그 주 박스는 이미 토·일에 조리가 끝났다(2026-10-01 일정 — 토·일 조리 → 월 포장 → 화 발송).
    assert.equal(nextShipDate(MON), '2026-07-21')
  })

  it('★금요일 신청 → 나흘 뒤 화요일 (마감 = 금요일 밤 — 토요일 조리 전에 확정돼야 한다)', () => {
    assert.equal(nextShipDate(FRI), '2026-07-21')
  })

  it('★토요일 신청 → 그 주 화요일이 아니라 다음 주 화요일 (조리가 이미 시작됐다)', () => {
    assert.equal(nextShipDate(SAT), '2026-07-28')
  })

  it('일요일 주문 → 다음 주 화요일 (옛 마감 일요일은 폐지 — 화요일 하루 조리 시절 값)', () => {
    assert.equal(nextShipDate(SUN), '2026-07-28')
  })

  it('화요일 주문 → 그 다음 주 화요일 (오늘 발송분은 이미 나감)', () => {
    assert.equal(nextShipDate(TUE), '2026-07-21')
  })

  it('수요일 주문 → 가장 가까운 다음 화요일 (6일 대기)', () => {
    assert.equal(nextShipDate(WED), '2026-07-21')
  })

  it('첫 박스 대기는 4~10일 (토요일 신청이 최악) · 일반 고객 결제일(토)은 언제나 신청일 다음 날 이후', () => {
    for (const d of [MON, TUE, WED, THU, FRI, SAT, SUN]) {
      const ship = nextShipDate(d)
      const gap =
        (new Date(ship + 'T00:00:00Z').getTime() -
          new Date(d + 'T00:00:00Z').getTime()) /
        86_400_000
      assert.ok(gap >= 4 && gap <= 10, `${d} → ${ship} 대기 ${gap}일`)
      // 조리 직전 결제일이 오늘이거나 지났으면 크론이 이미 돌았거나 조리가 시작된 뒤다.
      assert.ok(chargeDateFor(ship, 'before_cooking') > d, `${d} → 결제 ${chargeDateFor(ship, 'before_cooking')}`)
    }
  })
})

// ── 2026-10-02 사장님 "1기 서포터즈는 포함 아닌 거 아니었어?" — 체험 구간은 마감도 원래 방식(일요일) ──────────
describe('서포터즈 체험 구간 마감 = 일요일(원래 방식) · 일반 = 금요일 밤', () => {
  it('리드타임 — 서포터즈 2일(일요일)·일반 4일(금요일)', () => {
    assert.equal(leadDaysFor('ship_day'), 2)
    assert.equal(leadDaysFor('before_cooking'), 4)
  })
  it('★서포터즈는 토·일에 신청해도 그 주 화요일에 받는다', () => {
    assert.equal(nextShipDate(FRI, 'ship_day'), '2026-07-21')
    assert.equal(nextShipDate(SAT, 'ship_day'), '2026-07-21')
    assert.equal(nextShipDate(SUN, 'ship_day'), '2026-07-21')
    // 일반은 토·일 신청이면 다음 주(조리가 이미 시작됐다)
    assert.equal(nextShipDate(SAT, 'before_cooking'), '2026-07-28')
    assert.equal(nextShipDate(SUN, 'before_cooking'), '2026-07-28')
  })
  it('서포터즈도 월요일 신청은 다음 주(원래 방식의 마감은 일요일)', () => {
    assert.equal(nextShipDate(MON, 'ship_day'), '2026-07-21')
    assert.equal(nextShipDate('2026-07-20', 'ship_day'), '2026-07-28')
  })
  it('결제 시점을 안 넘기면 일반 마감(금요일) — 옛 호출부 무손상', () => {
    for (const d of [MON, TUE, WED, THU, FRI, SAT, SUN]) assert.equal(nextShipDate(d), nextShipDate(d, 'before_cooking'))
  })
  it('재개도 같은 마감을 쓴다', () => {
    assert.equal(resumeShipDate(null, SUN, 'ship_day'), '2026-07-21')
    assert.equal(resumeShipDate(null, SUN), '2026-07-28')
  })
  it('★주간 리듬 — 서포터즈는 마감 문구가 일요일 칸에, 결제 요일은 어디에도 없다', () => {
    const sup = shipWeekFor('ship_day')
    const fri = sup.find((d) => d.dow === 5)!
    const sun = sup.find((d) => d.dow === 0)!
    assert.doesNotMatch(fri.what, /신청/)
    assert.match(sun.what, /이날까지 신청하면 이번 화요일 발송/)
    for (const d of sup) assert.doesNotMatch(d.what, /결제/)
    assert.equal(shipWeekFor('before_cooking'), SHIP_WEEK)
  })
})

// ── 2026-10-01 일정 변경 — 토·일 조리 → 월 포장 → 화 발송, 결제는 고객마다 ─────────────────────
describe('결제 시점 — 일반은 토요일 조리 직전, 서포터즈 체험 구간은 발송일(화)', () => {
  it('체험 구간(100원·반값)이 남아 있으면 발송일 결제, 다 쓰면 조리 직전 결제', () => {
    assert.equal(chargeTimingFor({ cheap_remaining: 4, half_remaining: 4 }), 'ship_day')
    assert.equal(chargeTimingFor({ cheap_remaining: 0, half_remaining: 1 }), 'ship_day')
    assert.equal(chargeTimingFor({ cheap_remaining: 0, half_remaining: 0 }), 'before_cooking')
    assert.equal(chargeTimingFor(null), 'before_cooking')
    assert.equal(chargeTimingFor(undefined), 'before_cooking')
  })
  it('화요일 발송분의 결제일 — 일반은 토요일(3일 전), 서포터즈는 그 화요일', () => {
    assert.equal(chargeDateFor('2026-07-21', 'before_cooking'), SAT)
    assert.equal(weekdayKo(chargeDateFor('2026-07-21', 'before_cooking')), '토')
    assert.equal(chargeDateFor('2026-07-21', 'ship_day'), '2026-07-21')
  })
  it('제때 결제 마감 — 조리 직전 결제는 일요일(조리 둘째 날)까지, 발송일 결제는 그 화요일까지', () => {
    assert.equal(onTimeChargeDeadline('2026-07-21', 'before_cooking'), SUN)
    assert.equal(onTimeChargeDeadline('2026-07-21', 'ship_day'), '2026-07-21')
  })
  it('★조리 직전 결제: 토요일 성공 → 이번 화요일 발송, 다음 주기 = 화요일 + 14', () => {
    assert.equal(nextChargeDateAfterSuccess('2026-07-21', SAT, 'before_cooking'), '2026-08-04')
  })
  it('★토요일 실패 → 일요일 재시도 성공도 이번 화요일 박스(일요일 조리분)', () => {
    assert.equal(nextChargeDateAfterSuccess('2026-07-21', SUN, 'before_cooking'), '2026-08-04')
  })
  it('★토요일 실패 → 월요일 재시도 성공은 조리가 끝난 뒤 — 다음 주 화요일 발송, 그 +14 가 다음 주기', () => {
    // 월요일(07-20) 성공 → 07-28(화) 발송 → 다음 주기 08-11
    assert.equal(nextChargeDateAfterSuccess('2026-07-21', '2026-07-20', 'before_cooking'), '2026-08-11')
  })
  it('★화면용 박스 판정 — 토요일 결제 뒤(다음 주기로 밀린 날짜)에도 사흘 뒤 나갈 이번 박스를 말한다', () => {
    // 07-21(화) 발송분이 07-18(토)에 결제됨 → next_delivery_date = 08-04, 결제됨+발송대기 주문 있음
    assert.deepEqual(
      describeUpcomingBox({ nextDeliveryDate: '2026-08-04', timing: 'before_cooking', hasPaidPreparingOrder: true, today: SUN }),
      { kind: 'in_progress', shipIso: '2026-07-21' },
    )
  })
  // 결제 시각(UTC) — 크론은 KST 09:10 에 돈다.
  const SAT_0910 = '2026-07-18T00:10:00Z'
  const MON_0910 = '2026-07-20T00:10:00Z'
  const TUE_0910 = '2026-07-14T00:10:00Z'
  it('★결제된 박스 발송일 — 제때(토) 결제는 그 화요일, 결제 뒤 2주 미루기·해지에도 그대로', () => {
    assert.equal(paidBoxShipIso('2026-08-04', SAT_0910), '2026-07-21') // 크론이 민 그대로
    assert.equal(paidBoxShipIso('2026-08-18', SAT_0910), '2026-07-21') // 결제 뒤 '2주 미루기'(next +14)
    assert.equal(paidBoxShipIso(null, SAT_0910), '2026-07-21') // 결제 뒤 해지(next 지워짐)
  })
  it('★결제된 박스 발송일 — 월요일 늦은 성공은 다음 주 화요일(조리가 끝났다), 서포터즈 화요일 결제는 그날', () => {
    assert.equal(paidBoxShipIso('2026-08-11', MON_0910), '2026-07-28')
    assert.equal(paidBoxShipIso('2026-07-28', TUE_0910), '2026-07-14')
  })
  it('결제된 박스 발송일 — 결제일은 KST 로 센다(토요일 00:30 KST = 금요일 UTC)', () => {
    assert.equal(paidBoxShipIso('2026-08-04', '2026-07-17T15:30:00Z'), '2026-07-21')
  })
  it('★화면용 박스 판정 — paidAt 을 주면 결제 뒤 미루기에도 이번 박스를 2주 늦게 말하지 않는다', () => {
    const skipped = { nextDeliveryDate: '2026-08-18', timing: 'before_cooking' as const, hasPaidPreparingOrder: true, today: SUN }
    assert.deepEqual(describeUpcomingBox({ ...skipped, paidAt: SAT_0910 }), { kind: 'in_progress', shipIso: '2026-07-21' })
    // paidAt 없이는 옛 계산(next − 14)이라 08-04 로 틀린다 — 이 차이가 paidAt 을 넘기는 이유다.
    assert.deepEqual(describeUpcomingBox(skipped), { kind: 'in_progress', shipIso: '2026-08-04' })
  })
  it('★토요일 결제가 실패했는데 결제 증거가 없으면 "N일 후 발송"을 약속하지 않는다(결제 확인 중)', () => {
    assert.deepEqual(
      describeUpcomingBox({ nextDeliveryDate: '2026-07-21', timing: 'before_cooking', hasPaidPreparingOrder: false, today: SUN }),
      { kind: 'charge_check', shipIso: '2026-07-21', chargeIso: SAT },
    )
  })
  it('결제 전 — 일반은 토요일, 서포터즈는 화요일, 결제 시점을 모르면 결제일을 말하지 않는다', () => {
    const base = { nextDeliveryDate: '2026-07-21', hasPaidPreparingOrder: false, today: WED }
    assert.deepEqual(describeUpcomingBox({ ...base, timing: 'before_cooking' }), { kind: 'upcoming', shipIso: '2026-07-21', chargeIso: SAT })
    assert.deepEqual(describeUpcomingBox({ ...base, timing: 'ship_day' }), { kind: 'upcoming', shipIso: '2026-07-21', chargeIso: '2026-07-21' })
    assert.deepEqual(describeUpcomingBox({ ...base, timing: null }), { kind: 'upcoming', shipIso: '2026-07-21', chargeIso: null })
    assert.equal(describeUpcomingBox({ ...base, nextDeliveryDate: null, timing: 'before_cooking' }), null)
  })
  it('결제 시점을 안 넘기면 예전(발송일 결제)과 똑같이 동작한다', () => {
    assert.equal(nextChargeDateAfterSuccess(TUE, TUE), nextChargeDateAfterSuccess(TUE, TUE, 'ship_day'))
    // 07-14 발송분이 07-20(월)에 늦게 성공 → 07-28 발송 → 다음 주기 08-11 (옛 동작과 같다)
    assert.equal(nextChargeDateAfterSuccess(TUE, '2026-07-20'), '2026-08-11')
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

  it('★도착 요일은 약속하지 않는다 — 수요일은 위생 점검(사장님 2026-10-01 "수요일 도착이라는 말을 쓰지 말고")', () => {
    assert.equal(SHIP_WEEK.filter((d) => d.isArrive).length, 0)
    for (const d of SHIP_WEEK) assert.doesNotMatch(d.what, /도착/, `${d.ko}: ${d.what}`)
    assert.match(SHIP_WEEK.find((d) => d.dow === 3)!.what, /위생 점검/)
  })

  it('★주말 조리 일정 — 목 주문 · 금 입고 · 토·일 조리 · 월 포장 · 화 발송, 결제는 적지 않는다(고객마다 다르다)', () => {
    const by = (dow: number) => SHIP_WEEK.find((d) => d.dow === dow)!.what
    assert.match(by(4), /주문/)
    assert.match(by(5), /입고/)
    assert.match(by(6), /조리/)
    assert.match(by(0), /조리/)
    assert.match(by(1), /포장/)
    assert.match(by(2), /발송/)
    for (const d of SHIP_WEEK) assert.doesNotMatch(d.what, /결제/, `${d.ko}: ${d.what}`)
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

// ── 2026-09-28 점검 9차 — 늦은 성공·재개가 다음 청구를 앞당기지 않는다 ─────────────────────────
describe('nextChargeDateAfterSuccess — 늦게 성공하면 그 박스가 나가는 화요일 + 14', () => {
  it('예정일 당일 성공 → 예정일 + 14 (기존과 같음)', () => {
    assert.equal(nextChargeDateAfterSuccess(TUE, TUE), '2026-07-28')
  })
  it('★예정일(화) 실패 → 다음 주 월요일(T+13) 재시도 성공 → 다음 날 또 청구하지 않는다', () => {
    // 예전: 예정일+14 = 07-28(화) = 성공 다음 날 → 결제 2번·박스 1개
    const next = nextChargeDateAfterSuccess(TUE, '2026-07-27')
    assert.notEqual(next, '2026-07-28')
    // 월요일 성공분은 마감(일) 지나 다음 발송 화요일 08-04 에 나가고, 다음 청구는 그 +14
    assert.equal(next, '2026-08-18')
    assert.equal(weekdayKo(next), '화')
  })
  it('다음 날(수) 재시도 성공 → 다음 주 화요일 발송 + 14', () => {
    assert.equal(nextChargeDateAfterSuccess(TUE, WED), '2026-08-04')
  })
  it('크론 누락 따라잡기(화 예정 → 목 청구)도 화요일 정렬·미래', () => {
    const next = nextChargeDateAfterSuccess(TUE, THU)
    assert.equal(weekdayKo(next), '화')
    assert.ok(next > THU)
    assert.equal(next, '2026-08-04')
  })
  it('결과는 언제나 오늘 이후 · 화요일', () => {
    for (const today of [TUE, WED, THU, FRI, SAT, SUN, '2026-07-20', '2026-07-27', '2026-08-10']) {
      const n = nextChargeDateAfterSuccess(TUE, today)
      assert.ok(n > today, `${today} → ${n}`)
      assert.equal(weekdayOf(n), SHIP_WEEKDAY)
      // 늦은 성공이면 성공일로부터 최소 1주 이상 간격(한 주 안에 두 번 청구 금지)
      if (today > TUE) assert.ok(n >= nextShipDate(today), `${today} → ${n}`)
    }
  })
})

describe('resumeShipDate — 재개가 원래 배송일을 앞당기지 않는다', () => {
  it('★청구 직후 정지 → 곧바로 재개: 2주 뒤 원래 날짜 유지(예전엔 다음 화요일로 1주 앞당김)', () => {
    // 07-14(화) 청구 끝 → 다음 07-28. 수요일(07-15) 정지·재개
    assert.equal(resumeShipDate('2026-07-28', WED), '2026-07-28')
  })
  it('원래 날짜가 지났거나 없으면 다음 발송 화요일', () => {
    assert.equal(resumeShipDate('2026-07-14', '2026-07-20'), nextShipDate('2026-07-20'))
    assert.equal(resumeShipDate(null, WED), nextShipDate(WED))
    assert.equal(resumeShipDate(undefined, WED), nextShipDate(WED))
  })
  it('마감이 지난 원래 날짜(내일 화요일, 월요일 재개)는 다음 주로 — 뒤로만 민다', () => {
    assert.equal(resumeShipDate(TUE, MON), nextShipDate(MON))
  })
  it('화요일이 아닌 옛 날짜는 다음 발송 화요일로 스냅', () => {
    assert.equal(resumeShipDate('2026-07-30', WED), nextShipDate(WED))
  })
})
