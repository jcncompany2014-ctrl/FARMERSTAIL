/**
 * GreetingSection — v3 홈 화면 상단 Hero greeting.
 *
 * 핸드오프 패턴:
 *   - 좌측: accent dot + Mono kicker "Hello · {timeOfDay}"
 *           (사용자 요청 2026-05-25: 사용자 이름 kicker 에서 제거)
 *   - 우측: Signature 블록 ({name}님 + FAMILY · N + 4px ink bar)
 *   - 하단: 14px sub 카피 + yellow Mark 강조
 *
 * timeOfDay 는 KST 시간 기준 자동 분기:
 *   05-11 → morning / 12-16 → afternoon / 17-20 → evening / 21-04 → night
 *
 * # 멘트 다양화 (사용자 요청 2026-05-25)
 *
 * 같은 시간대에서도 5가지 멘트 중 day-of-year 기반 deterministic rotation.
 * 새로고침 시 안 바뀜 (혼란 방지). 다음날 자동 변경.
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
  /** 멘트 variant override (테스트용). 0-based index. */
  forceVariant?: number
  /** 하단 yellow-marker 카피. 기본 "오늘도 건강한 한 끼를 정성스럽게." */
  subCopy?: { lead: string; mark: string }
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

const TIME_LABEL: Record<TimeOfDay, string> = {
  morning: 'good morning',
  afternoon: 'good afternoon',
  evening: 'good evening',
  night: 'good night',
}

/**
 * 시간대별 헤딩 5종 — day-of-year mod 5 로 rotation.
 * 사용자 요청 2026-05-25: 항상 같은 멘트 X.
 */
const HEADINGS_BY_TIME: Record<TimeOfDay, string[]> = {
  morning: [
    '좋은 아침이에요,',
    '상쾌한 아침이에요,',
    '활기찬 시작이에요,',
    '오늘도 좋은 하루,',
    '잘 일어나셨어요,',
  ],
  afternoon: [
    '좋은 오후예요,',
    '점심은 챙기셨죠,',
    '따뜻한 오후예요,',
    '오후도 활기차게,',
    '오늘은 어떠세요,',
  ],
  evening: [
    '좋은 저녁이에요,',
    '오늘도 수고하셨어요,',
    '따뜻한 저녁이에요,',
    '하루 잘 마무리해요,',
    '저녁은 편안하게,',
  ],
  night: [
    '좋은 밤이에요,',
    '늦은 시간 고생 많아요,',
    '푹 쉬는 밤 되세요,',
    '오늘도 함께해 주셔서 고마워요,',
    '편안한 밤 보내요,',
  ],
}

function computeTimeOfDay(): TimeOfDay {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

/**
 * day-of-year (1-366) — KST 기준 매일 다른 값.
 * 같은 날엔 새로고침해도 같은 멘트, 다음 날엔 새 멘트.
 */
function dayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}

/**
 * 한국어 이름에 "님" 자동 부착. 이미 끝이 "님" 이면 중복 X.
 * 영문 이름은 그대로 (대문자 시작 + 영문자 only 휴리스틱).
 */
function withHonorific(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ''
  if (trimmed.endsWith('님')) return trimmed
  if (/^[A-Za-z][A-Za-z\s'-]*$/.test(trimmed)) return trimmed
  return `${trimmed}님`
}

export default function GreetingSection({
  userName,
  familyCount,
  forceTimeOfDay,
  forceVariant,
  subCopy = { lead: '오늘도 건강한 한 끼를 ', mark: '정성스럽게.' },
}: GreetingSectionProps) {
  const tod = forceTimeOfDay ?? computeTimeOfDay()
  const variants = HEADINGS_BY_TIME[tod]
  const idx = forceVariant ?? dayOfYear() % variants.length
  const headingText = variants[idx] ?? variants[0]!
  const kickerLabel = `Hello · ${TIME_LABEL[tod]}`

  return (
    <section
      style={{
        padding: '24px 20px 28px',
        position: 'relative',
      }}
    >
      {/* kicker: accent dot + greeting label (no name) */}
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

      {/* hero heading — R23: 38 → 24 (사용자 보고: 글씨 너무 큼).
          line-height 1.25 — 한 줄이지만 다음 sub copy 와 호흡. */}
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontWeight: V3FontWeight.black,
          fontSize: 24,
          lineHeight: 1.25,
          letterSpacing: V3LetterSpacing.heading,
          color: V3.ink,
          wordBreak: 'keep-all',
          whiteSpace: 'nowrap',
        }}
      >
        {headingText}
      </h1>

      {/* 우상단 signature — R23: size 22 → 15, barHeight 60 → 28
          (사용자 보고: 우상단 글씨 너무 큼) */}
      <div
        style={{
          position: 'absolute',
          right: 20,
          top: 24,
        }}
      >
        <Signature
          name={withHonorific(userName)}
          metaKicker={`FAMILY · ${familyCount}`}
          align="right"
          size={15}
          barHeight={28}
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
