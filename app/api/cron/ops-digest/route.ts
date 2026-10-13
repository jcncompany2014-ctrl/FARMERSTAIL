/**
 * /api/cron/ops-digest — 운영 이상 다이제스트 알림 (마스터피스 P1-O1/O2).
 *
 * # 왜 존재하나 — "코드 독립 알림 fallback"
 *  - 현재 운영 알림은 전부 Sentry 콘솔의 수동 룰 설정에 의존한다 (코드에
 *    알림 전달 경로 없음). Sentry rule 이 꺼져 있거나 미설정이면 운영자는
 *    장애를 영영 모를 수 있다.
 *  - 이 cron 은 Sentry 설정 여부와 무관하게, 매일 운영 이상을 DB 에서 직접
 *    집계해 운영자 이메일(business.email)로 종합 다이제스트 1통을 보낸다.
 *  - cron_health.error / refund 큐 적체 / 결제 미결 적체 → Sentry 가 죽어도
 *    이메일로는 도달.
 *
 * # 집계 항목 (모두 createAdminClient 로 직접 쿼리)
 *   1) cron_health — 최근 24h status='error' 행 (cron 이름 + error + 시각)
 *   2) payment_refund_queue — pending/permanently_failed 적체 (오래된 것 우선)
 *   3) orders — payment_status='pending' & created_at 24h+ 경과 미결제 적체
 *      (결제창 이탈 누적 비정상 감지)
 *   4) products — 재고 부족(아래 본문 주석)
 *   5) email_suppressions × profiles — 메일 못 받는 손님(거래 메일까지 막힘, 2026-10-14 규칙238).
 *      새로 막힌 손님(24h)만 이상으로 세고, 전체 숫자는 메일이 갈 때 같이 싣는다.
 *
 * # 스팸 방지
 *   이상이 0건이면 메일 발송 skip → { ok:true, skipped:'no_issues' }.
 *   매일 "이상 없음" 메일로 받은편지함을 채우지 않는다.
 *
 * # 멱등/안전 (베스트에포트)
 *   메일 발송이 실패해도 cron 자체는 200. sendEmail 결과는 응답에 로깅.
 *
 * # ★집계 실패는 "이상 없음"이 아니다 (2026-08-05 병렬 감사)
 *   전에는 세 집계가 전부 `const { data } = …` 로 error 를 안 꺼냈다. 조회가
 *   실패하면 `?? []` 로 접혀 issueCount === 0 → **메일 자체를 안 보냈다.**
 *   여기 주석은 "집계 쿼리가 실패하면 trackCron 이 error 로 기록"이라고
 *   주장했지만, supabase 는 throw 하지 않고 `{ error }` 를 돌려주므로
 *   trackCron 은 애초에 잡을 수가 없었다(규칙4 — 없는 방어를 주장하는 주석).
 *   "Sentry 가 죽어도 이메일로는 도달한다"가 존재 이유인 크론이 **자기 실패에
 *   침묵**했다. 지금은 조회 실패를 이슈로 세어 그 사실을 메일 맨 위에 싣는다 —
 *   숫자를 못 믿을 때는 못 믿는다고 말하는 게 안전망의 일이다.
 *
 * # 스케줄 — 매일 한국 오전 8시 (UTC 23:00, "0 23 * * *")
 * # 보안 — Bearer CRON_SECRET (isAuthorizedCronRequest)
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { sendEmail } from '@/lib/email/client'
import {
  OPS_DIGEST_MAX_ROWS,
  renderOpsDigest,
  type CronErrorRow,
  type LowStockRow,
  type MailBlockedSummary,
  type RefundQueueRow,
  type StalePendingOrderRow,
} from '@/lib/email/templates/ops-digest'
import { business } from '@/lib/business'
import { STOCK_LOW_THRESHOLD } from '@/lib/products/stock'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000
// 표시 상한 — 메일이 비대해지지 않게 섹션별 최근/오래된 것 N개만(메일 템플릿과 같은 값).
const MAX_ROWS = OPS_DIGEST_MAX_ROWS

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('ops-digest', () => runOpsDigest())
}

async function runOpsDigest(): Promise<Response> {
  const supabase = createAdminClient()
  const now = Date.now()
  const since24h = new Date(now - DAY_MS).toISOString()

  // ── 1) cron_health — 최근 24h 내 실패 행 (typed) ──
  const failures: string[] = []
  const { data: cronErrorsRaw, error: cronErrsErr } = await supabase
    .from('cron_health')
    .select('path, error_message, executed_at')
    .eq('status', 'error')
    .gte('executed_at', since24h)
    .order('executed_at', { ascending: false })
    .limit(MAX_ROWS + 1)
  if (cronErrsErr) failures.push(`cron_health 조회 실패: ${cronErrsErr.message}`)
  const cronErrors = (cronErrorsRaw ?? []) as CronErrorRow[]

  // ── 2) payment_refund_queue — 미해결(pending/permanently_failed) 적체 ──
  //    payment_refund_queue 는 generated types 에 아직 없음 (refund-retry 와
  //    동일) → untyped cast. status 정식 값: pending/succeeded/permanently_failed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminUntyped = supabase as any
  const { data: refundRowsRaw, error: refundErr } = await adminUntyped
    .from('payment_refund_queue')
    .select('id, order_id, status, attempts, last_error, created_at')
    .in('status', ['pending', 'permanently_failed'])
    .order('created_at', { ascending: true }) // 오래된 것 우선
    .limit(MAX_ROWS + 1)
  if (refundErr) {
    failures.push(`payment_refund_queue 조회 실패: ${String(refundErr.message ?? refundErr)}`)
  }
  const refundRows = (refundRowsRaw ?? []) as RefundQueueRow[]
  const refundPending = refundRows.filter((r) => r.status === 'pending').length
  const refundPermFailed = refundRows.filter(
    (r) => r.status === 'permanently_failed',
  ).length

  // ── 3) orders — payment_status='pending' & 24h+ 경과 미결제 적체 ──
  //    order_status 도 'pending' 인 것만 (취소/만료 처리된 건 제외) — 결제창
  //    이탈로 남은 진짜 미결제만 집계. 20260527000007 의 부분 인덱스와 동일 조건.
  const { data: staleOrdersRaw, error: staleErr } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, created_at')
    .eq('payment_status', 'pending')
    .eq('order_status', 'pending')
    .lt('created_at', since24h)
    .order('created_at', { ascending: true })
    .limit(MAX_ROWS + 1)
  if (staleErr) failures.push(`orders 조회 실패: ${staleErr.message}`)
  const staleOrders = (staleOrdersRaw ?? []) as StalePendingOrderRow[]

  /**
   * ── 4) 재고 부족 (2026-08-08 크론 감사) ──
   *
   * ★inventory-forecast·payment-ledger-reconcile 두 크론이 자기 주석에
   *   "직접 메일은 안 보낸다 — ops-digest 가 종합 메일을 보낸다" 고 적어
   *   뒀는데, **ops-digest 는 그 둘을 보고 있지 않았다**(문자열 0회).
   *   두 크론은 200 + Sentry 이벤트만 남기므로 trackCron 은 success 로 적고,
   *   Sentry 알림 룰이 없으면 사장님은 영영 모른다 — 이 파일 헤더가 스스로
   *   경고해 둔 바로 그 상태였다(AGENTS.md 규칙4).
   *
   *   원장 대조는 계산이 무거워 여기서 다시 돌리지 않는다. 대신 그 크론이
   *   남긴 cron_health 기록을 위 ①이 이미 본다(실패면 error 로 잡힌다).
   *   재고는 조회 한 번이면 되므로 여기서 직접 본다 — 품절이면 그날 박스가
   *   못 나간다.
   */
  const { data: lowStockRaw, error: lowStockErr } = await supabase
    .from('products')
    .select('name, slug, stock')
    .eq('is_active', true)
    .lte('stock', STOCK_LOW_THRESHOLD)
    .order('stock', { ascending: true })
    .limit(MAX_ROWS + 1)
  if (lowStockErr) failures.push(`재고 조회 실패: ${lowStockErr.message}`)
  const lowStock = (lowStockRaw ?? []) as LowStockRow[]

  const mailBlocked = await loadMailBlocked(supabase, since24h, failures)

  // 집계 실패 = 그 자체가 알려야 할 사건. 0건과 같은 취급을 하면
  // "이상 없음"으로 위장된다.
  // 메일 못 받는 손님은 **새로 막힌 사람(24시간)** 만 이상으로 센다 — 예전부터 막힌 손님 때문에 매일 메일이 오면
  // 이 메일이 소음이 된다. 다른 이상으로 메일이 갈 때는 전체 숫자가 같이 실린다.
  const issueCount =
    cronErrors.length +
    refundRows.length +
    staleOrders.length +
    lowStock.length +
    (mailBlocked?.newIn24h ?? 0) +
    failures.length

  // ── 이상 0건 → 발송 skip (스팸 방지). 실패가 하나라도 있으면 여기 안 걸린다. ──
  if (issueCount === 0) {
    return NextResponse.json({ ok: true, skipped: 'no_issues' })
  }

  // ── HTML 다이제스트 작성 — 공용 메일 틀(lib/email/templates/ops-digest, 규칙225) ──
  const { subject, html } = renderOpsDigest({
    failures,
    mailBlocked,
    cronErrors,
    refundRows,
    refundPending,
    refundPermFailed,
    staleOrders,
    lowStock,
    lowStockThreshold: STOCK_LOW_THRESHOLD,
    generatedAt: now,
  })

  const totalIssues =
    cronErrors.length + refundRows.length + staleOrders.length + lowStock.length + (mailBlocked?.newIn24h ?? 0)
  const result = await sendEmail({
    to: business.email,
    subject,
    html,
    tag: 'ops-digest',
  })

  // 베스트에포트: 발송 실패해도 200. 결과는 로깅 + 응답 body 에 담는다.
  if (result.ok === false) {
    if (result.skipped === true) {
      console.warn(
        `[ops-digest] 메일 발송 skip (${result.reason}) — RESEND_API_KEY 미설정 또는 수신차단. 이상 ${totalIssues}건 미통보.`,
      )
    } else {
      console.error(
        `[ops-digest] 메일 발송 실패 status=${result.status}: ${result.error}`,
      )
    }
  }

  return NextResponse.json({
    ok: true,
    issues: {
      cronErrors: cronErrors.length,
      refundQueue: refundRows.length,
      refundPending,
      refundPermanentlyFailed: refundPermFailed,
      stalePendingOrders: staleOrders.length,
      mailBlockedCustomers: mailBlocked?.customers ?? 0,
      mailBlockedNew24h: mailBlocked?.newIn24h ?? 0,
    },
    emailSent: result.ok === true,
    emailSkipped: result.ok === false && result.skipped === true,
  })
}

/**
 * 메일 못 받는 손님 — 수신차단 목록(email_suppressions) 중 회원(profiles.email) 주소만 센다(2026-10-14 메일 점검 M4, 규칙238).
 *
 * 수신차단은 거래 메일까지 막는다(lib/email/client). 막힌 사실은 Sentry 이벤트로만 남아, 알림 규칙이 없으면 사장님은
 * "결제됐는데 메일이 안 온다"는 손님 연락을 받고서야 안다. 그래서 운영 점검 메일에 숫자로 싣는다.
 * 조회 실패는 0명이 아니다 — failures 에 넣어 '숫자를 믿지 마세요' 경고로 올린다(규칙39와 같은 이유).
 * 차단 목록은 작다(하드바운스·스팸 신고만) — 최근 것부터 200개까지 본다.
 */
async function loadMailBlocked(
  supabase: ReturnType<typeof createAdminClient>,
  since24hIso: string,
  failures: string[],
): Promise<MailBlockedSummary | null> {
  const { data: suppRows, error: suppErr } = await supabase
    .from('email_suppressions')
    .select('email, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (suppErr) {
    failures.push(`메일 수신차단 목록 조회 실패: ${suppErr.message}`)
    return null
  }
  const rows = suppRows ?? []
  if (rows.length === 0) return null
  const { data: profRows, error: profErr } = await supabase
    .from('profiles')
    .select('email')
    .in(
      'email',
      rows.map((r) => r.email),
    )
  if (profErr) {
    failures.push(`메일 못 받는 손님 조회 실패: ${profErr.message}`)
    return null
  }
  const members = new Set((profRows ?? []).map((p) => (p.email ?? '').toLowerCase()).filter(Boolean))
  const blocked = rows.filter((r) => members.has(r.email.toLowerCase()))
  if (blocked.length === 0) return null
  return {
    customers: blocked.length,
    newIn24h: blocked.filter((r) => r.created_at >= since24hIso).length,
    hardBounce: blocked.filter((r) => r.reason === 'hard_bounce').length,
    complaint: blocked.filter((r) => r.reason === 'complaint').length,
  }
}
