/**
 * /link 배너의 기간 판정 — 순수 함수 (테스트: status.test.ts).
 *
 * 사장님 2026-09-26: "기간이 끝난 이벤트·모집은 2주 동안 회색으로 '기간 종료'
 * 표시하고, 2주 뒤엔 자동으로 사라지게."
 *
 *  upcoming     시작 전 → 숨김
 *  active       진행 중 → 정상 표시
 *  ended_recent 종료 후 GRACE 일 이내 → 회색 + '기간 종료' (클릭 불가)
 *  expired      종료 후 GRACE 일 초과 → 숨김
 *
 * 날짜는 전부 'YYYY-MM-DD'(KST 달력일). 시각 비교가 아니라 달력일 비교라
 * 종료일 당일까지 진행 중이다.
 */
import { diffDaysKst } from '../datetime-kst.ts'

export type BannerWindow = 'upcoming' | 'active' | 'ended_recent' | 'expired'

export const ENDED_GRACE_DAYS = 14

export function bannerWindow(
  today: string,
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
  graceDays: number = ENDED_GRACE_DAYS,
): BannerWindow {
  if (startsOn && today < startsOn) return 'upcoming'
  if (endsOn && today > endsOn) {
    return diffDaysKst(today, endsOn) <= graceDays ? 'ended_recent' : 'expired'
  }
  return 'active'
}

/** 화면에 그릴지 — upcoming·expired 는 안 그린다. */
export function isBannerVisible(w: BannerWindow): boolean {
  return w === 'active' || w === 'ended_recent'
}

/**
 * 배지 옆 작은 기간 문구 — '9.24 ~ 9.30' / '~ 9.30' / '9.24 ~' / ''(기간 없음).
 * 연도는 뺀다(링크인바이오는 "지금" 얘기라 연도가 소음).
 */
export function periodLabel(startsOn: string | null | undefined, endsOn: string | null | undefined): string {
  const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`
  if (startsOn && endsOn) return `${md(startsOn)} ~ ${md(endsOn)}`
  if (endsOn) return `~ ${md(endsOn)}`
  if (startsOn) return `${md(startsOn)} ~`
  return ''
}

/**
 * 마감된 배너는 자동으로 아래로 (사장님 2026-09-26 "마감된 건 순서도 밑으로").
 * 진행 중은 어드민 순서 그대로, 종료(회색)는 그 뒤에 — 안정 정렬이라 같은 무리
 * 안에서는 원래 순서를 지킨다.
 */
export function sortEndedLast<T extends { window: BannerWindow }>(items: T[]): T[] {
  const rank = (w: BannerWindow) => (w === 'ended_recent' ? 1 : 0)
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => rank(a.it.window) - rank(b.it.window) || a.i - b.i)
    .map((x) => x.it)
}
