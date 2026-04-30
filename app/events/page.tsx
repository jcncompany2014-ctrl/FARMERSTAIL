import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  getActiveEvents,
  formatEventDateRange,
  type EventPalette,
} from '@/lib/events/data'

// 1분 ISR — 이벤트 카드는 자주 바뀌지 않음. 60초 stale-while-revalidate 로
// admin 변경이 1분 내 반영. 즉각 반영 필요시 router.refresh() 또는
// revalidatePath('/events').
export const revalidate = 60

/**
 * /events — 진행 중 이벤트 인덱스.
 *
 * 대시보드 캐러셀이 "3개 슬라이드" 를 요약하는 관점이라면, 이 페이지는
 * 모든 활성 이벤트를 **세로 스크롤 리스트** 로 펼쳐서 상세로 들어가는 허브.
 * 캐러셀 카드의 에디토리얼 톤 (palette 배경 + CornerTicks 느낌의 meta row
 * + 대형 serif 타이틀) 은 유지하되, 각 카드의 높이를 풀어주어 정보 밀도를
 * 올린다 (tagline 까지 노출).
 *
 * 서버 컴포넌트 — 데이터는 `getActiveEvents()` 에서 바로 가져온다. 현재는
 * mock 이지만 서비스화 시엔 Supabase fetch 가 되어도 시그니처 유지.
 */

const PALETTE_MAP: Record<
  EventPalette,
  { bg: string; text: string; accent: string; body: string; rule: string }
> = {
  ink: {
    bg: 'var(--ink)',
    text: 'var(--bg)',
    accent: 'var(--gold)',
    body: 'rgba(245,240,230,0.76)',
    rule: 'rgba(245,240,230,0.18)',
  },
  terracotta: {
    bg: 'var(--terracotta)',
    text: 'var(--bg)',
    accent: '#F5E0C2',
    body: 'rgba(245,240,230,0.88)',
    rule: 'rgba(245,240,230,0.22)',
  },
  moss: {
    bg: 'var(--moss)',
    text: 'var(--bg)',
    accent: 'var(--gold)',
    body: 'rgba(245,240,230,0.85)',
    rule: 'rgba(245,240,230,0.22)',
  },
  gold: {
    bg: 'var(--gold)',
    text: 'var(--ink)',
    accent: 'var(--terracotta)',
    body: 'rgba(30,26,20,0.72)',
    rule: 'rgba(30,26,20,0.18)',
  },
}

export default async function EventsIndexPage() {
  const supabase = await createClient()
  const events = await getActiveEvents(supabase)

  return (
    <main className="pb-12 mx-auto" style={{ background: 'var(--bg)', maxWidth: 1280 }}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="px-5 md:px-6 pt-10 md:pt-16 pb-6 md:pb-10 text-center">
        <span className="kicker">Ongoing · 진행중</span>
        <h1
          className="font-serif mt-3 md:mt-5 text-[30px] md:text-[64px] lg:text-[80px]"
          style={{
            lineHeight: 1.05,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
          }}
        >
          EVENT
        </h1>
        <p
          className="mx-auto mt-3 md:mt-5 text-[12.5px] md:text-[16px] leading-relaxed max-w-[300px] md:max-w-[480px]"
          style={{ color: 'var(--muted)' }}
        >
          이번에 놓치면,{' '}
          <span
            className="font-serif italic"
            style={{
              fontWeight: 600,
              color: 'var(--terracotta)',
            }}
          >
            다음은 없어요.
          </span>
        </p>
      </section>

      {/* ── 이벤트 리스트 — 데스크톱 2열 ───────────────────── */}
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="px-5 md:px-6 flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
          {events.map((event, i) => {
            const palette = PALETTE_MAP[event.palette]
            const dateRange = formatEventDateRange(event.startsAt, event.endsAt)
            return (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="group relative overflow-hidden flex flex-col rounded-2xl"
                style={{
                  background: palette.bg,
                  color: palette.text,
                  minHeight: 220,
                }}
              >
                {/* 우상단 spotlight — 통판 배경의 flat 함 완화 */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(ellipse at 115% -10%, rgba(255,255,255,0.14) 0%, transparent 55%)',
                  }}
                />

                {/* 상단 meta bar — status + date + serial */}
                <div className="relative z-10 flex items-center justify-between px-5 pt-5">
                  <span
                    className="inline-flex items-center gap-1.5 text-[9.5px] font-bold px-2.5 py-1 rounded-full"
                    style={{
                      background: palette.rule,
                      color: palette.text,
                      letterSpacing: '0.08em',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: palette.accent }}
                    />
                    {event.statusLabel}
                  </span>
                  <span
                    className="font-mono text-[10px] tabular-nums"
                    style={{ color: palette.body, letterSpacing: '0.02em' }}
                  >
                    {dateRange}
                  </span>
                </div>

                {/* 본문 — kicker + title + subtitle + tagline */}
                <div className="relative z-10 flex-1 flex flex-col justify-end px-5 pb-5 pt-8">
                  <div
                    className="flex items-baseline gap-2"
                    style={{ color: palette.body }}
                  >
                    <span
                      className="font-serif italic text-[13px]"
                      style={{ fontWeight: 500 }}
                    >
                      No.
                    </span>
                    <span
                      className="font-serif tabular-nums text-[14px]"
                      style={{
                        fontWeight: 800,
                        color: palette.text,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="text-[9.5px] font-semibold uppercase ml-2"
                      style={{
                        letterSpacing: '0.2em',
                      }}
                    >
                      {event.kicker}
                    </span>
                  </div>

                  <div
                    className="font-serif mt-2 leading-[0.95]"
                    style={{
                      fontSize: 32,
                      fontWeight: 900,
                      color: palette.text,
                      letterSpacing: '-0.035em',
                    }}
                  >
                    {event.enTitle}
                  </div>

                  <div
                    className="font-serif italic mt-1"
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: palette.accent,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {event.koSubtitle}
                  </div>

                  <p
                    className="mt-3 leading-relaxed"
                    style={{
                      fontSize: 12,
                      color: palette.body,
                    }}
                  >
                    {event.tagline}
                  </p>

                  {/* 하단 bar — highlight + arrow */}
                  <div
                    className="mt-4 pt-4 flex items-end justify-between gap-3"
                    style={{ borderTop: `1px solid ${palette.rule}` }}
                  >
                    <div className="min-w-0">
                      <div
                        className="text-[8.5px] font-mono uppercase"
                        style={{
                          letterSpacing: '0.2em',
                          color: palette.body,
                        }}
                      >
                        Benefit
                      </div>
                      <div
                        className="font-serif mt-1 leading-[1.1]"
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: palette.accent,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {event.highlight}
                      </div>
                    </div>
                    <div
                      aria-hidden
                      className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5"
                      style={{
                        background: palette.text,
                        color: palette.bg,
                      }}
                    >
                      <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </section>
      )}

      {/* ── 아래 안내 문구 ──────────────────────────────────── */}
      <section className="px-5 mt-10">
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
          }}
        >
          <span className="kicker kicker-muted">Note</span>
          <p
            className="mt-2 text-[12px] leading-relaxed"
            style={{ color: 'var(--text)' }}
          >
            모든 이벤트는 기간 중 언제든 조기 마감될 수 있어요. 이미 받은 쿠폰은
            <strong> 마이페이지 → 쿠폰함</strong>에서 다시 확인할 수 있습니다.
          </p>
        </div>
      </section>
    </main>
  )
}

function EmptyState() {
  return (
    <section className="px-5">
      <div
        className="rounded-2xl px-5 py-10 text-center"
        style={{
          background: 'var(--bg-2)',
          border: '1px dashed var(--rule)',
        }}
      >
        <span className="kicker kicker-muted">Empty</span>
        <p
          className="font-serif mt-3"
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          지금 진행 중인 이벤트가 없어요.
        </p>
        <p
          className="mt-2 text-[12px]"
          style={{ color: 'var(--muted)' }}
        >
          새 소식은 홈에서 가장 먼저 알려드릴게요.
        </p>
      </div>
    </section>
  )
}
