import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${m}.${day} ${hh}:${mm}`
}

const STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  preparing: '준비 중',
  shipping: '배송 중',
  delivered: '배송 완료',
  cancelled: '취소',
}

function statusBadge(paymentStatus: string, orderStatus: string) {
  if (paymentStatus !== 'paid') {
    return { label: '결제 전', color: 'bg-rule text-text' }
  }
  switch (orderStatus) {
    case 'preparing':
      return { label: '준비 중', color: 'bg-terracotta text-white' }
    case 'shipping':
      return { label: '배송 중', color: 'bg-moss text-white' }
    case 'delivered':
      return { label: '완료', color: 'bg-[#8BA05A] text-white' }
    case 'cancelled':
      return { label: '취소', color: 'bg-sale text-white' }
    default:
      return { label: STATUS_LABEL[orderStatus] ?? orderStatus, color: 'bg-rule text-text' }
  }
}

export default async function AdminHome() {
  const supabase = await createClient()

  // 오늘 0시 ISO
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  // 30일 전
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 병렬로 쿼리 (is_admin 정책 덕분에 전체 조회 가능)
  const [
    paidOrdersRes,
    todayOrdersRes,
    pendingShipRes,
    usersRes,
    recentOrdersRes,
    thirtyDayOrdersRes,
  ] = await Promise.all([
    // 누적 매출 (paid만)
    supabase
      .from('orders')
      .select('total_amount', { count: 'exact' })
      .eq('payment_status', 'paid'),

    // 오늘 주문 수
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart),

    // 배송 대기 (preparing 상태)
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .eq('order_status', 'preparing'),

    // 전체 회원 수
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),

    // 최근 주문 10건
    supabase
      .from('orders')
      .select('id, order_number, total_amount, payment_status, order_status, created_at, recipient_name')
      .order('created_at', { ascending: false })
      .limit(10),

    // 최근 30일 매출 (일별 차트용)
    supabase
      .from('orders')
      .select('total_amount, created_at')
      .eq('payment_status', 'paid')
      .gte('created_at', thirtyDaysAgo),
  ])

  const totalRevenue =
    paidOrdersRes.data?.reduce(
      (sum, o: { total_amount: number | null }) => sum + (o.total_amount ?? 0),
      0
    ) ?? 0
  const totalPaidCount = paidOrdersRes.count ?? 0
  const todayOrderCount = todayOrdersRes.count ?? 0
  const pendingShipCount = pendingShipRes.count ?? 0
  const userCount = usersRes.count ?? 0
  const recentOrders = recentOrdersRes.data ?? []

  // 30일 매출 집계 (간단한 sparkline용)
  const dailyMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = `${d.getMonth() + 1}/${d.getDate()}`
    dailyMap.set(key, 0)
  }
  ;(thirtyDayOrdersRes.data ?? []).forEach((o: { created_at: string; total_amount: number }) => {
    const d = new Date(o.created_at)
    const key = `${d.getMonth() + 1}/${d.getDate()}`
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + o.total_amount)
  })
  const dailyData = Array.from(dailyMap.entries())
  const maxDaily = Math.max(...dailyData.map(([, v]) => v), 1)
  const last30DayRevenue = dailyData.reduce((s, [, v]) => s + v, 0)

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-['Archivo_Black'] text-3xl text-ink">
            DASHBOARD
          </h1>
          <p className="text-sm text-muted mt-1">
            {now.getFullYear()}년 {now.getMonth() + 1}월 {now.getDate()}일 기준
          </p>
        </div>
      </div>

      {/* 지표 카드 4개 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="누적 매출"
          value={`${totalRevenue.toLocaleString()}원`}
          sub={`완료 주문 ${totalPaidCount}건`}
          tone="red"
        />
        <MetricCard
          label="오늘 주문"
          value={`${todayOrderCount}건`}
          sub="payment_status 무관"
          tone="dark"
        />
        <MetricCard
          label="배송 대기"
          value={`${pendingShipCount}건`}
          sub="준비 중 상태"
          tone="green"
        />
        <MetricCard
          label="총 회원"
          value={`${userCount}명`}
          sub="profiles 기준"
          tone="dark"
        />
      </div>

      {/* 30일 매출 sparkline */}
      <div className="p-6 rounded-2xl bg-white border border-rule mb-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-ink">최근 30일 매출</h2>
            <p className="text-[11px] text-muted mt-0.5">
              결제 완료된 주문만 집계
            </p>
          </div>
          <p className="font-['Archivo_Black'] text-2xl text-terracotta">
            {last30DayRevenue.toLocaleString()}원
          </p>
        </div>
        <div className="flex items-end gap-1 h-24">
          {dailyData.map(([date, value]) => {
            const height = (value / maxDaily) * 100
            return (
              <div
                key={date}
                className="flex-1 flex flex-col items-center justify-end group relative"
              >
                <div
                  className="w-full bg-terracotta rounded-sm transition-all hover:bg-[#8A3822] min-h-[2px]"
                  style={{ height: `${height}%` }}
                />
                {value > 0 && (
                  <span className="absolute -top-5 opacity-0 group-hover:opacity-100 text-[9px] text-ink whitespace-nowrap bg-white px-1 rounded border border-rule transition">
                    {value.toLocaleString()}원
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-muted">
          <span>{dailyData[0]?.[0]}</span>
          <span>{dailyData[dailyData.length - 1]?.[0]}</span>
        </div>
      </div>

      {/* 최근 주문 */}
      <div className="p-6 rounded-2xl bg-white border border-rule">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-ink">최근 주문</h2>
          <Link
            href="/admin/orders"
            className="text-xs text-terracotta hover:underline"
          >
            전체 보기 →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">
            아직 주문이 없어요
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted border-b border-rule">
                  <th className="text-left py-2 font-medium">주문번호</th>
                  <th className="text-left py-2 font-medium">주문자</th>
                  <th className="text-right py-2 font-medium">금액</th>
                  <th className="text-center py-2 font-medium">상태</th>
                  <th className="text-right py-2 font-medium">시각</th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {recentOrders.map((o: any) => {
                  const badge = statusBadge(o.payment_status, o.order_status)
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-bg hover:bg-bg transition"
                    >
                      <td className="py-3 font-mono text-[11px] text-ink">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="hover:text-terracotta"
                        >
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="py-3 text-ink">{o.recipient_name}</td>
                      <td className="py-3 text-right font-semibold text-ink">
                        {o.total_amount.toLocaleString()}원
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[11px] text-muted">
                        {formatDate(o.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone: 'red' | 'dark' | 'green'
}) {
  const toneClass =
    tone === 'red'
      ? 'text-terracotta'
      : tone === 'green'
      ? 'text-moss'
      : 'text-ink'

  return (
    <div className="p-5 rounded-2xl bg-white border border-rule">
      <p className="text-[11px] text-muted font-bold uppercase tracking-wider">
        {label}
      </p>
      <p className={`mt-2 font-['Archivo_Black'] text-2xl ${toneClass}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] text-muted">{sub}</p>
    </div>
  )
}