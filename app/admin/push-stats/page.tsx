import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * /admin/push-stats — 푸시 알림 발송/읽음 통계.
 *
 * 어떤 알림이 잘 읽히는지, 어떤 카테고리가 무시되는지 분석. 다음 캠페인
 * 설계의 가이드. category 별 발송수 / 읽은수 / 읽음률 / 평균 reaction time.
 *
 * 데이터 소스: push_log 테이블.
 *   - read_at: 읽음 처리 시각 (사용자가 알림 클릭/뷰 시)
 *   - sent_at: 발송 시각
 *   - category: '식단', '주문', '리마인더', '재입고', '구독' 등
 *   - sent_count: 토큰 N개에 발송 (단일 사용자라도 디바이스 여러개)
 */
export default async function PushStatsPage() {
  const supabase = await createClient()

  // 최근 30일 push_log — force-dynamic 이라 매 요청마다 새 timestamp.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  const { data: logs } = await supabase
    .from('push_log')
    .select('id, category, sent_at, read_at, sent_count')
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(5000)

  type LogRow = {
    id: string
    category: string | null
    sent_at: string
    read_at: string | null
    sent_count: number
  }

  const rows: LogRow[] = (logs ?? []) as LogRow[]

  // 카테고리별 집계
  const byCategory = new Map<
    string,
    {
      total: number
      read: number
      sentCountSum: number
      reactionMinutesSum: number
      reactionMinutesCount: number
    }
  >()

  for (const r of rows) {
    const key = r.category ?? '미분류'
    const cur =
      byCategory.get(key) ?? {
        total: 0,
        read: 0,
        sentCountSum: 0,
        reactionMinutesSum: 0,
        reactionMinutesCount: 0,
      }
    cur.total += 1
    cur.sentCountSum += r.sent_count
    if (r.read_at) {
      cur.read += 1
      const sentTs = new Date(r.sent_at).getTime()
      const readTs = new Date(r.read_at).getTime()
      // Invalid Date → NaN. NaN 이 한 번 들어가면 평균 전체가 NaN 으로 오염되므로
      // valid timestamp 일 때만 누적.
      if (!Number.isNaN(sentTs) && !Number.isNaN(readTs)) {
        const minutes = Math.max(0, (readTs - sentTs) / 60000)
        cur.reactionMinutesSum += minutes
        cur.reactionMinutesCount += 1
      }
    }
    byCategory.set(key, cur)
  }

  // 일자별 발송/읽음
  const byDay = new Map<string, { sent: number; read: number }>()
  for (const r of rows) {
    const day = r.sent_at.slice(0, 10)
    const cur = byDay.get(day) ?? { sent: 0, read: 0 }
    cur.sent += 1
    if (r.read_at) cur.read += 1
    byDay.set(day, cur)
  }
  const dayRows = Array.from(byDay.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14)

  // 전체 KPI
  const totalSent = rows.length
  const totalRead = rows.filter((r) => r.read_at).length
  const overallReadRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0
  const totalRecipients = rows.reduce((s, r) => s + r.sent_count, 0)

  // 카테고리별 정렬 (발송수 desc)
  const categoryRows = Array.from(byCategory.entries())
    .map(([cat, agg]) => ({
      category: cat,
      total: agg.total,
      read: agg.read,
      readRate: agg.total > 0 ? (agg.read / agg.total) * 100 : 0,
      avgReactionMin:
        agg.reactionMinutesCount > 0
          ? agg.reactionMinutesSum / agg.reactionMinutesCount
          : null,
      avgRecipients: agg.total > 0 ? agg.sentCountSum / agg.total : 0,
    }))
    .sort((a, b) => b.total - a.total)

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-widest font-bold">
            Push Notification Stats
          </p>
          <h1 className="text-2xl font-black text-text mt-1">푸시 발송 통계</h1>
          <p className="text-[12px] text-muted mt-1">
            최근 30일 · 어떤 알림이 잘 읽히는지 분석
          </p>
        </div>
        <Link
          href="/admin"
          className="text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          ← 대시보드
        </Link>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="총 발송"
          value={totalSent.toLocaleString()}
          unit="건"
          tone="ink"
        />
        <KpiCard
          label="총 읽음"
          value={totalRead.toLocaleString()}
          unit="건"
          tone="moss"
        />
        <KpiCard
          label="평균 읽음률"
          value={overallReadRate.toFixed(1)}
          unit="%"
          tone="terracotta"
        />
        <KpiCard
          label="누적 수신 디바이스"
          value={totalRecipients.toLocaleString()}
          unit="대"
          tone="muted"
        />
      </section>

      {/* 카테고리별 표 */}
      <section className="mb-8">
        <h2 className="text-[13px] font-black text-text mb-3">
          카테고리별 성과
        </h2>
        {categoryRows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-rule p-8 text-center">
            <p className="text-[12px] text-muted">최근 30일 발송 기록이 없어요.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-rule overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-bg-2">
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted font-bold">
                  <th className="px-4 py-3">카테고리</th>
                  <th className="px-4 py-3 text-right">발송</th>
                  <th className="px-4 py-3 text-right">읽음</th>
                  <th className="px-4 py-3 text-right">읽음률</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">평균 반응시간</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">건당 평균 디바이스</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((c) => (
                  <tr
                    key={c.category}
                    className="border-t border-rule hover:bg-bg-2/40"
                  >
                    <td className="px-4 py-3 font-bold text-text">
                      {c.category}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {c.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-moss">
                      {c.read.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <ReadRateBar rate={c.readRate} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {c.avgReactionMin === null
                        ? '—'
                        : formatMinutes(c.avgReactionMin)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {c.avgRecipients.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 일자별 추이 (최근 14일) */}
      <section>
        <h2 className="text-[13px] font-black text-text mb-3">
          일자별 추이 (최근 14일)
        </h2>
        {dayRows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-rule p-8 text-center">
            <p className="text-[12px] text-muted">발송 기록이 없어요.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-rule overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-bg-2">
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted font-bold">
                  <th className="px-4 py-3">날짜</th>
                  <th className="px-4 py-3 text-right">발송</th>
                  <th className="px-4 py-3 text-right">읽음</th>
                  <th className="px-4 py-3 text-right">읽음률</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map(([day, agg]) => {
                  const rate = agg.sent > 0 ? (agg.read / agg.sent) * 100 : 0
                  return (
                    <tr
                      key={day}
                      className="border-t border-rule hover:bg-bg-2/40"
                    >
                      <td className="px-4 py-3 font-mono text-text">{day}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {agg.sent}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-moss">
                        {agg.read}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <ReadRateBar rate={rate} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  unit,
  tone,
}: {
  label: string
  value: string
  unit: string
  tone: 'ink' | 'moss' | 'terracotta' | 'muted'
}) {
  const toneColor =
    tone === 'ink'
      ? 'var(--ink)'
      : tone === 'moss'
        ? 'var(--moss)'
        : tone === 'terracotta'
          ? 'var(--terracotta)'
          : 'var(--muted)'
  return (
    <div className="bg-white rounded-2xl border border-rule px-4 py-4">
      <div
        className="text-[9px] uppercase tracking-[0.18em] font-bold"
        style={{ color: toneColor }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-1 mt-2">
        <span
          className="text-[24px] font-black tabular-nums"
          style={{ color: toneColor, letterSpacing: '-0.02em' }}
        >
          {value}
        </span>
        <span className="text-[11px] text-muted">{unit}</span>
      </div>
    </div>
  )
}

function ReadRateBar({ rate }: { rate: number }) {
  const clamped = Math.min(100, Math.max(0, rate))
  const tone =
    clamped >= 50
      ? 'var(--moss)'
      : clamped >= 25
        ? 'var(--terracotta)'
        : 'var(--muted)'
  return (
    <div className="inline-flex items-center gap-2">
      <div
        className="rounded-full overflow-hidden"
        style={{
          width: 60,
          height: 6,
          background: 'var(--rule)',
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: tone,
            transition: 'width 0.3s',
          }}
        />
      </div>
      <span className="font-bold tabular-nums" style={{ color: tone }}>
        {rate.toFixed(1)}%
      </span>
    </div>
  )
}

function formatMinutes(m: number) {
  if (m < 1) return `${Math.round(m * 60)}초`
  if (m < 60) return `${m.toFixed(1)}분`
  const h = m / 60
  if (h < 24) return `${h.toFixed(1)}시간`
  return `${(h / 24).toFixed(1)}일`
}
