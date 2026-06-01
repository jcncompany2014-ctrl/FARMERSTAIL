import Link from 'next/link'
import {
  AlertTriangle,
  Truck,
  CreditCard,
  Clock,
  Package,
  RefreshCcw,
  Activity,
} from 'lucide-react'

/**
 * 솔로 창업자 운영 hot path — 매일 한 번 보고 처리해야 할 큐.
 *
 * # 표시 항목 (server-side count)
 *  · 미발송 (preparing, paid 24h+) — admin 이 발송 처리해야 함
 *  · 배송 stuck (shipping 7d+) — 택배사 이슈 가능성
 *  · 카드 재등록 필요 (정기배송 requires_billing_key_renewal=true)
 *  · 결제 실패 24h (subscription_charges 또는 orders.failed)
 *  · 환불 pending (refunds.status='pending')
 *  · stock<=0 (재고 0 상품)
 *
 * # 디자인
 * 0건은 회색 (정상), 1건+ 은 sale 색 + count badge. 클릭 시 해당 admin 라우트.
 */
export type ActionsPanelProps = {
  unshippedCount: number
  shippingStuckCount: number
  cardRenewalCount: number
  recentFailedCount: number
  refundsPendingCount: number
  stockOutCount: number
  /** 24h 내 실패한 cron 횟수 (cron_health). 0 이면 카드 회색 (정상). */
  cronFailureCount?: number
}

type Item = {
  href: string
  icon: React.ComponentType<{
    className?: string
    strokeWidth?: number
    style?: React.CSSProperties
  }>
  label: string
  count: number
}

export default function ActionsPanel(props: ActionsPanelProps) {
  const items: Item[] = [
    {
      href: '/admin/orders?filter=unshipped',
      icon: Package,
      label: '미발송 (24h+)',
      count: props.unshippedCount,
    },
    {
      href: '/admin/orders?filter=stuck',
      icon: Truck,
      label: '배송 stuck (7d+)',
      count: props.shippingStuckCount,
    },
    {
      href: '/admin/subscriptions?filter=renewal',
      icon: CreditCard,
      label: '카드 재등록 대기',
      count: props.cardRenewalCount,
    },
    {
      href: '/admin/subscriptions/charges?filter=failed',
      icon: AlertTriangle,
      label: '24h 내 결제 실패',
      count: props.recentFailedCount,
    },
    {
      href: '/admin/orders?filter=refunds-pending',
      icon: RefreshCcw,
      label: '환불 pending',
      count: props.refundsPendingCount,
    },
    {
      href: '/admin/products?filter=out',
      icon: Clock,
      label: 'Stock 0 상품',
      count: props.stockOutCount,
    },
    {
      href: '/admin/cron-health',
      icon: Activity,
      label: '24h cron 실패',
      count: props.cronFailureCount ?? 0,
    },
  ]

  const totalActions = items.reduce((s, it) => s + it.count, 0)

  return (
    <section
      className="rounded-2xl border overflow-hidden"
      style={{
        background: totalActions > 0 ? 'color-mix(in srgb, var(--sale) 4%, var(--bg))' : 'var(--bg-2)',
        borderColor: totalActions > 0 ? 'var(--sale)' : 'var(--rule)',
      }}
    >
      <div className="px-5 py-3 flex items-center justify-between border-b border-rule">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={totalActions > 0 ? 'text-sale' : 'text-muted'}
            strokeWidth={2.2}
            style={{ width: 16, height: 16 }}
          />
          <span className="text-[12px] font-bold text-text">
            처리 대기
          </span>
        </div>
        <span
          className="text-[11px] font-bold"
          style={{ color: totalActions > 0 ? 'var(--sale)' : 'var(--muted)' }}
        >
          {totalActions === 0 ? '모두 처리됨' : `${totalActions}건`}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-rule">
        {items.map((it) => {
          const Icon = it.icon
          const active = it.count > 0
          return (
            <Link
              key={it.href}
              href={it.href}
              className="px-4 py-3 bg-bg hover:bg-bg-2 transition flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={active ? 'text-sale' : 'text-muted'}
                  strokeWidth={2}
                  style={{ width: 14, height: 14 }}
                />
                <span className="text-[11.5px] font-bold text-text">
                  {it.label}
                </span>
              </span>
              <span
                className="text-[12px] font-bold tabular-nums"
                style={{
                  color: active ? 'var(--sale)' : 'var(--muted)',
                }}
              >
                {it.count}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
