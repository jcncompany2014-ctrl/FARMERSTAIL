/**
 * V3Section — v3 의 표준 섹션 래퍼.
 *
 * AppChrome 안의 모든 page-level section 이 좌우 padding 20px / vertical
 * spacing 일관성을 유지하도록 강제. kicker (Mono) + heading (sans bold) +
 * children 구조를 한 곳에서 책임 — fontSize / lineHeight / letter-spacing
 * 가 흔들리지 않음.
 *
 * @example
 *   <V3Section
 *     kicker="HELLO · 안녕 pur"
 *     heading="오늘은 뭐 먹을까?"
 *     headingSize="hero"
 *   >
 *     {children}
 *   </V3Section>
 *
 * @example heading + 우측 액션
 *   <V3Section heading="내 아이들" headingMeta="(03)" action={<Link>전체보기</Link>}>
 *     {dogCards}
 *   </V3Section>
 */

import { V3, V3FontSize, V3FontWeight, V3LetterSpacing } from '@/lib/design/tokens'
import Mono from './Mono'

type HeadingSize = 'hero' | 'h1' | 'h2' | 'h3'

interface V3SectionProps {
  /** Mono kicker (위쪽 ALL CAPS). 옵션. */
  kicker?: React.ReactNode
  /** kicker color override. 기본 ink (헤더 영역) — accent 로 강조도 가능. */
  kickerColor?: keyof typeof V3 | (string & {})
  /** heading 본문. 옵션 (kicker 만 쓰는 섹션도 가능). */
  heading?: React.ReactNode
  /** heading 우측 작은 메타 — Mono 로 자동 렌더. 예: "(03)" / "최근 2" */
  headingMeta?: React.ReactNode
  /** heading 우측 액션 영역 — "전체보기 →" 같은 링크. */
  action?: React.ReactNode
  /** heading 사이즈 — hero(54) / h1(32) / h2(22) / h3(16). 기본 h2. */
  headingSize?: HeadingSize
  /** 좌우 padding — 기본 20px (v3 표준). 0 또는 다른 값 가능. */
  px?: number
  /** 하단 padding — 기본 28px. 0 가능. */
  pb?: number
  /** 상단 padding — 기본 0. Hero section 에서만 더 사용. */
  pt?: number
  /** 자식 컨텐츠 위 spacing — heading 과 children 사이. 기본 14. */
  contentGap?: number
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  id?: string
}

const HEADING_FONT_SIZE: Record<HeadingSize, number> = {
  hero: V3FontSize.xxl, // 54
  h1: V3FontSize.xl, // 32
  h2: V3FontSize.lg, // 22
  h3: V3FontSize.md, // 16
}

const HEADING_LINE_HEIGHT: Record<HeadingSize, number> = {
  hero: 0.95,
  h1: 1.05,
  h2: 1.15,
  h3: 1.3,
}

const HEADING_LETTER_SPACING: Record<HeadingSize, string> = {
  hero: V3LetterSpacing.hero, // -0.025em
  h1: V3LetterSpacing.heading, // -0.02em
  h2: V3LetterSpacing.heading,
  h3: V3LetterSpacing.body, // -0.015em
}

export default function V3Section({
  kicker,
  kickerColor = 'accent',
  heading,
  headingMeta,
  action,
  headingSize = 'h2',
  px = 20,
  pb = 28,
  pt = 0,
  contentGap = 14,
  children,
  className,
  style,
  id,
}: V3SectionProps) {
  const HeadingTag = (
    headingSize === 'hero' || headingSize === 'h1' ? 'h1' :
    headingSize === 'h2' ? 'h2' : 'h3'
  ) as 'h1' | 'h2' | 'h3'
  const hasHeader = Boolean(kicker || heading)

  return (
    <section
      id={id}
      className={className}
      style={{
        paddingLeft: px,
        paddingRight: px,
        paddingTop: pt,
        paddingBottom: pb,
        ...style,
      }}
    >
      {hasHeader && (
        <div
          className="flex items-end justify-between"
          style={{ marginBottom: children ? contentGap : 0 }}
        >
          <div className="min-w-0 ft-keep-all">
            {kicker && (
              <Mono color={kickerColor} size="xs" weight={600} letterSpacing="0.16em">
                {kicker}
              </Mono>
            )}
            {heading && (
              <HeadingTag
                style={{
                  margin: 0,
                  marginTop: kicker ? 10 : 0,
                  fontFamily: 'var(--font-sans)',
                  fontWeight:
                    headingSize === 'hero'
                      ? V3FontWeight.black
                      : V3FontWeight.black,
                  fontSize: HEADING_FONT_SIZE[headingSize],
                  lineHeight: HEADING_LINE_HEIGHT[headingSize],
                  letterSpacing: HEADING_LETTER_SPACING[headingSize],
                  color: V3.ink,
                  textWrap: 'balance',
                  wordBreak: 'keep-all',
                }}
              >
                {heading}
                {headingMeta && (
                  <Mono
                    color="inkMute"
                    size="sm"
                    upper={false}
                    letterSpacing="0"
                    style={{
                      marginLeft: 8,
                      verticalAlign: 'middle',
                      fontWeight: 500,
                    }}
                  >
                    {headingMeta}
                  </Mono>
                )}
              </HeadingTag>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
