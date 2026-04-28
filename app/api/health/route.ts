import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel 의 region 자동 라우팅 — 가까운 엣지에서 응답.
export const fetchCache = 'force-no-store'

/**
 * GET /api/health — uptime / synthetic monitoring 용 헬스체크.
 *
 * 외부 모니터 (UptimeRobot, BetterStack, Vercel Cron health pings) 가 200 응답
 * 만 보고 "살아있음" 으로 판단하도록 가볍게 설계. 동시에 핵심 의존성 (Supabase
 * 연결) 도 한 번 확인해 "Next.js 프로세스만 떠있고 DB 못 닿는" 상태도 잡는다.
 *
 * # 응답 형태
 *
 *   200 { status: "ok", timestamp, dependencies: { db: "ok" }, build }
 *   503 { status: "degraded", timestamp, dependencies: { db: "fail" }, build }
 *
 * 1요청 ~5-10ms — Vercel 무료 플랜의 cron 호출 한도에도 부담 없음.
 *
 * # 보안
 *
 * 인증 불필요 (intentional). 응답 본문에 비밀 정보 없음. 빌드 SHA 정도만
 * 노출 — 이미 Sentry release 로 외부에 알려진 정보.
 */
export async function GET() {
  const startedAt = Date.now()
  const buildInfo = {
    sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
  }

  let dbStatus: 'ok' | 'fail' = 'ok'
  let dbLatencyMs: number | null = null
  try {
    const supabase = await createClient()
    const t0 = Date.now()
    // 가장 가벼운 round-trip — auth.getUser() 는 RLS 와 무관하게 cookie 만 본다.
    // 익명 사용자도 정상 응답 (user=null, error=null). 네트워크 / 인증 스택 둘
    // 다 살아있는지 확인용.
    const { error } = await supabase.auth.getUser()
    dbLatencyMs = Date.now() - t0
    if (error && error.status && error.status >= 500) {
      dbStatus = 'fail'
    }
  } catch {
    dbStatus = 'fail'
  }

  const ok = dbStatus === 'ok'
  const body = {
    status: ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime_ms: Date.now() - startedAt,
    dependencies: {
      db: dbStatus,
      ...(dbLatencyMs !== null ? { db_latency_ms: dbLatencyMs } : {}),
    },
    build: buildInfo,
  }

  return NextResponse.json(body, {
    status: ok ? 200 : 503,
    headers: {
      // 캐시 절대 금지 — 의도적 fresh.
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
