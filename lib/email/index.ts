/**
 * Farmer's Tail — 메일 전송 공용 엔트리.
 *
 * 각 이벤트 훅(결제 confirm, 발송 처리, 취소 등) 에서 이 모듈의 `notifyXxx`
 * 를 부르면 (a) 수신자 이메일 조회, (b) 템플릿 렌더, (c) Resend 호출까지
 * 한 번에 처리한다. 실패는 베스트 에포트 — 주문 플로우를 막지 않는다.
 *
 * "왜 async 이지만 await 하지 않는가" 패턴:
 *   호출처는 `notifyOrderPlaced(...).catch(() => {})` 로 fire-and-forget
 *   한다. Vercel 서버리스는 응답 종료 후에도 pending promise 를 수 초간
 *   drain 해주기 때문에 대개 발송이 완료된다. 확실한 보장이 필요하면
 *   cron job / edge function 으로 빼는 게 맞다 (미래 과제).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from './client'
import {
  renderOrderCancelled,
  renderOrderConfirmation,
  renderOrderDelivered,
  renderOrderShipped,
  renderVirtualAccountWaiting,
  renderWelcome,
  type OrderEmailItem,
} from './templates/orders'
import {
  renderSubscriptionReminder,
  renderSubscriptionChargeFailed,
  type SubscriptionReminderItem,
} from './templates/subscription'
import {
  renderNewsletterConfirm,
  renderUnsubscribeAck,
} from './templates/newsletter'
import { renderNewsletterWelcome } from './templates/newsletter-welcome'
import { renderNewsletterVol01 } from './templates/newsletter-vol-01'
import { renderPersonalizationCycle } from './templates/personalization-cycle'
import { renderQuarterlyReport } from './templates/quarterly-report'
import { paymentMethodLabel } from '@/lib/payments/toss'

export { sendEmail }

type AnySupabase = SupabaseClient

/**
 * 주문에 연결된 수신자 정보 (이름/이메일) 조회. RLS 로 막히는 경우 서비스
 * 롤 클라이언트를 넘기는 호출처가 책임진다.
 */
async function resolveRecipient(
  supabase: AnySupabase,
  userId: string,
  fallbackName: string | null,
): Promise<{ email: string; name: string } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('email, name')
    .eq('id', userId)
    .single()
  if (!data?.email) return null
  return {
    email: data.email,
    name: data.name ?? fallbackName ?? '보호자',
  }
}

async function loadOrderItems(
  supabase: AnySupabase,
  orderId: string,
): Promise<OrderEmailItem[]> {
  const { data } = await supabase
    .from('order_items')
    .select('product_name, quantity, line_total')
    .eq('order_id', orderId)
  return (data ?? []) as OrderEmailItem[]
}

// ── 주문 접수 메일 (결제 DONE 직후) ──────────────────────────────────────────
export async function notifyOrderPlaced(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
    shippingFee: number
    paymentMethod: string | null
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderOrderConfirmation({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    shippingFee: input.shippingFee,
    paymentMethodLabel: paymentMethodLabel(input.paymentMethod),
    items,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'order-placed',
    idempotencyKey: `order-placed:${input.orderId}`,
  })
}

// ── 가상계좌 입금 대기 메일 ──────────────────────────────────────────────────
export async function notifyVirtualAccountWaiting(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
    bankCode: string | null
    accountNumber: string
    accountHolder: string | null
    dueDate: string | null
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderVirtualAccountWaiting({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    items,
    bankCode: input.bankCode,
    accountNumber: input.accountNumber,
    accountHolder: input.accountHolder,
    dueDate: input.dueDate,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'virtual-account-waiting',
    idempotencyKey: `va-waiting:${input.orderId}`,
  })
}

// ── 발송 시작 메일 ───────────────────────────────────────────────────────────
export async function notifyOrderShipped(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
    carrier: string | null
    trackingNumber: string | null
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderOrderShipped({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    items,
    carrier: input.carrier,
    trackingNumber: input.trackingNumber,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'order-shipped',
    idempotencyKey: `order-shipped:${input.orderId}`,
  })
}

// ── 배송 완료 메일 ───────────────────────────────────────────────────────────
export async function notifyOrderDelivered(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderOrderDelivered({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    items,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'order-delivered',
    idempotencyKey: `order-delivered:${input.orderId}`,
  })
}

// ── 주문 취소 메일 ───────────────────────────────────────────────────────────
export async function notifyOrderCancelled(
  supabase: AnySupabase,
  input: {
    orderId: string
    userId: string
    orderNumber: string
    recipientName: string | null
    totalAmount: number
    reason: string | null
    refundAmount: number | null
  },
) {
  const recipient = await resolveRecipient(supabase, input.userId, input.recipientName)
  if (!recipient) return
  const items = await loadOrderItems(supabase, input.orderId)
  const { subject, html } = renderOrderCancelled({
    recipientName: recipient.name,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    totalAmount: input.totalAmount,
    items,
    reason: input.reason,
    refundAmount: input.refundAmount,
  })
  await sendEmail({
    to: recipient.email,
    subject,
    html,
    tag: 'order-cancelled',
    idempotencyKey: `order-cancelled:${input.orderId}`,
  })
}

// ── 회원 가입 환영 메일 ──────────────────────────────────────────────────────
export async function notifyWelcome(
  input: { email: string; name: string | null },
) {
  const { subject, html } = renderWelcome({
    recipientName: input.name ?? '보호자',
  })
  await sendEmail({
    to: input.email,
    subject,
    html,
    tag: 'welcome',
    idempotencyKey: `welcome:${input.email}`,
  })
}

// ── 정기배송 알림 메일 ───────────────────────────────────────────────────────
/**
 * 정기배송 N일 전 도착 알림. cron 이 (subscription, days_before) 페어로 호출.
 * idempotencyKey 에 (subscription_id, date) 를 묶어 같은 회차에 중복 발송 방지.
 */
export async function notifySubscriptionReminder(input: {
  email: string
  name: string | null
  subscriptionId: string
  items: SubscriptionReminderItem[]
  nextDeliveryDate: string
  daysBefore: number
}) {
  const { subject, html } = renderSubscriptionReminder({
    recipientName: input.name ?? '보호자',
    items: input.items,
    nextDeliveryDate: input.nextDeliveryDate,
    daysBefore: input.daysBefore,
  })
  return sendEmail({
    to: input.email,
    subject,
    html,
    tag: 'subscription-reminder',
    // 같은 구독·같은 배송일 조합엔 24h 안에 중복 발송 X (Resend idempotency).
    idempotencyKey: `sub-reminder:${input.subscriptionId}:${input.nextDeliveryDate}`,
  })
}

/**
 * 정기배송 결제 실패 알림. cron (subscription-charge) 이 호출.
 * paused=true 면 3회 누적 실패로 자동 일시중단 — 별도 카피.
 */
export async function notifySubscriptionChargeFailed(input: {
  email: string
  name: string | null
  subscriptionId: string
  productLabel: string
  amount: number
  attemptCount: number
  paused: boolean
  reason?: string | null
  scheduledFor: string // YYYY-MM-DD
  errorClass?: 'permanent' | 'transient' | 'unknown'
  nextRetryAt?: string | null
}) {
  const { subject, html } = renderSubscriptionChargeFailed({
    recipientName: input.name ?? '보호자',
    productLabel: input.productLabel,
    amount: input.amount,
    attemptCount: input.attemptCount,
    paused: input.paused,
    reason: input.reason,
    errorClass: input.errorClass,
    nextRetryAt: input.nextRetryAt ?? null,
  })
  return sendEmail({
    to: input.email,
    subject,
    html,
    tag: 'subscription-charge-failed',
    idempotencyKey: `sub-charge-failed:${input.subscriptionId}:${input.scheduledFor}`,
  })
}

// ── 뉴스레터 ────────────────────────────────────────────────────────────────
/**
 * 뉴스레터 가입 confirm 메일. /api/newsletter 가 새 구독 insert 후 호출.
 * 정보통신망법 §50 — 광고성 정보 발송 동의 확인 절차 (double opt-in).
 */
export async function notifyNewsletterConfirm(input: {
  email: string
  confirmToken: string
}) {
  const { subject, html } = renderNewsletterConfirm({
    email: input.email,
    confirmToken: input.confirmToken,
  })
  return sendEmail({
    to: input.email,
    subject,
    html,
    tag: 'newsletter-confirm',
    // 같은 토큰엔 24h 안에 한 번만 — 재전송 트리거 시 새 토큰 받아야 함.
    idempotencyKey: `newsletter-confirm:${input.confirmToken}`,
  })
}

/**
 * 뉴스레터 confirm 직후 1회 발송하는 환영 메일.
 *
 * 호출 시점: /api/newsletter/confirm 이 status='confirmed' 마킹 직후 fire-and-
 * forget. unsubscribeToken 은 confirm 라우트에서 select 해 함께 넘긴다.
 *
 * 본문에 첫 주문 5,000원 할인 코드가 포함되어 (광고) 제목 + unsubscribe 링크
 * 가 들어있는 템플릿. idempotencyKey 로 중복 발송 방지 (동일 이메일에 24h
 * 안에 한 번만).
 */
export async function notifyNewsletterWelcome(input: {
  email: string
  unsubscribeToken: string
}) {
  const { subject, html } = renderNewsletterWelcome({
    email: input.email,
    unsubscribeToken: input.unsubscribeToken,
  })
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://farmerstail.kr'
  return sendEmail({
    to: input.email,
    subject,
    html,
    tag: 'newsletter-welcome',
    idempotencyKey: `newsletter-welcome:${input.email}`,
    // R87-A1: RFC 8058 List-Unsubscribe + One-Click — Gmail 2024.2 mandatory.
    unsubscribeUrl: `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(input.unsubscribeToken)}`,
  })
}

/**
 * Tail Letter Vol. 01 일괄 발송.
 *
 * status='confirmed' 인 newsletter_subscribers 전체를 돌며 배치 발송. 호출처
 * (scripts/send-newsletter-vol-01.ts 또는 추후 cron route) 는 service_role 클
 * 라이언트를 넘긴다.
 *
 * Rate limit: Resend free 는 2 rps, 유료는 10 rps. 안전하게 sequential 발송
 * + 200ms delay 로 충분. 사용자 규모가 커지면 Promise.allSettled + chunked
 * concurrency 로 옮기되 Resend 의 batch endpoint (POST /emails/batch, 100건/요청)
 * 로 옮기는 게 더 깔끔.
 *
 * idempotency: tag 에 'newsletter-vol-01' 박혀 있어서 Resend 대시보드에서
 * 같은 발송 묶음 집계 가능. 같은 이메일에 2번 발송 방지는 last_sent_at 으로
 * 막는다 (cron 옮긴 후엔 필수, 수동 스크립트는 호출자가 알아서).
 */
export async function broadcastNewsletterVol01(
  supabase: AnySupabase,
  options?: {
    /** 발송 후 last_sent_at 업데이트 여부. 테스트 시 false. */
    markSent?: boolean
    /** dry-run — 실제로 발송하지 않고 대상자 수만 리턴. */
    dryRun?: boolean
  },
): Promise<{ total: number; sent: number; failed: number; skipped: number }> {
  const markSent = options?.markSent ?? true
  const dryRun = options?.dryRun ?? false

  // confirmed 상태 + 같은 이슈를 아직 못 받은 구독자만. last_sent_at 이 24h
  // 이내면 스킵 — 실수로 두 번 트리거해도 중복 발송 차단.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: rows, error } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, unsubscribe_token, last_sent_at')
    .eq('status', 'confirmed')

  if (error || !rows) {
    return { total: 0, sent: 0, failed: 0, skipped: 0 }
  }

  type Row = {
    id: string
    email: string
    unsubscribe_token: string
    last_sent_at: string | null
  }
  const subscribers = rows as Row[]
  const eligible = subscribers.filter(
    (r) => !r.last_sent_at || r.last_sent_at < cutoff,
  )
  const skipped = subscribers.length - eligible.length

  if (dryRun) {
    return { total: subscribers.length, sent: 0, failed: 0, skipped }
  }

  let sent = 0
  let failed = 0
  for (const r of eligible) {
    try {
      const { subject, html } = renderNewsletterVol01({
        email: r.email,
        unsubscribeToken: r.unsubscribe_token,
      })
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://farmerstail.kr'
      const result = await sendEmail({
        to: r.email,
        subject,
        html,
        tag: 'newsletter-vol-01',
        // 같은 (이슈, 이메일) 페어로 24h 내 중복 발송 방지.
        idempotencyKey: `newsletter-vol-01:${r.email}`,
        // R87-A1: RFC 8058 — Gmail/Yahoo 2024.2 mandatory for bulk senders.
        unsubscribeUrl: `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(r.unsubscribe_token)}`,
      })
      if (result.ok) {
        sent += 1
        if (markSent) {
          await supabase
            .from('newsletter_subscribers')
            .update({ last_sent_at: new Date().toISOString() })
            .eq('id', r.id)
        }
      } else {
        failed += 1
      }
    } catch {
      failed += 1
    }
    // Resend free tier 는 2 rps — 안전하게 250ms 텀.
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return { total: subscribers.length, sent, failed, skipped }
}

/**
 * 마케팅 채널 수신거부 결과 통보. 정보통신망법 §50⑤ — 동의 철회 후 14일 내
 * 처리결과 통보 의무. profiles.agree_email/sms 가 false 로 토글된 직후 / 또는
 * /api/newsletter/unsubscribe 가 호출.
 */
export async function notifyUnsubscribeAck(input: {
  email: string
  channel: 'email' | 'sms' | 'newsletter'
}) {
  const { subject, html } = renderUnsubscribeAck({
    email: input.email,
    channel: input.channel,
  })
  return sendEmail({
    to: input.email,
    subject,
    html,
    tag: 'unsubscribe-ack',
    // 같은 (이메일, 채널) 페어로 24h 내 중복 발송 방지.
    idempotencyKey: `unsubscribe-ack:${input.email}:${input.channel}`,
  })
}

/**
 * Personalization cycle 진행 알림. cron 이 새 dog_formulas row 생성 후 호출.
 * push 와 함께 발송 — push OFF 사용자도 메일은 받게.
 */
export async function notifyPersonalizationCycle(input: {
  email: string
  recipientName: string
  dogName: string
  dogId: string
  cycleNumber: number
  recipeLabel: string
  reasoningLabels: string[]
}) {
  const { subject, html } = renderPersonalizationCycle({
    recipientName: input.recipientName,
    dogName: input.dogName,
    dogId: input.dogId,
    cycleNumber: input.cycleNumber,
    recipeLabel: input.recipeLabel,
    reasoningLabels: input.reasoningLabels,
  })
  return sendEmail({
    to: input.email,
    subject,
    html,
    tag: 'personalization-cycle',
    // 같은 (dog, cycle) 조합은 한 번만 — 재전송 방지.
    idempotencyKey: `personalization-cycle:${input.dogId}:${input.cycleNumber}`,
  })
}

/**
 * 분기 맞춤 영양 리포트 메일. cron `/api/cron/quarterly-report` 이 새싹 이상
 * 등급 회원에게 분기 1회 발송 (등급 혜택). 본인 강아지 데이터 요약이라
 * 거래/정보성 — 마케팅 수신동의 게이트 없음.
 */
export async function notifyQuarterlyReport(input: {
  email: string
  recipientName: string
  dogName: string
  dogId: string
  /** 멱등 키용 분기 키. 예: "2026-Q2" */
  quarterKey: string
  /** 표시용 분기 라벨. 예: "2026년 2분기" */
  quarterLabel: string
  weightKg: number | null
  bcsLabel: string | null
  feedG: number | null
  merKcal: number | null
  proteinPct: number | null
  fatPct: number | null
}) {
  const { subject, html } = renderQuarterlyReport({
    recipientName: input.recipientName,
    dogName: input.dogName,
    dogId: input.dogId,
    quarterLabel: input.quarterLabel,
    weightKg: input.weightKg,
    bcsLabel: input.bcsLabel,
    feedG: input.feedG,
    merKcal: input.merKcal,
    proteinPct: input.proteinPct,
    fatPct: input.fatPct,
  })
  return sendEmail({
    to: input.email,
    subject,
    html,
    tag: 'quarterly-report',
    // 같은 (dog, 분기) 조합은 한 번만 — 재전송 방지.
    idempotencyKey: `quarterly-report:${input.dogId}:${input.quarterKey}`,
  })
}
