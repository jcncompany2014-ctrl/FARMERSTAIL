/**
 * R63 — admin/orders/[id] 에 표시되는 payment_events 시계열.
 *
 * CS 도구 — 이 주문에 무슨 일이 있었나? (paid → refunded → partial 등)
 * 한눈에 확인. payment_events 가 insert-only ledger 라 모든 이력 영원.
 *
 * Server component — admin 페이지라 RLS 자체로 admin 만 SELECT 통과.
 */
import { createClient } from '@/lib/supabase/server'

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

const EVENT_LABEL: Record<string, string> = {
  paid: '결제 완료',
  refunded: '전체 환불',
  partial_refunded: '부분 환불',
  failed: '결제 실패',
  cancel_requested: '취소 요청',
  webhook_received: 'Toss webhook',
  admin_action: '관리자 조작',
  cron_refund_queue: '자동 환불 재시도',
}

const SOURCE_LABEL: Record<string, string> = {
  user_checkout: '사용자 결제',
  toss_webhook: 'Toss webhook',
  user_cancel: '사용자 취소',
  partial_cancel: '부분 취소',
  cron_refund_queue: '환불 재시도 cron',
  cron_subscription_charge: '정기구독 cron',
  cron_order_expire: '주문 만료 cron',
  admin_panel: '관리자',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}.${m}.${day} ${hh}:${mm}`
}

export default async function PaymentEventTimeline({ orderId }: Props) {
  const supabase = await createClient()

  // generated types 에 아직 payment_events 없음 → cast.
  const client = supabase.from('payment_events' as never) as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: EventRow[] | null }>
      }
    }
  }
  const { data: rawEvents } = await client
    .select(
      'id, payment_key, event_type, amount, prev_status, new_status, source, metadata, actor_user_id, created_at',
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  const events = (rawEvents ?? []) as EventRow[]
  const balance = events.reduce((sum, e) => sum + (e.amount ?? 0), 0)

  return (
    <section className="p-6 rounded-2xl bg-white border border-rule">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="text-sm font-bold text-ink">결제 원장 (Payment Events)</h2>
        <div className="text-xs text-mute">
          잔액: <span className="font-mono font-semibold text-ink">{balance.toLocaleString()}원</span>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-mute py-4 text-center">
          기록된 이벤트가 없어요. 결제·환불이 발생하면 자동으로 누적됩니다.
        </p>
      ) : (
        <ol className="space-y-3">
          {events.map((e) => {
            const isRefund = e.amount < 0
            return (
              <li
                key={e.id}
                className="flex gap-3 pb-3 border-b border-line last:border-0 last:pb-0"
              >
                <div
                  className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                    isRefund ? 'bg-sale' : 'bg-moss'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[13px] font-semibold text-ink">
                      {EVENT_LABEL[e.event_type] ?? e.event_type}
                    </span>
                    <span
                      className={`font-mono text-[13px] font-semibold ${
                        isRefund ? 'text-sale' : 'text-ink'
                      }`}
                    >
                      {e.amount > 0 ? '+' : ''}{e.amount.toLocaleString()}원
                    </span>
                  </div>
                  <div className="text-[10.5px] text-mute mt-0.5">
                    {formatDateTime(e.created_at)}
                    {' · '}
                    출처: {SOURCE_LABEL[e.source] ?? e.source}
                    {e.prev_status && e.new_status && (
                      <>
                        {' · '}
                        {e.prev_status} → {e.new_status}
                      </>
                    )}
                  </div>
                  {e.metadata && Object.keys(e.metadata).length > 0 && (
                    <pre className="mt-1.5 text-[10px] bg-paperHi rounded p-2 font-mono text-mute overflow-x-auto leading-snug">
                      {JSON.stringify(e.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
