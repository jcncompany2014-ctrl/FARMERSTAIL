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

/** 발송일을 하루로 모으는 이유 — 고객에게 그대로 보여주는 문구. */
export const SHIP_WHY =
  '아이마다 맞춤 용량으로 만들다 보니 한 번에 많이 만들어두지 않아요. 그 주에 쓸 원료만 받아서 화요일 하루에 모아 만들고 바로 보내드려요. 요일이 정해져 있어 번거로우실 수 있지만, 가장 신선한 상태로 보내드리려는 방법이라 양해 부탁드려요.'
