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
 * # 2026-10-09 앱 새 디자인('A 포스터', 시안 D03 일기 삭제 확인)
 * '삭제할까요?' 확인창 7종(대화·건강 기록·복약·리마인더·예방접종·진료 공유 링크 취소·일기)이 모두 이 창이라
 * 여기만 바꾸면 같은 모양이 된다(사장님 결정 목록). 아래에서 올라오는 창(그래버) → 굵은 제목 21(본문 글꼴 800)
 * → 설명 17(#3D3D3D) → 두 칸 버튼(높이 58): 왼쪽 '취소' = 흰 바탕 1.5px 먹선, 오른쪽 확인 = 먹색 바탕
 * (지우는 확인은 빨강 바탕). 시트의 기본 제목 줄(아래 선 있는 작은 제목)은 쓰지 않고 이 창이 직접 그린다.
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
  type CSSProperties,
  type ReactNode,
} from 'react'
import { V3, V3Radius } from '@/lib/design/tokens'
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

/** 두 칸 버튼 공통(시안 D03: 높이 58 · 모서리 4 · 17px 800). */
const BUTTON_BASE: CSSProperties = {
  height: 58,
  boxSizing: 'border-box',
  borderRadius: V3Radius.sm,
  fontFamily: 'inherit',
  fontSize: 17,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

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
        <ConfirmSheet
          open={!!current}
          title={current.title}
          body={current.body}
          confirmLabel={current.confirmLabel}
          cancelLabel={current.cancelLabel}
          tone={current.tone}
          busy={busy}
          onCancel={() => close(false)}
          onConfirm={() => {
            // busy 표시는 짧게 — perform 실행은 호출자 책임이라 즉시 close.
            // 호출자가 비동기 작업 도중 dismiss 막고 싶으면 본인 state 로.
            setBusy(true)
            close(true)
          }}
        />
      )}
    </Ctx.Provider>
  )
}

/**
 * ConfirmSheet — 확인 창의 **그리는 부분**(시안 D03). ConfirmProvider 가 이걸 쓰고, Provider 밖 화면도 같은 모양을
 * 쓰려고 꺼냈다(2026-10-09 — 배송지 삭제 확인: /account/profile 은 (main) 밖이라 ConfirmProvider 가 없다).
 * 열고 닫기·진행 중 상태는 부르는 쪽이 들고 있다. busy 동안엔 바탕을 눌러도·취소를 눌러도 닫히지 않는다.
 */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone,
  busy = false,
  busyLabel,
  onCancel,
  onConfirm,
}: ConfirmOptions & {
  open: boolean
  busy?: boolean
  /** 진행 중 확인 버튼 글자 — "삭제 중…". 없으면 confirmLabel 그대로. */
  busyLabel?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <BottomSheet
      open={open}
      onClose={() => {
        if (busy) return
        onCancel()
      }}
      // 제목은 아래에서 직접 그린다(시안의 큰 굵은 제목) — 시트 기본 제목 줄 대신 이름만 넘긴다.
      ariaLabel={title}
      dismissOnBackdrop={!busy}
    >
      <BottomSheet.Body>
        <div
          style={{
            lineHeight: 'normal',
            color: V3.ink,
            // 아래 28 = 본문 여백 16 + 12, 그리고 홈 바 구간.
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          }}
        >
          {/* 본문 글꼴 굵게 — 앱 틀의 h2 기본(제목 글꼴)을 되돌린다(시안 21px 800). */}
          <h2
            style={{
              margin: 0,
              fontFamily: 'inherit',
              fontSize: 21,
              fontWeight: 800,
              lineHeight: 1.35,
              letterSpacing: '-0.02em',
              color: V3.ink,
              wordBreak: 'keep-all',
            }}
          >
            {title}
          </h2>
          {body && (
            <div style={{ margin: '8px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
              {body}
            </div>
          )}
          <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              style={{
                ...BUTTON_BASE,
                border: `1.5px solid ${V3.ink}`,
                background: '#FFFFFF',
                color: V3.ink,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
              }}
            >
              {cancelLabel ?? '취소'}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              autoFocus
              style={{
                ...BUTTON_BASE,
                border: 0,
                background: tone === 'destructive' ? V3.sale : V3.ink,
                color: '#FFFFFF',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy && busyLabel ? busyLabel : (confirmLabel ?? '확인')}
            </button>
          </div>
        </div>
      </BottomSheet.Body>
    </BottomSheet>
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
