'use client'

// ---------------------------------------------------------------------------
// OngoingEvents — landing 버전 이벤트 캐러셀
//
// 대시보드에도 같은 개념의 캐러셀이 있지만, 그쪽은 Tailwind + 앱톤 (행동
// 중심, 촘촘한 UI). 랜딩 페이지는 에디토리얼 매거진 mood 라서 여기서는:
//   - 인라인 style 우위 (다른 landing/ 컴포넌트와 동일한 표기법)
//   - 세리얼 번호(No. 01), CornerTicks, 세그먼트 progress 바 — HeroSlideshow
//     와 같은 시각 문법을 공유
//   - 컨텐츠 컬럼은 부모 (max-width 430px) 에 붙어서 모바일 / 데스크톱
//     어디서 봐도 "폰 프레임 기준" 정렬을 유지 (full-bleed 브레이크아웃 X)
//
// 데이터는 출시 전이라 mock 고정. 서비스화 시점엔 Supabase `events` 테이블
// (is_active + now 기준 in-range + sort_priority desc 로 상위 3) 로 교체.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import CornerTicks from './CornerTicks'
import {
  formatEventDateRange,
  type EventItem,
  type EventPalette,
} from '@/lib/events/data'

// 이벤트는 DB 에 있고, 이 섹션은 client 컴포넌트라 fetch 를 부모 서버
// 컴포넌트 (`app/page.tsx`) 가 대신 수행해 prop 으로 내린다. 여기서는
// 렌더 + 캐러셀 인터랙션만.

// Palette 별 톤 매핑. ink/terracotta/moss 는 dark panel 톤 (배경이 진하고
// 텍스트가 밝음), gold 는 light panel 톤.
type PaletteTokens = {
  bg: string
  text: string
  accent: string
  body: string
  rule: string
  tick: string
}

const PALETTE_MAP: Record<EventPalette, PaletteTokens> = {
  ink: {
    bg: 'var(--ink)',
    text: 'var(--bg)',
    accent: 'var(--gold)',
    body: 'rgba(245,240,230,0.76)',
    rule: 'rgba(245,240,230,0.18)',
    tick: 'rgba(245,240,230,0.35)',
  },
  terracotta: {
    bg: 'var(--terracotta)',
    text: 'var(--bg)',
    accent: '#F5E0C2',
    body: 'rgba(245,240,230,0.88)',
    rule: 'rgba(245,240,230,0.22)',
    tick: 'rgba(245,240,230,0.4)',
  },
  moss: {
    bg: 'var(--moss)',
    text: 'var(--bg)',
    accent: 'var(--gold)',
    body: 'rgba(245,240,230,0.85)',
    rule: 'rgba(245,240,230,0.22)',
    tick: 'rgba(245,240,230,0.4)',
  },
  gold: {
    bg: 'var(--gold)',
    text: 'var(--ink)',
    accent: 'var(--terracotta)',
    body: 'rgba(30,26,20,0.72)',
    rule: 'rgba(30,26,20,0.18)',
    tick: 'rgba(30,26,20,0.35)',
  },
}

export default function OngoingEvents({
  events,
}: {
  events: EventItem[]
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)

  // 이벤트가 0개면 섹션 자체를 숨겨야 깔끔 — mock 삭제 / 기간 밖으로 밀릴
  // 때 섹션 헤더만 떠 있는 상황을 막는다. hooks 는 early return 전에 이미
  // 전부 호출됐는지 먼저 확인 — 이 컴포넌트는 useEffect 하나밖에 없어서
  // early return 을 아래로 내려도 됨.

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    let tid: number | null = null
    const onScroll = () => {
      if (tid) cancelAnimationFrame(tid)
      tid = requestAnimationFrame(() => {
        // 모든 슬라이드 폭이 동일 (flex 0 0 100%) 이므로 scrollLeft/clientWidth
        // round 로 정확히 매핑. HeroSlideshow 와 동일한 계산식.
        const i = Math.round(el.scrollLeft / el.clientWidth)
        setIdx((prev) => (prev !== i ? i : prev))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (tid) cancelAnimationFrame(tid)
    }
  }, [])

  const goTo = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  // hooks 이후의 early return — 컨텐츠 없으면 섹션 자체를 렌더하지 않는다.
  if (events.length === 0) return null

  const active = events[idx] ?? events[0]

  return (
    <section
      id="events"
      className="grain grain-soft"
      style={{
        position: 'relative',
        background: 'var(--bg)',
        padding: '52px 0 40px',
      }}
    >
      {/* Header strip — terracotta tick + Ongoing kicker + pp. page number */}
      <div
        style={{
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            aria-hidden
            style={{
              width: 20,
              height: 1,
              background: 'var(--terracotta)',
            }}
          />
          <span className="kicker">Ongoing</span>
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'var(--muted)',
          }}
        >
          pp. 015 — 016
        </span>
      </div>

      {/* Headline — evergreen. 예전엔 "세 가지" 로 카운트를 박아뒀지만,
          이벤트는 계속 바뀌는 섹션이라 특정 숫자 / 특정 이벤트 종류를
          고정하지 않는다. "이벤트" 자체에 무게를 실어주는 magazine
          treatment: kicker-ish "지금," + big serif "이벤트." */}
      <h2
        className="font-serif"
        style={{
          margin: '14px 20px 0',
          fontSize: 34,
          lineHeight: 1.02,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.035em',
        }}
      >
        <span
          className="font-serif"
          style={{
            display: 'block',
            fontSize: 18,
            fontWeight: 500,
            fontStyle: 'italic',
            color: 'var(--terracotta)',
            letterSpacing: '-0.01em',
            marginBottom: 2,
          }}
        >
          지금,
        </span>
        이벤트.
      </h2>

      {/* Body — evergreen + FOMO. 구체 이벤트는 여전히 안 박지만, "놓치면
          없다" 쪽으로 톤을 댕김. "다음은 없습니다." 가 핵심 punch line. */}
      <p
        style={{
          margin: '12px 20px 0',
          maxWidth: 320,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: 'var(--text)',
        }}
      >
        이번에 놓치면,{' '}
        <span
          className="font-serif"
          style={{
            fontStyle: 'italic',
            fontWeight: 600,
            color: 'var(--terracotta)',
          }}
        >
          다음은 없어요.
        </span>
      </p>

      {/* Scroll track — HeroSlideshow 의 no-scrollbar 트랙과 동일 문법.
          각 슬라이드 flex: 0 0 100% 이라 스냅 포인트가 정확히 카드 경계. */}
      <div style={{ padding: '22px 20px 0' }}>
        <div
          ref={trackRef}
          className="no-scrollbar"
          style={{
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            borderRadius: 2,
          }}
        >
          {events.map((event, i) => (
            <EventCard key={event.id} event={event} serial={i + 1} />
          ))}
        </div>

        {/* 현재 active event 캡션 + counter (ko subtitle — date range · idx/total) */}
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 6,
            }}
          >
            <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
              <span
                className="font-serif"
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                }}
              >
                {active.koSubtitle}
              </span>
              <span
                className="font-serif"
                style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  marginLeft: 6,
                }}
              >
                — {formatEventDateRange(active.startsAt, active.endsAt)}
              </span>
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                color: 'var(--muted)',
                textTransform: 'uppercase',
                flexShrink: 0,
              }}
            >
              {String(idx + 1).padStart(2, '0')} /{' '}
              {String(events.length).padStart(2, '0')}
            </div>
          </div>

          {/* Segmented progress bar — 지난 인덱스도 ink 로 채워 "여기까지 왔다"
              는 시각 단서. HeroSlideshow 와 동일. */}
          <div style={{ display: 'flex', gap: 4 }}>
            {events.map((e, i) => (
              <button
                key={e.id}
                type="button"
                aria-label={`Event ${i + 1}: ${e.enTitle}`}
                onClick={() => goTo(i)}
                style={{
                  flex: 1,
                  height: 2,
                  padding: 0,
                  border: 0,
                  cursor: 'pointer',
                  background: i <= idx ? 'var(--ink)' : 'var(--rule-2)',
                  transition: 'background .25s',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// 랜딩 카드가 쓰는 최소 필드 집합만 명시. 공유 EventItem 타입을 그대로
// 받아도 되지만, 랜딩은 `kind` 나 `perks` 같은 상세 페이지용 필드를 모르고
// `href` 만 재매핑해서 쓰므로 로컬 명세로 의도를 명확히.
type LandingEventCard = {
  id: string
  kicker: string
  enTitle: string
  koSubtitle: string
  tagline: string
  highlight: string
  startsAt: string
  endsAt: string
  statusLabel: string
  href: string
  palette: EventPalette
  imageUrl?: string
  imageAlt?: string
}

function EventCard({
  event,
  serial,
}: {
  event: LandingEventCard
  serial: number
}) {
  const palette = PALETTE_MAP[event.palette]
  const dateRange = formatEventDateRange(event.startsAt, event.endsAt)

  return (
    <Link
      href={event.href}
      style={{
        flex: '0 0 100%',
        scrollSnapAlign: 'start',
        position: 'relative',
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          position: 'relative',
          background: palette.bg,
          color: palette.text,
          aspectRatio: '4 / 5',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 배경 이미지 — 이벤트가 image_url 을 설정했을 때만 렌더. palette
            단색 위에 image → 상단 gradient overlay 순으로 쌓아서 텍스트
            가독성 유지. 이미지 없으면 기존 단색 카드 그대로. */}
        {event.imageUrl && (
          <>
            <Image
              src={event.imageUrl}
              alt={event.imageAlt ?? event.enTitle}
              fill
              sizes="(max-width: 768px) 100vw, 448px"
              style={{ objectFit: 'cover', zIndex: 0 }}
            />
            {/* palette tint — 이미지를 그대로 깔면 채도가 높아 에디토리얼
                톤이 깨지고 흰 텍스트 가독성이 떨어짐. palette 색을 opacity
                로 덮어 브랜드 일관성 + 텍스트 대비 확보. gold (light
                palette) 는 덜 덮고, 나머지 dark palette 는 더 진하게. */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: palette.bg,
                opacity: event.palette === 'gold' ? 0.55 : 0.7,
                zIndex: 1,
              }}
            />
            {/* 하단으로 갈수록 짙어지는 추가 그라디언트 — 카드 하단의
                Benefit/date 영역이 이미지 위에서도 제대로 읽히도록. */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background:
                  event.palette === 'gold'
                    ? 'linear-gradient(180deg, transparent 40%, rgba(30,26,20,0.18) 100%)'
                    : 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.35) 100%)',
                zIndex: 1,
              }}
            />
          </>
        )}

        {/* 상단 우측 spotlight — 통판 배경의 flat 함 완화 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse at 115% -10%, rgba(255,255,255,0.14) 0%, transparent 55%)',
            zIndex: 2,
          }}
        />

        <CornerTicks color={palette.tick} />

        {/* Top row — SerialNo + Status chip */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            padding: '22px 22px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              className="font-serif"
              style={{
                fontSize: 13,
                color: palette.body,
                fontWeight: 500,
                fontStyle: 'italic',
              }}
            >
              No.
            </span>
            <span
              className="font-serif tnum"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: palette.text,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'lining-nums tabular-nums',
              }}
            >
              {String(serial).padStart(2, '0')}
            </span>
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 9.5,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              background: palette.rule,
              color: palette.text,
              letterSpacing: '0.08em',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: palette.accent,
              }}
            />
            {event.statusLabel}
          </span>
        </div>

        {/* 중간 본문 — flex:1 로 남은 세로 공간을 먹으면서 안쪽에서 수직 하단
            정렬. 위쪽 여백이 자동으로 meta row 와의 간격을 유지한다. */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            flex: 1,
            padding: '20px 22px 0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: palette.body,
            }}
          >
            {event.kicker}
          </span>
          <div
            className="font-serif"
            style={{
              marginTop: 10,
              fontSize: 36,
              fontWeight: 900,
              color: palette.text,
              letterSpacing: '-0.035em',
              lineHeight: 0.95,
            }}
          >
            {event.enTitle}
          </div>
          <div
            className="font-serif"
            style={{
              marginTop: 6,
              fontSize: 16,
              fontWeight: 500,
              fontStyle: 'italic',
              color: palette.accent,
              letterSpacing: '-0.01em',
            }}
          >
            {event.koSubtitle}
          </div>
          <p
            style={{
              marginTop: 12,
              fontSize: 12,
              lineHeight: 1.55,
              color: palette.body,
            }}
          >
            {event.tagline}
          </p>
        </div>

        {/* Bottom row — Benefit + highlight + date + CTA arrow */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            margin: '20px 22px 0',
            padding: '16px 0 22px',
            borderTop: `1px solid ${palette.rule}`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="font-mono"
              style={{
                fontSize: 8.5,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: palette.body,
              }}
            >
              Benefit
            </div>
            <div
              className="font-serif"
              style={{
                marginTop: 4,
                fontSize: 18,
                fontWeight: 800,
                color: palette.accent,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              {event.highlight}
            </div>
            <div
              className="font-mono tnum"
              style={{
                marginTop: 6,
                fontSize: 10,
                color: palette.body,
                letterSpacing: '0.02em',
                fontVariantNumeric: 'lining-nums tabular-nums',
              }}
            >
              {dateRange}
            </div>
          </div>
          <div
            aria-hidden
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: palette.text,
              color: palette.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="14"
              height="10"
              viewBox="0 0 16 10"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 5h14m-5-4 4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}
