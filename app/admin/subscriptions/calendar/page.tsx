import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminTabs, Hl, Em } from '@/components/admin/ui'
import { SUBS_TABS } from '@/components/admin/tabGroups'

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

type SearchParamsT = Promise<{ ym?: string; day?: string }>

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function parseYm(ym: string | undefined): { year: number; month: number } {
  // YYYY-MM. invalid → 이번달.
  const now = new Date()
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  const [y, m] = ym.split('-').map(Number) as [number, number]
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
  const { ym, day: dayParam } = await searchParams
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
      {/* 대개편 v2 T1 — 정기배송 그룹 탭 (뒤로가기 링크는 탭으로 대체·헤더 zinc 통일) */}
      <AdminTabs tabs={SUBS_TABS} active="/admin/subscriptions/calendar" />
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
            배송 캘린더
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            <Hl>앞으로 나갈 배송을 달력으로</Hl> 봐요 (발송은{' '}
            <Em>매주 화요일 하루</Em>예요). 날짜를 보고 몇 박스를 준비해야 할지
            미리 가늠할 수 있어요. — 이번 달 예정 {monthTotalCount}건 · 합계{' '}
            {monthTotalRevenue.toLocaleString('ko-KR')}원
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/subscriptions/calendar?ym=${prevYm}`}
            className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-4 h-4 text-zinc-900" strokeWidth={2} />
          </Link>
          <h2
            className="font-bold tracking-tight text-xl text-zinc-900 min-w-[140px] text-center"
            style={{ letterSpacing: '0.02em' }}
          >
            {year}.{pad(month)}
          </h2>
          <Link
            href={`/admin/subscriptions/calendar?ym=${nextYm}`}
            className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition"
            aria-label="다음 달"
          >
            <ChevronRight className="w-4 h-4 text-zinc-900" strokeWidth={2} />
          </Link>
          <Link
            href="/admin/subscriptions/calendar"
            className="ml-2 px-3 py-2 rounded-lg border border-zinc-200 text-[11px] hover:bg-zinc-50 transition"
          >
            오늘
          </Link>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="rounded-lg bg-white border border-zinc-200 overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-zinc-200">
          {WEEK_LABELS.map((label, i) => (
            <div
              key={label}
              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-center ${
                i === 0
                  ? 'text-sale'
                  : i === 6
                  ? 'text-terracotta'
                  : 'text-zinc-500'
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
                className={`relative min-h-[110px] border-r border-b border-zinc-200 p-2 ${
                  c.isToday ? 'bg-terracotta/5' : ''
                } ${c.date === null ? 'bg-zinc-50/60' : ''}`}
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
                      {/* 계획 A-F6 — 3개 넘게 있으면 잘려서 안 보였다. 클릭하면
                          아래 '그날 전체' 목록으로(같은 페이지 ?day= 분기). */}
                      {c.items.length > 3 && c.date && (
                        <Link
                          href={`/admin/subscriptions/calendar?ym=${year}-${pad(month)}&day=${c.date}#day-detail`}
                          className="block text-[10px] font-bold text-terracotta px-1.5 hover:underline"
                        >
                          +{c.items.length - 3}건 더 보기
                        </Link>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 계획 A-F6 — 그날 전체 배송 목록. 셀은 3개까지만 보여줘서 나머지가
          안 보이던 문제 해결. 이미 가져온 subsByDay 를 재사용(추가 쿼리 없음). */}
      {dayParam && (
        <section
          id="day-detail"
          className="mt-6 rounded-lg border border-zinc-200 bg-white p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-bold text-zinc-900">
                {dayParam} 배송 전체
              </h2>
              <p className="text-[12px] text-zinc-500 mt-0.5">
                이 날짜에 나갈 정기배송 {(subsByDay.get(dayParam) ?? []).length}
                건이에요.
              </p>
            </div>
            <Link
              href={`/admin/subscriptions/calendar?ym=${year}-${pad(month)}`}
              className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 shrink-0"
            >
              닫기 ✕
            </Link>
          </div>
          {(subsByDay.get(dayParam) ?? []).length === 0 ? (
            <p className="text-[13px] text-zinc-500">
              이 날짜에 예정된 배송이 없어요.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(subsByDay.get(dayParam) ?? []).map((it) => (
                <li key={it.id} className="py-2.5">
                  <Link
                    href={`/admin/subscriptions?focus=${it.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 hover:opacity-80"
                  >
                    <span className="text-[13px] font-bold text-zinc-900">
                      {it.recipient_name ?? it.profiles?.name ?? '수령인 미지정'}
                    </span>
                    {it.status === 'paused' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        일시정지
                      </span>
                    )}
                    <span className="text-[12px] text-zinc-500">
                      {(it.subscription_items ?? [])
                        .map((x) => `${x.product_name}×${x.quantity}`)
                        .join(', ') || '구성 미등록'}
                    </span>
                    <span className="ml-auto text-[12px] font-bold text-zinc-700 tabular-nums">
                      {(it.total_amount ?? 0).toLocaleString()}원
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-4 text-[11px] text-zinc-500">
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
