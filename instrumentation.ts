/**
 * Next.js 서버/엣지 instrumentation.
 *
 * 각 런타임(nodejs / edge)마다 Sentry SDK 초기화 위치가 다르므로 동적
 * import로 분기한다. 이렇게 해야 Edge 빌드에 node 전용 SDK가 포함되지
 * 않는다. Sentry DSN이 없으면 내부 config 파일들이 noop로 종료.
 *
 * onRequestError는 Next가 서버 Component/Action/Route에서 잡힌 에러를
 * 콜백으로 흘려보내주는 공식 훅. Sentry가 여기에 맞춰 자동 hook을 제공.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  // 환경변수 검증을 가장 먼저. 필수 키 누락 시 여기서 throw → 서버 부팅
  // 자체가 실패하므로 "반쯤 깨진 앱"이 프로덕션에 뜨는 일을 막는다.
  // 이 import는 side-effect 실행 — 모듈 top-level에서 schema.parse가 돈다.
  await import('./lib/env')

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
