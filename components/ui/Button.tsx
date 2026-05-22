/**
 * Farmer's Tail — Button 컴포넌트.
 *
 * # 왜 만들었나
 *
 * 앱 전체에 제각기 튜닝된 버튼이 30곳 넘게 있었다
 * (bg-terracotta text-white + { rounded-xl | rounded-full | rounded-lg } +
 *  { font-black | font-bold | font-semibold } + { py-2.5 | py-3 | py-3.5 }).
 * 한 번만 브랜드 가이드 수정이 생기면 전수 grep 노동이라 중앙화한다. 복구는
 * 호출처가 적은 곳부터 점진적 마이그레이션 — 이 컴포넌트만 먼저 존재해도 OK.
 *
 * # 디자인 원칙
 *
 * - Tailwind v4 `@theme inline` 토큰 (bg-terracotta, text-ink, bg-moss 등) 만 사용.
 *   하드코딩된 hex 금지 (globals.css의 "never hard-code hex" 규칙 준수).
 * - 이탤릭/세리프 금지 (globals.css가 전역 italic을 !important로 해제).
 * - "Retro offset" 보더+섀도 스타일은 PWA 오프라인 페이지 한 곳만 쓰고 있어서
 *   별도 variant("offset")로 보존 — 브랜드 device(b)라서 지우지 않음.
 *
 * # API
 *
 *   <Button onClick={...}>담기</Button>                // primary / md / 기본
 *   <Button variant="secondary" size="lg">취소</Button>
 *   <Button variant="ghost" size="sm" leftIcon={<CartIcon/>}>담기</Button>
 *   <Button loading>결제 진행 중</Button>             // disabled + spinner
 *   <Button asChild><Link href="/products">보러가기</Link></Button>
 *
 * `asChild` 패턴: Radix UI의 Slot 아이디어. 이미 <Link>, <a>, <button type="submit">
 * 이 필요한 경우 className/disabled만 주입하고 element 자체는 자식이 그대로 렌더.
 * 이 덕에 Next Link와의 충돌 없이 버튼 스타일을 재사용할 수 있다.
 */
'use client'

import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/ui/cn'

// ──────────────────────────────────────────────────────────────────────────
// Variants
// ──────────────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'primary' // 주 CTA — terracotta solid. 페이지당 1~2개 이하로 유지.
  | 'secondary' // ink solid — "보조 CTA but 진중한 톤". 대시보드, 어드민.
  | 'outline' // 테두리 + 투명 배경. 네거티브 공간용.
  | 'ghost' // 테두리 없는 보조 — 취소/닫기/부차 액션.
  | 'danger' // 삭제/환불 확정 — sale red. 되돌리기 어려운 액션 전용.
  | 'link' // 인라인 하이퍼링크 스타일. padding 없음.
  | 'offset' // 브랜드 device(b): retro shadow + border. 포스터 무드 페이지용.

export type ButtonSize = 'sm' | 'md' | 'lg'

// variant별 색/hover만 정의. 크기는 size에서. 모양(pill vs rect)은 shape에서.
const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-terracotta text-white hover:bg-[#8A3822] active:scale-[0.98] ' +
    'disabled:bg-terracotta/60 disabled:cursor-not-allowed',
  secondary:
    'bg-ink text-white hover:bg-[#2A2118] active:scale-[0.98] ' +
    'disabled:bg-ink/60 disabled:cursor-not-allowed',
  outline:
    'bg-transparent text-text border border-rule-2 hover:bg-bg-2 ' +
    'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-text hover:bg-bg-2 active:scale-[0.98] ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-sale text-white hover:brightness-95 active:scale-[0.98] ' +
    'disabled:bg-sale/60 disabled:cursor-not-allowed',
  link:
    'bg-transparent text-terracotta underline-offset-4 hover:underline ' +
    'p-0 disabled:opacity-50 disabled:cursor-not-allowed',
  offset:
    'bg-terracotta text-white border-2 border-[#2A2118] ' +
    'shadow-[3px_3px_0_#2A2118] hover:-translate-y-0.5 ' +
    'active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ' +
    'transition-all disabled:opacity-60 disabled:cursor-not-allowed',
}

// size별 padding/font-size. link는 padding 자기 클래스에서 덮어씀.
const sizeClass: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-[15px]',
}

// shape: rect(기본), pill(rounded-full), square(rounded-lg 정도의 작은 radius).
type Shape = 'rect' | 'pill' | 'square'
const shapeClass: Record<Shape, string> = {
  rect: 'rounded-xl',
  pill: 'rounded-full',
  square: 'rounded-lg',
}

const baseClass =
  // 폰트: 전역 sans, weight는 bold가 기본 — font-black은 primary CTA 강조용으로만.
  'inline-flex items-center justify-center gap-1.5 font-bold ' +
  // 포커스 아웃라인: Safari/iOS에서 보더가 날아가지 않도록 ring.
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ' +
  // 터치 — Tailwind의 transition은 shadow까지 기본 안 타므로 all로.
  'transition select-none'

// ──────────────────────────────────────────────────────────────────────────
// Spinner (loading state)
// ──────────────────────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Button
// ──────────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  shape?: Shape
  /** 로딩 중이면 spinner + disabled. aria-busy 자동. */
  loading?: boolean
  /** 자식 앞에 아이콘. 이미 sized되어 있다면 size prop과 비례해서 선택. */
  leftIcon?: ReactNode
  /** 자식 뒤에 아이콘. */
  rightIcon?: ReactNode
  /**
   * 전체 너비. mobile 하단 CTA, modal 버튼 row에 흔함.
   * `w-full`을 className에 직접 넣는 것보다 의도가 또렷해서 추가.
   */
  fullWidth?: boolean
  /**
   * true면 자식 element에 스타일만 주입하고 렌더는 자식이 함.
   * Next Link, <a>, form submit의 native button을 유지하고 싶을 때.
   */
  asChild?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      shape = 'rect',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      asChild = false,
      disabled,
      className,
      children,
      type,
      ...rest
    },
    ref
  ) {
    const classes = cn(
      baseClass,
      variantClass[variant],
      // link variant는 size의 padding을 무시해야 자연스러움.
      variant === 'link' ? 'text-sm' : sizeClass[size],
      // link는 radius 의미 없음.
      variant === 'link' ? '' : shapeClass[shape],
      fullWidth && 'w-full',
      loading && 'cursor-wait',
      className
    )

    const spinnerSize =
      size === 'lg' ? 'w-5 h-5' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

    const content = (
      <>
        {loading ? <Spinner className={spinnerSize} /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </>
    )

    if (asChild) {
      // 자식은 정확히 하나의 element여야 함. 다중 child면 개발자 오류.
      const only = Children.only(children)
      if (!isValidElement<{ className?: string }>(only)) {
        // runtime fallback — dev 경고만 하고 일반 button으로 렌더.
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Button] asChild requires a single valid element child')
        }
      } else {
        return cloneElement(only as ReactElement<{ className?: string }>, {
          className: cn(classes, only.props.className),
        })
      }
    }

    return (
      <button
        ref={ref}
        // type 기본값을 "button"으로 — form 안에서 실수로 submit 안 되게.
        // 실제 submit이 필요하면 호출자가 명시적으로 type="submit" 지정.
        type={type ?? 'button'}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={classes}
        {...rest}
      >
        {content}
      </button>
    )
  }
)
