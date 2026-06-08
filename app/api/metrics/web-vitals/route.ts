import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

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

/**
 * path 는 Sentry captureMessage / tag 에 그대로 들어간다. 제어문자(개행 등)가
 * 남으면 로그 인젝션(메시지 위조·이슈 그룹 오염)이 가능하므로 ASCII 제어범위
 * (0x00–0x1f, 0x7f) 를 공백으로 치환한 뒤 길이를 제한한다.
 */
function sanitizePath(raw: string): string {
  let out = ''
  for (const ch of raw) {
    const c = ch.charCodeAt(0)
    out += c < 0x20 || c === 0x7f ? ' ' : ch
  }
  return out.slice(0, 200)
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

  // 익명 beacon 이라 spam 잠재성. IP 당 분당 60건 (페이지 당 vital 5종 +
  // navigation 12회 정도 — 정상 사용은 5분에 30건 미만). Sentry 쿼터 보호.
  const rl = rateLimit({
    bucket: 'web-vitals',
    key: ipFromRequest(request),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return new NextResponse(null, { status: 429, headers: rl.headers })
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
  const path = isString(body.path) ? sanitizePath(body.path) : '(unknown)'
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
