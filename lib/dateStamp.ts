/**
 * Editorial date stamp — 매거진 마스트헤드용 날짜/호수.
 *
 * Farmer's Tail 은 디지털 매거진 정체성을 강하게 가져가는데, 날짜 + 호수
 * (issue number) 가 이 정체성의 핵심 시각 시그니처다. Dashboard 마스트헤드,
 * AppChrome 헤더, landing 의 hero 영역 등 여러 곳에서 같은 stamp 를 쓴다.
 *
 * # 왜 별도 모듈인가
 *
 * `useSyncExternalStore` 의 getSnapshot 은 `Object.is` 로 prev/next 를 비교하기
 * 때문에 매 호출마다 새 객체를 반환하면 무한 재렌더 → React 19 가 공식 경고로
 * 잡는다. 모듈 스코프에 캐시 키 (YYYY-MM-DD) + 캐시 값을 두어 같은 날짜 안에서는
 * 항상 **동일 참조** 를 반환하게 한다. 자정 넘기면 한 번 갱신되고 그 이후는 다시
 * 안정 참조.
 *
 * # 왜 클라이언트 전용
 *
 * SSR 에서 계산하면 서버 timezone (UTC) 과 클라 timezone (KST 등) 차이로 hydration
 * mismatch 가 난다. 그래서 `getServerSnapshot` 은 항상 null 을 반환하고, 클라
 * 마운트 후에 한 번 computeStamp() 가 돌면서 stamp 가 채워진다. 빈 슬롯에서
 * 채워진 슬롯으로 가는 1회 layout shift 를 줄이려면 호출자가 SSR 단계에서 같은
 * 폭의 placeholder (`&nbsp;` 같은) 를 그려두는 게 좋다.
 */

/**
 * `useSyncExternalStore(subscribe, ...)` 에서 외부 변경 신호가 없는 client-only
 * computed value 를 표현할 때 쓰는 빈 구독자. unsubscribe 도 빈 함수.
 */
export const EMPTY_SUBSCRIBE = () => () => {}

export type EditorialStamp = {
  /** 영문 요일 약어 — `MON`, `TUE` … */
  weekday: string
  /** 일자 2자리 — `01` … `31` */
  day: string
  /** 영문 월 약어 — `JAN`, `FEB` … */
  month: string
}

function computeStamp(): EditorialStamp {
  const now = new Date()
  const weekday = now
    .toLocaleDateString('en-US', { weekday: 'short' })
    .toUpperCase()
  const day = String(now.getDate()).padStart(2, '0')
  const month = now
    .toLocaleDateString('en-US', { month: 'short' })
    .toUpperCase()
  return { weekday, day, month }
}

let cacheKey = ''
let cacheValue: EditorialStamp | null = null
/**
 * 같은 달력일 (로컬 timezone 기준) 동안 동일 객체 참조를 반환하는 stamp 스냅샷.
 * `useSyncExternalStore` 의 client getSnapshot 으로 안전하게 사용 가능.
 */
export function getStampSnapshot(): EditorialStamp {
  const now = new Date()
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
  if (key === cacheKey && cacheValue) return cacheValue
  cacheKey = key
  cacheValue = computeStamp()
  return cacheValue
}

/** SSR 단계에서는 항상 null. 호출자가 placeholder 를 그려주는 책임을 진다. */
export function getServerStampSnapshot(): EditorialStamp | null {
  return null
}
