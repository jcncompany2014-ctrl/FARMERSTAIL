import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Coins,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Crown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { tierMeta, nextTier } from '@/lib/tiers'
import PointsBrowser from './PointsBrowser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '적립금',
  robots: { index: false, follow: false },
}

/**
 * /mypage/points — 적립금 hub.
 *
 * Hero (gold-on-ink gradient) + stat 4-grid (이번달 적립/사용 + 누적 적립/사용)
 * + 등급 적립률 안내 + filter 탭 (전체/적립/사용) + 월별 그룹 ledger.
 */
export default async function PointsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/points')

  const [{ data: entries }, { data: profile }] = await Promise.all([
    supabase
      .from('point_ledger')
      .select('id, delta, balance_after, reason, reference_type, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('profiles')
      .select('tier, cumulative_spend')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const balance =
    entries && entries.length > 0 ? entries[0].balance_after : 0

  // Server component 매 요청마다 실행 — 의도된 동작.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now()
  const monthDate = new Date(nowMs)
  const thisMonthStart = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1,
  ).getTime()

  let earnedTotal = 0
  let usedTotal = 0
  let earnedThisMonth = 0
  let usedThisMonth = 0
  for (const e of entries ?? []) {
    const t = new Date(e.created_at).getTime()
    if (e.delta > 0) {
      earnedTotal += e.delta
      if (t >= thisMonthStart) earnedThisMonth += e.delta
    } else if (e.delta < 0) {
      usedTotal += -e.delta
      if (t >= thisMonthStart) usedThisMonth += -e.delta
    }
  }

  const tier = (profile?.tier as string | null) ?? 'seed'
  const meta = tierMeta(tier)
  const next = nextTier(tier)
  const cumulativeSpend = profile?.cumulative_spend ?? 0
  const remainToNext = next ? Math.max(0, next.threshold - cumulativeSpend) : 0

  return (
    <main className="pb-10">
      <section className="px-5 pt-6 pb-3">
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-terracotta font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          내 정보
        </Link>
      </section>

      {/* HERO — gold-on-ink + 큰 잔액 + 등급 적립률 */}
      <section className="px-5">
        <div
          className="relative overflow-hidden rounded-3xl px-6 pt-6 pb-7 text-white"
          style={{
            background:
              'linear-gradient(135deg, #1E1A14 0%, #3a2f1d 60%, #5b4720 100%)',
          }}
        >
          <div
            aria-hidden
            className="absolute -top-12 -right-10 w-44 h-44 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(212,169,74,0.25) 0%, transparent 70%)',
            }}
          />
          <div
            aria-hidden
            className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
              <span className="kicker kicker-gold">
                Points · 사용 가능
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-serif leading-none tabular-nums text-gold"
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                }}
              >
                {balance.toLocaleString()}
              </span>
              <span className="text-[16px] text-white/85 font-bold">P</span>
            </div>

            {/* 등급 적립률 안내 → 멤버십 hub 진입 */}
            <Link
              href="/mypage/membership"
              className="mt-5 flex items-center gap-3 px-4 py-2.5 rounded-xl hover:opacity-95 transition"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <div
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: meta.bg, color: meta.ink }}
              >
                {meta.key === 'mate' ? (
                  <Crown className="w-3.5 h-3.5" strokeWidth={2} />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-white">
                  {meta.label} 등급 — {meta.earnRate}% 적립
                </div>
                {next ? (
                  <div className="text-[10px] text-white/70 mt-0.5">
                    {next.label} ({next.earnRate}%) 까지{' '}
                    {remainToNext.toLocaleString()}원 더
                  </div>
                ) : (
                  <div className="text-[10px] text-white/70 mt-0.5">
                    최고 적립률 도달 ✓
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-white/70" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>

      {/* stat 4-grid */}
      <section className="px-5 mt-3">
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            kicker="이번 달 적립"
            value={earnedThisMonth}
            tone="moss"
            Icon={TrendingUp}
          />
          <StatCard
            kicker="이번 달 사용"
            value={usedThisMonth}
            tone="terracotta"
            Icon={TrendingDown}
          />
          <StatCard
            kicker="누적 적립"
            value={earnedTotal}
            tone="ink"
            Icon={TrendingUp}
            small
          />
          <StatCard
            kicker="누적 사용"
            value={usedTotal}
            tone="muted"
            Icon={TrendingDown}
            small
          />
        </div>
      </section>

      {/* ledger — client island (filter 탭 + 월별 그룹) */}
      <PointsBrowser
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entries={(entries ?? []) as any[]}
      />
    </main>
  )
}

function StatCard({
  kicker,
  value,
  tone,
  Icon,
  small,
}: {
  kicker: string
  value: number
  tone: 'moss' | 'terracotta' | 'ink' | 'muted'
  Icon: typeof TrendingUp
  small?: boolean
}) {
  const colorMap = {
    moss: 'var(--moss)',
    terracotta: 'var(--terracotta)',
    ink: 'var(--ink)',
    muted: 'var(--muted)',
  }
  const accent = colorMap[tone]
  return (
    <div
      className="rounded-xl border px-4 py-3 transition"
      style={{
        background: 'white',
        borderColor: 'var(--rule)',
      }}
    >
      <div className="inline-flex items-center gap-1">
        <Icon
          className="w-3 h-3"
          style={{ color: accent }}
          strokeWidth={2.5}
        />
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {kicker}
        </span>
      </div>
      <div
        className="mt-1 font-serif tabular-nums"
        style={{
          fontSize: small ? 14 : 18,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.015em',
        }}
      >
        {value.toLocaleString()}
        <span className="text-[10px] text-muted ml-0.5 font-sans">P</span>
      </div>
    </div>
  )
}
