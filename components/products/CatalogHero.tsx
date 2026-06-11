'use client'

/**
 * CatalogHero — 모바일 카탈로그 hero 슬라이더 (2026-05-21).
 *
 * `events` 테이블에서 active row 들을 받아 가로 스냅 carousel 로 표시.
 * 각 슬라이드는 palette 별 색상 (terracotta/moss/gold/ink) + Gift 아이콘 +
 * kicker badge + tagline + highlight + "지금 시작 →" CTA.
 * 클릭 시 `/events/${slug}` 상세 페이지로 이동.
 *
 * # 동작
 *  - 가로 스크롤 + scroll-snap (라이브러리 X — 네이티브 스크롤).
 *  - 5초 autoplay. 사용자가 swipe/tap 하면 5초 일시정지 후 재개.
 *  - 도트 클릭으로 점프. active 도트 = 가로로 길쭉.
 *  - 슬라이드가 1개면 도트 숨김.
 *
 * # 데스크톱
 *  - md:hidden — 데스크톱은 별도 /events 페이지로 navigation.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowRight, Gift } from 'lucide-react'
import type { EventItem, EventPalette } from '@/lib/events/data'

interface Palette {
  bg: string
  accent: string // 본문 텍스트 색 (bg 위)
  perkBg: string // kicker badge 의 반투명 배경
  ctaFg: string // "지금 시작" CTA pill 의 텍스트 색 (= bg 와 동일)
  giftTint: string // 우상단 Gift 아이콘 색
}

const PALETTE_MAP: Record<EventPalette, Palette> = {
  terracotta: {
    bg: '#dc532a',
    accent: '#fff',
    perkBg: 'rgba(255,255,255,0.22)',
    ctaFg: '#dc532a',
    giftTint: 'rgba(255,255,255,0.28)',
  },
  moss: {
    bg: '#5d6f3f',
    accent: '#fff',
    perkBg: 'rgba(255,255,255,0.22)',
    ctaFg: '#5d6f3f',
    giftTint: 'rgba(255,255,255,0.28)',
  },
  gold: {
    bg: '#e8a82e',
    accent: '#1a140c',
    perkBg: 'rgba(26,20,12,0.14)',
    ctaFg: '#a87520',
    giftTint: 'rgba(26,20,12,0.16)',
  },
  ink: {
    bg: '#1a140c',
    accent: '#fff',
    perkBg: 'rgba(255,255,255,0.16)',
    ctaFg: '#1a140c',
    giftTint: 'rgba(255,255,255,0.2)',
  },
}

const AUTOPLAY_MS = 5000
const USER_PAUSE_MS = 6000

export default function CatalogHero({
  events,
  variant = 'web',
}: {
  events: EventItem[]
  /** 'web' (기본) 또는 'app' — v3 톤 분기 (R14 cleanup) */
  variant?: 'web' | 'app'
}) {
  const [active, setActive] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const userPausedUntil = useRef<number>(0)
  const isApp = variant === 'app'
  const ctaRadius = isApp ? 4 : 14

  // autoplay — 5초마다 next slide. 사용자가 swipe 한 직후 6초는 일시정지.
  useEffect(() => {
    if (events.length <= 1) return
    const id = setInterval(() => {
      if (Date.now() < userPausedUntil.current) return
      setActive((prev) => (prev + 1) % events.length)
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [events.length])

  // active state 가 바뀌면 스크롤 위치 동기화 (도트 클릭 + autoplay).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const slide = el.children[active] as HTMLElement | undefined
    if (slide) {
      el.scrollTo({
        left: slide.offsetLeft - el.offsetLeft,
        behavior: 'smooth',
      })
    }
  }, [active])

  // 사용자가 직접 스크롤 → active 동기화 (역방향).
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (Date.now() >= userPausedUntil.current) return // autoplay-driven scroll 은 무시
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx >= 0 && idx < events.length) {
      setActive(idx)
    }
  }, [events.length])

  function pauseAutoplay() {
    userPausedUntil.current = Date.now() + USER_PAUSE_MS
  }

  if (events.length === 0) return null

  return (
    <section className="md:hidden px-4 pb-5">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onTouchStart={pauseAutoplay}
        onMouseDown={pauseAutoplay}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          gap: 0,
        }}
      >
        {events.map((event) => (
          <HeroSlide
            key={event.id}
            event={event}
            ctaRadius={ctaRadius}
            cardRadius={isApp ? 12 : 18}
            kickerRadius={isApp ? 4 : 10}
            isApp={isApp}
          />
        ))}
      </div>

      {/* 도트 페이지네이션 */}
      {events.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {events.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                pauseAutoplay()
                setActive(idx)
              }}
              className="transition-all"
              style={{
                width: idx === active ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background:
                  idx === active ? '#1a140c' : 'rgba(26,20,12,0.22)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label={`이벤트 ${idx + 1}로 이동`}
              aria-current={idx === active}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function HeroSlide({
  event,
  ctaRadius,
  cardRadius,
  kickerRadius,
  isApp = false,
}: {
  event: EventItem
  ctaRadius: number
  cardRadius: number
  kickerRadius: number
  isApp?: boolean
}) {
  const p = PALETTE_MAP[event.palette] ?? PALETTE_MAP.terracotta
  return (
    <Link
      href={event.href}
      className="shrink-0 snap-start snap-always relative block overflow-hidden"
      style={{
        flex: '0 0 100%',
        width: '100%',
        background: p.bg,
        color: p.accent,
        borderRadius: cardRadius,
        // R22: 위아래 여백 ↑ (사용자 보고: 텍스트 따닥따닥)
        padding: '26px 24px 24px',
      }}
    >
      {/* 장식 원 */}
      <span
        className="absolute pointer-events-none"
        style={{
          top: -50,
          right: -40,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background:
            event.palette === 'gold'
              ? 'rgba(255,255,255,0.18)'
              : 'rgba(255,255,255,0.14)',
        }}
      />
      <span
        className="absolute pointer-events-none"
        style={{
          bottom: -80,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.07)',
        }}
      />
      {/* 우상단 Gift 일러스트 — 더 흐릿하게 (사용자: 가시성 ↓ → 텍스트 우선) */}
      <span
        className="absolute pointer-events-none"
        style={{ top: 22, right: 22, color: p.giftTint, opacity: 0.7 }}
      >
        <Gift size={56} strokeWidth={1.6} />
      </span>

      <div className="relative">
        <span
          className="inline-flex items-center font-bold"
          style={{
            padding: '5px 11px',
            background: p.perkBg,
            borderRadius: kickerRadius,
            fontSize: 10.5,
            letterSpacing: 1.6,
            color: p.accent,
            lineHeight: 1,
          }}
        >
          {event.kicker}
        </span>
        <h2
          // Phase P: 앱은 Archivo Black 누수 차단 — sans 900 (다른 app 헤딩 정합)
          className={isApp ? undefined : "font-['Archivo_Black']"}
          style={{
            // R22: tagline 여백 + 줄간 정리 (이전: 따닥따닥)
            marginTop: 14,
            fontSize: 22,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
            color: p.accent,
            wordBreak: 'keep-all',
            fontFamily: isApp
              ? "var(--font-sans), 'Pretendard', sans-serif"
              : undefined,
            fontWeight: isApp ? 900 : undefined,
          }}
        >
          {event.tagline}
        </h2>
        <p
          style={{
            marginTop: 12,
            fontSize: 12.5,
            lineHeight: 1.55,
            color: p.accent,
            opacity: 0.86,
            wordBreak: 'keep-all',
          }}
        >
          {event.highlight}
        </p>
        <div className="flex items-center gap-2.5" style={{ marginTop: 18 }}>
          <span
            className="inline-flex items-center gap-1.5 font-bold"
            style={{
              padding: '11px 20px',
              background: '#fff',
              color: p.ctaFg,
              borderRadius: ctaRadius,
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            지금 시작
            <ArrowRight size={14} color={p.ctaFg} strokeWidth={2.4} />
          </span>
          <span
            style={{
              fontSize: 11,
              color: p.accent,
              opacity: 0.85,
            }}
          >
            {event.statusLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}
