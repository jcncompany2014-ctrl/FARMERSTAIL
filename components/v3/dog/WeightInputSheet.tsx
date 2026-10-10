'use client'

/**
 * WeightInputSheet — 체중 입력 sheet (item 50).
 *
 * 2026-10-09 'A 포스터'(시안 T13) — 핸드오프 패턴을 새 틀로:
 *   - 머리줄: 제목 "{이름}의 오늘 체중." + 회색 한 줄(마지막 기록 · 권장 구간) · 오른쪽 '닫기'
 *   - 회색 면: "오늘의 체중 (kg)" → 큰 숫자(Anton) + kg → 지난 기록과의 차이
 *     · 권장 구간(recommendedRange)을 받았을 때만 '안정 구간'/'주의 구간' 칩
 *   - 먹선 네모 −0.5 / −0.1 / +0.1 / +0.5 → 먹색 꽉 찬 저장 버튼
 *   조각은 components/v3/sheet/SheetParts.
 *
 * 근거 없는 말은 하지 않는다: 예전엔 권장 구간 없이도 늘 '안정 구간'이라 적었다(호출자 누구도
 * 구간을 안 넘김). 마지막 기록 며칠 전도 모르면(daysSinceLast 를 안 넘김) 아무 말도 하지 않는다.
 *
 * 이 컴포넌트는 controlled sheet — open/onClose/onSave 호출자 책임.
 *
 * R-feel(2026-06-10): 풀스크린 takeover → 공용 BottomSheet 로 전환.
 * 아래서 슬라이드업 + 백드롭 블러 + 그래버 + ESC(native <dialog>). 깜빡 제거.
 */

import { useState, useEffect } from 'react'
import { userFacingError } from '@/lib/error-message'
import { V3, V3Radius } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import { formatKg } from '@/lib/korean'
import {
  SheetContent,
  SheetError,
  SheetHeader,
  SheetPrimaryButton,
} from '@/components/v3/sheet/SheetParts'

interface WeightInputSheetProps {
  open: boolean
  onClose: () => void
  /** 강아지 이름 — 헤딩에 사용. */
  dogName: string
  /** 마지막 기록 체중 (kg) — delta 비교 baseline. */
  lastKg?: number | null
  /**
   * 마지막 기록 N일 전(0 = 오늘). null = 기록 없음 → '첫 기록을 시작해요'.
   * 안 넘기면(undefined = 아직 모름 · 조회 실패) 아무 말도 하지 않는다.
   */
  daysSinceLast?: number | null
  /** 권장 구간 [low, high]. 넘길 때만 '안정 구간'/'주의 구간'을 말한다. */
  recommendedRange?: [number, number]
  /** 초기 값 (kg). */
  initialKg?: number
  /** 저장 — async, 호출자가 DB write + close. */
  onSave: (kg: number) => Promise<void> | void
}

/** ±0.5 / ±0.1 버튼. 빼기는 진짜 빼기 기호(U+2212). */
const STEPS = [-0.5, -0.1, 0.1, 0.5] as const

/** 줄바꿈 없는 빈칸 — 보조 줄에 쓸 말이 없을 때도 한 줄 높이를 지킨다(보통 빈칸은 접혀서 높이가 0). */
const NBSP = String.fromCharCode(160)

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

  // 차이는 보이는 자리(0.1kg)로 반올림한 뒤 부호를 정한다 — "− 0.0kg" 같은 표시가 없게.
  const deltaTenths = lastKg != null ? Math.round((val - lastKg) * 10) : 0
  const deltaText =
    lastKg == null
      ? null
      : deltaTenths === 0
        ? '지난 기록과 같아요'
        : `지난 기록보다 ${deltaTenths > 0 ? '+' : '−'} ${(Math.abs(deltaTenths) / 10).toFixed(1)}kg`
  // 권장 구간을 받았을 때만 판정한다(null = 모름 → 말하지 않음).
  const inRange: boolean | null = recommendedRange
    ? val >= recommendedRange[0] && val <= recommendedRange[1]
    : null

  const lastText =
    daysSinceLast === undefined
      ? null
      : daysSinceLast === null
        ? '첫 기록을 시작해요'
        : daysSinceLast === 0
          ? '마지막 기록 오늘'
          : `마지막 기록 ${daysSinceLast}일 전`
  const rangeText = recommendedRange
    ? `권장 구간 ${recommendedRange[0]}~${recommendedRange[1]}kg`
    : null
  // 아직 모를 때도 한 줄 높이는 지킨다 — 조회가 끝나 글이 생길 때 시트가 들썩이지 않게.
  const sub = [lastText, rangeText].filter(Boolean).join(' · ') || NBSP

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setErrorMsg(null)
    try {
      await onSave(val)
    } catch (err) {
      // R83-9: 이전엔 catch 누락 → sheet 가 안 닫히고 사용자 침묵 → 반복 시도.
      const msg = userFacingError(err, '체중 저장에 실패했어요')
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
        <SheetContent>
          <SheetHeader title={`${dogName}의 오늘 체중.`} sub={sub} onClose={onClose} />

          {/* 큰 숫자 — 회색 면(칸 사이 6) */}
          <div
            className="flex flex-col items-center"
            style={{
              marginTop: 18,
              gap: 6,
              background: V3.soft,
              borderRadius: V3Radius.sm,
              padding: '18px 16px 16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>
              오늘의 체중 (kg)
            </div>
            <div
              aria-hidden
              className="flex items-baseline justify-center"
              style={{ gap: 5, whiteSpace: 'nowrap' }}
            >
              {/* 숫자 글꼴은 .ft-num 이 준다 — fontFamily·fontWeight 를 여기서 주지 않는다. */}
              <span className="ft-num" style={{ fontSize: 64, lineHeight: 1, color: V3.ink }}>
                {val.toFixed(1)}
              </span>
              <span style={{ fontSize: 20, fontWeight: 800, color: V3.ink }}>kg</span>
            </div>
            {/* 값은 스텝퍼로만 바뀌므로, 위 큰 숫자(aria-hidden 장식) 대신 이 live
                영역이 변경 시 현재 체중을 스크린리더에 낭독한다. */}
            <span className="sr-only" role="status">
              {`현재 체중 ${val.toFixed(1)} 킬로그램${
                inRange === null ? '' : ` · ${inRange ? '안정 구간' : '주의 구간'}`
              }`}
            </span>

            {(deltaText || inRange !== null) && (
              <div
                className="flex flex-wrap items-center justify-center"
                style={{ gap: 10 }}
              >
                {deltaText && (
                  <span style={{ fontSize: 15, fontWeight: 700, color: V3.inkSoft }}>
                    {deltaText}
                  </span>
                )}
                {inRange !== null && (
                  <span
                    className="flex items-center"
                    style={{
                      height: 26,
                      padding: '0 8px',
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#FFFFFF',
                      background: inRange ? V3.ink : V3.sale,
                      borderRadius: V3Radius.sm,
                    }}
                  >
                    {inRange ? '안정 구간' : '주의 구간'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* −0.5 / −0.1 / +0.1 / +0.5 */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
              marginTop: 12,
            }}
          >
            {STEPS.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() =>
                  setVal((v) =>
                    Math.max(0.1, Math.round((v + step) * 10) / 10),
                  )
                }
                aria-label={`${Math.abs(step)}킬로그램 ${step > 0 ? '늘리기' : '줄이기'}`}
                className="transition active:scale-95 ft-no-press"
                style={{
                  height: 52,
                  padding: 0,
                  background: '#FFFFFF',
                  border: `1.5px solid ${V3.ink}`,
                  borderRadius: V3Radius.sm,
                  fontSize: 18,
                  fontWeight: 800,
                  color: V3.ink,
                  cursor: 'pointer',
                }}
              >
                {`${step > 0 ? '+' : '−'}${Math.abs(step)}`}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <SheetError msg={errorMsg} />
            <SheetPrimaryButton onClick={handleSave} disabled={saving} busy={saving}>
              {saving ? '저장 중...' : `${formatKg(val)}으로 저장`}
            </SheetPrimaryButton>
          </div>
        </SheetContent>
      </BottomSheet.Body>
    </BottomSheet>
  )
}
