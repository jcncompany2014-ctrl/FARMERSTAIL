/**
 * TodayCard — "오늘의 한 가지" ink hero 카드 (server component).
 *
 * 핸드오프 패턴:
 *   - ink bg + paper text — 검정 카드 (시각적 강조).
 *   - 좌상단: Mono yellow "오늘의 한 가지 · №01"
 *   - 본문: 26px sans 700 헤딩 (2줄 가능).
 *   - 우상단: 56×56 accent circle + icon.
 *   - 본문 설명: 13px sub 카피.
 *   - CTA: accent bg "지금 입력하기 →" — Link 로 호출자가 href 지정.
 *
 * # 2026-05-22 — server component 로 전환
 *  Dashboard server component 에서 LucideIcon (function reference) 를 prop
 *  으로 넘기다가 "Functions cannot be passed to Client Components" 에러 발생.
 *  → 'use client' 제거 + onCtaClick 함수 prop 제거 + Icon prop type 을
 *    `LucideIcon` → `React.ReactNode` 로 변경 (Element 는 직렬화 가능).
 *  → CTA 는 Link href 기반으로 변경. 호출자가 element 만들어 넘김:
 *    `<TodayCard icon={<Scale size={24} color="#f4ede0" />} href="/dogs/..." ... />`
 *
 *  "안내 숨기기" / "왜 이 안내?" 같은 클라이언트 인터랙티브 액션은 별도
 *  client island 로 분리 예정 (R8 이후, useDismissible 와 함께).
 */

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface TodayCardProps {
  /** 누적 액션 번호. №01 등. */
  number?: string
  /** 상단 kicker — 기본 "오늘의 한 가지 · {number}". */
  kicker?: string
  /** 헤딩 본문 (2줄 가능). */
  heading: React.ReactNode
  /** 설명 본문 — 14자 권장. */
  description: string
  /** CTA 라벨. 기본 "지금 입력하기". */
  ctaLabel?: string
  /** CTA 클릭 시 이동할 경로. */
  href: string
  /** 우상단 큰 circle 아이콘 — `<Scale size={24} color={V3.paper} />` 같은
   *  미리 만든 ReactNode element. LucideIcon (function ref) 는 직렬화 불가
   *  하므로 element 형태로 전달. */
  icon?: React.ReactNode
}

export default function TodayCard({
  number = '№01',
  kicker,
  heading,
  description,
  ctaLabel = '지금 입력하기',
  href,
  icon,
}: TodayCardProps) {
  const displayKicker = kicker ?? `오늘의 한 가지 · ${number}`

  return (
    <section style={{ padding: '0 20px 30px' }}>
      <div
        className="ft-card-ink"
        style={{
          padding: '22px 22px 22px',
          position: 'relative',
        }}
      >
        <div className="flex justify-between" style={{ alignItems: 'flex-start' }}>
          <div className="min-w-0">
            <Mono color="yellow" size="xs" weight={600}>
              {displayKicker}
            </Mono>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.bold,
                fontSize: 26,
                marginTop: 10,
                lineHeight: 1.15,
                letterSpacing: '-0.022em',
                color: V3.paper,
                textWrap: 'balance',
                wordBreak: 'keep-all',
              }}
            >
              {heading}
            </div>
          </div>
          {icon && (
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: V3.accent,
              }}
              aria-hidden
            >
              {icon}
            </div>
          )}
        </div>

        <p
          style={{
            margin: '14px 0 18px',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'rgba(244,237,224,0.7)',
            wordBreak: 'keep-all',
          }}
        >
          {description}
        </p>

        <Link
          href={href}
          className="flex items-center justify-between transition active:scale-[0.99]"
          style={{
            width: '100%',
            background: V3.accent,
            color: V3.paper,
            borderRadius: 4,
            padding: '14px 18px',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 14,
            letterSpacing: '-0.005em',
          }}
        >
          <span>{ctaLabel}</span>
          <ArrowRight size={16} color={V3.paper} strokeWidth={2.2} />
        </Link>
      </div>
    </section>
  )
}
