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
import { isFailureStatus } from './cron-status.ts'
import { failureCountOf } from './cron-failure-count.ts'
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
    // ★최종감사 #21 (2026-07-29): void(fire-and-forget)였는데, Vercel 함수는
    //   응답 반환 시 백그라운드 promise 를 절단할 수 있다(이 리포의 R83-6 이
    //   push/email 을 같은 이유로 await 로 바꾼 전례). 특히 실패 경로는 throw
    //   직후 500 이 나가 insert 절단 확률이 더 높았다 — cron_health 전 기간
    //   error 행 0건이 이것과 부합. 기록은 반드시 완료 후 반환한다.
    // ★반환된 5xx 도 실패로 기록한다(2026-08-05).
    //   전에는 핸들러가 **throw 할 때만** error 였다. 그런데 2026-08-05 에
    //   크론 37곳에 넣은 조회 실패 가드는 전부 `NextResponse.json(..., 500)`
    //   을 **반환**한다 — 즉 "실패가 초록으로 집계된다"를 고치려던 수정이
    //   cron_health·ops-digest·Sentry 세 층 모두에서 여전히 초록이었다.
    //   (ops-digest 는 `.eq('status','error')` 로만 보고, daily-briefing 의
    //    워치독은 행 존재 여부만 보므로 성공 행이 있으면 "누락"도 아니다.)
    //   가드 37곳을 각각 고치는 대신 여기 한 곳에서 덮는다.
    const status = (result as unknown as { status?: number })?.status
    if (isFailureStatus(status)) {
      const reason =
        (summary && (summary.reason ?? summary.error)) ?? `HTTP ${status}`
      const message = sanitizeLogText(String(reason), 500)
      await recordHealth(path, 'error', durationMs, message, summary)
      // throw 경로와 동일하게 Sentry 도 울린다 — 기록만 하고 조용하면
      // "사람에게 알린다"는 이 가드들의 목적이 반만 달성된다.
      await notifyCronError(path, message, durationMs)
      return result
    }
    /**
     * ★"200 인데 실패 카운트가 있는" 크론도 실패로 본다 (2026-08-12 3라운드 감사).
     *
     * 2026-08-05 에 5xx **반환** 경로를 덮었는데, 그 사이로 다른 얼굴이 남아
     * 있었다: 크론이 실패를 **세어 body 에 담고 200 을 돌려주는** 경우다.
     *   · subscription-reminders: `{ sent, errors }` → errors 12 여도 200
     *   · quarterly-report:       `{ sent, failed }` → 전부 실패해도 200
     * 그러면 cron_health 는 success, ops-digest(status='error' 만 본다)는 침묵.
     * "오늘 리마인더가 한 통도 안 나갔다"가 어디에도 안 남는다.
     *
     * 크론 하나하나를 고치는 대신(그 방식이 2026-08-05 에 이미 한 번 새어서)
     * 집계 지점인 여기서 한 번에 판정한다. summary 의 실패 카운터는
     * pickSummary 가 이미 allow 목록으로 통과시킨 값들이다.
     */
    const failCount = failureCountOf(summary)
    if (failCount > 0) {
      const message = sanitizeLogText(
        `부분 실패 ${failCount}건 (HTTP 200 이지만 실패 카운터가 있음)`,
        500,
      )
      await recordHealth(path, 'error', durationMs, message, summary)
      await notifyCronError(path, message, durationMs)
      return result
    }
    await recordHealth(path, 'success', durationMs, null, summary)
    return result
  } catch (err) {
    const durationMs = Date.now() - start
    // 점검 J: 위생 처리(제어문자→공백/PII 마스킹/길이 cap)를 message 생성 시점에
    // 한 번 — recordHealth(DB) + notifyCronError(Sentry) 양쪽에 동일 적용.
    const message = sanitizeLogText(
      err instanceof Error ? err.message : 'unknown cron error',
      500,
    )
    await recordHealth(path, 'error', durationMs, message, null)
    // R87-C5 (D14): cron 실패는 매일 admin 대시보드 직접 확인이 필요 — 알림 보강.
    // Sentry breadcrumb + captureBusinessEvent 로 운영자에게 즉시 가시화.
    // Sentry alert rule 에서 `cron.error` 태그로 Slack/email 발화 (B7 user action).
    await notifyCronError(path, message, durationMs)
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
    // ★실패 카운터 — failureCountOf 가 이 값들을 보고 '200 인데 부분 실패'를
    //   판정한다. allow 에 없으면 summary 에서 잘려 나가 판정이 무력해진다
    //   (규칙을 넣고 입력을 막는 실수 — 여기서 함께 관리한다).
    'itemsFailed',
    'mailFailed',
    'mailSent',
    'paidSkipped',
  ]
  const out: Record<string, unknown> = {}
  for (const k of allow) {
    if (k in json) out[k] = json[k]
  }
  return out
}
