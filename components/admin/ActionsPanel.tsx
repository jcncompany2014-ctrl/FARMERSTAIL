import Link from 'next/link'
import {
  AlertTriangle,
  Truck,
  CreditCard,
  Clock,
  Package,
  RefreshCcw,
  Activity,
  MessageCircle,
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
  /**
   * 답 안 한 1:1 문의 수 (cs_messages, sender='user' AND read_at IS NULL).
   *
   * ★대시보드에 없던 유일한 '고객이 기다리는 일'이었다(2026-08-07 감사).
   * 문의는 /admin/cs-inbox 를 직접 열어야만 보였고, 대시보드만 보고 하루를
   * 끝내면 답장이 며칠 밀린다. 앱은 "영업일 기준 24시간 이내 답변"이라고
   * 약속한다.
   */
  csUnansweredCount?: number
  /**
   * "돌았어야 하는데 기록이 없는" 크론 수 (lib/cron-watchdog).
   *
   * ★실패(status='error')와 **다른 문제**다. 크론이 죽는 가장 흔한 방식은
   * 아예 안 도는 것인데(CRON_SECRET 누락 → 29개 전부 401, 크론 요금 한도로
   * 배포 거부), 그때는 cron_health 에 행이 안 생겨서 "실패 0건"으로 보인다.
   */
  missedCronCount?: number
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
      // ★최종감사 #13 (2026-07-29): 예전 ?filter= 파라미터는 대상 페이지들이
      //   아예 읽지 않아 클릭해도 조용히 무시됐다. 각 페이지가 실제로 읽는
      //   파라미터(orders/charges 는 ?status=, products 는 ?active=)로 교체.
      //   전용 필터가 없는 항목(카드 재등록·환불 대기)은 그 조건을 보여주는
      //   화면으로 바로 착지시킨다.
      href: '/admin/orders?status=preparing',
      icon: Package,
      label: '미발송 (24시간+)',
      count: props.unshippedCount,
    },
    {
      href: '/admin/orders?status=shipping',
      icon: Truck,
      label: '배송 지연 (7일+)',
      count: props.shippingStuckCount,
    },
    {
      href: '/admin/subscriptions',
      icon: CreditCard,
      label: '카드 재등록 대기',
      count: props.cardRenewalCount,
    },
    {
      href: '/admin/subscriptions/charges?status=failed',
      icon: AlertTriangle,
      label: '24시간 내 결제 실패',
      count: props.recentFailedCount,
    },
    {
      href: '/admin/refunds',
      icon: RefreshCcw,
      label: '환불 대기',
      count: props.refundsPendingCount,
    },
    {
      href: '/admin/products?active=active',
      icon: Clock,
      label: '품절 상품',
      count: props.stockOutCount,
    },
    {
      href: '/admin/cs-inbox',
      icon: MessageCircle,
      label: '답 안 한 문의',
      count: props.csUnansweredCount ?? 0,
    },
    {
      href: '/admin/cron-health',
      icon: Activity,
      label: '자동작업 실패 (24시간)',
      count: props.cronFailureCount ?? 0,
    },
    {
      href: '/admin/cron-health',
      icon: Activity,
      label: '안 돈 자동작업',
      count: props.missedCronCount ?? 0,
    },
  ]

  const totalActions = items.reduce((s, it) => s + it.count, 0)

  /**
   * ★할 일이 있는 항목만 그린다 (2026-08-10 사장님 제보 — "짜친다").
   *
   * 예전엔 9칸을 **항상** 3×3 으로 깔았다. 출시 전이라 전부 0인 지금은
   * 화면 최상단(제일 좋은 자리)을 "할 일 없음" 아홉 칸이 차지했다.
   * 처리 대기는 **목록**이지 대시보드 지표가 아니다 — 0건짜리 줄을 남겨 둘
   * 이유가 없다. 매출 차트가 0원일 때 그래프를 안 그리는 것과 같은 원리.
   *   · 전부 0  → 헤더 한 줄("모두 처리됨")로 끝. 그리드 없음.
   *   · 일부 0  → 0 아닌 것만. 나머지는 아래 한 줄로 요약.
   * 각 항목의 관리 화면은 사이드바로 갈 수 있으니 진입 경로도 안 잃는다.
   */
  const pending = items.filter((it) => it.count > 0)
  const clearedCount = items.length - pending.length

  // 색은 --adm- 토큰(2026-09-05 어드민 개편) — 할 일 있으면 destructive 톤,
  // 없으면 secondary 로 조용히.
  return (
    <section
      className={`overflow-hidden rounded-xl border ${
        totalActions > 0
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border bg-secondary/60'
      }`}
    >
      <div
        className={`flex items-center justify-between px-5 py-3 ${
          pending.length > 0 ? 'border-b border-border' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={
              totalActions > 0 ? 'text-destructive' : 'text-muted-foreground'
            }
            strokeWidth={2.2}
            style={{ width: 16, height: 16 }}
          />
          <span className="text-[12px] font-bold">처리 대기</span>
        </div>
        <span
          className={`text-[11px] font-bold ${
            totalActions > 0 ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {totalActions === 0 ? '모두 처리됨' : `${totalActions}건`}
        </span>
      </div>
      {pending.length > 0 && (
      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-3">
        {pending.map((it) => {
          const Icon = it.icon
          const active = it.count > 0
          return (
            <Link
              // '자동작업 실패'와 '안 돈 자동작업'이 같은 href(/admin/cron-health)라
              // href 만으론 key 가 겹친다 — 라벨이 유일 식별자(2026-09-05 감사).
              key={it.label}
              href={it.href}
              className="flex items-center justify-between bg-card px-4 py-3 transition hover:bg-secondary"
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={
                    active ? 'text-destructive' : 'text-muted-foreground'
                  }
                  strokeWidth={2}
                  style={{ width: 14, height: 14 }}
                />
                <span className="text-[11.5px] font-bold">{it.label}</span>
              </span>
              <span
                className={`text-[12px] font-bold tabular-nums ${
                  active ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {it.count}
              </span>
            </Link>
          )
        })}
      </div>
      )}
      {pending.length > 0 && clearedCount > 0 && (
        <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
          나머지 {clearedCount}개 항목은 처리할 게 없어요.
        </p>
      )}
    </section>
  )
}
