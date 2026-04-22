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
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
