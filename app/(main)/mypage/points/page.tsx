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
import { V3, V3Dark, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import PointsBrowser from './PointsBrowser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '적립금',
  robots: { index: false, follow: false },
}

/**
 * /mypage/points — 적립금 hub (v3 reskin, 2026-05-22 R9-4).
 *
 * V3Dark ink hero + yellow accent + 4-stat metric strip + 등급 적립률 안내.
 * ledger 는 PointsBrowser (client) — filter 탭 + 월별 그룹.
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
    entries && entries.length > 0 ? entries[0]!.balance_after : 0

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
    <div style={{ paddingBottom: 40 }}>
      {/* Back link */}
      <section style={{ padding: '24px 20px 12px' }}>
        <Link
          href="/mypage"
          className="inline-flex items-center"
          style={{
            gap: 4,
            fontSize: 10.5,
            fontWeight: V3FontWeight.semibold,
            color: V3.inkMute,
            textDecoration: 'none',
          }}
        >
          <ChevronLeft size={12} strokeWidth={2.5} />
          내 정보
        </Link>
      </section>

      {/* HERO — V3Dark ink + yellow accent */}
      <section style={{ padding: '0 20px' }}>
        <div
          className="relative overflow-hidden"
          style={{
            background: V3Dark.bg,
            borderRadius: V3Radius.sm,
            padding: '22px 22px 22px',
            color: V3Dark.fg,
          }}
        >
          {/* 우상단 yellow glow */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: -40,
              right: -40,
              width: 170,
              height: 170,
              borderRadius: 999,
              background:
                'radial-gradient(circle, rgba(230,185,66,0.22) 0%, transparent 70%)',
            }}
          />
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              bottom: -50,
              left: -50,
              width: 140,
              height: 140,
              borderRadius: 999,
              background: 'rgba(244,237,224,0.04)',
            }}
          />

          <div className="relative">
            <div className="flex items-center" style={{ gap: 6, marginBottom: 6 }}>
              <Coins size={14} color={V3.yellow} strokeWidth={2} />
              <span
                style={{
                  fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: V3.yellow,
                }}
              >
                Points · 사용 가능
              </span>
            </div>
            <div className="flex items-baseline" style={{ gap: 6 }}>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.black,
                  fontSize: 44,
                  color: V3.yellow,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {balance.toLocaleString()}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
                  fontSize: 13.5,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: V3Dark.fgMute,
                  textTransform: 'uppercase',
                }}
              >
                P
              </span>
            </div>

            {/* 등급 적립률 안내 → 멤버십 hub */}
            <Link
              href="/mypage/membership"
              className="flex items-center transition"
              style={{
                marginTop: 18,
                gap: 12,
                padding: '10px 14px',
                borderRadius: V3Radius.xs,
                background: V3Dark.ruleSoft,
                border: `1px solid ${V3Dark.rule}`,
                color: V3Dark.fg,
                textDecoration: 'none',
              }}
            >
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: meta.bg,
                  color: meta.ink,
                }}
              >
                {meta.key === 'mate' ? (
                  <Crown size={14} strokeWidth={2} />
                ) : (
                  <Sparkles size={14} strokeWidth={2} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: V3FontWeight.bold,
                    color: V3Dark.fg,
                  }}
                >
                  {meta.label} 등급 — {meta.earnRate}% 적립
                </div>
                {next ? (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: V3Dark.fgMute,
                      marginTop: 2,
                    }}
                  >
                    {next.label} ({next.earnRate}%) 까지{' '}
                    {remainToNext.toLocaleString()}원 더
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: V3Dark.fgMute,
                      marginTop: 2,
                    }}
                  >
                    최고 적립률 도달 ✓
                  </div>
                )}
              </div>
              <ChevronRight size={16} color={V3Dark.fgMute} strokeWidth={2} />
            </Link>
          </div>
        </div>
      </section>

      {/* stat 4-grid — metric strip 패턴 */}
      <section style={{ padding: '12px 20px 0' }}>
        <div
          className="grid grid-cols-2"
          style={{
            gap: 0,
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: V3Radius.sm,
            overflow: 'hidden',
          }}
        >
          <StatCell
            kicker="이번 달 적립"
            value={earnedThisMonth}
            tone="sage"
            Icon={TrendingUp}
            isFirstRow
            isFirstCol
          />
          <StatCell
            kicker="이번 달 사용"
            value={usedThisMonth}
            tone="accent"
            Icon={TrendingDown}
            isFirstRow
          />
          <StatCell
            kicker="누적 적립"
            value={earnedTotal}
            tone="ink"
            Icon={TrendingUp}
            small
            isFirstCol
          />
          <StatCell
            kicker="누적 사용"
            value={usedTotal}
            tone="inkMute"
            Icon={TrendingDown}
            small
          />
        </div>
      </section>

      {/* ledger — client island */}
      <PointsBrowser
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entries={(entries ?? []) as any[]}
      />
    </div>
  )
}

type ToneKey = 'sage' | 'accent' | 'ink' | 'inkMute'
const TONE_COLOR: Record<ToneKey, string> = {
  sage: V3.sage,
  accent: V3.accent,
  ink: V3.ink,
  inkMute: V3.inkMute,
}

function StatCell({
  kicker,
  value,
  tone,
  Icon,
  small,
  isFirstRow,
  isFirstCol,
}: {
  kicker: string
  value: number
  tone: ToneKey
  Icon: typeof TrendingUp
  small?: boolean
  isFirstRow?: boolean
  isFirstCol?: boolean
}) {
  const accent = TONE_COLOR[tone]
  return (
    <div
      style={{
        padding: '12px 14px',
        borderLeft: isFirstCol ? 'none' : `1px solid ${V3.rule}`,
        borderTop: isFirstRow ? 'none' : `1px solid ${V3.rule}`,
      }}
    >
      <div className="inline-flex items-center" style={{ gap: 4 }}>
        <Icon size={11} color={accent} strokeWidth={2.5} />
        <span
          style={{
            fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: accent,
          }}
        >
          {kicker}
        </span>
      </div>
      <div
        className="tabular-nums"
        style={{
          marginTop: 5,
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.black,
          fontSize: small ? 16 : 22,
          color: V3.ink,
          letterSpacing: V3LetterSpacing.heading,
          lineHeight: 1,
        }}
      >
        {value.toLocaleString()}
        <span
          style={{
            fontSize: 10.5,
            color: V3.inkMute,
            marginLeft: 3,
            fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
            fontWeight: 500,
            letterSpacing: '0.08em',
          }}
        >
          P
        </span>
      </div>
    </div>
  )
}
