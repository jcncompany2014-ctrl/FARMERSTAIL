import { NextResponse } from 'next/server'
import { ipFromRequest, rateLimit } from '@/lib/rate-limit'
import {
  carrierMeta,
  mapTrackerStatusCode,
  type TrackingResult,
  type TrackingEvent,
} from '@/lib/tracking'

/**
 * GET /api/tracking?carrier=&trackingNumber= — 배송 조회 프록시.
 *
 * # 인증이 없다 (의도)
 * 송장 조회는 로그인 전에도 필요할 수 있고, 상류(tracker.delivery)도 공개 API 다.
 * 대신 **두 가지를 지킨다**:
 *
 *  1. **개인정보를 받아오지 않는다.** 상류는 sender·recipient 이름을 주지만 우리는
 *     쿼리에서 아예 뺐다. 우리 화면이 그걸 쓴 적이 없는데 인증 없는 엔드포인트가
 *     담아서 내보내면, 송장번호만 아는 사람이 **수취인 이름을 캐낼 수 있다**.
 *     안 쓰는 개인정보는 받지도 않는 게 맞다. (2026-07-16)
 *  2. **레이트리밋.** 인증이 없으면 열린 프록시가 된다 — 송장번호를 긁거나 우리
 *     서버로 상류를 두들기는 데 쓰일 수 있다. 다른 공개 라우트(contact·web-vitals)엔
 *     있었는데 여기만 없었다.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public GraphQL endpoint — no API key required, CORS-permissive from server.
const DELIVERY_TRACKER_ENDPOINT = 'https://apis.tracker.delivery/graphql'

const QUERY = `
  query Track($carrierId: ID!, $trackingNumber: String!) {
    track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
      lastEvent {
        time
        status { code name }
        description
        location { name }
      }
      events {
        time
        status { code name }
        description
        location { name }
      }
    }
  }
`

type DeliveryTrackerEvent = {
  time: string
  status: { code: string | null; name: string | null } | null
  description: string | null
  location: { name: string | null } | null
}

type DeliveryTrackerResponse = {
  data?: {
    track?: {
      lastEvent: DeliveryTrackerEvent | null
      events: DeliveryTrackerEvent[]
    } | null
  }
  errors?: Array<{ message: string }>
}

function normalizeEvent(e: DeliveryTrackerEvent): TrackingEvent {
  return {
    time: e.time,
    description: e.description ?? e.status?.name ?? '',
    status: e.status?.name ?? null,
    location: e.location?.name ?? null,
  }
}

export async function GET(req: Request) {
  // 인증이 없는 프록시 — 열어두면 송장번호 긁기에 쓰인다. 조회는 자주 하니 분당 30건.
  const rl = rateLimit({
    bucket: 'tracking',
    key: ipFromRequest(req),
    limit: 30,
    windowMs: 60 * 1000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '조회가 너무 잦아요. 잠시 후 다시 시도해 주세요.' },
      { status: 429, headers: rl.headers },
    )
  }

  const { searchParams } = new URL(req.url)
  const carrierCode = searchParams.get('carrier') ?? ''
  const trackingNumber = searchParams.get('trackingNumber') ?? ''

  if (!carrierCode || !trackingNumber) {
    return NextResponse.json(
      { code: 'MISSING_PARAMS', message: '택배사와 송장번호가 필요해요' },
      { status: 400 }
    )
  }

  const meta = carrierMeta(carrierCode)
  if (!meta) {
    return NextResponse.json(
      { code: 'UNKNOWN_CARRIER', message: '지원하지 않는 택배사예요' },
      { status: 400 }
    )
  }

  if (!meta.deliveryTrackerId) {
    // e.g. carrier === 'other' — no inline lookup available.
    return NextResponse.json(
      {
        code: 'NO_INLINE_LOOKUP',
        message: '이 택배사는 사이트에서 직접 조회해 주세요',
      },
      { status: 422 }
    )
  }

  try {
    const res = await fetch(DELIVERY_TRACKER_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: QUERY,
        variables: {
          carrierId: meta.deliveryTrackerId,
          trackingNumber,
        },
      }),
      cache: 'no-store',
      // Don't let a hung upstream block the page indefinitely.
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json(
        {
          code: 'UPSTREAM_ERROR',
          message: `조회에 실패했어요 (HTTP ${res.status})`,
        },
        { status: 502 }
      )
    }

    const json = (await res.json()) as DeliveryTrackerResponse

    if (json.errors && json.errors.length) {
      return NextResponse.json(
        {
          code: 'TRACKING_NOT_FOUND',
          message:
            json.errors[0]?.message ??
            '송장을 찾을 수 없어요. 송장번호를 확인해 주세요.',
        },
        { status: 404 }
      )
    }

    const track = json.data?.track
    if (!track) {
      return NextResponse.json(
        {
          code: 'TRACKING_NOT_FOUND',
          message: '아직 조회할 수 있는 배송 정보가 없어요',
        },
        { status: 404 }
      )
    }

    const events = (track.events ?? []).map(normalizeEvent)
    // Sort newest first for display.
    events.sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0))
    const last = track.lastEvent ?? track.events[track.events.length - 1] ?? null
    const state = mapTrackerStatusCode(last?.status?.code)

    const result: TrackingResult = {
      state,
      stateLabel: last?.status?.name ?? '상태 확인 중',
      events,
      updatedAt: last?.time ?? new Date().toISOString(),
    }

    return NextResponse.json(result, {
      headers: {
        // Short-lived cache: tracker state updates every few minutes.
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    })
  } catch (e) {
    const message =
      e instanceof Error && e.name === 'TimeoutError'
        ? '택배사 응답이 지연되고 있어요. 잠시 후 다시 시도해 주세요.'
        : '택배 정보를 불러오지 못했어요'
    return NextResponse.json({ code: 'FETCH_FAILED', message }, { status: 502 })
  }
}
