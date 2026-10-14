/**
 * 경보함 화면 모델 — admin_alerts 행 → 화면 한 줄(순수 함수) (2026-10-14 어드민 B1, 규칙248).
 *
 * 각 경보에서 **바로 해당 주문·구독·고객으로** 가는 링크를 만든다. 구독·강아지 상세 화면은 따로 없어 그 주인 고객 화면
 * (구독·주문이 함께 보이는 /admin/users/[id])으로 보낸다 — 구독·강아지 → 고객 id 는 호출부가 조회해 넘긴다.
 */
import { ALERT_GROUP_LABEL, ownerAlertDef, type AlertGroup } from './alert-kinds.ts'

export type AlertRow = {
  id: string
  kind: string
  severity: string
  message: string
  occurrences: number
  first_seen_at: string
  last_seen_at: string
  resolved_at: string | null
  resolved_note: string | null
  order_id: string | null
  subscription_id: string | null
  user_id: string | null
  dog_id: string | null
  context: unknown
}

export type AlertLink = { label: string; href: string }

export type AlertView = {
  id: string
  kind: string
  group: AlertGroup | 'other'
  groupLabel: string
  severity: 'warning' | 'error'
  message: string
  action: string | null
  occurrences: number
  firstSeenAt: string
  lastSeenAt: string
  resolvedAt: string | null
  resolvedNote: string | null
  links: AlertLink[]
  /** 보조 정보(id·숫자·코드만 — 기록 때 이미 걸렀다). 화면엔 몇 개만. */
  facts: Array<{ key: string; value: string }>
}

const FACT_SKIP = new Set(['note', 'detail', 'targetKey'])

export function toAlertView(
  row: AlertRow,
  owners: { userBySub: ReadonlyMap<string, string>; userByDog: ReadonlyMap<string, string> },
): AlertView {
  const def = ownerAlertDef(row.kind)
  const links: AlertLink[] = []
  if (row.order_id) links.push({ label: '주문 보기', href: `/admin/orders/${row.order_id}` })
  const subUser = row.subscription_id ? owners.userBySub.get(row.subscription_id) : undefined
  const dogUser = row.dog_id ? owners.userByDog.get(row.dog_id) : undefined
  const userId = row.user_id ?? subUser ?? dogUser ?? null
  if (row.subscription_id) {
    links.push(subUser ? { label: '구독 보기(고객 화면)', href: `/admin/users/${subUser}` } : { label: '구독 목록', href: '/admin/subscriptions' })
  }
  if (userId && !links.some((l) => l.href === `/admin/users/${userId}`)) {
    links.push({ label: '고객 보기', href: `/admin/users/${userId}` })
  }
  // 종류에 따라 처리 화면으로 바로.
  if (def?.group === 'refund') links.push({ label: '환불 화면', href: '/admin/refunds' })
  if (row.kind === 'ops.key_expiring' || row.kind === 'tracking.tracker_key_rejected') links.push({ label: '키 설정일 적기', href: '/admin/alerts#keys' })
  if (row.kind === 'subscription.items.rebuild_failed' || row.kind === 'subscription.create.held_allergen_share') {
    links.push({ label: '포장 목록', href: '/admin/personalization/picking-list' })
  }
  if (row.kind === 'inventory.shortage_forecast') links.push({ label: '상품 재고', href: '/admin/products' })
  if (row.kind.startsWith('subscription.charge.trial') || row.kind === 'trial.price_increase.consent_missing') {
    links.push({ label: '체험단 화면', href: '/admin/trials' })
  }

  const ctx = row.context && typeof row.context === 'object' ? (row.context as Record<string, unknown>) : {}
  const facts = Object.entries(ctx)
    .filter(([k, v]) => !FACT_SKIP.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'))
    .slice(0, 6)
    .map(([k, v]) => ({ key: k, value: String(v).slice(0, 120) }))

  return {
    id: row.id,
    kind: row.kind,
    group: def?.group ?? 'other',
    groupLabel: def ? ALERT_GROUP_LABEL[def.group] : '기타',
    severity: row.severity === 'error' ? 'error' : 'warning',
    message: row.message,
    action: def?.action ?? null,
    occurrences: row.occurrences,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
    resolvedNote: row.resolved_note,
    links,
    facts,
  }
}

/** 안 본 것(처리 전) 위, 그 안에서는 error 먼저·최근 순. 처리한 것은 아래·최근 처리 순. */
export function sortAlertViews(views: readonly AlertView[]): AlertView[] {
  return [...views].sort((a, b) => {
    const ar = a.resolvedAt ? 1 : 0
    const br = b.resolvedAt ? 1 : 0
    if (ar !== br) return ar - br
    if (!a.resolvedAt) {
      const as = a.severity === 'error' ? 0 : 1
      const bs = b.severity === 'error' ? 0 : 1
      if (as !== bs) return as - bs
      return a.lastSeenAt < b.lastSeenAt ? 1 : a.lastSeenAt > b.lastSeenAt ? -1 : 0
    }
    return (a.resolvedAt ?? '') < (b.resolvedAt ?? '') ? 1 : -1
  })
}
