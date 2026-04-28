import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * /admin/subscriptions/calendar — 정기배송 일정 캘린더 뷰.
 *
 * 동선
 * ────
 * 한 달 그리드. 각 날짜 셀에 next_delivery_date 가 그 날인 활성 구독을 chip
 * 으로 표시. 셀 클릭이 아니라 chip 클릭 → 해당 구독 상세 (관리자 row 편집).
 *
 * URL `?ym=YYYY-MM` 으로 월 이동. 미지정 시 이번 달.
 *
 * 이 페이지는 server component — 빠른 SSR 로 한 번에 그리드를 그린다. 인터랙션
 * (월 이동) 은 a 태그 + URL 갱신.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '정기배송 캘린더 | Admin',
  robots: { index: false, follow: false },
}

type SearchParamsT = Promise<{ ym?: string }>

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function parseYm(ym: string | undefined): { year: number; month: number } {
  // YYYY-MM. invalid → 이번달.
  const now = new Date()
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  const [y, m] = ym.split('-').map(Number)
  if (m < 1 || m > 12) return { year: now.getFullYear(), month: now.getMonth() + 1 }
  return { year: y, month: m }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export default async function SubscriptionsCalendarPage({
  searchParams,
}: {
  searchParams: SearchParamsT
}) {
  const { ym } = await searchParams
  const { year, month } = parseYm(ym)

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0) // 다음 달 0일 = 이번 달 마지막 일
  const startKey = `${year}-${pad(month)}-01`
  const endKey = `${year}-${pad(month)}-${pad(monthEnd.getDate())}`

  const supabase = await createClient()

  // 활성 + paused 구독 모두 표시 (paused 는 다음 발송 예정인지 본 후 dim 으로).
  const { data: subs } = await supabase
    .from('subscriptions')
    .select(
      'id, status, next_delivery_date, total_amount, recipient_name, profiles(name, email), subscription_items(product_name, quantity)',
    )
    .gte('next_delivery_date', startKey)
    .lte('next_delivery_date', endKey)
    .in('status', ['active', 'paused'])
    .order('next_delivery_date', { ascending: true })

  type SubLite = {
    id: string
    status: 'active' | 'paused' | 'cancelled' | string
    next_delivery_date: string | null
    total_amount: number | null
    recipient_name: string | null
    profiles: { name: string | null; email: string | null } | null
    subscription_items: { product_name: string; quantity: number }[]
  }

  const subsByDay = new Map<string, SubLite[]>()
  for (const s of (subs ?? []) as unknown as SubLite[]) {
    if (!s.next_delivery_date) continue
    const key = s.next_delivery_date.slice(0, 10)
    const arr = subsByDay.get(key) ?? []
    arr.push(s)
    subsByDay.set(key, arr)
  }

  // 그리드 셀 — 첫 주의 빈 칸 + 마지막 주의 빈 칸 채워서 7×N 격자.
  const firstWeekday = monthStart.getDay() // 0 = 일
  const daysInMonth = monthEnd.getDate()
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  type Cell = {
    date: string | null
    day: number | null
    isToday: boolean
    isWeekend: boolean
    items: SubLite[]
  }
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const cells: Cell[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayOfMonth = i - firstWeekday + 1
    if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
      cells.push({
        date: null,
        day: null,
        isToday: false,
        isWeekend: false,
        items: [],
      })
    } else {
      const key = `${year}-${pad(month)}-${pad(dayOfMonth)}`
      const weekday = (firstWeekday + dayOfMonth - 1) % 7
      cells.push({
        date: key,
        day: dayOfMonth,
        isToday: key === todayKey,
        isWeekend: weekday === 0 || weekday === 6,
        items: subsByDay.get(key) ?? [],
      })
    }
  }

  // 월별 합계
  const monthTotalCount = (subs ?? []).length
  const monthTotalRevenue = (subs ?? []).reduce(
    (s, x) => s + (x.total_amount ?? 0),
    0,
  )

  // prev/next 월 계산
  const prevYm = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`
  const nextYm = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/subscriptions"
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-terracotta mb-2"
          >
            <ArrowLeft className="w-3 h-3" strokeWidth={2.5} />
            구독 리스트로
          </Link>
          <h1 className="font-['Archivo_Black'] text-3xl text-ink">
            DELIVERY CALENDAR
          </h1>
          <p className="text-sm text-muted mt-1">
            예정 배송 {monthTotalCount}건 · 합계{' '}
            {monthTotalRevenue.toLocaleString('ko-KR')}원
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/subscriptions/calendar?ym=${prevYm}`}
            className="p-2 rounded-lg border border-rule hover:bg-bg transition"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-4 h-4 text-ink" strokeWidth={2} />
          </Link>
          <h2
            className="font-['Archivo_Black'] text-xl text-ink min-w-[140px] text-center"
            style={{ letterSpacing: '0.02em' }}
          >
            {year}.{pad(month)}
          </h2>
          <Link
            href={`/admin/subscriptions/calendar?ym=${nextYm}`}
            className="p-2 rounded-lg border border-rule hover:bg-bg transition"
            aria-label="다음 달"
          >
            <ChevronRight className="w-4 h-4 text-ink" strokeWidth={2} />
          </Link>
          <Link
            href="/admin/subscriptions/calendar"
            className="ml-2 px-3 py-2 rounded-lg border border-rule text-[11px] hover:bg-bg transition"
          >
            오늘
          </Link>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="rounded-2xl bg-white border border-rule overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-rule">
          {WEEK_LABELS.map((label, i) => (
            <div
              key={label}
              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center ${
                i === 0
                  ? 'text-sale'
                  : i === 6
                  ? 'text-terracotta'
                  : 'text-muted'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7">
          {cells.map((c, idx) => {
            const weekday = idx % 7
            const dayColor =
              weekday === 0 ? '#A23B2A' : weekday === 6 ? '#A0452E' : 'var(--ink)'
            return (
              <div
                key={idx}
                className={`relative min-h-[110px] border-r border-b border-rule p-2 ${
                  c.isToday ? 'bg-terracotta/5' : ''
                } ${c.date === null ? 'bg-bg/60' : ''}`}
                style={{
                  borderRight:
                    weekday === 6 ? 'none' : '1px solid var(--rule)',
                }}
              >
                {c.day !== null && (
                  <>
                    <div
                      className={`text-[12px] font-mono tabular-nums ${
                        c.isToday ? 'font-bold' : ''
                      }`}
                      style={{
                        color: c.isToday ? 'var(--terracotta)' : dayColor,
                      }}
                    >
                      {c.day}
                      {c.isToday && (
                        <span className="ml-1 inline-flex items-center text-[8px] font-bold px-1 rounded bg-terracotta text-white">
                          오늘
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-1">
                      {c.items.slice(0, 3).map((it) => (
                        <Link
                          key={it.id}
                          href={`/admin/subscriptions?focus=${it.id}`}
                          className={`block text-[10px] px-1.5 py-1 rounded transition hover:opacity-80 ${
                            it.status === 'paused'
                              ? 'bg-gold/15 text-gold'
                              : 'bg-moss/15 text-moss'
                          }`}
                          title={`${it.recipient_name ?? '수령인 미지정'} · ${(it.subscription_items ?? []).map((x) => `${x.product_name}×${x.quantity}`).join(', ')}`}
                        >
                          <div className="font-bold truncate">
                            {it.recipient_name ??
                              it.profiles?.name ??
                              '수령인 미지정'}
                          </div>
                          <div className="truncate opacity-80">
                            {(it.subscription_items ?? [])
                              .map((x) => x.product_name)
                              .slice(0, 2)
                              .join(', ')}
                          </div>
                        </Link>
                      ))}
                      {c.items.length > 3 && (
                        <div className="text-[10px] text-muted px-1.5">
                          +{c.items.length - 3}건 더
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-4 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-moss" />
          구독 중
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-gold" />
          일시정지
        </span>
        <span className="ml-auto text-[10px] font-mono">
          {startKey} ~ {endKey}
        </span>
      </div>
    </div>
  )
}
