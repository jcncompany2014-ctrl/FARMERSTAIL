/**
 * Farmer's Tail — Toast (snackbar) 시스템.
 *
 * # 왜 컨텍스트 기반인가
 *
 * 다른 toast 라이브러리(sonner, react-hot-toast)도 충분히 쓸만한데 두 가지
 * 이유로 직접 만든다:
 *   1) 외부 의존성 최소화 — 이 정도 컴포넌트에 10KB 번들은 아깝다.
 *   2) 브랜드 디자인 토큰(terracotta/ink/moss/sale)을 라이브러리 기본 스타일과
 *      맞추려면 override를 잔뜩 깔아야 함. 차라리 처음부터 우리 톤으로.
 *
 * # 사용법
 *
 *   // 1) 앱 루트에 provider 한 번 붙인다 (이 파일은 layout.tsx에서 import).
 *   <ToastProvider>
 *     {children}
 *   </ToastProvider>
 *
 *   // 2) 아무 client component에서 훅으로 꺼내 쓰기.
 *   const toast = useToast()
 *   toast.success('장바구니에 담았어요')
 *   toast.error('결제에 실패했어요. 잠시 후 다시 시도해 주세요.')
 *   toast.info('주문이 접수됐습니다', { duration: 4000 })
 *
 *   // 3) action 제공:
 *   toast.show({
 *     intent: 'info',
 *     title: '네트워크가 불안정해요',
 *     description: '다시 시도할까요?',
 *     action: { label: '재시도', onClick: () => refetch() },
 *   })
 *
 * # 접근성
 *
 * - Provider는 화면 밖 aria-live 영역을 렌더한다. success/info는
 *   `aria-live="polite"`, error/warning은 `aria-live="assertive"`.
 * - 키보드: `Esc`로 포커스 있는 토스트 닫힘.
 * - prefers-reduced-motion 존중 — 슬라이드/페이드 대신 즉시 표시.
 *
 * # 타이머
 *
 * - 마우스 hover / 포커스 중에는 타이머 일시정지. 읽는 사용자가 지워지지 않게.
 * - 기본 duration: success/info 3초, warning 4초, error 5초 (error는 사용자가
 *   문제를 인식할 시간을 더 줘야).
 */
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/ui/cn'

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type ToastIntent = 'success' | 'error' | 'info' | 'warning'

export type ToastAction = {
  label: string
  onClick: () => void
}

export type ToastInput = {
  intent?: ToastIntent
  /** 한 줄 요약. 생략하면 description만 보여줌. */
  title?: string
  /** 두 번째 줄 설명. title과 둘 중 하나는 있어야 함. */
  description?: string
  /** 토스트 안에 버튼 한 개 (예: 재시도). */
  action?: ToastAction
  /** ms. 생략하면 intent별 기본. null/0 이면 자동 닫힘 비활성. */
  duration?: number | null
}

type ToastItem = Required<Pick<ToastInput, 'intent'>> &
  ToastInput & {
    id: string
  }

type ToastContextValue = {
  show: (input: ToastInput) => string
  success: (message: string, opts?: Omit<ToastInput, 'intent' | 'title'>) => string
  error: (message: string, opts?: Omit<ToastInput, 'intent' | 'title'>) => string
  info: (message: string, opts?: Omit<ToastInput, 'intent' | 'title'>) => string
  warning: (message: string, opts?: Omit<ToastInput, 'intent' | 'title'>) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// ──────────────────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────────────────

const DEFAULT_DURATION: Record<ToastIntent, number> = {
  success: 3000,
  info: 3000,
  warning: 4000,
  error: 5000,
}

const MAX_TOASTS = 4 // 화면에 동시에 유지되는 최대 개수. 초과 시 가장 오래된 것부터 제거.

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  // 토스트별 setTimeout ID. hover 시 clear하고, mouseleave 시 재시작.
  const timers = useRef<Map<string, number>>(new Map())

  const dismiss = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id))
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
  }, [])

  const dismissAll = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current.clear()
    setItems([])
  }, [])

  const scheduleAutoDismiss = useCallback(
    (id: string, duration: number) => {
      const t = window.setTimeout(() => dismiss(id), duration) as unknown as number
      timers.current.set(id, t)
    },
    [dismiss]
  )

  const show = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID()
      const intent = input.intent ?? 'info'
      const item: ToastItem = { ...input, id, intent }
      setItems((xs) => {
        const next = [...xs, item]
        // cap — 오래된 것부터 잘라냄.
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
      })
      const duration =
        input.duration === null ? 0 : (input.duration ?? DEFAULT_DURATION[intent])
      if (duration > 0) scheduleAutoDismiss(id, duration)
      return id
    },
    [scheduleAutoDismiss]
  )

  // 편의 메서드들 — body는 show() 위임.
  const makeShortcut = useCallback(
    (intent: ToastIntent) =>
      (message: string, opts?: Omit<ToastInput, 'intent' | 'title'>) =>
        show({ intent, title: message, ...opts }),
    [show]
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      dismiss,
      dismissAll,
      success: makeShortcut('success'),
      error: makeShortcut('error'),
      info: makeShortcut('info'),
      warning: makeShortcut('warning'),
    }),
    [show, dismiss, dismissAll, makeShortcut]
  )

  // unmount 시 모든 타이머 정리.
  useEffect(() => {
    // React Hooks lint: ref.current를 cleanup에서 직접 읽지 말라 — effect가 돌 때
    // 참조를 복사해둔 값을 cleanup이 쓰도록.
    const map = timers.current
    return () => {
      map.forEach((t) => clearTimeout(t))
      map.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        items={items}
        onDismiss={dismiss}
        onPauseTimer={(id) => {
          const t = timers.current.get(id)
          if (t) {
            clearTimeout(t)
            timers.current.delete(id)
          }
        }}
        onResumeTimer={(id) => {
          const item = items.find((x) => x.id === id)
          if (!item) return
          const duration =
            item.duration === null
              ? 0
              : (item.duration ?? DEFAULT_DURATION[item.intent])
          if (duration > 0) scheduleAutoDismiss(id, duration)
        }}
      />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error(
      'useToast must be used inside <ToastProvider>. Add it once at the app root (layout.tsx).'
    )
  }
  return ctx
}

// ──────────────────────────────────────────────────────────────────────────
// Viewport — aria-live region + visible stack
// ──────────────────────────────────────────────────────────────────────────

function ToastViewport(props: {
  items: ToastItem[]
  onDismiss: (id: string) => void
  onPauseTimer: (id: string) => void
  onResumeTimer: (id: string) => void
}) {
  const { items, onDismiss, onPauseTimer, onResumeTimer } = props
  // error/warning은 즉시 읽히도록 assertive. 나머지는 polite(진행 중 읽기 방해 안 함).
  const assertiveItems = items.filter(
    (i) => i.intent === 'error' || i.intent === 'warning'
  )
  const politeItems = items.filter(
    (i) => i.intent !== 'error' && i.intent !== 'warning'
  )

  return (
    <>
      {/* 시각적으로 보이는 stack — 하단 중앙, 모바일은 하단 fullwidth padded. */}
      <div
        className={cn(
          'fixed z-[60] left-1/2 -translate-x-1/2',
          // 모바일: 하단 탭바 위(env(safe-area) + 탭바 높이 대략 68px 여유)
          'bottom-[calc(72px+env(safe-area-inset-bottom,0))]',
          // 데스크톱 폰 프레임: 프레임 폭 안에서 중앙에 맞게 max-w.
          'w-full max-w-[420px] px-4',
          'pointer-events-none'
        )}
      >
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ToastCard
              key={item.id}
              item={item}
              onDismiss={onDismiss}
              onPauseTimer={onPauseTimer}
              onResumeTimer={onResumeTimer}
            />
          ))}
        </div>
      </div>

      {/* sr-only live regions — screen reader가 읽을 텍스트 미러. 시각적 토스트가
          CSS로 숨겨져도 스크린리더에는 여기서 읽힌다. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        // style은 sr-only 유틸로 시각적 숨김 + 접근 트리엔 존재.
      >
        {politeItems.map((i) => (
          <span key={i.id}>
            {i.title} {i.description}
          </span>
        ))}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveItems.map((i) => (
          <span key={i.id}>
            {i.title} {i.description}
          </span>
        ))}
      </div>
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Card
// ──────────────────────────────────────────────────────────────────────────

const intentStyle: Record<ToastIntent, { bg: string; ring: string; icon: string }> = {
  success: { bg: 'bg-ink text-white', ring: 'ring-moss/40', icon: '✓' },
  info: { bg: 'bg-ink text-white', ring: 'ring-ink/20', icon: 'ⓘ' },
  warning: { bg: 'bg-gold text-ink', ring: 'ring-gold/50', icon: '!' },
  error: { bg: 'bg-sale text-white', ring: 'ring-sale/50', icon: '!' },
}

function ToastCard({
  item,
  onDismiss,
  onPauseTimer,
  onResumeTimer,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
  onPauseTimer: (id: string) => void
  onResumeTimer: (id: string) => void
}) {
  // Esc 로 닫기 — 카드가 포커스 받으면.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onDismiss(item.id)
  }
  const style = intentStyle[item.intent]

  return (
    <div
      role={item.intent === 'error' ? 'alert' : 'status'}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => onPauseTimer(item.id)}
      onMouseLeave={() => onResumeTimer(item.id)}
      onFocus={() => onPauseTimer(item.id)}
      onBlur={() => onResumeTimer(item.id)}
      className={cn(
        'pointer-events-auto rounded-xl shadow-lg ring-1',
        // motion-safe에서만 slide-in. reduce-motion이면 즉시 표시.
        'motion-safe:animate-[toast-in_180ms_ease-out]',
        style.bg,
        style.ring,
        'px-4 py-3 flex items-start gap-3'
      )}
    >
      <span
        aria-hidden
        className="shrink-0 w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-[13px] font-black"
      >
        {style.icon}
      </span>
      <div className="flex-1 min-w-0">
        {item.title && (
          <div className="text-[13px] font-bold leading-snug break-keep">
            {item.title}
          </div>
        )}
        {item.description && (
          <div
            className={cn(
              'text-[12px] leading-snug break-keep',
              item.title ? 'mt-0.5 opacity-80' : 'opacity-100'
            )}
          >
            {item.description}
          </div>
        )}
      </div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action!.onClick()
            onDismiss(item.id)
          }}
          className="shrink-0 text-[12px] font-bold underline underline-offset-2 hover:opacity-80"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="닫기"
        onClick={() => onDismiss(item.id)}
        className="shrink-0 -mr-1 -mt-1 p-1 rounded hover:bg-white/10 text-[13px] leading-none"
      >
        ×
      </button>
    </div>
  )
}
