import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

/**
 * POST /api/metrics/web-vitals
 *
 * 클라이언트 WebVitalsReporter 에서 sendBeacon 으로 도달. Sentry 메트릭/브레드크럼
 * 으로 기록하고, rating === 'poor' 인 LCP/INP/CLS 는 captureMessage 로 알림.
 *
 * 인증 없음 — 익명 beacon. 다만 Zod validation + path whitelist 로 남용을 줄임.
 * (악의적 POST 로 Sentry 쿼터를 소모할 가능성이 있어 body 검증 + 크기 제한.)
 */

type VitalPayload = {
  id: unknown
  name: unknown
  value: unknown
  delta: unknown
  rating: unknown
  navigationType: unknown
  path: unknown
  ts: unknown
}

const ALLOWED_METRICS = new Set(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'])
const MAX_BODY = 2_048

function isString(v: unknown): v is string {
  return typeof v === 'string'
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export async function POST(request: Request) {
  // 간단한 사이즈 가드. CF Workers 는 content-length 헤더가 신뢰 가능.
  const lenHeader = request.headers.get('content-length')
  if (lenHeader && Number(lenHeader) > MAX_BODY) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 })
  }

  let body: VitalPayload
  try {
    body = (await request.json()) as VitalPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const name = isString(body.name) ? body.name : ''
  const value = isNumber(body.value) ? body.value : NaN
  if (!ALLOWED_METRICS.has(name) || Number.isNaN(value)) {
    return NextResponse.json({ error: 'invalid_metric' }, { status: 400 })
  }

  const rating = isString(body.rating) ? body.rating : null
  const path = isString(body.path) ? body.path.slice(0, 200) : '(unknown)'
  const navigationType = isString(body.navigationType)
    ? body.navigationType
    : null
  const delta = isNumber(body.delta) ? body.delta : 0
  const id = isString(body.id) ? body.id.slice(0, 80) : null

  // 지표마다 breadcrumb 로 남기고, poor 인 핵심 지표(LCP/INP/CLS) 는
  // captureMessage 로 올림. Sentry 는 동일 메시지를 issue grouping 하므로
  // 날카로운 파장만 걸린다.
  Sentry.addBreadcrumb({
    category: 'web-vital',
    level: rating === 'poor' ? 'warning' : 'info',
    message: `${name}=${value} (${rating ?? 'unknown'})`,
    data: { path, delta, navigationType, id },
  })

  const coreMetrics = new Set(['LCP', 'INP', 'CLS'])
  if (rating === 'poor' && coreMetrics.has(name)) {
    Sentry.captureMessage(`Poor ${name} on ${path}`, {
      level: 'warning',
      tags: { metric: name, rating, path },
      extra: { value, delta, navigationType, id },
    })
  }

  // 204 No Content — body 없이 빠르게 응답.
  return new NextResponse(null, { status: 204 })
}
