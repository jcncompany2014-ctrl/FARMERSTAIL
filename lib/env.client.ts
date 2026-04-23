/**
 * 클라이언트 전용 환경변수 검증.
 *
 * Next.js는 NEXT_PUBLIC_* 접두사 변수만 클라이언트 번들에 inline한다.
 * 서버 시크릿(SUPABASE_SERVICE_ROLE_KEY 등)을 섞은 `lib/env.ts`를
 * 클라이언트에서 import하면 서버 필드가 전부 undefined로 나타나서 파싱
 * 실패 → 앱이 하얗게 된다. 그래서 브라우저에서 실제로 쓸 수 있는 키만
 * 따로 작은 스키마로 검증한다.
 *
 * 이 모듈은 서버/클라 양쪽에서 import해도 안전. 서버에서는 같은 값들이
 * `lib/env.ts`를 통해서도 이미 검증되었지만, 중복 비용은 무시할 정도.
 */
import { z } from 'zod'

const optStr = () =>
  z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v))

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: optStr().pipe(z.string().url().optional()),
  NEXT_PUBLIC_SENTRY_DSN: optStr(),
  NEXT_PUBLIC_GA_ID: optStr(),
  NEXT_PUBLIC_META_PIXEL_ID: optStr(),
  NEXT_PUBLIC_TOSS_CLIENT_KEY: optStr(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optStr(),
})

const raw = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  NEXT_PUBLIC_TOSS_CLIENT_KEY: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
}

const parsed = clientSchema.safeParse(raw)

if (!parsed.success) {
  // 클라이언트에서는 throw하면 앱이 통째로 흰 화면이 되니 console.error만 하고
  // 비어있는 기본값으로 진행. 서버쪽 env.ts에서 이미 throw했을 것이므로
  // 프로덕션 배포에서는 이 경로에 도달하지 않는다.
  console.error(
    '⚠️  Client env validation failed:',
    parsed.error.flatten().fieldErrors
  )
}

export const clientEnv = parsed.success
  ? parsed.data
  : ({
      NEXT_PUBLIC_SUPABASE_URL: raw.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      NEXT_PUBLIC_SITE_URL: raw.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_SENTRY_DSN: raw.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_GA_ID: raw.NEXT_PUBLIC_GA_ID,
      NEXT_PUBLIC_META_PIXEL_ID: raw.NEXT_PUBLIC_META_PIXEL_ID,
      NEXT_PUBLIC_TOSS_CLIENT_KEY: raw.NEXT_PUBLIC_TOSS_CLIENT_KEY,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: raw.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    } as z.infer<typeof clientSchema>)
