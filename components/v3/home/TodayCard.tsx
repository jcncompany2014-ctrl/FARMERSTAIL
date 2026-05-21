'use client'

/**
 * TodayCard — "오늘의 한 가지" ink hero 카드.
 *
 * 핸드오프 패턴:
 *   - ink bg + paper text — 검정 카드 (시각적 강조).
 *   - 좌상단: Mono yellow "오늘의 한 가지 · №01"
 *   - 본문: 26px sans 700 헤딩 (2줄 가능).
 *   - 우상단: 56×56 accent circle + icon.
 *   - 본문 설명: 13px sub 카피.
 *   - CTA: accent bg button "지금 입력하기 →".
 *   - 하단: "안내 숨기기" + "왜 이 안내?" 2개 mute link.
 */

import { ArrowRight, EyeOff, HelpCircle, type LucideIcon } from 'lucide-react'
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
  /** CTA 클릭 핸들러 — Link 동작은 호출자 책임. */
  onCtaClick?: () => void
  /** 우상단 큰 circle 아이콘 — 24px lucide-react Icon. */
  Icon?: LucideIcon
  /** "안내 숨기기" 클릭 — 옵션 (없으면 미표시). */
  onDismiss?: () => void
  /** "왜 이 안내?" 클릭 — 옵션. */
  onWhy?: () => void
}

export default function TodayCard({
  number = '№01',
  kicker,
  heading,
  description,
  ctaLabel = '지금 입력하기',
  onCtaClick,
  Icon,
  onDismiss,
  onWhy,
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
          {Icon && (
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
              <Icon size={24} color={V3.paper} strokeWidth={1.75} />
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

        <button
          onClick={onCtaClick}
          className="flex items-center justify-between transition active:scale-[0.99]"
          style={{
            width: '100%',
            background: V3.accent,
            color: V3.paper,
            border: 'none',
            borderRadius: 4,
            padding: '14px 18px',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 14,
            letterSpacing: '-0.005em',
            cursor: 'pointer',
          }}
        >
          <span>{ctaLabel}</span>
          <ArrowRight size={16} color={V3.paper} strokeWidth={2.2} />
        </button>

        {(onDismiss || onWhy) && (
          <div
            className="flex justify-between"
            style={{ marginTop: 14 }}
          >
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="inline-flex items-center"
                style={{
                  gap: 6,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'rgba(244,237,224,0.55)',
                }}
              >
                <EyeOff size={12} strokeWidth={1.6} />
                <Mono color="rgba(244,237,224,0.55)" size="xxs">
                  안내 숨기기
                </Mono>
              </button>
            )}
            {onWhy && (
              <button
                onClick={onWhy}
                className="inline-flex items-center"
                style={{
                  gap: 6,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'rgba(244,237,224,0.55)',
                }}
              >
                <HelpCircle size={12} strokeWidth={1.6} />
                <Mono color="rgba(244,237,224,0.55)" size="xxs">
                  왜 이 안내?
                </Mono>
              </button>
            )}
          </div>
        )}

      </div>
    </section>
  )
}
