/**
 * 배송 스케줄 — **발송은 화요일 하루** (사장님 확정 2026-07-15).
 *
 * # 왜 하루만 보내나 (고객에게 그대로 말하는 이유)
 * 강아지마다 맞춤 용량으로 만들다 보니 한 번에 많이 만들어두지 않는다. 그래서
 * 발송을 한 날로 모아 그 주에 쓸 원료만 받고, 주말(토·일)에 만들어 월요일에 포장하고
 * 화요일에 보낸다(2026-10-01 — 예전엔 화요일 하루에 조리·포장·발송을 다 했다).
 * 결제 시점은 고객마다 다르다: 일반 = 토요일 조리 직전, 서포터즈 체험 구간 = 화요일(chargeDateFor).
 *
 * # 왜 화요일인가 (내부 근거)
 *  · 화 발송 → 수 도착. 금요일 발송이면 토요일 도착이 밀렸을 때 신선식품이
 *    물류창고에서 주말을 난다. 화요일은 그 위험이 없다.
 *  · 배송 주기가 2주(=정확히 14일)라 한 번 화요일이면 다음도 무조건 화요일.
 *    첫 배송만 화요일로 맞추면 이후는 저절로 정렬된다.
 *
 * # 한계 (알고 가는 것)
 * 마감(일요일) 직후인 월요일에 주문하면 첫 박스를 8일 기다린다 — 가장 나쁜
 * 경우. 물량이 늘면 ① LEAD_DAYS 를 1로 낮춰 최대 7일, ② 목요일을 여는 순서
 * (화 발송→수 도착 / 목 발송→금 도착, 둘 다 주말 회피)로 확장한다.
 *
 * ⚠️ 이 파일이 문구와 실제 배송일의 **단일 진실**이다. "매주 화요일 발송"이라고
 *    써놓고 스케줄러가 다른 날을 잡으면 그 자체로 거짓말이 되므로, 화면 카피와
 *    billing-issue 의 next_delivery_date 가 반드시 여기서 나와야 한다.
 */
import { addDaysKst, kstDateOf, todayKstIsoDate } from './datetime-kst.ts'

/** 발송 요일 — 화요일. JS getUTCDay(): 0=일 … 2=화. */
export const SHIP_WEEKDAY = 2

/**
 * 주문 마감 리드타임(일). 4 = **금요일까지 신청하면 다음 화요일 발송**.
 *
 * ★2026-10-01 일정 변경(사장님 "상식적으로 하루 만에 다 만들고 발송하는 게 말이 안 돼"):
 *   예전엔 화요일 하루에 조리·포장·발송을 다 했다(마감 일요일, LEAD 2). 이제 **토·일 조리 →
 *   월 포장 → 화 발송**이다. 토요일 조리 시작 전에 그 박스가 확정돼야 하므로 마감은 금요일 밤.
 *   (일반 고객은 토요일 아침 조리 직전에 결제된다 — 아래 chargeDateFor.)
 *
 * 대가: 토요일 신청은 첫 박스를 10일 기다린다(가장 나쁜 경우).
 */
const LEAD_DAYS = 4

/**
 * ★서포터즈(1기) 체험 구간의 마감 — **원래 방식 그대로 일요일**(발송 이틀 전, 옛 LEAD 2).
 *
 * 사장님 2026-10-02: "여태 우리가 만든 규칙에 이번 1기 서포터즈는 포함 아닌 거 아니었어?" — 체험 구간(100원·반값)
 * 동안은 결제(발송일 화요일)만이 아니라 **신청 마감도 옛 규칙**이다. 정상가로 넘어가면(before_cooking) 금요일 밤.
 * 판정은 결제 시점과 같은 chargeTimingFor(체험 회차가 남았는가) — 두 규칙이 같은 사람에게 같이 적용된다.
 */
const LEAD_DAYS_SUPPORTER = 2

/** 결제 시점별 신청 마감 리드타임 — 일반 4(금요일 밤) · 서포터즈 체험 구간 2(일요일). */
export function leadDaysFor(timing: ChargeTiming): number {
  return timing === 'ship_day' ? LEAD_DAYS_SUPPORTER : LEAD_DAYS
}

/**
 * 결제 시점 — 발송일은 모두 화요일이고, **언제 결제하느냐**만 다르다(2026-10-01 사장님).
 *  · before_cooking — 발송 3일 전 **토요일 아침, 조리 직전**. 일반 고객의 기본.
 *    사장님 선택("조리 직전"): 마감을 가장 늦게(금요일 밤) 둘 수 있다. 대가로 결제가 실패한
 *    박스의 원료는 이미 들어와 있다.
 *  · ship_day — **발송일(화) 아침**. 서포터즈가 100원·반값 구간에 있는 동안만(원래 약속한 방식).
 *    정상가 결제부터는 before_cooking 으로 넘어간다 — 그 전까지 서포터즈에게 이 변경을 알리지
 *    않는다(사장님 "그때까지 아무 알림도 띄우지 마").
 */
export type ChargeTiming = 'before_cooking' | 'ship_day'

/** 조리 직전 결제 = 발송(화) 3일 전 토요일. */
export const CHARGE_BEFORE_SHIP_DAYS = 3

/** 체험 구간(100원·반값)이 남아 있으면 발송일 결제, 아니면 조리 직전 결제. 판정 정본. */
export function chargeTimingFor(
  trial: { cheap_remaining: number; half_remaining: number } | null | undefined,
): ChargeTiming {
  return trial && (trial.cheap_remaining > 0 || trial.half_remaining > 0) ? 'ship_day' : 'before_cooking'
}

/** 발송일(화)의 박스를 **언제 결제하는가**. 화면의 '결제 예정'·사전 고지·청구 크론이 모두 이걸 쓴다. */
export function chargeDateFor(shipIso: string, timing: ChargeTiming): string {
  return timing === 'ship_day' ? shipIso : addDaysKst(shipIso, -CHARGE_BEFORE_SHIP_DAYS)
}

/**
 * 화면용 — 지금 고객에게 말할 '박스' 하나를 정한다(2026-10-01). 홈·강아지 카드·정기배송 화면·마이페이지가
 * 같은 판정을 쓴다(화면마다 따로 계산하면 또 갈린다).
 *
 * 왜 필요한가: 결제가 성공하면 청구 크론이 next_delivery_date 를 **다음 주기**(+14)로 민다. 결제일 = 발송일이던
 * 시절엔 몇 시간이었지만, 이제 일반 고객은 토요일에 결제되고 화요일에 나가므로 **토~화 사흘 반** 동안
 * next_delivery_date 가 다음 주기를 가리킨다. 그대로 쓰면 사흘 뒤 나갈 박스를 두고 "D-17 발송"이라고 말한다.
 *  · in_progress — 결제됐고 아직 안 나간 박스(결제됨 + 발송 대기 주문)가 있다 → 그 박스의 발송일(다음 주기 − 14).
 *  · charge_check — 결제일 청구 시각이 지났는데 결제 증거가 없다 → 날짜를 약속하지 않고 '결제 확인 중'.
 *  · upcoming — 아직 결제 전. chargeIso = 결제일(결제 시점을 모르면 null — 서포터즈에게 토요일을 단정하지 않는다).
 * hasPaidPreparingOrder 를 모르면(조회 실패) false 로 넘긴다 — 그때는 다음 주기를 말하게 되지만 거짓 결제일은 없다.
 */
export type UpcomingBox =
  | { kind: 'in_progress'; shipIso: string }
  | { kind: 'charge_check'; shipIso: string; chargeIso: string }
  | { kind: 'upcoming'; shipIso: string; chargeIso: string | null }

export function describeUpcomingBox(i: {
  nextDeliveryDate: string | null
  timing: ChargeTiming | null
  hasPaidPreparingOrder: boolean
  /** 그 결제된 박스 주문의 paid_at — 주면 결제 뒤 미루기에도 이번 박스 발송일이 맞다(paidBoxShipIso). */
  paidAt?: string | null
  /** KST yyyy-mm-dd */
  today: string
}): UpcomingBox | null {
  if (!i.nextDeliveryDate) return null
  if (i.hasPaidPreparingOrder) {
    return {
      kind: 'in_progress',
      shipIso: i.paidAt ? paidBoxShipIso(i.nextDeliveryDate, i.paidAt) : addDaysKst(i.nextDeliveryDate, -14),
    }
  }
  const chargeIso = i.timing ? chargeDateFor(i.nextDeliveryDate, i.timing) : null
  if (chargeIso && chargeIso < i.today) return { kind: 'charge_check', shipIso: i.nextDeliveryDate, chargeIso }
  return { kind: 'upcoming', shipIso: i.nextDeliveryDate, chargeIso }
}

/**
 * 결제됐고 아직 안 나간 박스의 **발송일(화)** — 화면·어드민·아침 브리핑 공통 정본(2026-10-02).
 *
 * 청구 크론은 결제 성공 시 next_delivery_date 를 '그 박스가 나가는 화요일 + 14'로 민다 → 보통 발송일 = next − 14.
 * 그런데 그 칸은 고객이 바꿀 수 있다 — 토요일에 결제된 뒤 '2주 미루기'를 누르면 next 가 +14 더 밀리고, next − 14 는
 * 이미 결제된 이번 박스를 2주 늦게 나가는 것처럼 말한다(실제로는 그대로 나간다 — 사장님 "그대로 발송").
 * 그래서 결제일 기준 첫 화요일(B)과 맞춰 본다: 제때 결제는 B, 늦은 성공(월요일 이후)은 B+7 이다.
 * next − 14 가 그 범위 [B, B+7] 안이면 그것, 밖이면(결제 뒤 미루기·해지로 next 가 비거나 움직임) B.
 * B 쪽으로 떨어지는 건 일부러다 — 어드민 '발송일 지난 미발송' 경보가 늦게 울리지 않는 쪽.
 */
export function paidBoxShipIso(nextDeliveryDate: string | null, paidAtIso: string): string {
  const paidDay = kstDateOf(paidAtIso)
  const firstShip = addDaysKst(paidDay, (SHIP_WEEKDAY - weekdayOf(paidDay) + 7) % 7)
  const bumped = nextDeliveryDate ? addDaysKst(nextDeliveryDate, -14) : null
  if (bumped && bumped >= firstShip && bumped <= addDaysKst(firstShip, 7)) return bumped
  return firstShip
}

/**
 * 이 발송분 박스로 **제때** 결제됐다고 볼 마지막 날. 이 날까지 성공하면 그 화요일에 나가고, 넘기면
 * 다음 발송 화요일로 밀린다. 조리 직전 결제는 조리 둘째 날(일요일)까지 — 토요일 결제가 실패해
 * 일요일 재시도로 성공한 박스는 일요일 조리분에 넣는다. 월요일 성공은 이미 조리가 끝났다.
 */
export function onTimeChargeDeadline(shipIso: string, timing: ChargeTiming): string {
  return timing === 'ship_day' ? shipIso : addDaysKst(shipIso, -(CHARGE_BEFORE_SHIP_DAYS - 1))
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

/** ISO yyyy-mm-dd 의 요일 (0=일 … 6=토). */
export function weekdayOf(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00Z').getUTCDay()
}

/** ISO yyyy-mm-dd → '화' 같은 한글 요일. */
export function weekdayKo(isoDate: string): string {
  return WEEKDAY_KO[weekdayOf(isoDate)]!
}

/**
 * fromIso(기본 오늘) 이후 가장 가까운 **발송 가능한 화요일**.
 * 마감을 지난 주문은 그다음 주 화요일로 넘어간다. 마감은 결제 시점별(leadDaysFor) — 일반 금요일 밤,
 * 서포터즈 체험 구간 일요일. timing 을 안 넘기면 일반(금요일).
 */
export function nextShipDate(
  fromIso: string = todayKstIsoDate(),
  timing: ChargeTiming = 'before_cooking',
): string {
  // 리드타임을 먼저 더한 뒤, 그 날짜 이상인 첫 화요일을 찾는다.
  const earliest = addDaysKst(fromIso, leadDaysFor(timing))
  const gap = (SHIP_WEEKDAY - weekdayOf(earliest) + 7) % 7
  return addDaysKst(earliest, gap)
}

/**
 * 일시정지 → **재개**할 때의 다음 배송일(2026-09-28 점검 9차).
 *
 * 예전엔 재개가 무조건 `nextShipDate()` 로 덮어써서, 청구 직후(다음 배송일 = 2주 뒤) 정지했다 곧바로 재개하면
 * 다음 배송이 **1주 앞당겨져** 한 주 만에 또 결제·발송됐다(관리자·앱·웹 재개 3곳 공통). 일시정지는 날짜를
 * 지우지 않으므로, 아직 오지 않은 발송 요일 날짜가 있으면 그대로 두고 지났거나 없을 때만 다음 발송 화요일로.
 */
export function resumeShipDate(
  currentIso: string | null | undefined,
  fromIso: string = todayKstIsoDate(),
  timing: ChargeTiming = 'before_cooking',
): string {
  const earliest = nextShipDate(fromIso, timing)
  if (currentIso && currentIso >= earliest && weekdayOf(currentIso) === SHIP_WEEKDAY) return currentIso
  return earliest
}

/**
 * 이후 배송일 — 2주(14일) 뒤. 14일 = 정확히 2주라 요일이 보존된다.
 * (요일이 어긋나면 화요일로 다시 당기는 게 아니라 애초에 어긋날 수 없다.)
 */
export function nextCycleDate(shipIso: string, intervalWeeks = 2): string {
  return addDaysKst(shipIso, intervalWeeks * 7)
}

/**
 * 다음 주기 배송일 — **화요일 정렬 자가치유 + 미래 보장** 판 (최종감사 #3).
 *
 * `nextCycleDate` 는 "입력이 화요일이면 출력도 화요일"만 보장한다. 그런데
 * 자동결제 크론은 밀린 날 따라잡기(.lte)를 허용하므로, 크론이 화요일에 안 돈
 * 주에는 실행일 기준 +14 가 비화요일을 만들 수 있었다(실측: 07-07 화 미실행).
 * 비화요일 next_delivery_date 는 피킹 리스트(화요일만 조회)에서 그 고객의
 * 박스를 영영 누락시킨다 — 결제만 되고 박스가 안 나간다.
 *
 * 그래서 여기서는 **원래 예정일(dueIso)** 기준 +14 를 앵커로 쓰되:
 *   ① 과거 데이터·수동 입력으로 이미 이탈한 날짜도 발송 요일로 스냅(자가치유)
 *   ② 크론이 여러 주 밀렸어도 결과가 반드시 todayIso 초과가 되도록 전진
 *      (과거로 잡히면 다음날 크론이 곧바로 또 청구한다)
 */
export function nextCycleDateAligned(dueIso: string, todayIso: string): string {
  const gap = (SHIP_WEEKDAY - weekdayOf(dueIso) + 7) % 7
  let next = nextCycleDate(addDaysKst(dueIso, gap))
  while (next <= todayIso) next = nextCycleDate(next)
  return next
}

/**
 * 청구 **성공** 뒤 다음 청구일(2026-09-28 점검 9차).
 *
 * 제때(예정일 당일) 결제 → 그날 발송, 다음 = 예정일 + 14 (위 nextCycleDateAligned 그대로).
 * **늦게 성공**(잔액부족 재시도가 며칠 뒤 성공 · 크론 누락 따라잡기 · 카드 재등록) → 그 박스는 예정일에 이미
 * 발송금지로 빠졌으므로 **다음 발송 가능 화요일**에 나간다. 다음 청구는 그로부터 14일 뒤여야 한다.
 * 예전엔 예정일+14 로 잡아, 월요일(T+13)에 성공하면 다음 날(T+14) 또 청구되고 피킹 리스트엔 구독당
 * 한 줄만 떠 **결제 2번·박스 1개**가 됐다. 결과 = 발송일+14 라 피킹 리스트의 '오늘 아침 청구분'
 * 판정(next_delivery_date === 발송일+14)과도 맞는다.
 */
export function nextChargeDateAfterSuccess(
  dueIso: string,
  todayIso: string,
  // 기본값 = 발송일 결제(옛 동작) — 호출부가 결제 시점을 넘기지 않으면 예전과 똑같이 동작한다.
  timing: ChargeTiming = 'ship_day',
): string {
  if (todayIso <= onTimeChargeDeadline(dueIso, timing)) return nextCycleDateAligned(dueIso, todayIso)
  return nextCycleDateAligned(nextShipDate(todayIso), todayIso)
}

export type ShipDay = {
  /** 0=일 … 6=토 */
  dow: number
  ko: string
  /** 그날 우리가 하는 일. */
  what: string
  /** 발송일 강조. */
  isShip?: boolean
  /** 도착일 강조. */
  isArrive?: boolean
  /** 쉬는 날. */
  isOff?: boolean
}

/**
 * 한 주 리듬 — 화면의 주간 캘린더가 이걸 그대로 렌더한다.
 * 사장님 2026-07-15: "각 요일마다 어떤 일을 하는지 원료 입고, 제품 제작 등
 * 그런 걸 더 자세하게 써놔줘."
 */
// ★2026-10-01 일정 변경 — 토·일 조리 → 월 포장 → 화 발송(사장님). 예전엔 화요일 하루에 조리·포장·
//   발송을 다 했다. 결제 시점은 고객마다 달라(chargeDateFor) 이 공통 리듬에는 적지 않는다 — 서포터즈는
//   체험 구간 동안 발송일 결제라, 여기 '토요일 결제'를 적으면 그분들 화면에 거짓이 된다.
//   목·금 문구(원료 주문·입고 시점)는 사장님 확인 전 초안이다.
//   사장님 확정(2026-10-01): 목 원료 주문 · 금 입고·손질 · 토·일 조리 · 월 포장 · 화 발송 · 수 위생 점검.
//   "수요일 도착이라는 말을 쓰지 말고" — 도착은 지역·택배사 사정이라 요일을 약속하지 않는다(shipTimingLabel 원칙).
export const SHIP_WEEK: ShipDay[] = [
  { dow: 1, ko: '월', what: '포장 · 출고 준비' },
  { dow: 2, ko: '화', what: '발송', isShip: true },
  { dow: 3, ko: '수', what: '주방 세척 · 위생 점검' },
  { dow: 4, ko: '목', what: '농가에 원료 주문' },
  { dow: 5, ko: '금', what: '원료 입고 · 손질 · 이날까지 신청하면 다음 화요일 발송' },
  { dow: 6, ko: '토', what: '조리' },
  { dow: 0, ko: '일', what: '조리' },
]

/**
 * 결제 시점별 한 주 리듬 — 서포터즈 체험 구간은 신청 마감이 일요일(LEAD_DAYS_SUPPORTER)이라 금요일 칸의 마감 문구를
 * 일요일 칸으로 옮긴다. 결제 요일은 여전히 적지 않는다(SHIP_WEEK 원칙).
 */
export function shipWeekFor(timing: ChargeTiming): ShipDay[] {
  if (timing !== 'ship_day') return SHIP_WEEK
  return SHIP_WEEK.map((d) =>
    d.dow === 5
      ? { ...d, what: '원료 입고 · 손질' }
      : d.dow === 0
        ? { ...d, what: '조리 · 이날까지 신청하면 이번 화요일 발송' }
        : d,
  )
}

/**
 * `next_delivery_date` 까지 남은 날 → **고객에게 보여줄 문구**.
 *
 * # ★ 이 함수가 생긴 이유 (2026-07-30 감사 4차)
 * 홈이 `next_delivery_date` 를 **도착일처럼** 말하고 있었다:
 *   "내일 새벽 도착" · "3일 후 도착" · "곧 도착해요"
 * 그런데 이 파일이 정한 대로 그 날짜는 **발송일(화요일)** 이고 도착은 그 다음
 * 날부터다(SHIP_WEEK: 화=발송, 수=문 앞 도착). 하루를 앞당겨 약속한 셈이고,
 * "새벽" 은 우리가 알 수도 없는 시각이다 — 택배사 사정이다.
 *
 * 게다가 **지역마다 다르다**: 수도권은 발송 다음 날, 그 외는 대체로 48시간,
 * 도서산간은 하루 더(FAQ 에 그렇게 적혀 있다). 우리는 고객의 지역으로 도착일을
 * 계산하지 않으므로 **도착 날짜를 단정할 근거가 없다.**
 *
 * → 우리가 아는 것(발송일)은 단정하고, 모르는 것(도착)은 범위로 말한다.
 *   화면마다 제 문구를 쓰면 또 갈라지므로 여기 한 곳에 둔다.
 */
export function shipTimingLabel(daysUntilShip: number): {
  /** 짧은 강조 — 카드 상단 D-N 자리. */
  dLabel: string
  /** 한 줄 설명. */
  detail: string
  /** 숫자 칸 + 단위 칸으로 쪼개 쓰는 화면용(홈 metric). */
  metric: { value: string; unit: string }
} {
  /**
   * ★날짜가 **지났으면** 발송을 약속하지 않는다 (2026-08-07 고객 실패경로 감사).
   *
   * 예전엔 `<= 0` 이 전부 "오늘 발송" 이었다. 그런데 결제가 한 번 미끄러지면
   * (잔액 부족 같은 transient 실패) 청구 크론이 `next_delivery_date` 를
   * **갱신하지 않는다** — status 도 그대로 active 다. 그래서 그 날짜가 과거로
   * 흘러가는데 화면은 **매일** "오늘 발송돼요" 라고 말했다. 홈·강아지 카드·
   * 구독 탭·마이페이지·웹 다섯 곳이 같은 거짓말을 했다.
   *
   * 모르는 것을 단정하지 않는다 — 왜 밀렸는지는 이 함수가 알 수 없으므로
   * "확인 중" 이라고만 하고 다음 행동은 화면이 붙인다.
   */
  if (daysUntilShip < 0) {
    return {
      dLabel: '확인 중',
      detail: '예정일이 지났어요. 결제나 배송에 문제가 없는지 확인하고 있어요.',
      metric: { value: '확인', unit: '중' },
    }
  }
  if (daysUntilShip === 0) {
    return {
      dLabel: '오늘 발송',
      detail: '오늘 발송돼요. 도착은 지역에 따라 하루에서 이틀 걸려요.',
      metric: { value: '오늘', unit: '발송' },
    }
  }
  if (daysUntilShip === 1) {
    return {
      dLabel: 'D-1',
      detail: '내일 발송돼요. 발송하면 알려드릴게요.',
      metric: { value: '1', unit: '일 후 발송' },
    }
  }
  return {
    dLabel: `D-${daysUntilShip}`,
    detail: `${daysUntilShip}일 후 발송돼요.`,
    metric: { value: String(daysUntilShip), unit: '일 후 발송' },
  }
}

/**
 * 마감 안내 문구 — **두 종류를 섞지 말 것** (2026-07-30 감사 4차).
 *
 * 화면마다 마감을 다르게 말하고 있었고, 그중 하나는 **실제보다 엄했다.**
 * `/about` 이 "해지는 일요일까지 신청하면 다음 박스부터 적용돼요" 라고 했는데,
 * 해지는 그렇게 동작하지 않는다:
 *
 *  · **해지·일시정지** = 즉시 반영이다. 청구 크론이 `status='active'` 인 것만
 *    고르므로(subscription-charge) **그 박스의 결제가 일어나기 전이면 언제
 *    눌러도 멈춘다** — 일요일과 무관하다. 월요일에 저 문구를 읽은 고객은 이미
 *    늦었다고 생각해 원치 않는 박스를 한 번 더 받는다.
 *
 *    ★단, `next_delivery_date` 를 지우는 건 **해지뿐이다**(2026-08-12 정정 —
 *    예전 이 주석은 "둘 다 지운다"고 단언했고 그건 거짓이었다). 일시정지는
 *    재개 기준점이 필요해 날짜를 남긴다. 그래서 **발송 목록은 날짜만 보면 안
 *    되고 status·결제 증거를 함께 봐야 한다** — 실제로 피킹 리스트가 이 거짓
 *    주석 위에서 "정지된 구독 = 결제 후 정지"로 단언해, 청구 전에 멈춘 고객의
 *    박스를 무료로 내보낼 뻔했다(picking-list 의 pausedBeforeCharge 참조).
 *
 *  · **박스 구성 변경**(레시피·화식 비율) = 일요일 마감이다. 월요일에 원료를
 *    받아 손질하기 때문에(SHIP_WEEK) 그 뒤 바꾸면 그 주 박스에 못 담는다.
 *
 * 여기 있는 건 **멈추기(해지·일시정지·건너뛰기)** 쪽 문구다. 구성 변경 쪽
 * 문구는 앱 화면에 두지 않았다 — 구성 변경은 처방 재제안 승인을 거치고, 월요일에
 * 손질을 시작한 뒤 승인된 변경을 그 주 박스에 담을 수 있는지는 **운영 판단**이라
 * 코드로 확인할 수 없다. 사장님 확인 후 이 파일에 함께 둔다.
 * (FAQ 는 DB(`faqs`) 에서 나오고 그쪽엔 일요일 마감이 적혀 있다.)
 */
export const STOP_TIMING_COPY =
  '다음 결제 전에 멈추면 그 박스는 나가지 않아요.'

/** 발송일을 하루로 모으는 이유 — 고객에게 그대로 보여주는 문구. */
export const SHIP_WHY =
  '아이마다 맞춤 용량으로 만들다 보니 한 번에 많이 만들어두지 않아요. 그 주에 쓸 원료만 받아서 주말에 만들고, 화요일에 모아 보내드려요. 요일이 정해져 있어 번거로우실 수 있지만, 가장 신선한 상태로 보내드리려는 방법이라 양해 부탁드려요.'
