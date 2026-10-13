/**
 * 운영 점검 다이제스트 메일(관리자 → business.email) — 크론 app/api/cron/ops-digest 가 이상을 모아 보낸다.
 *
 * 예전엔 크론 라우트 안에서 본문을 그렸다. 2026-10-14 공용 틀 정리 때 다른 메일과 같은 곳(lib/email/templates)으로
 * 옮겼다 — 모든 메일이 renderLayout 하나를 쓰는지 한 폴더만 보면 알 수 있게(규칙225). 문구·항목·링크는 그대로다.
 */
import { block, EMAIL_COLORS, escape, renderLayout, SITE_URL } from '../layout.ts'

/** 표시 상한 — 메일이 비대해지지 않게 섹션별 최근/오래된 것 N개만. 크론의 조회 limit(N+1)도 이 값을 쓴다. */
export const OPS_DIGEST_MAX_ROWS = 15

export type CronErrorRow = {
  path: string
  error_message: string | null
  executed_at: string
}

export type RefundQueueRow = {
  id: string
  order_id: string
  status: string
  attempts: number
  last_error: string | null
  created_at: string
}

export type StalePendingOrderRow = {
  id: string
  order_number: string
  total_amount: number
  created_at: string
}

export type LowStockRow = {
  name: string | null
  slug: string | null
  stock: number | null
}

/**
 * 메일 못 받는 손님 — 수신차단 목록(email_suppressions: 주소 없음 반송·스팸 신고)에 걸린 회원 수(2026-10-14 메일 점검 M4, 규칙238).
 * 이 손님들에겐 주문·결제·입금·가격 변경 안내 메일이 **하나도** 안 나간다(lib/email/client). 해제 화면이 없어 사장님이
 * 모르면 영영 모른다 — 그래서 운영 점검 메일에 숫자로 싣는다. 새로 생긴 손님(24시간)이 있으면 그 자체로 점검 메일을 보낸다.
 */
export type MailBlockedSummary = {
  /** 지금 메일을 못 받는 회원 수. */
  customers: number
  /** 그중 최근 24시간에 새로 막힌 회원 수. */
  newIn24h: number
  /** 이유별 — 주소 없음 반송(hard_bounce) · 스팸 신고(complaint). */
  hardBounce: number
  complaint: number
}

export type OpsDigestInput = {
  /** 집계 자체가 실패한 항목 — 숫자를 못 믿는다는 경고를 맨 위에 싣는다. */
  failures: string[]
  /** 메일 못 받는 손님(없으면 줄을 싣지 않는다). */
  mailBlocked?: MailBlockedSummary | null
  cronErrors: CronErrorRow[]
  refundRows: RefundQueueRow[]
  refundPending: number
  refundPermFailed: number
  staleOrders: StalePendingOrderRow[]
  lowStock: LowStockRow[]
  /** 재고 부족 기준(lib/products/stock STOCK_LOW_THRESHOLD) — 문장에 그대로 쓴다. */
  lowStockThreshold: number
  generatedAt: number
}

const MAX_ROWS = OPS_DIGEST_MAX_ROWS
const C = EMAIL_COLORS

// ── KST 날짜/시각 포맷 ──
export function formatKstDate(ms: number): string {
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

/** 목록 한 줄(굵은 첫 줄 + 회색 둘째 줄 + 선택 빨간 오류 줄). 인자는 이미 escape 된 HTML. */
function itemRow(firstLine: string, secondLine: string, errorLine?: string | null): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${C.line};font-size:15px;line-height:1.5;color:${C.ink};">
      <div>${firstLine}</div>
      <div style="font-size:13px;color:${C.mute};margin-top:2px;">${secondLine}</div>
      ${errorLine ? `<div style="font-size:13px;color:${C.red};margin-top:3px;word-break:break-word;">${errorLine}</div>` : ''}
    </td>
  </tr>`
}

function rowsTable(rowsHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-top:2px solid ${C.ink};">${rowsHtml}</table>`
}

/** 섹션 제목 + 설명 + 본문 테이블 + (선택) more 라인 + (선택) 섹션 CTA 링크. */
function sectionBlock(
  title: string,
  description: string,
  tableHtml: string,
  more: string | null,
  link?: { label: string; href: string },
): string {
  return `<div style="margin-top:28px;">
    <div style="font-size:19px;line-height:1.35;font-weight:900;color:${C.ink};letter-spacing:-0.03em;">${escape(title)}</div>
    <div style="font-size:14px;color:${C.mute};line-height:1.6;margin:4px 0 10px;">${escape(description)}</div>
    ${tableHtml}
    ${more ? `<div style="font-size:13px;color:${C.mute};margin-top:8px;">${escape(more)}</div>` : ''}
    ${
      link
        ? `<div style="margin-top:12px;"><a href="${escape(link.href)}" style="font-size:15px;color:${C.ink};text-decoration:underline;font-weight:800;">${escape(link.label)} →</a></div>`
        : ''
    }
  </div>`
}

export function renderOpsDigest(input: OpsDigestInput): { subject: string; html: string } {
  const { failures, cronErrors, refundRows, refundPending, refundPermFailed, staleOrders, lowStock } = input
  const now = input.generatedAt

  const mailBlocked = input.mailBlocked && input.mailBlocked.customers > 0 ? input.mailBlocked : null
  const totalIssues = cronErrors.length + refundRows.length + staleOrders.length + lowStock.length + (mailBlocked?.newIn24h ?? 0)
  const subject = `[파머스테일 운영] 점검 필요 ${totalIssues}건 — ${formatKstDate(now)}`

  const sections: string[] = []

  // ★맨 위 — 집계 자체가 실패했으면 아래 숫자를 믿으면 안 된다고 먼저 말한다.
  //   "0건"과 "못 셌음"은 다르고, 그 차이를 아는 건 사람뿐이다.
  if (failures.length > 0) {
    sections.push(
      block.callout(
        'sale',
        `<strong>이 메일의 숫자를 그대로 믿지 마세요.</strong><br />` +
          `아래 항목을 집계하지 못했습니다 — 실제 문제가 더 있을 수 있어요.<br />` +
          failures.map((f) => `· ${escape(f)}`).join('<br />'),
      ),
    )
    sections.push('<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>')
  }

  // 상단 요약 라인
  const summaryItems: string[] = []
  if (failures.length > 0) summaryItems.push(`집계 실패 ${failures.length}건`)
  if (cronErrors.length > 0) summaryItems.push(`cron 실패 ${cronErrors.length}건`)
  if (refundRows.length > 0)
    summaryItems.push(`환불 큐 적체 ${refundRows.length}건 (대기 ${refundPending} / 영구실패 ${refundPermFailed})`)
  if (staleOrders.length > 0) summaryItems.push(`미결제 적체 ${staleOrders.length}건`)
  if (lowStock.length > 0) summaryItems.push(`재고 부족 ${lowStock.length}종`)
  if (mailBlocked) {
    summaryItems.push(
      `메일 못 받는 손님 ${mailBlocked.customers}명${mailBlocked.newIn24h > 0 ? ` (최근 24시간 새로 ${mailBlocked.newIn24h}명)` : ''}`,
    )
  }

  sections.push(
    block.callout(
      'sale',
      `<strong>최근 24시간 운영 점검 결과</strong><br/>${summaryItems.map((s) => `· ${escape(s)}`).join('<br/>')}`,
    ),
  )

  // 1) cron 실패
  if (cronErrors.length > 0) {
    const rowsHtml = cronErrors
      .slice(0, MAX_ROWS)
      .map((c) =>
        itemRow(
          `<strong>${escape(c.path)}</strong>`,
          `${escape(formatKstDateTime(c.executed_at))} · ${escape(hoursAgo(c.executed_at, now))}`,
          c.error_message ? escape(c.error_message.slice(0, 240)) : null,
        ),
      )
      .join('')
    sections.push(
      sectionBlock(
        `🔴 cron 실패 (${cronErrors.length}건)`,
        '예약 작업이 24시간 내 실패했어요. Vercel Cron Logs / Sentry 에서 원인을 확인하세요.',
        rowsTable(rowsHtml),
        cronErrors.length > MAX_ROWS ? `외 ${cronErrors.length - MAX_ROWS}건 더 있어요.` : null,
      ),
    )
  }

  // 2) 환불 큐 적체
  if (refundRows.length > 0) {
    const rowsHtml = refundRows
      .slice(0, MAX_ROWS)
      .map((r) => {
        const statusLabel = r.status === 'permanently_failed' ? '영구 실패' : '대기'
        const statusColor = r.status === 'permanently_failed' ? C.red : C.ink
        return itemRow(
          `<span style="font-weight:800;color:${statusColor};">${escape(statusLabel)}</span> · 주문 ${escape(r.order_id.slice(0, 8))} · 재시도 ${r.attempts}회`,
          `${escape(formatKstDateTime(r.created_at))} 등록 · ${escape(hoursAgo(r.created_at, now))}`,
          r.last_error ? escape(r.last_error.slice(0, 200)) : null,
        )
      })
      .join('')
    sections.push(
      sectionBlock(
        `💳 환불 큐 적체 (${refundRows.length}건)`,
        `자동 환불이 처리되지 않고 남아 있어요 (대기 ${refundPending} · 영구실패 ${refundPermFailed}). 영구 실패 건은 운영자 수동 환불이 필요합니다.`,
        rowsTable(rowsHtml),
        refundRows.length > MAX_ROWS ? `외 ${refundRows.length - MAX_ROWS}건 더 있어요.` : null,
        { label: '환불 관리에서 보기', href: `${SITE_URL}/admin/refunds` },
      ),
    )
  }

  // 3) 미결제 적체
  if (staleOrders.length > 0) {
    const rowsHtml = staleOrders
      .slice(0, MAX_ROWS)
      .map((o) =>
        itemRow(
          `<strong>주문번호 ${escape(o.order_number)}</strong>`,
          `${o.total_amount.toLocaleString()}원 · ${escape(formatKstDateTime(o.created_at))} 생성 · ${escape(hoursAgo(o.created_at, now))}`,
        ),
      )
      .join('')
    sections.push(
      sectionBlock(
        `🧾 미결제 적체 (${staleOrders.length}건)`,
        '결제창에서 이탈해 24시간 넘게 미결제로 남은 주문이에요. 평소보다 많다면 결제 플로우 장애를 의심하세요.',
        rowsTable(rowsHtml),
        staleOrders.length > MAX_ROWS ? `외 ${staleOrders.length - MAX_ROWS}건 더 있어요.` : null,
        { label: '주문 관리에서 보기', href: `${SITE_URL}/admin/orders` },
      ),
    )
  }

  // 4) 재고 부족
  if (lowStock.length > 0) {
    const rowsHtml = lowStock
      .slice(0, MAX_ROWS)
      .map((p) => itemRow(`<strong>${escape(p.name ?? p.slug ?? '(이름 없음)')}</strong>`, `남은 재고 ${p.stock ?? 0}개`))
      .join('')
    sections.push(
      sectionBlock(
        `📦 재고 부족 (${lowStock.length}종)`,
        `${input.lowStockThreshold}개 이하로 남은 판매중 상품이에요. 화요일 발송분에 이 레시피가 들어가면 박스가 못 나갑니다.`,
        rowsTable(rowsHtml),
        lowStock.length > MAX_ROWS ? `외 ${lowStock.length - MAX_ROWS}종 더 있어요.` : null,
        { label: '상품 관리에서 보기', href: `${SITE_URL}/admin/products` },
      ),
    )
  }

  // 5) 메일 못 받는 손님 — 수신차단 목록에 걸린 회원(규칙238). 거래 메일까지 안 나가므로 다른 길로 연락해야 한다.
  if (mailBlocked) {
    sections.push(
      sectionBlock(
        `✉️ 메일 못 받는 손님 (${mailBlocked.customers}명)`,
        `주문·결제·입금·가격 변경 안내 메일이 이 손님들에게 가지 않아요(주소 없음 반송 ${mailBlocked.hardBounce}명 · 스팸 신고 ${mailBlocked.complaint}명). 앱 알림이나 전화로 연락하고, 주소를 고쳤다면 차단을 풀어 주세요(email_suppressions).`,
        '',
        mailBlocked.newIn24h > 0 ? `최근 24시간에 새로 막힌 손님 ${mailBlocked.newIn24h}명` : null,
        { label: '회원 관리에서 보기', href: `${SITE_URL}/admin/users` },
      ),
    )
  }

  sections.push(
    block.note(
      `이 메일은 매일 오전 8시 운영 점검 cron(ops-digest)이 이상 발견 시에만 자동
      발송해요. 이상이 없는 날은 보내지 않습니다. 집계 기준 ${escape(formatKstDate(now))}.`,
      24,
    ),
  )

  const html = renderLayout({
    preview: `운영 점검 ${cronErrors.length + refundRows.length + staleOrders.length}건 — 확인이 필요해요`,
    kicker: '운영 점검',
    heading: '운영 점검이 필요해요',
    body: sections.join('\n'),
    cta: { label: '관리자 대시보드 열기', href: `${SITE_URL}/admin` },
  })
  return { subject, html }
}
