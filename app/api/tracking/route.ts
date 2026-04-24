import { NextResponse } from 'next/server'
import {
  carrierMeta,
  mapTrackerStatusCode,
  type TrackingResult,
  type TrackingEvent,
} from '@/lib/tracking'

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
      sender { name }
      recipient { name }
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
      sender?: { name: string | null } | null
      recipient?: { name: string | null } | null
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
      sender: track.sender?.name ?? null,
      recipient: track.recipient?.name ?? null,
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
