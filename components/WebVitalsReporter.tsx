'use client'

/**
 * Core Web Vitals reporter.
 *
 * Next 16 의 `useReportWebVitals` hook 을 써서 CLS · INP · LCP · FCP · TTFB 를
 * 수집해 `/api/metrics/web-vitals` 로 `sendBeacon` 송신. 사용자 네트워크가
 * 끊겼다 복구되는 PWA 시나리오에서도 최대한 안 새도록 beacon → fetch
 * fallback 구조로.
 *
 * 왜 이 구현이 필요한가
 * ──────────────────
 *   - Vercel Analytics / Speed Insights 는 지표를 _이미_ 수집하지만, 우리는
 *     RLS 기반 사용자 플로우(로그인 · 카트 · 체크아웃) 의 구간별 INP 를
 *     Sentry 이벤트로 묶어 재현 replay 와 연결하고 싶다. 그래서 자체 beacon
 *     으로 서버 쪽에서 pathname + rating + 세션 ID 를 함께 찍는다.
 *   - Server 쪽 라우트에서 Sentry.captureMessage 를 쓰면 threshold 초과
 *     이벤트가 이슈로 올라와 Slack alert 와 연동된다.
 *
 * 중복 이벤트 방지: Next docs 에 따르면 새로운 콜백 ref 는 이전 지표를
 * 전부 다시 흘려보낸다. 그래서 콜백을 모듈 스코프 상수로 잡아두고 rerender
 * 에도 ref 가 고정되도록 한다.
 */
import { useReportWebVitals } from 'next/web-vitals'

type WebVitalMetric = {
  id: string
  name: string
  value: number
  delta: number
  rating?: 'good' | 'needs-improvement' | 'poor'
  navigationType?: string
}

function sendMetric(metric: WebVitalMetric) {
  // pathname 은 SPA 네비게이션 후에도 현재 위치를 보여줘야 하므로 호출
  // 시점에 직접 읽는다.
  const path =
    typeof window === 'undefined' ? null : window.location.pathname
  const payload = JSON.stringify({
    id: metric.id,
    name: metric.name,
    value: Math.round(metric.value * 1000) / 1000,
    delta: Math.round(metric.delta * 1000) / 1000,
    rating: metric.rating ?? null,
    navigationType: metric.navigationType ?? null,
    path,
    ts: Date.now(),
  })
  const url = '/api/metrics/web-vitals'

  // sendBeacon 은 unload 시점에도 안정적. 실패 시 (payload 너무 크거나
  // 정책 차단) fetch keepalive 로 폴백.
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function'
    ) {
      const blob = new Blob([payload], { type: 'application/json' })
      if (navigator.sendBeacon(url, blob)) return
    }
  } catch {
    /* fall through */
  }
  try {
    void fetch(url, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    })
  } catch {
    /* noop — 메트릭 유실은 사용자 경험에 영향 없음 */
  }
}

export default function WebVitalsReporter() {
  useReportWebVitals(sendMetric)
  return null
}
