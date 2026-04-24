/**
 * Lightweight declarative motion wrappers.
 *
 * Framer Motion 같은 런타임 애니메이션 엔진은 번들을 60KB+ 불려놓고 우리는
 * stagger fade/rise 정도만 쓰기 때문에 CSS keyframe + 토큰으로 충분하다.
 * 이 컴포넌트들은 props 로 preset 을 받아 globals.css 의 `--animate-*` 유틸을
 * 입히는 얇은 래퍼.
 */
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { motion, motionStagger, type MotionPreset } from '@/lib/motion'

type BaseProps = HTMLAttributes<HTMLDivElement> & {
  as?: 'div' | 'section' | 'article' | 'li' | 'ul' | 'span'
  preset?: MotionPreset
  delay?: number
  children: ReactNode
}

export function MotionShow({
  as,
  preset = 'fadeInUp',
  delay,
  className,
  style,
  children,
  ...rest
}: BaseProps) {
  const Tag = (as ?? 'div') as 'div'
  const merged: CSSProperties | undefined =
    delay !== undefined
      ? { ...(style ?? {}), animationDelay: `${Math.max(0, delay)}ms` }
      : style
  return (
    <Tag
      className={`${motion[preset]}${className ? ` ${className}` : ''}`}
      style={merged}
      {...rest}
    >
      {children}
    </Tag>
  )
}

type StaggerProps = {
  preset?: MotionPreset
  stepMs?: number
  as?: 'div' | 'ul' | 'ol'
  className?: string
  children: ReactNode[]
}

/**
 * Stagger children — 자식 배열을 fade-in-up preset 으로 순차 진입. 자식이
 * 1개면 stagger 효과 없이 바로 보여주기 위해 index 0 은 delay 0.
 */
export function Stagger({
  preset = 'fadeInUp',
  stepMs = 60,
  as,
  className,
  children,
}: StaggerProps) {
  const Tag = (as ?? 'div') as 'div'
  return (
    <Tag className={className}>
      {children.map((child, idx) => (
        <div
          key={idx}
          className={motion[preset]}
          style={motionStagger(idx, stepMs)}
        >
          {child}
        </div>
      ))}
    </Tag>
  )
}
