/**
 * Farmer's Tail — cron 실행 audit helper.
 *
 * 모든 cron route 의 시작/종료 시각을 cron_health 테이블에 기록 → admin
 * 대시보드에서 "최근 24h 실패한 cron N건" 같은 시그널 노출.
 *
 * # 사용
 *   export async function GET(req: Request) {
 *     if (!isAuthorizedCronRequest(req)) return NextResponse.json({...}, {status: 401})
 *     return await trackCron('subscription-charge', async () => {
 *       const supabase = createAdminClient()
 *       // ... 기존 로직 ...
 *       return NextResponse.json({ ok: true, processed: 10 })
 *     })
 *   }
 *
 * # 동작
 *  - 시작 시각 기록 → handler 실행 → 성공 시 cron_health row insert (status='success', duration_ms, summary)
 *  - 실패 시 (throw) → cron_health row insert (status='error', error_message), 다시 throw
 *  - cron_health insert 자체가 실패해도 handler 결과는 그대로 전달 (silent swallow)
 *
 * # 보안
 * 호출 전에 isAuthorizedCronRequest 가 통과해야 함. 그 이후 admin client 로
 * insert. RLS 는 select 만 admin 으로 제한, write 는 service_role 자동 통과.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeLogText } from '@/lib/log-sanitize'

export async function trackCron<T extends Response>(
  path: string,
  handler: () => Promise<T>,
): Promise<T> {
  const start = Date.now()
  try {
    const result = await handler()
    const durationMs = Date.now() - start
    // result 는 Response — clone 해서 body 한 번 더 읽음 (summary 캡처).
    let summary: Record<string, unknown> | null = null
    try {
      const cloned = result.clone()
      const json = (await cloned.json()) as Record<string, unknown>
      // 큰 결과는 안 잡고 핵심만 (count / processed 류).
      summary = pickSummary(json)
    } catch {
      // body 가 JSON 아니면 summary 없이 통과
    }
    void recordHealth(path, 'success', durationMs, null, summary)
    return result
  } catch (err) {
    const durationMs = Date.now() - start
    // 점검 J: 위생 처리(제어문자→공백/PII 마스킹/길이 cap)를 message 생성 시점에
    // 한 번 — recordHealth(DB) + notifyCronError(Sentry) 양쪽에 동일 적용.
    const message = sanitizeLogText(
      err instanceof Error ? err.message : 'unknown cron error',
      500,
    )
    void recordHealth(path, 'error', durationMs, message, null)
    // R87-C5 (D14): cron 실패는 매일 admin 대시보드 직접 확인이 필요 — 알림 보강.
    // Sentry breadcrumb + captureBusinessEvent 로 운영자에게 즉시 가시화.
    // Sentry alert rule 에서 `cron.error` 태그로 Slack/email 발화 (B7 user action).
    void notifyCronError(path, message, durationMs)
    throw err
  }
}

async function notifyCronError(
  path: string,
  message: string,
  durationMs: number,
): Promise<void> {
  try {
    const { captureBusinessEvent } = await import('@/lib/sentry/trace')
    captureBusinessEvent('error', 'cron.error', {
      cron_path: path,
      duration_ms: durationMs,
      error_message: message.slice(0, 500),
    })
  } catch {
    /* Sentry 없으면 무시 — cron_health 테이블에 이미 기록됨 */
  }
}

async function recordHealth(
  path: string,
  status: 'success' | 'error',
  durationMs: number,
  errorMessage: string | null,
  summary: Record<string, unknown> | null,
): Promise<void> {
  try {
    const admin = createAdminClient()
    // audit #79: cron_health.path 컬럼 누락 (generated types 미갱신) → untyped cast.
    // summary 는 Record → JSON 정규화.
    const summaryJson = summary
      ? JSON.parse(JSON.stringify(summary))
      : null
    await (admin as unknown as {
      from: (t: string) => {
        insert: (r: Record<string, unknown>) => Promise<unknown>
      }
    }).from('cron_health').insert({
      path,
      status,
      duration_ms: durationMs,
      error_message: errorMessage,
      result_summary: summaryJson,
    })
  } catch {
    // cron_health insert 실패가 cron 본체에 영향 X — 조용히 통과.
  }
}

/** result body 에서 운영 시그널만 잡아 keep — 큰 array / PII 제거. */
function pickSummary(json: Record<string, unknown>): Record<string, unknown> {
  const allow = [
    'ok',
    'checked',
    'sent',
    'failed',
    'succeeded',
    'skipped',
    'expired',
    'purged',
    'delivered',
    'polled',
    'errors',
    'pushed',
    'matched',
    'notified',
    'today',
    'cutoff',
    'reason',
  ]
  const out: Record<string, unknown> = {}
  for (const k of allow) {
    if (k in json) out[k] = json[k]
  }
  return out
}
