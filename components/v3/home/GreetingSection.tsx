/**
 * GreetingSection — v3 홈 화면 상단 Hero greeting.
 *
 * 핸드오프 패턴:
 *   - 좌측: accent dot + Mono kicker "Hello, {name} · {timeOfDay}"
 *           54px sans 900 "좋은 / 저녁 / 이에요,"
 *   - 우측: Signature 블록 (이름 italic + FAMILY · N + 4px ink bar)
 *   - 하단: 14.5px sub 카피 + yellow Mark 강조
 *
 * timeOfDay 는 KST 시간 기준 자동 분기:
 *   05-11 → "아침" / 12-16 → "오후" / 17-20 → "저녁" / 21-04 → "밤"
 */

import { V3, V3FontWeight, V3LetterSpacing } from '@/lib/design/tokens'
import { Mono, Signature, Mark } from '@/components/v3'

interface GreetingSectionProps {
  /** 보호자 이름. */
  userName: string
  /** 가족(강아지) 수. */
  familyCount: number
  /** 강제 timeOfDay override (테스트용). 일반적으로 prop 안 줌. */
  forceTimeOfDay?: TimeOfDay
  /** 하단 yellow-marker 카피. 기본 "오늘도 건강한 한 끼를 정성스럽게." */
  subCopy?: { lead: string; mark: string }
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

const TIME_LABEL: Record<TimeOfDay, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'late night',
}

/** 시간대별 헤딩 — 한 줄 구성 (2026-05-22: 3줄 → 1줄). */
const HEADING_BY_TIME: Record<TimeOfDay, string> = {
  morning: '좋은 아침이에요,',
  afternoon: '좋은 오후예요,',
  evening: '좋은 저녁이에요,',
  night: '좋은 밤이에요,',
}

function computeTimeOfDay(): TimeOfDay {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

export default function GreetingSection({
  userName,
  familyCount,
  forceTimeOfDay,
  subCopy = { lead: '오늘도 건강한 한 끼를 ', mark: '정성스럽게.' },
}: GreetingSectionProps) {
  const tod = forceTimeOfDay ?? computeTimeOfDay()
  const headingText = HEADING_BY_TIME[tod]
  const kickerLabel = `Hello, ${userName} · ${TIME_LABEL[tod]}`

  return (
    <section
      style={{
        padding: '24px 20px 28px',
        position: 'relative',
      }}
    >
      {/* kicker: accent dot + greeting label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: V3.accent,
            flexShrink: 0,
          }}
        />
        <Mono color="ink" size="xs" weight={500}>
          {kickerLabel}
        </Mono>
      </div>

      {/* 1-line hero heading — 38px sans 900. 사용자 요청: 한 줄로 들어오게.
          54px → 38px 로 줄여서 우상단 signature 와 줄바뀜 없이 함께 들어감.
          가장 긴 카피 "좋은 저녁이에요," (8자) 기준 358px wide phone 에서도 OK. */}
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.black,
          fontSize: 38,
          lineHeight: 1.05,
          letterSpacing: V3LetterSpacing.hero,
          color: V3.ink,
          wordBreak: 'keep-all',
          whiteSpace: 'nowrap',
        }}
      >
        {headingText}
      </h1>

      {/* 우상단 signature — Pretendard italic 600 (no Serif) */}
      <div
        style={{
          position: 'absolute',
          right: 20,
          top: 24,
        }}
      >
        <Signature
          name={userName}
          metaKicker={`FAMILY · ${familyCount}`}
          align="right"
          size={22}
        />
      </div>

      {/* 하단 카피 + yellow marker */}
      <div style={{ marginTop: 18 }}>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            color: V3.inkSoft,
            lineHeight: 1.5,
          }}
        >
          {subCopy.lead}
          <Mark tone="yellow">{subCopy.mark}</Mark>
        </span>
      </div>
    </section>
  )
}
