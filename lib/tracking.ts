/**
 * Farmer's Tail — 택배사(courier) 어댑터.
 *
 * 한국 쇼핑몰에서 택배사 처리가 늘 꼬이는 지점:
 *   1. 내부 DB 코드(cj/lotte/...)와 택배사 조회 API의 carrier ID(kr.cjlogistics)
 *      가 다르다.
 *   2. 같은 송장번호를 택배사 공식 사이트로 띄우는 URL 포맷도 택배사마다 제각각.
 *   3. 관리자 드롭다운, 고객 라벨, 배송조회 API 가 각자 CARRIER 맵을 복붙한다.
 *
 * 이 모듈이 단일 진실의 원천. 모든 호출처가 CARRIERS 테이블만 본다.
 *
 * - `code`              — orders.carrier 컬럼에 저장되는 내부 키
 * - `label`             — 고객/관리자 노출용 한글명
 * - `trackerUrl(n)`     — 택배사 공식 사이트의 조회 페이지 deep-link
 *                         (인라인 트래커가 실패했을 때 fallback)
 * - `deliveryTrackerId` — tracker.delivery 공개 GraphQL API의 carrier ID
 *                         (kr.cjlogistics, ...). null 이면 인라인 조회 불가
 *                         → deep-link 만 제공.
 */

export type CarrierCode =
  | 'cj'
  | 'post'
  | 'lotte'
  | 'hanjin'
  | 'logen'
  | 'kd'
  | 'other'

export type CarrierMeta = {
  code: CarrierCode
  label: string
  deliveryTrackerId: string | null
  trackerUrl: (trackingNumber: string) => string | null
}

export const CARRIERS: Record<CarrierCode, CarrierMeta> = {
  cj: {
    code: 'cj',
    label: 'CJ대한통운',
    deliveryTrackerId: 'kr.cjlogistics',
    trackerUrl: (n) =>
      `https://trace.cjlogistics.com/web/detail.jsp?slipno=${encodeURIComponent(n)}`,
  },
  post: {
    code: 'post',
    label: '우체국택배',
    deliveryTrackerId: 'kr.epost',
    trackerUrl: (n) =>
      `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(n)}`,
  },
  lotte: {
    code: 'lotte',
    label: '롯데택배',
    deliveryTrackerId: 'kr.lotte',
    trackerUrl: (n) =>
      `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${encodeURIComponent(n)}`,
  },
  hanjin: {
    code: 'hanjin',
    label: '한진택배',
    deliveryTrackerId: 'kr.hanjin',
    trackerUrl: (n) =>
      `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnum=${encodeURIComponent(n)}`,
  },
  logen: {
    code: 'logen',
    label: '로젠택배',
    deliveryTrackerId: 'kr.logen',
    trackerUrl: (n) =>
      `https://www.ilogen.com/web/personal/trace/${encodeURIComponent(n)}`,
  },
  kd: {
    code: 'kd',
    label: '경동택배',
    deliveryTrackerId: 'kr.kdexp',
    trackerUrl: (n) =>
      `https://kdexp.com/service/delivery/etc/delivery.aspx?barcode=${encodeURIComponent(n)}`,
  },
  other: {
    code: 'other',
    label: '기타',
    deliveryTrackerId: null,
    trackerUrl: () => null,
  },
}

/** 관리자 드롭다운 등에서 "모든 택배사" 를 순회할 때 쓰는 고정 순서. */
export const CARRIER_CODES: readonly CarrierCode[] = [
  'cj',
  'post',
  'lotte',
  'hanjin',
  'logen',
  'kd',
  'other',
]

/** 관리자 드롭다운 옵션. value는 DB 저장값, label은 표시용. */
export const CARRIER_OPTIONS: ReadonlyArray<{
  value: CarrierCode
  label: string
}> = CARRIER_CODES.map((code) => ({
  value: code,
  label: CARRIERS[code].label,
}))

export function isCarrierCode(v: unknown): v is CarrierCode {
  return typeof v === 'string' && CARRIER_CODES.includes(v as CarrierCode)
}

export function carrierMeta(code: string | null | undefined): CarrierMeta | null {
  if (!code) return null
  return (CARRIERS as Record<string, CarrierMeta>)[code] ?? null
}

export function carrierLabel(code: string | null | undefined): string {
  return carrierMeta(code)?.label ?? '—'
}

/**
 * 택배 공식 사이트 deep-link 빌더 — `carrierMeta(code)?.trackerUrl(n)` 을
 * 한 줄로. 코드가 유효하지 않거나 송장이 비었으면 null.
 */
export function carrierTrackerUrl(
  code: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  if (!trackingNumber) return null
  const meta = carrierMeta(code)
  if (!meta) return null
  return meta.trackerUrl(trackingNumber)
}

export type TrackingEvent = {
  time: string // ISO
  description: string
  status: string | null
  location: string | null
}

export type TrackingResult = {
  state:
    | 'information_received'
    | 'at_pickup'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered'
    | 'unknown'
  stateLabel: string
  events: TrackingEvent[]
  recipient: string | null
  sender: string | null
  updatedAt: string // ISO
}

// Human-readable labels for each state bucket (Delivery Tracker standard).
const STATE_LABEL_KO: Record<TrackingResult['state'], string> = {
  information_received: '접수 완료',
  at_pickup: '상품 인수',
  in_transit: '이동 중',
  out_for_delivery: '배송 출발',
  delivered: '배송 완료',
  unknown: '상태 확인 중',
}

export function stateLabel(s: TrackingResult['state']): string {
  return STATE_LABEL_KO[s]
}

/**
 * tracker.delivery 가 주는 status.code → 내부 state 버킷.
 * 대소문자 섞여 올 수 있어 toUpperCase 로 정규화.
 */
export function mapTrackerStatusCode(
  code: string | null | undefined,
): TrackingResult['state'] {
  if (!code) return 'unknown'
  const upper = code.toUpperCase()
  if (upper === 'INFORMATION_RECEIVED') return 'information_received'
  if (upper === 'AT_PICKUP') return 'at_pickup'
  if (upper === 'IN_TRANSIT') return 'in_transit'
  if (upper === 'OUT_FOR_DELIVERY') return 'out_for_delivery'
  if (upper === 'DELIVERED') return 'delivered'
  return 'unknown'
}
