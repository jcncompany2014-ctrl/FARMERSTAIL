'use client'

/**
 * WeightInputSheet — 체중 입력 sheet (item 50).
 *
 * 핸드오프 패턴:
 *   - 상단: STEP kicker + Hero heading "{name}의 / 오늘 체중."
 *   - 본문: 96px 큰 숫자 + .소수점 작은 mute + KG accent mono
 *   - delta hint: ± 0.0 kg sage / 안정 구간 mute
 *   - 권장 구간 안내 + 저장 CTA (ink button)
 *
 * 이 컴포넌트는 controlled sheet — open/onClose/onSave 호출자 책임.
 *
 * R-feel(2026-06-10): 풀스크린 takeover → 공용 BottomSheet 로 전환.
 * 아래서 슬라이드업 + 백드롭 블러 + 그래버 + ESC(native <dialog>). 깜빡 제거.
 */

import { useState, useEffect } from 'react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'
import BottomSheet from '@/components/ui/BottomSheet'

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

  useEffect(() => {
    if (open) setVal(initialKg)
  }, [open, initialKg])

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
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel={`${dogName} 체중 입력`}
      dismissOnBackdrop={!saving}
    >
      <BottomSheet.Body>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.display,
            fontSize: 34,
            color: V3.ink,
            letterSpacing: '-0.025em',
            lineHeight: 1.02,
            wordBreak: 'keep-all',
            textWrap: 'balance',
          }}
        >
          <span style={{ letterSpacing: '-0.04em' }}>{dogName}</span>의
          <br />
          <span style={{ color: V3.accent }}>오늘 체중.</span>
        </h2>
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

        <div className="ft-rule-ink" style={{ margin: '18px 0' }} />

        {/* 큰 숫자 입력 */}
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
              fontSize: 13.5,
              color: V3.accent,
              letterSpacing: '0.16em',
              wordSpacing: '-0.12em',
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
                padding: '12px 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.bold,
                fontSize: 13.5,
                color: V3.ink,
                cursor: 'pointer',
              }}
            >
              {step > 0 ? `+${step}` : step}
            </button>
          ))}
        </div>
      </BottomSheet.Body>

      <BottomSheet.Footer>
        {errorMsg && (
          <p
            role="alert"
            style={{
              margin: '0 0 10px',
              fontSize: 12,
              color: V3.sale,
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
            fontSize: 16,
            letterSpacing: '-0.005em',
          }}
        >
          {saving ? '저장 중...' : `${val.toFixed(1)} kg 으로 저장`}
        </button>
      </BottomSheet.Footer>
    </BottomSheet>
  )
}
