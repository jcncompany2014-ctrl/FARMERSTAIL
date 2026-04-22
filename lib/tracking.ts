// Carrier metadata — single source of truth for both the admin workflow
// (#11) and the customer-facing tracker (#12).
//
// - `code`           — internal key stored in orders.carrier
// - `label`          — Korean display name
// - `trackerUrl(n)`  — deep-link to the carrier's own tracking site, used as a
//                      reliable fallback if our inline tracker fails
// - `deliveryTrackerId` — carrier identifier for the public GraphQL API
//                         at tracker.delivery (kr.cjlogistics, etc.). If null,
//                         we can only offer the deep-link.

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

export function carrierMeta(code: string | null | undefined): CarrierMeta | null {
  if (!code) return null
  return (CARRIERS as Record<string, CarrierMeta>)[code] ?? null
}

export function carrierLabel(code: string | null | undefined): string {
  return carrierMeta(code)?.label ?? '—'
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
