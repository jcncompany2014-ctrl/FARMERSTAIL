/**
 * R63 — admin/orders/[id] 에 표시되는 payment_events 시계열.
 *
 * CS 도구 — 이 주문에 무슨 일이 있었나? (paid → refunded → partial 등)
 * 한눈에 확인. payment_events 가 insert-only ledger 라 모든 이력 영원.
 *
 * Server component — admin 페이지라 RLS 자체로 admin 만 SELECT 통과.
 */
import { createClient } from '@/lib/supabase/server'
import { formatKstDateTime as formatDateTime } from '@/lib/datetime-kst'

interface Props {
  orderId: string
}

interface EventRow {
  id: string
  payment_key: string | null
  event_type: string
  amount: number
  prev_status: string | null
  new_status: string | null
  source: string
  metadata: Record<string, unknown> | null
  actor_user_id: string | null
  created_at: string
}

/**
 * 이 화면의 규칙 (2026-07-26 사장님 지적):
 * **개발자 용어를 그대로 찍지 않는다.** 예전엔 `cron · pending → cancelled` 과
 * `{"reason": "..."}` JSON 덩어리가 그대로 보여서 읽을 수가 없었다.
 * DB 원본값(status·source·metadata)은 전부 아래 표를 거쳐 한국어로 바꾼다.
 * 표에 없는 값이 들어오면 원본이 보이므로, 새 이벤트를 추가하면 여기도 추가할 것.
 */
const EVENT_LABEL: Record<string, string> = {
  paid: '결제 완료',
  refunded: '전체 환불',
  partial_refunded: '부분 환불',
  failed: '결제 실패',
  cancel_requested: '취소 처리',
  webhook_received: '토스에서 알려옴',
  admin_action: '관리자가 직접 처리',
  cron_refund_queue: '자동 환불 재시도',
}

const SOURCE_LABEL: Record<string, string> = {
  user_checkout: '고객 결제',
  toss_webhook: '토스 알림',
  user_cancel: '고객이 취소',
  partial_cancel: '부분 취소',
  cron_refund_queue: '자동 환불 재시도',
  cron_subscription_charge: '정기배송 자동결제',
  cron_order_expire: '자동 만료 처리',
  admin_panel: '관리자 화면',
}

/** 결제 상태 DB 값 → 사람 말. `pending → cancelled` 같은 게 안 보이게. */
const STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  failed: '결제 실패',
  cancelled: '취소됨',
  expired: '기간 만료',
  refunded: '환불 완료',
  partially_refunded: '부분 환불',
  ready: '결제 준비',
}

/** metadata JSON 키 → 사람 말. reason 은 이미 한국어 문장이라 그대로 쓴다. */
const META_LABEL: Record<string, string> = {
  reason: '사유',
  cancel_reason: '취소 사유',
  refund_amount: '환불 금액',
  requested_by: '요청자',
  retry_count: '재시도 횟수',
  error_code: '오류 코드',
  error_message: '오류 내용',
}

/** 사람이 못 읽는 내부 식별자 — 화면에서 감춘다(필요하면 Sentry·DB 에서 본다). */
const META_HIDDEN = new Set([
  'paymentKey',
  'payment_key',
  'orderId',
  'order_id',
  'idempotencyKey',
  'idempotency_key',
  'transactionKey',
])

function formatMetaValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return v.toLocaleString()
  if (typeof v === 'boolean') return v ? '예' : '아니오'
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

export default async function PaymentEventTimeline({ orderId }: Props) {
  const supabase = await createClient()

  // generated types 에 아직 payment_events 없음 → cast.
  // ★error 를 cast 타입에 포함 (2026-09-05 전수감사, AGENTS.md 규칙1) —
  //   예전 cast 는 { data } 만 있어서 조회 실패가 "기록된 이벤트가 없어요"로
  //   위장됐다. 돈의 시계열을 보는 CS 도구에서 그 둘이 같으면 안 된다.
  const client = supabase.from('payment_events' as never) as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data: EventRow[] | null
          error: { message: string } | null
        }>
      }
    }
  }
  const { data: rawEvents, error: eventsErr } = await client
    .select(
      'id, payment_key, event_type, amount, prev_status, new_status, source, metadata, actor_user_id, created_at',
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
  if (eventsErr) {
    console.error('[admin-order-detail] 결제 원장 조회 실패:', eventsErr.message)
  }

  const events = (rawEvents ?? []) as EventRow[]
  const balance = events.reduce((sum, e) => sum + (e.amount ?? 0), 0)

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-bold">결제 원장 (Payment Events)</h2>
        {!eventsErr && (
          <div className="text-xs text-muted-foreground">
            잔액:{' '}
            <span className="font-mono font-semibold text-foreground">
              {balance.toLocaleString()}원
            </span>
          </div>
        )}
      </div>

      {eventsErr ? (
        <p className="py-4 text-center text-xs text-destructive">
          결제 원장을 불러오지 못했어요 — 새로고침해 주세요. (기록이 없는 게
          아니라 조회가 실패한 상태예요)
        </p>
      ) : events.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          기록된 이벤트가 없어요. 결제·환불이 발생하면 자동으로 누적됩니다.
        </p>
      ) : (
        <ol className="space-y-3">
          {events.map((e) => {
            const isRefund = e.amount < 0
            return (
              <li
                key={e.id}
                className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div
                  className={`mt-2 size-2 shrink-0 rounded-full ${
                    isRefund ? 'bg-destructive' : 'bg-emerald-600'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-semibold">
                      {EVENT_LABEL[e.event_type] ?? e.event_type}
                    </span>
                    <span
                      className={`font-mono text-[13px] font-semibold ${
                        isRefund ? 'text-destructive' : ''
                      }`}
                    >
                      {e.amount > 0 ? '+' : ''}{e.amount.toLocaleString()}원
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {formatDateTime(e.created_at)}
                    {' · '}
                    출처: {SOURCE_LABEL[e.source] ?? e.source}
                    {e.prev_status && e.new_status && (
                      <>
                        {' · '}
                        {STATUS_LABEL[e.prev_status] ?? e.prev_status} →{' '}
                        {STATUS_LABEL[e.new_status] ?? e.new_status}
                      </>
                    )}
                  </div>
                  {(() => {
                    // JSON 덩어리 대신 '라벨: 값' 줄로. 내부 식별자는 감춘다.
                    const entries = Object.entries(e.metadata ?? {}).filter(
                      ([k]) => !META_HIDDEN.has(k),
                    )
                    if (entries.length === 0) return null
                    return (
                      <ul className="mt-1.5 space-y-0.5 rounded border border-border bg-secondary px-2.5 py-1.5">
                        {entries.map(([k, v]) => (
                          <li
                            key={k}
                            className="break-keep text-[11px] leading-snug"
                          >
                            <span className="text-muted-foreground">
                              {META_LABEL[k] ?? k}
                            </span>
                            {' — '}
                            <span>{formatMetaValue(v)}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  })()}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
