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
 *
 * # 스팸 방지
 *   이상이 0건이면 메일 발송 skip → { ok:true, skipped:'no_issues' }.
 *   매일 "이상 없음" 메일로 받은편지함을 채우지 않는다.
 *
 * # 멱등/안전 (베스트에포트)
 *   메일 발송이 실패해도 cron 자체는 200. sendEmail 결과는 응답에 로깅.
 *   집계 쿼리 자체가 실패하면 trackCron 이 cron_health 에 error 로 기록.
 *
 * # 스케줄 — 매일 한국 오전 8시 (UTC 23:00, "0 23 * * *")
 * # 보안 — Bearer CRON_SECRET (isAuthorizedCronRequest)
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { sendEmail } from '@/lib/email/client'
import { renderLayout, block, escape, SITE_URL } from '@/lib/email/layout'
import { business } from '@/lib/business'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000
// 표시 상한 — 메일이 비대해지지 않게 섹션별 최근/오래된 것 N개만.
const MAX_ROWS = 15

type CronErrorRow = {
  path: string
  error_message: string | null
  executed_at: string
}

type RefundQueueRow = {
  id: string
  order_id: string
  status: string
  attempts: number
  last_error: string | null
  created_at: string
}

type StalePendingOrderRow = {
  id: string
  order_number: string
  total_amount: number
  created_at: string
}

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
  const { data: cronErrorsRaw } = await supabase
    .from('cron_health')
    .select('path, error_message, executed_at')
    .eq('status', 'error')
    .gte('executed_at', since24h)
    .order('executed_at', { ascending: false })
    .limit(MAX_ROWS + 1)
  const cronErrors = (cronErrorsRaw ?? []) as CronErrorRow[]

  // ── 2) payment_refund_queue — 미해결(pending/permanently_failed) 적체 ──
  //    payment_refund_queue 는 generated types 에 아직 없음 (refund-retry 와
  //    동일) → untyped cast. status 정식 값: pending/succeeded/permanently_failed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminUntyped = supabase as any
  const { data: refundRowsRaw } = await adminUntyped
    .from('payment_refund_queue')
    .select('id, order_id, status, attempts, last_error, created_at')
    .in('status', ['pending', 'permanently_failed'])
    .order('created_at', { ascending: true }) // 오래된 것 우선
    .limit(MAX_ROWS + 1)
  const refundRows = (refundRowsRaw ?? []) as RefundQueueRow[]
  const refundPending = refundRows.filter((r) => r.status === 'pending').length
  const refundPermFailed = refundRows.filter(
    (r) => r.status === 'permanently_failed',
  ).length

  // ── 3) orders — payment_status='pending' & 24h+ 경과 미결제 적체 ──
  //    order_status 도 'pending' 인 것만 (취소/만료 처리된 건 제외) — 결제창
  //    이탈로 남은 진짜 미결제만 집계. 20260527000007 의 부분 인덱스와 동일 조건.
  const { data: staleOrdersRaw } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, created_at')
    .eq('payment_status', 'pending')
    .eq('order_status', 'pending')
    .lt('created_at', since24h)
    .order('created_at', { ascending: true })
    .limit(MAX_ROWS + 1)
  const staleOrders = (staleOrdersRaw ?? []) as StalePendingOrderRow[]

  const issueCount =
    cronErrors.length + refundRows.length + staleOrders.length

  // ── 이상 0건 → 발송 skip (스팸 방지) ──
  if (issueCount === 0) {
    return NextResponse.json({ ok: true, skipped: 'no_issues' })
  }

  // ── HTML 다이제스트 작성 ──
  const html = renderDigest({
    cronErrors,
    refundRows,
    refundPending,
    refundPermFailed,
    staleOrders,
    generatedAt: now,
  })

  const totalIssues =
    cronErrors.length + refundRows.length + staleOrders.length
  const result = await sendEmail({
    to: business.email,
    subject: `[파머스테일 운영] 점검 필요 ${totalIssues}건 — ${formatKstDate(now)}`,
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
    },
    emailSent: result.ok === true,
    emailSkipped: result.ok === false && result.skipped === true,
  })
}

// ── KST 날짜/시각 포맷 ──
function formatKstDate(ms: number): string {
  const kst = new Date(ms + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
}

function formatKstDateTime(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(kst.getUTCDate()).padStart(2, '0')
  const hh = String(kst.getUTCHours()).padStart(2, '0')
  const mm = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${m}.${d} ${hh}:${mm}`
}

function hoursAgo(iso: string, now: number): string {
  const diffH = Math.floor((now - new Date(iso).getTime()) / (60 * 60 * 1000))
  if (diffH < 24) return `${diffH}시간 전`
  return `${Math.floor(diffH / 24)}일 전`
}

// ── 다이제스트 HTML ──
function renderDigest(input: {
  cronErrors: CronErrorRow[]
  refundRows: RefundQueueRow[]
  refundPending: number
  refundPermFailed: number
  staleOrders: StalePendingOrderRow[]
  generatedAt: number
}): string {
  const { cronErrors, refundRows, refundPending, refundPermFailed, staleOrders } =
    input
  const now = input.generatedAt

  const sections: string[] = []

  // 상단 요약 라인
  const summaryItems: string[] = []
  if (cronErrors.length > 0)
    summaryItems.push(`cron 실패 ${cronErrors.length}건`)
  if (refundRows.length > 0)
    summaryItems.push(
      `환불 큐 적체 ${refundRows.length}건 (대기 ${refundPending} / 영구실패 ${refundPermFailed})`,
    )
  if (staleOrders.length > 0)
    summaryItems.push(`미결제 적체 ${staleOrders.length}건`)

  sections.push(
    block.callout(
      'sale',
      `<strong>최근 24시간 운영 점검 결과</strong><br/>${summaryItems
        .map((s) => `· ${escape(s)}`)
        .join('<br/>')}`,
    ),
  )

  // 1) cron 실패
  if (cronErrors.length > 0) {
    const shown = cronErrors.slice(0, MAX_ROWS)
    const rowsHtml = shown
      .map(
        (c) => `<tr>
          <td style="padding:8px 0;font-size:12px;color:#1E1A14;border-bottom:1px solid #F0EADB;">
            <div style="font-weight:700;">${escape(c.path)}</div>
            <div style="font-size:11px;color:#7A7A7A;margin-top:2px;">${escape(
              formatKstDateTime(c.executed_at),
            )} · ${escape(hoursAgo(c.executed_at, now))}</div>
            ${
              c.error_message
                ? `<div style="font-size:11px;color:#C44B3A;margin-top:3px;word-break:break-all;">${escape(
                    c.error_message.slice(0, 240),
                  )}</div>`
                : ''
            }
          </td>
        </tr>`,
      )
      .join('')
    sections.push(
      sectionBlock(
        `🔴 cron 실패 (${cronErrors.length}건)`,
        '예약 작업이 24시간 내 실패했어요. Vercel Cron Logs / Sentry 에서 원인을 확인하세요.',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rowsHtml}</table>`,
        cronErrors.length > MAX_ROWS
          ? `외 ${cronErrors.length - MAX_ROWS}건 더 있어요.`
          : null,
      ),
    )
  }

  // 2) 환불 큐 적체
  if (refundRows.length > 0) {
    const shown = refundRows.slice(0, MAX_ROWS)
    const rowsHtml = shown
      .map((r) => {
        const statusLabel =
          r.status === 'permanently_failed' ? '영구 실패' : '대기'
        const statusColor =
          r.status === 'permanently_failed' ? '#C44B3A' : '#B5533A'
        return `<tr>
          <td style="padding:8px 0;font-size:12px;color:#1E1A14;border-bottom:1px solid #F0EADB;">
            <div>
              <span style="font-weight:700;color:${statusColor};">${escape(
                statusLabel,
              )}</span>
              · 주문 ${escape(r.order_id.slice(0, 8))} · 재시도 ${r.attempts}회
            </div>
            <div style="font-size:11px;color:#7A7A7A;margin-top:2px;">${escape(
              formatKstDateTime(r.created_at),
            )} 등록 · ${escape(hoursAgo(r.created_at, now))}</div>
            ${
              r.last_error
                ? `<div style="font-size:11px;color:#C44B3A;margin-top:3px;word-break:break-all;">${escape(
                    r.last_error.slice(0, 200),
                  )}</div>`
                : ''
            }
          </td>
        </tr>`
      })
      .join('')
    sections.push(
      sectionBlock(
        `💳 환불 큐 적체 (${refundRows.length}건)`,
        `자동 환불이 처리되지 않고 남아 있어요 (대기 ${refundPending} · 영구실패 ${refundPermFailed}). 영구 실패 건은 운영자 수동 환불이 필요합니다.`,
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rowsHtml}</table>`,
        refundRows.length > MAX_ROWS
          ? `외 ${refundRows.length - MAX_ROWS}건 더 있어요.`
          : null,
        { label: '환불 관리에서 보기', href: `${SITE_URL}/admin/refunds` },
      ),
    )
  }

  // 3) 미결제 적체
  if (staleOrders.length > 0) {
    const shown = staleOrders.slice(0, MAX_ROWS)
    const rowsHtml = shown
      .map(
        (o) => `<tr>
          <td style="padding:8px 0;font-size:12px;color:#1E1A14;border-bottom:1px solid #F0EADB;">
            <div style="font-weight:700;">주문번호 ${escape(o.order_number)}</div>
            <div style="font-size:11px;color:#7A7A7A;margin-top:2px;">${o.total_amount.toLocaleString()}원 · ${escape(
              formatKstDateTime(o.created_at),
            )} 생성 · ${escape(hoursAgo(o.created_at, now))}</div>
          </td>
        </tr>`,
      )
      .join('')
    sections.push(
      sectionBlock(
        `🧾 미결제 적체 (${staleOrders.length}건)`,
        '결제창에서 이탈해 24시간 넘게 미결제로 남은 주문이에요. 평소보다 많다면 결제 플로우 장애를 의심하세요.',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rowsHtml}</table>`,
        staleOrders.length > MAX_ROWS
          ? `외 ${staleOrders.length - MAX_ROWS}건 더 있어요.`
          : null,
        { label: '주문 관리에서 보기', href: `${SITE_URL}/admin/orders` },
      ),
    )
  }

  sections.push(
    `<p style="margin:18px 0 0;font-size:11px;color:#9A9A9A;line-height:1.6;">
      이 메일은 매일 오전 8시 운영 점검 cron(ops-digest)이 이상 발견 시에만 자동
      발송해요. 이상이 없는 날은 보내지 않습니다. 집계 기준 ${escape(
        formatKstDate(now),
      )}.
    </p>`,
  )

  return renderLayout({
    preview: `운영 점검 ${
      cronErrors.length + refundRows.length + staleOrders.length
    }건 — 확인이 필요해요`,
    kicker: 'Ops Digest · 운영 점검',
    heading: '운영 점검이 필요해요',
    icon: '🛠️',
    body: sections.join('\n'),
    cta: { label: '관리자 대시보드 열기', href: `${SITE_URL}/admin` },
  })
}

/** 섹션 제목 + 설명 + 본문 테이블 + (선택) more 라인 + (선택) 섹션 CTA 링크. */
function sectionBlock(
  title: string,
  description: string,
  tableHtml: string,
  more: string | null,
  link?: { label: string; href: string },
): string {
  return `<div style="margin-top:22px;">
    <div style="font-size:14px;font-weight:800;color:#1E1A14;letter-spacing:-0.01em;">${escape(
      title,
    )}</div>
    <div style="font-size:12px;color:#7A7A7A;line-height:1.6;margin:4px 0 8px;">${escape(
      description,
    )}</div>
    ${tableHtml}
    ${
      more
        ? `<div style="font-size:11px;color:#9A9A9A;margin-top:8px;">${escape(
            more,
          )}</div>`
        : ''
    }
    ${
      link
        ? `<div style="margin-top:10px;"><a href="${escape(
            link.href,
          )}" style="font-size:12px;color:#B5533A;text-decoration:none;font-weight:700;">${escape(
            link.label,
          )} →</a></div>`
        : ''
    }
  </div>`
}
