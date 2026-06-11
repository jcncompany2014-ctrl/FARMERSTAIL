'use client'

/**
 * QuickLogSheet — 1탭 기록 sheet (item 79).
 *
 * 4-옵션 sheet — 식사 / 산책 / 체중 / 메모 각각 ONE TAP 으로 완료.
 *   - 식사: "오늘 식사 완료 ✓" → POST 1회
 *   - 산책: "산책 시작" → 카운터 시작 (별도 페이지로)
 *   - 체중: WeightInputSheet 호출
 *   - 메모: 텍스트 입력 textarea + 사진 추가 옵션
 *
 * 호출자는 onAction 으로 분기 — 실제 DB write 책임.
 *
 * R-feel(2026-06-10): 풀스크린 takeover → 공용 BottomSheet 로 전환.
 * 아래서 슬라이드업 + 백드롭 블러 + 그래버(native <dialog>). 풀스크린 깜빡 제거.
 */

import { useState } from 'react'
import { Check, Soup, Footprints, Scale, Pencil, type LucideIcon } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'
import BottomSheet from '@/components/ui/BottomSheet'

type QuickLogKind = 'meal' | 'walk' | 'weight' | 'memo'

interface QuickLogSheetProps {
  open: boolean
  onClose: () => void
  /** 초기 선택 액션. 기본 'meal'. */
  initialKind?: QuickLogKind
  /** 활성 강아지 이름 — 헤딩에 사용. */
  dogName?: string
  /** 액션 트리거 — 호출자 책임. */
  onAction: (kind: QuickLogKind, payload?: { memo?: string }) => Promise<void> | void
}

const ACTIONS: Array<{
  kind: QuickLogKind
  label: string
  Icon: LucideIcon
  tone: 'sage' | 'accent' | 'ink' | 'yellow'
  description: string
}> = [
  { kind: 'meal',   label: '식사', Icon: Soup,       tone: 'sage',   description: '오늘 한 끼를 기록' },
  { kind: 'walk',   label: '산책', Icon: Footprints, tone: 'accent', description: '오늘 산책을 기록' },
  { kind: 'weight', label: '체중', Icon: Scale,      tone: 'ink',    description: '오늘 체중을 입력' },
  { kind: 'memo',   label: '메모', Icon: Pencil,     tone: 'yellow', description: '오늘의 메모 추가' },
]

const TONE_COLOR: Record<'sage' | 'accent' | 'ink' | 'yellow', string> = {
  sage: V3.sage,
  accent: V3.accent,
  ink: V3.ink,
  yellow: V3.yellow,
}

export default function QuickLogSheet({
  open,
  onClose,
  initialKind = 'meal',
  dogName,
  onAction,
}: QuickLogSheetProps) {
  const [kind, setKind] = useState<QuickLogKind>(initialKind)
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleConfirm() {
    if (busy) return
    setBusy(true)
    setErrorMsg(null)
    try {
      await onAction(kind, kind === 'memo' ? { memo } : undefined)
      onClose()
    } catch (err) {
      // R83-9: 이전엔 catch 누락 → sheet 가 안 닫히고 사용자는 침묵 → 다시 눌러 중복 기록.
      const msg = err instanceof Error ? err.message : '기록에 실패했어요'
      setErrorMsg(msg)
    } finally {
      setBusy(false)
    }
  }

  const activeAction = ACTIONS.find((a) => a.kind === kind) ?? ACTIONS[0]!
  const memoEmpty = kind === 'memo' && memo.trim().length === 0

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel="빠른 기록"
      dismissOnBackdrop={!busy}
    >
      <BottomSheet.Body>
        <Mono color="accent" size="xs" weight={600}>
          빠른 기록 · QUICK LOG
        </Mono>

        {/* 4 액션 picker — 큰 카드 grid */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginTop: 12,
          }}
        >
          {ACTIONS.map((a) => {
            const active = a.kind === kind
            return (
              <button
                key={a.kind}
                onClick={() => setKind(a.kind)}
                className="flex flex-col items-center transition active:scale-95"
                style={{
                  background: active ? V3.ink : V3.paperHi,
                  color: active ? V3.paperHi : V3.ink,
                  border: `1px solid ${active ? V3.ink : V3.rule}`,
                  borderRadius: 4,
                  padding: '14px 8px',
                  cursor: 'pointer',
                  gap: 6,
                }}
                aria-pressed={active}
              >
                <a.Icon
                  size={22}
                  color={active ? V3.paperHi : TONE_COLOR[a.tone]}
                  strokeWidth={1.8}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    fontWeight: V3FontWeight.bold,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {a.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* 큰 헤딩 + 설명 */}
        <div style={{ marginTop: 20 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.display,
              fontSize: 30,
              color: V3.ink,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              wordBreak: 'keep-all',
            }}
          >
            {dogName ? `${dogName}의 ` : ''}
            {activeAction.label}
          </h2>
          <p
            style={{
              margin: '8px 0 0',
              fontFamily: 'var(--font-sans)',
              fontSize: 13.5,
              color: V3.inkSoft,
              lineHeight: 1.55,
              wordBreak: 'keep-all',
            }}
          >
            {activeAction.description}
          </p>
        </div>

        {/* memo 액션이면 textarea 노출 */}
        {kind === 'memo' && (
          <div style={{ marginTop: 14 }}>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="오늘의 한 줄을 적어주세요…"
              rows={4}
              style={{
                width: '100%',
                background: V3.paperHi,
                border: `1px solid ${V3.rule}`,
                borderRadius: 4,
                padding: 12,
                fontFamily: 'var(--font-sans)',
                fontSize: 13.5,
                color: V3.ink,
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>
        )}
      </BottomSheet.Body>

      <BottomSheet.Footer>
        {errorMsg && (
          <p
            role="alert"
            style={{
              margin: '0 0 10px',
              fontSize: 12,
              color: '#b03a2e',
              letterSpacing: '-0.01em',
              lineHeight: 1.4,
            }}
          >
            {errorMsg}
          </p>
        )}
        <button
          onClick={handleConfirm}
          disabled={busy || memoEmpty}
          className="flex items-center justify-center transition active:scale-[0.98]"
          style={{
            width: '100%',
            height: 52,
            borderRadius: 4,
            background: busy || memoEmpty ? V3.inkMute : V3.ink,
            color: V3.paperHi,
            border: 'none',
            cursor: busy ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 16,
            letterSpacing: '-0.005em',
            gap: 8,
          }}
        >
          <Check size={18} color={V3.paperHi} strokeWidth={2.2} />
          {busy ? '저장 중...' : `${activeAction.label} 기록 완료`}
        </button>
      </BottomSheet.Footer>
    </BottomSheet>
  )
}
