/**
 * 환경변수 검증 레이어 — 서버 전용.
 *
 * 이 파일은 **server/edge 런타임에서만** import해야 한다. 클라이언트 전용
 * 변수(NEXT_PUBLIC_*)는 `lib/env.client.ts`에서 별도 검증. Next.js는
 * NEXT_PUBLIC_* 접두사만 클라이언트 번들에 inline하기 때문에, 서버 시크릿을
 * 섞어 놓은 스키마를 client에서 import하면 undefined 필드 때문에 전부 실패.
 *
 * 검증 시점:
 *   1) 서버 부팅: instrumentation.ts에서 register() 호출 시 side-effect
 *      import로 이 모듈이 로드되며 module-level 스키마 파싱이 실행된다.
 *   2) 빌드 타임: Next build 중 이 모듈을 import하는 서버 코드가 있으면
 *      그 시점에도 파싱 → 누락된 필수 키는 빌드 실패로 드러난다.
 *
 * 필수 vs 선택:
 *   - 필수: Supabase URL/anon/service role — 이거 없으면 아무 API도 안 돔
 *   - 선택: 분석/결제/푸시/Anthropic — 없어도 앱은 돌고, 해당 기능만 no-op
 *   선택 필드는 ''을 undefined로 변환해서 "env에 빈 문자열로 박아둔 경우"도
 *   "없음"으로 취급 (Vercel 대시보드가 빈 값을 문자열로 주입하는 경우 있음).
 */
import { z } from 'zod'

// 빈 문자열을 undefined로 정규화하는 helper. 선택 필드에 체이닝해서 쓴다.
const optStr = () =>
  z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v))

const serverSchema = z.object({
  // === Supabase ============================================================
  // URL + anon key 는 공개 카탈로그도 못 여니까 무조건 필수.
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL',
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
    message: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required',
  }),
  // service_role 은 관리자/웹훅/크론 전용. dev 에서 일반 카탈로그만 둘러볼
  // 때는 없어도 서버가 떠야 DX 가 좋아서 default('') 로 완화한다 — 대신
  // production 빌드에서는 아래 분기에서 빈값을 잡아 즉시 throw. admin 클라이언트
  // (lib/supabase/admin.ts) 는 빈값이면 호출 시점에 자체 에러를 던져서
  // "서버는 떴지만 admin 동작은 명확히 실패" 상태가 된다.
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),

  // === Site (선택, fallback 있음) ==========================================
  NEXT_PUBLIC_SITE_URL: optStr().pipe(z.string().url().optional()),

  // === Sentry (선택 — DSN 없으면 SDK가 no-op) ==============================
  NEXT_PUBLIC_SENTRY_DSN: optStr(),
  SENTRY_DSN: optStr(),
  SENTRY_ORG: optStr(),
  SENTRY_PROJECT: optStr(),
  SENTRY_AUTH_TOKEN: optStr(),

  // === Analytics (선택) ====================================================
  NEXT_PUBLIC_GA_ID: optStr(),
  NEXT_PUBLIC_META_PIXEL_ID: optStr(),

  // === Toss Payments (선택 — 결제 안 쓰는 단계에선 빌드되게) ===============
  // 주의: 프로덕션 결제를 붙이려면 둘 다 필수가 된다. 지금은 개발/스테이징
  // 편의를 위해 optional로 두고, 결제 API route에서 런타임 체크로 막는다.
  NEXT_PUBLIC_TOSS_CLIENT_KEY: optStr(),
  TOSS_SECRET_KEY: optStr(),

  // === Web Push VAPID (선택 — 셋 중 하나라도 없으면 푸시 비활성) ============
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optStr(),
  VAPID_PRIVATE_KEY: optStr(),
  VAPID_SUBJECT: optStr(),

  // === Anthropic (선택 — /api/analysis/commentary용) =======================
  ANTHROPIC_API_KEY: optStr(),

  // === Resend (선택 — 거래 메일. 없으면 모든 sendEmail 호출은 no-op) ========
  // EMAIL_FROM 은 "파머스테일 <no-reply@farmerstail.com>" 처럼 display+addr 형식.
  // Resend 계정에 검증된 도메인만 From으로 쓸 수 있음.
  RESEND_API_KEY: optStr(),
  EMAIL_FROM: optStr(),
  EMAIL_REPLY_TO: optStr(),

  // === Cron job bearer secret (선택 — 없으면 /api/cron/* 은 503 반환) =======
  // Vercel Cron 이 붙인 `Authorization: Bearer <secret>` 를 검증. 외부 툴이
  // 호출할 수 있는 엔드포인트라 단순 admin 쿠키 가드가 아니라 고정 토큰으로 막음.
  CRON_SECRET: optStr(),

  // === Node runtime meta ===================================================
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

/**
 * Next.js는 `process.env.FOO`를 빌드 타임에 그 자리에 **리터럴로 inline**한다.
 * 스프레드(`...process.env`)나 동적 키 접근(`process.env[x]`)은 inline 대상이
 * 아니므로 반드시 하나하나 키 이름을 적어야 한다. 아래 목록이 곧 "이 앱이
 * 인식하는 전체 env 키"의 단일 진실 공급원(SSOT).
 */
const raw = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_DSN: process.env.SENTRY_DSN,
  SENTRY_ORG: process.env.SENTRY_ORG,
  SENTRY_PROJECT: process.env.SENTRY_PROJECT,
  SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  NEXT_PUBLIC_TOSS_CLIENT_KEY: process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
  TOSS_SECRET_KEY: process.env.TOSS_SECRET_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
  CRON_SECRET: process.env.CRON_SECRET,
  NODE_ENV: process.env.NODE_ENV,
}

const parsed = serverSchema.safeParse(raw)

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors
  // 빌드/부팅을 실패시켜서 "프로덕션 배포가 조용히 깨진 상태로 나가는" 사태를
  // 방지. Vercel 빌드 로그에 그대로 나타나므로 디버깅 쉬움.
  console.error('\n❌ 환경변수 검증 실패:')
  for (const [key, errors] of Object.entries(fieldErrors)) {
    if (errors?.length) {
      console.error(`  · ${key}: ${errors.join(', ')}`)
    }
  }
  console.error(
    '\n.env.local (또는 Vercel 프로젝트 Environment Variables)에 위 키를 ' +
      '채워주세요.\n'
  )
  throw new Error('Invalid environment variables — see logs above.')
}

// Post-parse 보강 검증:
//   - service_role 은 schema 단계에선 default('') 로 느슨하게 통과시켰으니
//     여기서 환경별로 분기. 프로덕션 빌드에서 키 누락은 배포 직전에 잡혀야 하니
//     여전히 즉시 throw.
//   - dev/test 에서는 빈 값 허용 + 한 번만 경고. 경고는 instrumentation 부팅 시점에
//     한 번만 찍혀서 로그가 도배되지 않는다.
if (!parsed.data.SUPABASE_SERVICE_ROLE_KEY) {
  if (parsed.data.NODE_ENV === 'production') {
    console.error(
      '\n❌ SUPABASE_SERVICE_ROLE_KEY is required in production ' +
        '(admin ops, payment webhook, cron jobs).\n',
    )
    throw new Error('Invalid environment variables — see logs above.')
  }
  console.warn(
    '\n⚠️  SUPABASE_SERVICE_ROLE_KEY 가 비어 있습니다 — 관리자/결제 웹훅/크론 ' +
      '경로는 런타임에 실패합니다. 공개 카탈로그만 둘러볼 거면 무시해도 됩니다.\n' +
      '   값을 넣으려면: Supabase Dashboard → Project Settings → API → ' +
      '"service_role" secret 복사 → .env.local 에 추가.\n',
  )
}

/**
 * 검증된 환경변수. 서버/엣지 코드에서 `process.env` 대신 이걸 써라.
 * - 타입 안전 (optional 필드는 `string | undefined`)
 * - 빈 문자열이 undefined로 정규화됨
 * - 누락 시 부팅 때 이미 throw — 여기까지 오면 "값 있음" 보장
 */
export const env = parsed.data

/** Feature flag 헬퍼 — 선택 env 그룹이 모두 채워졌을 때만 true. */
export const features = {
  // admin/service_role 경로가 쓸 준비가 됐는지. false 면 관리자 대시보드 진입
  // 시점에 UI 에서 "서비스 롤 키 미설정" 안내로 유저 혼란 줄일 수 있다.
  adminOps: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  sentry: Boolean(env.SENTRY_DSN ?? env.NEXT_PUBLIC_SENTRY_DSN),
  sentryUpload: Boolean(
    env.SENTRY_ORG && env.SENTRY_PROJECT && env.SENTRY_AUTH_TOKEN
  ),
  analytics: Boolean(env.NEXT_PUBLIC_GA_ID),
  metaPixel: Boolean(env.NEXT_PUBLIC_META_PIXEL_ID),
  tossPayments: Boolean(env.NEXT_PUBLIC_TOSS_CLIENT_KEY && env.TOSS_SECRET_KEY),
  webPush: Boolean(
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      env.VAPID_PRIVATE_KEY &&
      env.VAPID_SUBJECT
  ),
  anthropic: Boolean(env.ANTHROPIC_API_KEY),
  email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
} as const
