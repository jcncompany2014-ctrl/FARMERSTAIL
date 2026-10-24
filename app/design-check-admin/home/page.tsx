import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import WeeklyTodoPanel from '@/components/admin/WeeklyTodoPanel'
import ActionsPanel from '@/components/admin/ActionsPanel'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import { orderBadge, SUB_BADGE } from '@/lib/admin/status-badge'
import type { WeeklyTodo } from '@/lib/admin/weekly-todo'

/**
 * /design-check-admin/home — 어드민 홈 '오늘 할 일'(2026-10-24 2묶음 2-1, 규칙318)과 상태 배지 표(규칙316) 점검.
 * 예시 값(땅콩·초코) — 운영 데이터 아님. **실제 사이트(production)에선 404**, noindex.
 * 오늘 = 토요일 칸(펼침) · 월요일 칸(할 게 없는 줄만 → 숨김) · 화요일 칸(접힘) · 늘 확인(빨강 → 펼침).
 */
export const metadata: Metadata = {
  title: '디자인 점검 · 어드민 홈',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

const TODO = {
  today: '2026-10-24',
  shipIso: '2026-10-27',
  saturday: '2026-10-24',
  monday: '2026-10-26',
  failures: [],
  days: [
    {
      key: 'sat',
      label: '토 · 결제',
      dateIso: '2026-10-24',
      isToday: true,
      items: [
        { key: 'charge', title: '정기배송 결제', count: 2, unit: '건', summary: '성공 2 · 실패 0', tone: 'ok', href: '/admin/subscriptions/charges', hrefLabel: '결제 기록 보기', lines: [{ text: '땅콩 · 결제함 49,450원' }, { text: '초코 · 결제함 100원' }] },
        { key: 'consent', title: '서포터즈 인상 동의', count: 0, unit: '명', summary: '', tone: 'ok', href: '/admin/trials', hrefLabel: '서포터즈 보기', lines: [] },
      ],
    },
    {
      key: 'mon',
      label: '월 · 포장',
      dateIso: '2026-10-26',
      isToday: false,
      items: [{ key: 'pack', title: '포장할 박스', count: 0, unit: '박스', summary: '', tone: 'ok', href: '/admin/personalization/picking-list', hrefLabel: '포장 목록', lines: [] }],
    },
    {
      key: 'tue',
      label: '화 · 발송',
      dateIso: '2026-10-27',
      isToday: false,
      items: [{ key: 'ship', title: '보낼 박스', count: 2, unit: '박스', summary: '송장 넣을 박스', tone: 'info', href: '/admin/orders?status=preparing', hrefLabel: '송장 넣기', lines: [{ text: '땅콩' }, { text: '초코' }] }],
    },
    {
      key: 'always',
      label: '늘 확인',
      dateIso: null,
      isToday: false,
      items: [
        { key: 'card', title: '카드 다시 받기', count: 1, unit: '명', summary: '결제가 멈춘 정기배송', tone: 'bad', href: '/admin/subscriptions', hrefLabel: '정기배송 보기', lines: [{ text: '보리 · 카드 한도 초과' }] },
        { key: 'cs', title: '답 안 한 문의', count: 0, unit: '명', summary: '', tone: 'ok', href: '/admin/cs-inbox', hrefLabel: '문의함', lines: [] },
      ],
    },
  ],
} as unknown as WeeklyTodo

const PAID = '2026-10-24T00:10:00Z'
const ORDERS = [
  orderBadge({ payment_status: 'failed', order_status: 'pending', paid_at: null }),
  orderBadge({ payment_status: 'cancelled', order_status: 'cancelled', paid_at: null }),
  orderBadge({ payment_status: 'paid', order_status: 'preparing', paid_at: PAID }),
  orderBadge({ payment_status: 'paid', order_status: 'shipping', paid_at: PAID }),
  orderBadge({ payment_status: 'partially_refunded', order_status: 'delivered', paid_at: PAID }),
  orderBadge({ payment_status: 'cancelled', order_status: 'cancelled', paid_at: PAID }),
  orderBadge({ payment_status: 'paid', order_status: 'cancelled', paid_at: PAID }),
]

export default function DesignCheckAdminHome() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  return (
    <div className="admin-scope min-h-screen bg-background px-4 py-5 font-sans text-foreground antialiased">
      <div className="grid gap-4">
        <WeeklyTodoPanel todo={TODO} />
        <ActionsPanel
          unshippedCount={0}
          shippingStuckCount={0}
          cardRenewalCount={1}
          recentFailedCount={0}
          refundsPendingCount={0}
          stockOutCount={0}
          cronFailureCount={0}
          csUnansweredCount={2}
        />
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-[15px] font-bold">상태 배지 표</h2>
          <div className="flex flex-wrap gap-2">
            {ORDERS.map((b, i) => (
              <AdminStatusBadge key={i} badge={b} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.values(SUB_BADGE).map((b) => (
              <AdminStatusBadge key={b.label} badge={b} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
