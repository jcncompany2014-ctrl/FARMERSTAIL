'use client'

/**
 * useConfirm — v3 confirm() 훅 (2026-05-22 R10-3c).
 *
 * # 왜 만들었나
 *
 * browser native `confirm('...')` 은 v3 톤이랑 안 맞고 focus trap 없음.
 * 페이지마다 Modal state 와 perform 함수 작성하면 ~50줄 boilerplate × N.
 *
 * 한 번 provider 깔고 어디서든:
 *
 *   const confirm = useConfirm()
 *   async function handleDelete() {
 *     if (!(await confirm({
 *       title: '이 일기를 삭제할까요?',
 *       body: '되돌릴 수 없어요.',
 *       confirmLabel: '삭제',
 *       tone: 'destructive',
 *     }))) return
 *     // proceed
 *   }
 *
 * # 디자인 결정
 *
 * - Promise<boolean> return — `await` 직관적. 취소면 false, 확인이면 true.
 * - 단일 modal mount — 한 번에 하나만 열림. 동시 호출은 queue (FIFO).
 * - tone: 'default' / 'destructive' — 확인 버튼 색만 다름 (ink vs sale).
 *
 * # ToastProvider 처럼 layout.tsx 에 한 번 마운트:
 *
 *   <ConfirmProvider>
 *     {children}
 *   </ConfirmProvider>
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'

export type ConfirmTone = 'default' | 'destructive'

export interface ConfirmOptions {
  title: string
  /** 보조 설명. ReactNode 라 굵게/링크 인라인 가능. */
  body?: ReactNode
  /** 확인 버튼 라벨. 기본 '확인'. destructive 면 '삭제' 등 명시 권장. */
  confirmLabel?: string
  /** 취소 라벨. 기본 '취소'. */
  cancelLabel?: string
  /** 'destructive' → 확인 버튼 sale red. 기본 default → ink. */
  tone?: ConfirmTone
}

type Pending = ConfirmOptions & {
  resolve: (value: boolean) => void
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const Ctx = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Pending[]>([])
  const [busy, setBusy] = useState(false)
  // 같은 컴포넌트가 빠르게 두 번 호출하는 케이스 대비 (e.g. 더블 클릭).
  const lastIdRef = useRef(0)

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      lastIdRef.current += 1
      setQueue((q) => [...q, { ...opts, resolve }])
    })
  }, [])

  const current = queue[0] ?? null

  const close = useCallback(
    (result: boolean) => {
      if (!current) return
      current.resolve(result)
      setQueue((q) => q.slice(1))
      setBusy(false)
    },
    [current],
  )

  const value = useMemo<ConfirmFn>(() => confirm, [confirm])

  return (
    <Ctx.Provider value={value}>
      {children}
      {current && (
        <BottomSheet
          open={!!current}
          onClose={() => {
            if (busy) return
            close(false)
          }}
          title={current.title}
          dismissOnBackdrop={!busy}
        >
          {current.body && <BottomSheet.Body>{current.body}</BottomSheet.Body>}
          <BottomSheet.Footer>
            {/* R-feel: 시트 바닥에 가로 꽉 찬 버튼 — 취소(연회색) + 확인(ink/red). */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => close(false)}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: '14px 18px',
                  borderRadius: V3Radius.sm,
                  fontSize: 14,
                  fontWeight: V3FontWeight.bold,
                  background: V3.paperHi,
                  color: V3.inkMute,
                  border: `1px solid ${V3.rule}`,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {current.cancelLabel ?? '취소'}
              </button>
              <button
                type="button"
                onClick={() => {
                  // busy 표시는 짧게 — perform 실행은 호출자 책임이라 즉시 close.
                  // 호출자가 비동기 작업 도중 dismiss 막고 싶으면 본인 state 로.
                  setBusy(true)
                  close(true)
                }}
                disabled={busy}
                autoFocus
                style={{
                  flex: 1,
                  padding: '14px 18px',
                  borderRadius: V3Radius.sm,
                  fontSize: 14,
                  fontWeight: V3FontWeight.bold,
                  background: current.tone === 'destructive' ? V3.sale : V3.ink,
                  color: V3.paperHi,
                  border: 'none',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {current.confirmLabel ?? '확인'}
              </button>
            </div>
          </BottomSheet.Footer>
        </BottomSheet>
      )}
    </Ctx.Provider>
  )
}

/**
 * @example
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: '삭제할까요?', tone: 'destructive' }))) return
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(Ctx)
  if (!ctx) {
    throw new Error(
      'useConfirm() must be used inside <ConfirmProvider>. Add it once at the app root (layout.tsx).',
    )
  }
  return ctx
}
