/**
 * Farmer's Tail — Form primitives.
 *
 * react-hook-form + zod 기반 폼의 공통 인풋/라벨/에러 컴포넌트.
 *
 * # 설계 원칙
 *
 * 1) **rhf의 register() 패턴을 정면으로 수용**한다.
 *    - `register()` 반환값은 `{ name, onBlur, onChange, ref, ... }`.
 *    - Input은 이 객체를 spread 받는 게 자연스러우므로 별도 wrapper 없이 쓰게.
 *    - `Controller`가 필요한 자리(Checkbox 배열, Radio 등)는 Controller wrap 후
 *      render prop 안에서 이 primitives를 쓰면 된다.
 *
 * 2) **id/aria 배선을 primitives가 알아서 한다.**
 *    - FieldRow가 `useId`로 id를 만들고 Label/Control/Error/Hint를 Context로
 *      연결. `htmlFor`, `aria-invalid`, `aria-describedby`를 손으로 쓸 일이 없게.
 *
 * 3) **에러 상태는 "있다/없다" 로만 분기**.
 *    - prop `error` 가 truthy면 빨간 톤 (`--sale`), focus-ring도 --sale 로.
 *    - 성공 상태는 안 그린다 (과잉 피드백 지양, 브랜드 톤).
 *
 * 4) **브랜드 토큰만 쓴다.** (Tailwind v4 @theme inline 연결)
 *    - 테두리 `rule-2`, 본문 `text`, 보조 `muted`, 포커스 `terracotta`, 에러 `sale`.
 *    - 인라인 hex 금지 — globals.css 토큰 단일 소스.
 *
 * 5) **한글 본문 polish**.
 *    - Label 11px bold (signup/login에서 쓰던 톤과 동일).
 *    - Placeholder는 --muted로 눈에 덜 띄게.
 *    - Hint는 에러와 구분되는 --muted 12px.
 *    - break-keep로 한글 줄바꿈 정돈.
 *
 * # 사용
 *
 * ```tsx
 * const schema = z.object({
 *   email: z.string().email('이메일 형식이 올바르지 않아요'),
 *   password: z.string().min(8, '8자 이상 입력해 주세요'),
 * })
 *
 * const { register, handleSubmit, formState: { errors, isSubmitting } } =
 *   useForm({ resolver: zodResolver(schema), mode: 'onBlur' })
 *
 * <Form onSubmit={handleSubmit(onSubmit)}>
 *   <FieldRow label="이메일" error={errors.email?.message}>
 *     <Input type="email" autoComplete="email" {...register('email')} />
 *   </FieldRow>
 *
 *   <FieldRow label="비밀번호" hint="8자 이상, 영문·숫자 조합" error={errors.password?.message}>
 *     <PasswordInput autoComplete="current-password" {...register('password')} />
 *   </FieldRow>
 *
 *   <Button type="submit" loading={isSubmitting} fullWidth>로그인</Button>
 * </Form>
 * ```
 */
'use client'

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type FormHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/ui/cn'

// ──────────────────────────────────────────────────────────────────────────
// FieldRow context — Label / Control / Error / Hint 간 id·aria 배선.
// ──────────────────────────────────────────────────────────────────────────

interface FieldContext {
  /** 컨트롤 id (input, select, textarea가 소비) */
  id: string
  /** hint id — 있을 때만 ariaDescribedBy에 포함 */
  hintId?: string
  /** error id — 있을 때만 ariaDescribedBy에 포함 */
  errorId?: string
  /** 에러 상태 (aria-invalid 및 스타일) */
  invalid: boolean
  /** required 미러 (label 별표, aria-required) */
  required?: boolean
  /** disabled 미러 */
  disabled?: boolean
}

const FieldCtx = createContext<FieldContext | null>(null)

function useField() {
  return useContext(FieldCtx)
}

/**
 * aria-describedby 문자열 합치기. space-delimited.
 */
function joinIds(...ids: Array<string | undefined | false>): string | undefined {
  const list = ids.filter(Boolean) as string[]
  return list.length > 0 ? list.join(' ') : undefined
}

// ──────────────────────────────────────────────────────────────────────────
// <Form> — novalidate 기본, 제출 Enter 처리 등은 rhf의 handleSubmit에 위임.
// ──────────────────────────────────────────────────────────────────────────

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  /** 기본 space-y-4. 조밀한 폼에선 `space-y-3` 등으로 override. */
  spacing?: 'sm' | 'md' | 'lg'
}

const spacingMap: Record<NonNullable<FormProps['spacing']>, string> = {
  sm: 'space-y-3',
  md: 'space-y-4',
  lg: 'space-y-5',
}

export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { className, spacing = 'md', children, ...rest },
  ref
) {
  return (
    <form
      ref={ref}
      // 브라우저 기본 HTML5 validation 끔 — zod에 위임.
      noValidate
      className={cn(spacingMap[spacing], className)}
      {...rest}
    >
      {children}
    </form>
  )
})

// ──────────────────────────────────────────────────────────────────────────
// FieldRow — 한 필드 단위 (label + control + hint + error).
// ──────────────────────────────────────────────────────────────────────────

export interface FieldRowProps {
  label?: ReactNode
  /** label 숨기고 스크린리더에만 노출 (visually hidden) */
  hideLabel?: boolean
  /** 입력 전 안내 — 에러가 있으면 에러 메시지가 우선 노출. */
  hint?: ReactNode
  /** error 메시지 (rhf: `errors.fieldName?.message`) */
  error?: ReactNode
  /** label 별표 + aria-required */
  required?: boolean
  /** 필드 전체 disable 미러 (label / hint opacity 조정) */
  disabled?: boolean
  /** 라벨 오른쪽에 작은 텍스트 (ex: "선택", "15/500") */
  labelMeta?: ReactNode
  /** id override — 기본은 useId() */
  id?: string
  className?: string
  children: ReactNode
}

export function FieldRow({
  label,
  hideLabel = false,
  hint,
  error,
  required = false,
  disabled = false,
  labelMeta,
  id,
  className,
  children,
}: FieldRowProps) {
  const autoId = useId()
  const controlId = id ?? `field-${autoId}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined

  const invalid = Boolean(error)

  return (
    <FieldCtx.Provider
      value={{
        id: controlId,
        hintId,
        errorId,
        invalid,
        required,
        disabled,
      }}
    >
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <div className="flex items-baseline justify-between gap-2">
            <FieldLabel hidden={hideLabel}>{label}</FieldLabel>
            {labelMeta && (
              <span className="text-[11px] text-muted tabular-nums">
                {labelMeta}
              </span>
            )}
          </div>
        )}

        {children}

        {/* 에러가 우선. 에러가 없을 때만 hint 노출. */}
        {error ? (
          <FieldError id={errorId!}>{error}</FieldError>
        ) : hint ? (
          <FieldHint id={hintId!}>{hint}</FieldHint>
        ) : null}
      </div>
    </FieldCtx.Provider>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// FieldLabel / FieldHint / FieldError — 단독 사용도 가능.
// ──────────────────────────────────────────────────────────────────────────

export function FieldLabel({
  children,
  hidden = false,
  className,
  htmlFor: htmlForProp,
}: {
  children: ReactNode
  hidden?: boolean
  className?: string
  htmlFor?: string
}) {
  const ctx = useField()
  const htmlFor = htmlForProp ?? ctx?.id
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'text-[11px] font-bold text-text break-keep',
        ctx?.disabled && 'opacity-60',
        hidden && 'sr-only',
        className
      )}
    >
      {children}
      {ctx?.required && (
        <span aria-hidden className="ml-1 text-sale">
          *
        </span>
      )}
    </label>
  )
}

export function FieldHint({
  children,
  id,
  className,
}: {
  children: ReactNode
  id?: string
  className?: string
}) {
  const ctx = useField()
  return (
    <p
      id={id ?? ctx?.hintId}
      className={cn(
        'text-[12px] text-muted leading-relaxed break-keep',
        className
      )}
    >
      {children}
    </p>
  )
}

/**
 * FieldError — aria-live="polite"로 스크린리더 알림. rhf가 submit/blur 시점에
 * errors.* 를 채우기 때문에 사용자가 이미 다른 곳으로 포커스를 옮겼을 수
 * 있어서 live 필요.
 */
export function FieldError({
  children,
  id,
  className,
}: {
  children: ReactNode
  id?: string
  className?: string
}) {
  const ctx = useField()
  if (!children) return null
  return (
    <p
      id={id ?? ctx?.errorId}
      role="alert"
      aria-live="polite"
      className={cn(
        'text-[12px] font-bold text-sale break-keep',
        className
      )}
    >
      {children}
    </p>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// 공통 인풋 스타일. 에러 상태는 클래스 토글로.
// ──────────────────────────────────────────────────────────────────────────

/**
 * 모든 컨트롤이 공유하는 박스 스타일. 컨트롤 종류별로 rounded만 다르게 쓰지
 * 않고 통일 (rounded-lg, 14px body).
 */
const controlBase = [
  'w-full px-3.5 py-3 rounded-lg text-[14px] text-text',
  // 배경: 종이 톤 위에 조금 밝은 흰지 — #FDFDFD 을 bg-bg-2 로 대체하면
  // 대비가 약해서 전용 near-white 토큰이 필요. 현재는 bg-[#FDFDFD]로 고정.
  'bg-[#FDFDFD]',
  // 테두리를 box-shadow inset으로 구현해서 layout shift 없이 컬러만 바꾼다.
  'shadow-[inset_0_0_0_1px_var(--rule-2)]',
  'placeholder:text-muted/80',
  'transition-[box-shadow,background-color] duration-150',
  'outline-none',
  // hover: 살짝 짙은 테두리
  'hover:shadow-[inset_0_0_0_1px_var(--muted)]',
  // focus-visible: 테라코타 링 + 2px 두께 느낌
  'focus-visible:shadow-[inset_0_0_0_2px_var(--terracotta)]',
  // disabled: 종이 위에 스며들어 있는 느낌
  'disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-bg-2',
] as const

const controlInvalid = [
  'shadow-[inset_0_0_0_1px_var(--sale)]',
  'hover:shadow-[inset_0_0_0_1px_var(--sale)]',
  'focus-visible:shadow-[inset_0_0_0_2px_var(--sale)]',
] as const

// ──────────────────────────────────────────────────────────────────────────
// Input
// ──────────────────────────────────────────────────────────────────────────

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 에러 상태를 직접 강제 (보통은 FieldRow에서 자동 inherit) */
  invalid?: boolean
  /** left에 붙일 장식 (단위, 아이콘, 국가코드 등) */
  leftAddon?: ReactNode
  /** right에 붙일 장식 */
  rightAddon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    invalid: invalidProp,
    leftAddon,
    rightAddon,
    id: idProp,
    'aria-describedby': ariaDescribedByProp,
    required: requiredProp,
    disabled: disabledProp,
    type = 'text',
    ...rest
  },
  ref
) {
  const ctx = useField()
  const invalid = invalidProp ?? ctx?.invalid ?? false
  const id = idProp ?? ctx?.id
  const describedBy = joinIds(ariaDescribedByProp, ctx?.hintId, ctx?.errorId)
  const required = requiredProp ?? ctx?.required
  const disabled = disabledProp ?? ctx?.disabled

  // addon이 있으면 wrapper 필요.
  if (leftAddon || rightAddon) {
    return (
      <div
        className={cn(
          'relative flex items-stretch',
          disabled && 'opacity-60'
        )}
      >
        {leftAddon && (
          <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted text-[13px]">
            {leftAddon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          required={required}
          disabled={disabled}
          className={cn(
            controlBase,
            invalid && controlInvalid,
            // `leftAddon`은 ReactNode (number 가능)라 `&&` 결과가 number일 수
            // 있다. 클래스용으론 boolean 판정만 필요하므로 Boolean() 변환.
            Boolean(leftAddon) && 'pl-9',
            Boolean(rightAddon) && 'pr-10',
            className
          )}
          {...rest}
        />
        {rightAddon && (
          <span className="absolute inset-y-0 right-3 flex items-center text-muted text-[13px]">
            {rightAddon}
          </span>
        )}
      </div>
    )
  }

  return (
    <input
      ref={ref}
      id={id}
      type={type}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      required={required}
      disabled={disabled}
      className={cn(controlBase, invalid && controlInvalid, className)}
      {...rest}
    />
  )
})

// ──────────────────────────────────────────────────────────────────────────
// PasswordInput — Eye toggle 내장.
// ──────────────────────────────────────────────────────────────────────────

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      className,
      invalid: invalidProp,
      id: idProp,
      'aria-describedby': ariaDescribedByProp,
      required: requiredProp,
      disabled: disabledProp,
      ...rest
    },
    ref
  ) {
    const ctx = useField()
    const invalid = invalidProp ?? ctx?.invalid ?? false
    const id = idProp ?? ctx?.id
    const describedBy = joinIds(
      ariaDescribedByProp,
      ctx?.hintId,
      ctx?.errorId
    )
    const required = requiredProp ?? ctx?.required
    const disabled = disabledProp ?? ctx?.disabled

    const [visible, setVisible] = useState(false)

    return (
      <div className={cn('relative', disabled && 'opacity-60')}>
        <input
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          required={required}
          disabled={disabled}
          className={cn(
            controlBase,
            invalid && controlInvalid,
            'pr-11',
            className
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? '비밀번호 숨기기' : '비밀번호 표시'}
          aria-pressed={visible}
          tabIndex={-1}
          disabled={disabled}
          className={cn(
            'absolute inset-y-0 right-1.5 my-auto h-8 w-8 rounded-md',
            'flex items-center justify-center text-muted',
            'hover:bg-black/5 focus-visible:bg-black/5 transition-colors',
            'outline-none'
          )}
        >
          {visible ? (
            <EyeOff className="w-4 h-4" strokeWidth={2} aria-hidden />
          ) : (
            <Eye className="w-4 h-4" strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
    )
  }
)

// ──────────────────────────────────────────────────────────────────────────
// Textarea
// ──────────────────────────────────────────────────────────────────────────

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      className,
      invalid: invalidProp,
      id: idProp,
      'aria-describedby': ariaDescribedByProp,
      required: requiredProp,
      disabled: disabledProp,
      rows = 4,
      ...rest
    },
    ref
  ) {
    const ctx = useField()
    const invalid = invalidProp ?? ctx?.invalid ?? false
    const id = idProp ?? ctx?.id
    const describedBy = joinIds(
      ariaDescribedByProp,
      ctx?.hintId,
      ctx?.errorId
    )
    const required = requiredProp ?? ctx?.required
    const disabled = disabledProp ?? ctx?.disabled

    return (
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        required={required}
        disabled={disabled}
        className={cn(
          controlBase,
          invalid && controlInvalid,
          'resize-y leading-relaxed',
          className
        )}
        {...rest}
      />
    )
  }
)

// ──────────────────────────────────────────────────────────────────────────
// Select (native)
// ──────────────────────────────────────────────────────────────────────────

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      className,
      invalid: invalidProp,
      id: idProp,
      'aria-describedby': ariaDescribedByProp,
      required: requiredProp,
      disabled: disabledProp,
      children,
      ...rest
    },
    ref
  ) {
    const ctx = useField()
    const invalid = invalidProp ?? ctx?.invalid ?? false
    const id = idProp ?? ctx?.id
    const describedBy = joinIds(
      ariaDescribedByProp,
      ctx?.hintId,
      ctx?.errorId
    )
    const required = requiredProp ?? ctx?.required
    const disabled = disabledProp ?? ctx?.disabled

    return (
      <select
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        required={required}
        disabled={disabled}
        className={cn(
          controlBase,
          invalid && controlInvalid,
          // native select 화살표 인디케이터 — terracotta 톤 SVG
          "appearance-none bg-no-repeat bg-[right_12px_center] pr-10",
          "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'><path d='M3 4.5L6 7.5L9 4.5' stroke='%238A7668' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")]",
          className
        )}
        {...rest}
      >
        {children}
      </select>
    )
  }
)

// ──────────────────────────────────────────────────────────────────────────
// Checkbox — 박스형. label은 children 또는 label prop.
// FieldRow 없이 그 자체로 한 줄 자주 쓰임 (약관 동의 등).
// ──────────────────────────────────────────────────────────────────────────

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** label 텍스트 — children과 동일. children 우선. */
  label?: ReactNode
  /** label 옆 보조 설명 (muted) */
  description?: ReactNode
  invalid?: boolean
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      className,
      label,
      description,
      invalid: invalidProp,
      id: idProp,
      'aria-describedby': ariaDescribedByProp,
      required: requiredProp,
      disabled: disabledProp,
      children,
      ...rest
    },
    ref
  ) {
    const ctx = useField()
    const autoId = useId()
    const invalid = invalidProp ?? ctx?.invalid ?? false
    const id = idProp ?? ctx?.id ?? `cb-${autoId}`
    const describedBy = joinIds(
      ariaDescribedByProp,
      ctx?.hintId,
      ctx?.errorId
    )
    const required = requiredProp ?? ctx?.required
    const disabled = disabledProp ?? ctx?.disabled
    const content = children ?? label

    return (
      <label
        htmlFor={id}
        className={cn(
          'flex items-start gap-2.5 cursor-pointer select-none',
          disabled && 'opacity-60 cursor-not-allowed',
          className
        )}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          required={required}
          disabled={disabled}
          className={cn(
            // native → 테라코타 accent
            'mt-0.5 h-[18px] w-[18px] shrink-0 rounded-[4px]',
            'accent-[var(--terracotta)]',
            'cursor-pointer disabled:cursor-not-allowed',
            invalid && 'accent-[var(--sale)]'
          )}
          {...rest}
        />
        {content && (
          <span className="flex-1 min-w-0">
            <span
              className={cn(
                'text-[13px] text-text break-keep leading-snug',
                invalid && 'text-sale'
              )}
            >
              {content}
              {required && (
                <span aria-hidden className="ml-1 text-sale">
                  *
                </span>
              )}
            </span>
            {description && (
              <span className="block text-[12px] text-muted mt-0.5 leading-relaxed break-keep">
                {description}
              </span>
            )}
          </span>
        )}
      </label>
    )
  }
)

// ──────────────────────────────────────────────────────────────────────────
// Radio — 단일 radio. RadioGroup 같은 컨테이너는 굳이 만들지 않았다.
// rhf의 `register('field', { value: '...' })` 혹은 Controller로 묶으면 됨.
// ──────────────────────────────────────────────────────────────────────────

export interface RadioProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
  invalid?: boolean
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  {
    className,
    label,
    description,
    invalid: invalidProp,
    id: idProp,
    'aria-describedby': ariaDescribedByProp,
    required: requiredProp,
    disabled: disabledProp,
    children,
    ...rest
  },
  ref
) {
  const ctx = useField()
  const autoId = useId()
  const invalid = invalidProp ?? ctx?.invalid ?? false
  const id = idProp ?? `rd-${autoId}`
  const describedBy = joinIds(ariaDescribedByProp, ctx?.hintId, ctx?.errorId)
  const required = requiredProp ?? ctx?.required
  const disabled = disabledProp ?? ctx?.disabled
  const content = children ?? label

  return (
    <label
      htmlFor={id}
      className={cn(
        'flex items-start gap-2.5 cursor-pointer select-none',
        disabled && 'opacity-60 cursor-not-allowed',
        className
      )}
    >
      {/* eslint-disable-next-line jsx-a11y/role-supports-aria-props --
          radio의 validity/required는 spec상 group-level 속성이라 eslint가
          싫어한다. 단일 radio라도 rhf의 검증 결과를 시각적으로 같이 물려
          주는 게 UX상 필요하므로 의도적으로 남겨 둔다. */}
      <input
        ref={ref}
        id={id}
        type="radio"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        required={required}
        disabled={disabled}
        className={cn(
          'mt-0.5 h-[18px] w-[18px] shrink-0',
          'accent-[var(--terracotta)]',
          'cursor-pointer disabled:cursor-not-allowed',
          invalid && 'accent-[var(--sale)]'
        )}
        {...rest}
      />
      {content && (
        <span className="flex-1 min-w-0">
          <span
            className={cn(
              'text-[13px] text-text break-keep leading-snug',
              invalid && 'text-sale'
            )}
          >
            {content}
          </span>
          {description && (
            <span className="block text-[12px] text-muted mt-0.5 leading-relaxed break-keep">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  )
})
