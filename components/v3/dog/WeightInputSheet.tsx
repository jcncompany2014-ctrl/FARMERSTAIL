'use client'

/**
 * WeightInputSheet — 체중 입력 풀스크린 sheet (item 50).
 *
 * 핸드오프 패턴:
 *   - 상단: 36×4 drag handle + STEP kicker + 닫기 + Hero heading "{name}의 / 오늘 체중."
 *   - 본문: 96px 큰 숫자 + .소수점 작은 mute + KG accent mono
 *   - delta hint: ± 0.0 kg sage / 안정 구간 mute
 *   - 권장 구간 안내 + 저장 CTA (ink button)
 *
 * 이 컴포넌트는 controlled sheet — open/onClose/onSave 호출자 책임.
 */

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

interface WeightInputSheetProps {
  open: boolean
  onClose: () => void
  /** 강아지 이름 — 헤딩에 사용. */
  dogName: string
  /** 마지막 기록 체중 (kg) — delta 비교 baseline. */
  lastKg?: number | null
  /** 마지막 기록 N일 전. */
  daysSinceLast?: number | null
  /** 권장 구간 [low, high]. */
  recommendedRange?: [number, number]
  /** 초기 값 (kg). */
  initialKg?: number
  /** 저장 — async, 호출자가 DB write + close. */
  onSave: (kg: number) => Promise<void> | void
}

export default function WeightInputSheet({
  open,
  onClose,
  dogName,
  lastKg,
  daysSinceLast,
  recommendedRange,
  initialKg = 4.0,
  onSave,
}: WeightInputSheetProps) {
  const [val, setVal] = useState<number>(initialKg)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setVal(initialKg)
  }, [open, initialKg])

  // ESC 키로 close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const delta = lastKg != null ? val - lastKg : 0
  const deltaSign = delta > 0 ? '+' : delta < 0 ? '−' : '±'
  const deltaAbs = Math.abs(delta).toFixed(1)
  const inRange =
    recommendedRange
      ? val >= recommendedRange[0] && val <= recommendedRange[1]
      : true

  const intPart = Math.trunc(val)
  const decPart = Math.abs(Math.round((val - intPart) * 10))

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setErrorMsg(null)
    try {
      await onSave(val)
    } catch (err) {
      // R83-9: 이전엔 catch 누락 → sheet 가 안 닫히고 사용자 침묵 → 반복 시도.
      const msg = err instanceof Error ? err.message : '체중 저장에 실패했어요'
      setErrorMsg(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${dogName} 체중 입력`}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{
        background: 'var(--paper, #f4ede0)',
        color: V3.ink,
      }}
    >
      {/* drag handle */}
      <div
        aria-hidden
        style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: V3.ink,
          margin: '8px auto 0',
          opacity: 0.4,
        }}
      />

      {/* header */}
      <div
        className="flex justify-between items-center"
        style={{ padding: '18px 20px 0' }}
      >
        <Mono color="accent" size="xs" weight={600}>
          입력 · STEP 01 / 01
        </Mono>
        <button
          onClick={onClose}
          className="flex items-center transition"
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: V3.ink,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.semibold,
            fontSize: 14,
            gap: 4,
          }}
        >
          닫기 <X size={14} color={V3.ink} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: '8px 20px 18px' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.display,
            fontSize: 38,
            color: V3.ink,
            letterSpacing: '-0.025em',
            lineHeight: 1,
            wordBreak: 'keep-all',
            textWrap: 'balance',
          }}
        >
          <span style={{ letterSpacing: '-0.04em' }}>{dogName}</span>의
          <br />
          <span style={{ color: V3.accent }}>오늘 체중.</span>
        </h1>
        <p
          style={{
            margin: '12px 0 0',
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            color: V3.inkSoft,
            lineHeight: 1.55,
          }}
        >
          {daysSinceLast != null
            ? `마지막 기록 ${daysSinceLast}일 전`
            : '첫 기록을 시작해요'}
          {recommendedRange && (
            <>
              {' '}· 권장 구간{' '}
              <span style={{ color: V3.ink, fontWeight: 700 }}>
                {recommendedRange[0]} — {recommendedRange[1]} kg
              </span>
            </>
          )}
        </p>
      </div>
      <div className="ft-rule-ink" style={{ marginLeft: 20, marginRight: 20 }} />

      {/* 큰 숫자 입력 */}
      <section style={{ padding: '24px 20px 28px' }}>
        <Mono color="inkMute" size="xs" weight={500} style={{ display: 'inline-block', marginBottom: 10 }}>
          오늘의 체중 (KG)
        </Mono>
        <div
          className="flex items-baseline justify-center"
          style={{
            background: V3.paperHi,
            border: `1.5px solid ${V3.ink}`,
            borderRadius: 4,
            padding: '32px 20px 24px',
            gap: 8,
          }}
        >
          <span
            className="tabular-nums"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.display,
              fontSize: 96,
              color: V3.ink,
              letterSpacing: '-0.07em',
              lineHeight: 0.9,
            }}
          >
            {intPart}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.display,
              fontSize: 48,
              color: V3.inkMute,
              letterSpacing: '-0.04em',
              lineHeight: 0.9,
            }}
          >
            .{decPart}
          </span>
          <span
            style={{
              fontFamily:
                "var(--font-mono, 'IBM Plex Mono'), 'JetBrains Mono', ui-monospace, monospace",
              fontSize: 14,
              color: V3.accent,
              letterSpacing: '0.16em',
              marginLeft: 8,
              alignSelf: 'flex-end',
              paddingBottom: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            KG
          </span>
        </div>

        {/* delta hint */}
        <div
          className="flex justify-between items-center"
          style={{ marginTop: 12, padding: '0 4px' }}
        >
          <span className="inline-flex items-center" style={{ gap: 8 }}>
            <span
              aria-hidden
              style={{ width: 8, height: 8, background: V3.sage }}
            />
            <Mono color="sage" size="xs" weight={500} upper={false}>
              지난 기록 대비 {deltaSign} {deltaAbs} kg
            </Mono>
          </span>
          <Mono
            color={inRange ? 'sage' : 'accent'}
            size="xs"
            weight={500}
            upper={false}
          >
            {inRange ? '안정 구간' : '주의 구간'}
          </Mono>
        </div>

        {/* +0.1 / -0.1 stepper */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            marginTop: 18,
          }}
        >
          {[-0.5, -0.1, +0.1, +0.5].map((step) => (
            <button
              key={step}
              onClick={() =>
                setVal((v) =>
                  Math.max(0.1, Math.round((v + step) * 10) / 10),
                )
              }
              className="transition active:scale-95"
              style={{
                background: V3.paperHi,
                border: `1px solid ${V3.rule}`,
                borderRadius: 4,
                padding: '10px 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.bold,
                fontSize: 13,
                color: V3.ink,
                cursor: 'pointer',
              }}
            >
              {step > 0 ? `+${step}` : step}
            </button>
          ))}
        </div>
      </section>

      <div style={{ flex: 1 }} />

      {/* 저장 CTA */}
      <div
        style={{
          padding: '16px 20px calc(env(safe-area-inset-bottom) + 16px)',
          borderTop: `1px solid ${V3.rule}`,
        }}
      >
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
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center transition active:scale-[0.98]"
          style={{
            width: '100%',
            height: 52,
            borderRadius: 4,
            background: saving ? V3.inkMute : V3.ink,
            color: V3.paperHi,
            border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 15,
            letterSpacing: '-0.005em',
          }}
        >
          {saving ? '저장 중...' : `${val.toFixed(1)} kg 으로 저장`}
        </button>
      </div>
    </div>
  )
}
