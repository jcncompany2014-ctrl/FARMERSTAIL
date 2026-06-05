/**
 * Signature — v3 의 시그니처 블록 (이름 + meta + ink bar).
 *
 * 핸드오프의 우상단 손글씨 톤 블록 — Greeting / 강아지 detail 우상단에 사용.
 * 사용자 요청에 따라 **Instrument Serif italic 폐기** → Pretendard italic style
 * 로 대체. 색상 + italic 만으로 시그니처 톤 유지.
 *
 * @example
 *   <Signature
 *     name="안성민"
 *     metaKicker="FAMILY · 3"
 *   />
 *
 * @example FAMILY 표시 + 강아지 수
 *   <Signature name="pur" metaKicker="DOG №01" align="left" />
 */

import { V3, V3FontSize, V3FontWeight } from '@/lib/design/tokens'
import Mono from './Mono'

interface SignatureProps {
  /** 이름 (italic 으로 렌더). */
  name: string
  /** 작은 메타 라벨 — Mono kicker 로 자동 렌더. 옵션. */
  metaKicker?: string
  /** 정렬 — 기본 right. Greeting 우상단 / detail 우상단 모두 right. */
  align?: 'left' | 'right'
  /** ink bar 높이 — 기본 60px. 0 이면 bar 숨김. */
  barHeight?: number
  /** name size — 기본 22(md). 강아지 detail hero 는 28~32 가능. */
  size?: number
  /**
   * name 최대 폭(px). 지정 시 초과분은 ellipsis 처리.
   * 긴 영문 이름이 옆 요소(Greeting heading 등)와 겹치는 것을 방지.
   */
  nameMaxWidth?: number
  className?: string
  style?: React.CSSProperties
}

export default function Signature({
  name,
  metaKicker,
  align = 'right',
  barHeight = 60,
  size = V3FontSize.lg, // 22px
  nameMaxWidth,
  className,
  style,
}: SignatureProps) {
  const isRight = align === 'right'
  return (
    <div
      className={className}
      style={{
        textAlign: isRight ? 'right' : 'left',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: isRight ? 'flex-end' : 'flex-start',
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontStyle: 'italic',
          fontWeight: V3FontWeight.semibold,
          fontSize: size,
          color: V3.ink,
          lineHeight: 1,
          letterSpacing: '-0.015em',
          ...(nameMaxWidth
            ? {
                maxWidth: nameMaxWidth,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }
            : null),
        }}
      >
        {name}
      </div>
      {metaKicker && (
        <Mono color="inkMute" size="xxs" style={{ marginTop: 6 }}>
          {metaKicker}
        </Mono>
      )}
      {barHeight > 0 && (
        <div
          style={{
            marginTop: 14,
            height: barHeight,
            width: 4,
            background: V3.ink,
          }}
          aria-hidden
        />
      )}
    </div>
  )
}
