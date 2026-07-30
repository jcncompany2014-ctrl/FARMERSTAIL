/**
 * 배송 스케줄 — **발송은 화요일 하루** (사장님 확정 2026-07-15).
 *
 * # 왜 하루만 보내나 (고객에게 그대로 말하는 이유)
 * 강아지마다 맞춤 용량으로 만들다 보니 한 번에 많이 만들어두지 않는다. 그래서
 * 발송을 한 날로 모아 그 주에 쓸 원료만 받고, 만들어서 바로 보낸다 — 신선함을
 * 최선으로 유지하는 방법이 이거다.
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
import { addDaysKst, todayKstIsoDate } from './datetime-kst.ts'

/** 발송 요일 — 화요일. JS getUTCDay(): 0=일 … 2=화. */
export const SHIP_WEEKDAY = 2

/**
 * 주문 마감 리드타임(일). 2 = **일요일까지 주문하면 그 주 화요일 발송**.
 *
 * 월요일에 그 주 주문을 확정해 딱 필요한 만큼만 원료를 받고 손질하기 때문에,
 * 월요일에 들어온 주문을 다음 날 아침 조리분에 밀어넣을 수는 없다(원료가
 * 그만큼 안 들어와 있다). 그래서 마감은 일요일 밤.
 *
 * 대가: 월요일 주문은 첫 박스를 8일 기다린다(가장 나쁜 경우). 물량이 늘어
 * 원료를 여유 있게 받게 되면 1로 낮춰 최대 7일로 줄일 수 있다.
 */
const LEAD_DAYS = 2

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
 * 마감(LEAD_DAYS)을 지난 주문은 그다음 주 화요일로 넘어간다.
 */
export function nextShipDate(fromIso: string = todayKstIsoDate()): string {
  // 리드타임을 먼저 더한 뒤, 그 날짜 이상인 첫 화요일을 찾는다.
  const earliest = addDaysKst(fromIso, LEAD_DAYS)
  const gap = (SHIP_WEEKDAY - weekdayOf(earliest) + 7) % 7
  return addDaysKst(earliest, gap)
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
export const SHIP_WEEK: ShipDay[] = [
  { dow: 1, ko: '월', what: '원료 입고 · 손질' },
  { dow: 2, ko: '화', what: '조리 · 포장 · 발송', isShip: true },
  { dow: 3, ko: '수', what: '문 앞 도착', isArrive: true },
  { dow: 4, ko: '목', what: '주방 세척 · 위생 점검' },
  { dow: 5, ko: '금', what: '농가에 다음 주 원료 주문' },
  // 토·일 — '쉼' 두 줄은 아무 정보도 주지 않았다(사장님 2026-07-15 "다른 걸로
  // 채우든가 없애든가"). 지우는 대신, 이 이틀이 **비어 있다는 사실 자체가
  // 신선함의 근거**라는 걸 말한다. 주말에 만들어 재워두지 않으니까.
  { dow: 6, ko: '토', what: '만들어 둔 재고 없음', isOff: true },
  { dow: 0, ko: '일', what: '이날까지 주문하면 화요일 발송', isOff: true },
]

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
  if (daysUntilShip <= 0) {
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
 *  · **해지·일시정지** = 즉시 반영이다. `status` 를 바꾸는 순간
 *    `next_delivery_date` 가 지워지고, 청구 크론은 `status='active'` 인 것만
 *    고른다(subscription-charge). 즉 **그 박스의 결제가 일어나기 전이면 언제
 *    눌러도 멈춘다** — 일요일과 무관하다. 월요일에 저 문구를 읽은 고객은 이미
 *    늦었다고 생각해 원치 않는 박스를 한 번 더 받는다.
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
  '아이마다 맞춤 용량으로 만들다 보니 한 번에 많이 만들어두지 않아요. 그 주에 쓸 원료만 받아서 화요일 하루에 모아 만들고 바로 보내드려요. 요일이 정해져 있어 번거로우실 수 있지만, 가장 신선한 상태로 보내드리려는 방법이라 양해 부탁드려요.'
