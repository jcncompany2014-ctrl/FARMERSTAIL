/**
 * Mono — v3 의 모든 ALL CAPS 메타데이터 / kicker / ticker / 카운터.
 *
 * IBM Plex Mono (fallback JetBrains Mono) + uppercase + letter-spacing 0.16em.
 * 색상은 기본 inkMute, 필요 시 prop 으로 override.
 *
 * @example
 *   <Mono>Hello, Seongmin · evening</Mono>
 *   <Mono color="accent" weight={700}>D-1</Mono>
 *   <Mono size="xxs">FAMILY · 3</Mono>
 */

import { V3, V3FontSize, type V3FontSizeKey } from '@/lib/design/tokens'

interface MonoProps {
  children: React.ReactNode
  /** size 별칭 — xxs(9) / xs(10.5) / sm(12). 그 외 size 는 디자인 합의 필요. */
  size?: Extract<V3FontSizeKey, 'xxs' | 'xs' | 'sm'>
  /** color — token name 또는 css 값 직접. 기본 inkMute. */
  color?: keyof typeof V3 | (string & {})
  /** font-weight — 400(default) / 500(medium) / 600(semibold) / 700(bold). */
  weight?: 400 | 500 | 600 | 700
  /** letter-spacing override. 기본 0.04em (R-clean: 한글에서 과한 자간 제거). */
  letterSpacing?: string | number
  /** word-spacing override. 기본 -0.12em — letter-spacing 이 공백에도 더해져
   *  단어 사이가 과하게 벌어지는 걸 상쇄(특히 한글 띄어쓰기). */
  wordSpacing?: string | number
  /** uppercase 끄기. 기본 true. */
  upper?: boolean
  /** 인라인 / 블록. 기본 inline (span). */
  as?: 'span' | 'div'
  className?: string
  style?: React.CSSProperties
}

export default function Mono({
  children,
  size = 'xs',
  color = 'inkMute',
  weight = 500,
  letterSpacing = '0.04em',
  wordSpacing = '-0.12em',
  upper = true,
  as: Tag = 'span',
  className,
  style,
}: MonoProps) {
  const resolvedColor =
    color in V3 ? V3[color as keyof typeof V3] : (color as string)
  // ★한글 머리말(2026-09-22 시니어 사용성 2단계): 영어 kicker 를 한글로 바꾸면서
  //   모노 폰트·uppercase·넓은 자간은 한글에서 "이상하게 벌어진 글자"가 된다.
  //   문자열 자식에 한글이 있으면 산세리프 굵게, 자간 0 으로 — 호출처는 그대로.
  const text = Array.isArray(children) ? children.join('') : typeof children === 'string' ? children : ''
  const korean = /[가-힣]/.test(text)
  return (
    <Tag
      className={className}
      style={{
        fontFamily: korean
          ? 'var(--font-sans), Pretendard, sans-serif'
          : "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
        fontSize: V3FontSize[size],
        fontWeight: korean ? Math.max(weight, 600) : weight,
        letterSpacing: korean ? '-0.01em' : letterSpacing,
        wordSpacing: korean ? 0 : wordSpacing,
        textTransform: upper && !korean ? 'uppercase' : 'none',
        color: resolvedColor,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}
