'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X,
  Check,
  RotateCcw,
  AlertCircle,
  UtensilsCrossed,
  Plus,
  Drumstick,
  Sprout,
  CalendarClock,
  Sparkles,
} from 'lucide-react'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import { petName } from '@/lib/korean'
import {
  computeNutrientPanel,
  clinicalCheckForPanel,
} from '@/lib/personalization/nutrientPanel'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { haptic } from '@/lib/haptic'
import { trackBoxAdjusted } from '@/lib/analytics'

/**
 * AdjustSheet — Claude Design 핸드오프 #3 (sheet) 적용.
 *
 * 사용자가 추천 비율을 슬라이더로 직접 조정. 합 100% 강제 + 알레르기 차단
 * 라인 비활성. 저장 시 POST /api/personalization/adjust → user_adjusted=true.
 *
 * # 핵심 로직
 *  - rebalance: 한 라인 슬라이더 변경 시 같은 그룹 (메인 / 토퍼) 의 다른 라인
 *    을 비례 분배. blocked 라인은 donor 에서 제외.
 *  - 토퍼 cap 30%, 메인 단일 라인 max 70%
 *  - 5% step (0.05 단위 — algorithm.0.1 보다 fine 한 사용자 조정 허용)
 *  - "다음 cycle 부터 / 이번 즉시" 토글은 UI 만 (백엔드는 strategy='now' 만
 *    구현. 'next' 는 미래 작업. props 로 받아 호출처가 결정).
 */

const MAIN_STEP = 5
const MAIN_MAX = 70

// 토퍼 폐지(2026-07-13 사장님) — 야채/육류 토퍼 삭제. 박스는 화식 레시피만.
type Ratios = Record<string, number> // lineId → percent (0-100)

/** Smart redistribute — group 내 한 항목 변경 시 다른 항목들에 비례 분배. */
function rebalance(
  group: string[],
  ratios: Ratios,
  id: string,
  newVal: number,
  blocked: Set<string>,
): Ratios {
  const next: Ratios = { ...ratios }
  const oldVal = ratios[id] ?? 0
  const delta = newVal - oldVal
  if (delta === 0) return next
  next[id] = newVal

  const donorKeys = group.filter((k) => k !== id && !blocked.has(k))
  const donorTotal = donorKeys.reduce((s, k) => s + (ratios[k] ?? 0), 0)

  if (delta > 0) {
    // 증가 → donor 에서 비례 차감
    let need = delta
    if (donorTotal <= 0) {
      next[id] = oldVal
      return next
    }
    let safety = 10
    while (need > 0.0001 && safety-- > 0) {
      const eligible = donorKeys.filter((k) => (next[k] ?? 0) > 0)
      if (eligible.length === 0) {
        next[id] = oldVal + (delta - need)
        break
      }
      const eligibleTotal = eligible.reduce((s, k) => s + (next[k] ?? 0), 0)
      let removed = 0
      for (const k of eligible) {
        const share = (next[k] ?? 0) / eligibleTotal
        const take = Math.min(next[k] ?? 0, need * share)
        next[k] = (next[k] ?? 0) - take
        removed += take
      }
      if (removed < 0.0001) break
      need -= removed
    }
  } else {
    // 감소 → donor 에 비례 분배
    const give = -delta
    if (donorKeys.length === 0) {
      next[id] = oldVal
      return next
    }
    if (donorTotal > 0) {
      for (const k of donorKeys) {
        const share = (ratios[k] ?? 0) / donorTotal
        next[k] = (next[k] ?? 0) + give * share
      }
    } else {
      const each = give / donorKeys.length
      for (const k of donorKeys) next[k] = (next[k] ?? 0) + each
    }
  }

  // 5% step snap
  const step = group === group ? 5 : 5
  for (const k of group) {
    next[k] = Math.round((next[k] ?? 0) / step) * step
  }
  next[id] = newVal

  // 합 유지 — 잔차를 가장 큰 donor 에 흡수
  const oldSum = group.reduce((s, k) => s + (ratios[k] ?? 0), 0)
  const newSum = group.reduce((s, k) => s + (next[k] ?? 0), 0)
  const error = oldSum - newSum
  if (Math.abs(error) >= 1) {
    const candidates = donorKeys
      .filter((k) => !blocked.has(k))
      .sort((a, b) => (next[b] ?? 0) - (next[a] ?? 0))
    for (const k of candidates) {
      const after = (next[k] ?? 0) + error
      if (after >= 0 && after <= 100) {
        next[k] = after
        break
      }
    }
  }

  return next
}

const sumGroup = (ratios: Ratios, keys: string[]) =>
  keys.reduce((s, k) => s + (ratios[k] ?? 0), 0)

// ──────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────────────────────────────────

export default function AdjustSheet({
  open,
  onClose,
  formula,
  dogId,
  dogName,
  onSaved,
  isSenior = false,
}: {
  open: boolean
  onClose: () => void
  formula: Formula
  dogId: string
  dogName: string
  onSaved: (next: Formula) => void
  /** 노령기(시니어) 여부 — analysis.stage 에서 신뢰성 있게 파생. reasoning
   *  ruleId 에는 시니어 신호가 없어 prop 으로 전달 → senior 단백/지방 상한
   *  (35%/18% DM) 경고를 live preview 에서 켠다. */
  isSenior?: boolean
}) {
  // formula → ratios (퍼센트 정수). 메인 화식 라인만(토퍼 폐지).
  const initialRatios: Ratios = useMemo(() => {
    const r: Ratios = {}
    for (const line of ALL_LINES) {
      r[line] = Math.round(formula.lineRatios[line] * 100)
    }
    return r
  }, [formula])

  const [ratios, setRatios] = useState<Ratios>(initialRatios)
  const [strategy, setStrategy] = useState<'now' | 'next'>('next')
  const [shakeId, setShakeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const [dragY, setDragY] = useState(0)
  const dragStart = useRef<{ y: number; time: number } | null>(null)

  // 알레르기 차단 라인 — formula.reasoning 의 allergy-* ruleId 패턴.
  const blocked = useMemo<Set<FoodLine>>(() => {
    const s = new Set<FoodLine>()
    for (const r of formula.reasoning) {
      const m = r.ruleId.match(
        /^(?:next-)?allergy-(basic|weight|skin|premium|joint)$/,
      )
      if (m) s.add(m[1] as FoodLine)
    }
    return s
  }, [formula])

  // open 변경 / formula 변경 → ratios 재초기화.
  useEffect(() => {
    if (open) setRatios(initialRatios)
  }, [open, initialRatios])

  const mainKeys: string[] = [...ALL_LINES]
  const mainSum = sumGroup(ratios, mainKeys)
  // 메인 화식 5종 합 = 100% (정량 영양 책임). 토퍼 폐지.
  const canSave = Math.round(mainSum) === 100 && !saving

  function onLineChange(id: string, newVal: number) {
    setRatios((prev) =>
      rebalance(mainKeys, prev, id, newVal, blocked as Set<string>),
    )
  }
  function onBlockedTouch(id: string) {
    setShakeId(id)
    haptic('warn')
    setTimeout(() => setShakeId(null), 380)
  }
  function onReset() {
    setRatios(initialRatios)
  }

  async function onSave() {
    if (!canSave) return
    setSaving(true)
    setErr(null)
    try {
      const lineRatios = {
        basic: (ratios.basic ?? 0) / 100,
        weight: (ratios.weight ?? 0) / 100,
        skin: (ratios.skin ?? 0) / 100,
        premium: (ratios.premium ?? 0) / 100,
        joint: (ratios.joint ?? 0) / 100,
      }
      // 토퍼 폐지 — 항상 빈 값 저장.
      const toppers = { vegetable: 0, protein: 0 }
      const res = await fetch('/api/personalization/adjust', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dogId,
          cycleNumber: formula.cycleNumber,
          lineRatios,
          toppers,
          strategy, // 백엔드가 'next' 인식할 때까지는 'now' 처럼 동작
        }),
      })
      const json = (await res.json()) as
        | { ok: true; lineRatios: typeof lineRatios; dailyGrams?: number }
        | { ok?: false; code?: string; message?: string }
      if (!res.ok || !('ok' in json) || json.ok !== true) {
        const msg =
          ('message' in json && json.message) || '저장에 실패했어요'
        setErr(msg)
        return
      }
      haptic('confirm')
      trackBoxAdjusted({ dogId, cycleNumber: formula.cycleNumber })
      onSaved({
        ...formula,
        lineRatios,
        toppers,
        // 서버가 라인 mix 기준 재계산한 dailyGrams 사용 (없으면 기존 값 유지).
        dailyGrams: json.dailyGrams ?? formula.dailyGrams,
        userAdjusted: true,
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '네트워크가 불안정해요. 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  // ── drag-to-dismiss ──
  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = { y: e.clientY, time: Date.now() }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return
    const dy = e.clientY - dragStart.current.y
    setDragY(Math.max(0, dy))
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragStart.current) return
    const sheetH = sheetRef.current?.offsetHeight ?? 600
    const dy = e.clientY - dragStart.current.y
    const elapsed = Date.now() - dragStart.current.time
    const velocity = dy / elapsed
    if (dy > sheetH * 0.5 || (velocity > 0.6 && dy > 50)) {
      onClose()
    }
    setDragY(0)
    dragStart.current = null
  }

  if (!open) return null

  return (
    <>
      <div className="adj-scrim adj-open" onClick={onClose} />
      <div
        ref={sheetRef}
        className="adj-sheet adj-open"
        style={{ transform: `translateY(${dragY}px)` }}
      >
        {/* drag handle */}
        <div
          className="adj-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <i />
        </div>

        {/* head */}
        <div className="adj-head">
          <div className="adj-titles">
            <div className="adj-kicker">ADJUST RATIO</div>
            <h2>비율 직접 조정</h2>
            <div className="adj-sub">
              {/* 친근형(petName)으로 감싸 받침 유무와 무관히 조사 정확 —
                  모음명 "나우"→"나우의"(기존 "나우이의"✗), 받침명 "푸린"→"푸린이의". */}
              <strong>{petName(dogName)}</strong>의 cycle {formula.cycleNumber} 맞춤 박스
            </div>
          </div>
          <button
            type="button"
            className="adj-x"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* body */}
        <div className="adj-body">
          {/* live bar */}
          <LiveBar
            ratios={ratios}
            mainSum={mainSum}
            formula={formula}
            isSenior={isSenior}
          />

          {/* 메인 화식 — 5종 합 무조건 100% (정량 영양). 단일 라인 max 70%. */}
          <div className="adj-sect-lbl">
            <div className="l">
              <Drumstick size={11} strokeWidth={2} color="var(--ink)" />
              메인 화식 5종
            </div>
            <div className="r">
              <b>{Math.round(mainSum)}</b>% · 합 100% 필수
            </div>
          </div>
          <div className="adj-lines">
            {ALL_LINES.map((line) => {
              const meta = FOOD_LINE_META[line]
              const v = ratios[line] ?? 0
              const isBlocked = blocked.has(line)
              const grams = (formula.dailyGrams * v) / 100
              const kcal = (formula.dailyKcal * v) / 100
              return (
                <LineRow
                  key={line}
                  id={line}
                  label={meta.name}
                  sub={meta.subtitle}
                  color={meta.color}
                  value={v}
                  max={MAIN_MAX}
                  step={MAIN_STEP}
                  blocked={isBlocked}
                  blockedReason={
                    isBlocked
                      ? meta.blockingAllergies[0] ?? '알레르기'
                      : undefined
                  }
                  shake={shakeId === line}
                  grams={grams}
                  kcal={kcal}
                  onChange={(nv) => onLineChange(line, nv)}
                  onBlockedTouch={() => onBlockedTouch(line)}
                />
              )
            })}
          </div>

          {/* 전환 전략 */}
          <div className="adj-sect-lbl">
            <div className="l">
              <CalendarClock size={11} strokeWidth={2} color="var(--ink)" />
              전환 전략
            </div>
          </div>
          <div className="adj-strategy">
            <div className="l">이 변경을 언제부터 적용할까요?</div>
            <div className="adj-seg">
              <div
                className="adj-seg-thumb"
                style={{
                  left: strategy === 'next' ? '3px' : 'calc(50% + 0px)',
                }}
              />
              <button
                type="button"
                className={strategy === 'next' ? 'on' : ''}
                onClick={() => setStrategy('next')}
              >
                다음 cycle부터
              </button>
              <button
                type="button"
                className={strategy === 'now' ? 'on' : ''}
                onClick={() => setStrategy('now')}
              >
                이번 cycle 즉시
              </button>
            </div>
          </div>

          {/* footer note */}
          <div className="adj-footer-note">
            <div className="ic">
              <Sparkles size={13} strokeWidth={2} color="#3C725E" />
            </div>
            <div>
              저장하면 <b>&apos;사용자 조정됨&apos;</b>으로 마킹돼요. 다음
              cycle 알고리즘이 이 조정값을 참고해 더 나은 추천을 만들어요.
            </div>
          </div>

          {err && (
            <div className="adj-err" role="alert">
              <AlertCircle size={13} strokeWidth={2} />
              {err}
            </div>
          )}
        </div>

        {/* sticky CTA */}
        <div className="adj-cta-bar">
          <button type="button" className="adj-ghost" onClick={onReset}>
            <RotateCcw size={13} strokeWidth={2} />
            추천으로
          </button>
          <button
            type="button"
            className="adj-save"
            disabled={!canSave}
            onClick={onSave}
          >
            {saving ? '저장 중...' : '저장'}
            <Check size={14} strokeWidth={2.6} color="#fff" />
          </button>
        </div>
      </div>
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// LiveBar — stacked bar + 합계 표시
// ──────────────────────────────────────────────────────────────────────────

function LiveBar({
  ratios,
  mainSum,
  formula,
  isSenior = false,
}: {
  ratios: Ratios
  mainSum: number
  formula: Formula
  isSenior?: boolean
}) {
  // 메인 화식 5종 (합 100% 정량 영양) stacked bar. 토퍼 폐지(2026-07-13).
  const mainOk = Math.round(mainSum) === 100
  return (
    <div className="adj-live">
      {/* ── 메인 화식 (정량) ───────────────────────────────────────────── */}
      <div className="adj-live-axis">
        <div className="l">
          <UtensilsCrossed size={10} strokeWidth={2} color="var(--muted)" />
          메인 화식 <b>{Math.round(mainSum)}%</b>
        </div>
        <div className={'r' + (mainOk ? '' : ' warn')}>
          {mainOk ? (
            <>
              <Check size={10} strokeWidth={2.6} color="#3C725E" />합 100%
            </>
          ) : (
            <>
              <AlertCircle size={10} strokeWidth={2.2} color="#b83a2e" />
              {mainSum > 100
                ? `${Math.round(mainSum - 100)}% 초과`
                : `${Math.round(100 - mainSum)}% 부족`}
            </>
          )}
        </div>
      </div>
      <div className="adj-live-bar">
        {ALL_LINES.map((k) => {
          const v = ratios[k] ?? 0
          if (v === 0) return null
          const color = FOOD_LINE_META[k].color
          return (
            <i
              key={k}
              style={{ width: `${v}%`, background: color }}
              title={`${k} ${v}%`}
            />
          )
        })}
      </div>

      {/* ── 영양 단면 live preview + 임상 권고 위반 chip (v1.5+) ──────── */}
      <NutrientLivePreview ratios={ratios} formula={formula} isSenior={isSenior} />
    </div>
  )
}

/**
 * 슬라이더 조정 시 영양 단면 (DM%) 실시간 update + 임상 권고 위반 chip.
 * 사용자가 "이 변경이 영양적으로 어떤 의미" 를 즉시 볼 수 있고, 만약
 * 췌장염 fat 16% 초과 같은 위반이 발생하면 즉시 경고.
 *
 * context 는 formula.reasoning 의 ruleId 에서 추론:
 *  - age-puppy / age-puppy-large-breed → isPuppy / isLargeBreedPuppy
 *  - chronic-pancreatitis → hasPancreatitis
 *  - chronic-cardiac → hasCardiac
 *  - chronic-kidney-stage4 → irisStage 4
 *  - chronic-kidney-stage3 / chronic-kidney (무스테이지) → irisStage 3
 *  - chronic-kidney-early (Stage 1-2) → irisStage 1
 */
function NutrientLivePreview({
  ratios,
  formula,
  isSenior = false,
}: {
  ratios: Ratios
  formula: Formula
  isSenior?: boolean
}) {
  // ratios 는 0-100 percent. computeNutrientPanel 은 0-1.0 ratio 받음.
  const mainRatios = useMemo(() => {
    const total = ALL_LINES.reduce((s, l) => s + (ratios[l] ?? 0), 0)
    if (total <= 0) {
      return { basic: 0, weight: 0, skin: 0, premium: 0, joint: 0 }
    }
    const out: Record<FoodLine, number> = {
      basic: 0,
      weight: 0,
      skin: 0,
      premium: 0,
      joint: 0,
    }
    for (const l of ALL_LINES) {
      out[l] = (ratios[l] ?? 0) / total
    }
    return out
  }, [ratios])

  const panel = useMemo(
    () => computeNutrientPanel(mainRatios),
    [mainRatios],
  )

  // formula.reasoning 의 ruleId 에서 임상 context 추론.
  const clinicalContext = useMemo(() => {
    const rules = new Set(formula.reasoning.map((r) => r.ruleId))
    return {
      isPuppy: rules.has('age-puppy') || rules.has('age-puppy-large-breed'),
      isLargeBreedPuppy: rules.has('age-puppy-large-breed'),
      hasPancreatitis: rules.has('chronic-pancreatitis'),
      hasCardiac: rules.has('chronic-cardiac'),
      // 노령기 — reasoning 에 신뢰 가능한 시니어 신호가 없어 prop 으로 받는다
      // (analysis.stage → stageFromKR 파생). senior 단백/지방 상한 경고용.
      isSenior,
      // CKD 4개 ruleId 전부 매핑 (C4). firstBox 가 stage 별로 분리해 내보내므로
      // stage4/stage3 을 놓치면 가장 위험한 케이스의 IRIS 단백 가드(<22%)가
      // 죽는다 (무스테이지 chronic-kidney 는 보수적으로 Stage 3 취급).
      irisStage: rules.has('chronic-kidney-stage4')
        ? 4
        : rules.has('chronic-kidney-stage3')
          ? 3
          : rules.has('chronic-kidney')
            ? 3
            : rules.has('chronic-kidney-early')
              ? 1
              : null,
    }
  }, [formula.reasoning, isSenior])

  const check = useMemo(
    () => clinicalCheckForPanel(panel, clinicalContext),
    [panel, clinicalContext],
  )

  return (
    <div className="adj-live-nutri">
      <div className="adj-live-nutri-label">영양 단면 (DM)</div>
      <div className="adj-live-nutri-grid">
        <span>
          <small>단백질</small>
          <b>{panel.proteinPctDM}%</b>
        </span>
        <span>
          <small>지방</small>
          <b>{panel.fatPctDM}%</b>
        </span>
        <span>
          <small>kcal/100g</small>
          <b>{panel.kcalPer100g}</b>
        </span>
      </div>
      {check.warnings.length > 0 && (
        <div className="adj-live-warn">
          {check.warnings.map((w) => (
            <div key={w.code} className="adj-live-warn-row">
              <AlertCircle size={11} strokeWidth={2.4} color="#b83a2e" />
              <span className="adj-live-warn-label">{w.label}</span>
              <span className="adj-live-warn-actual">{w.actual}</span>
              <span className="adj-live-warn-target">{w.target}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// LineRow — 한 줄 (메인 또는 토퍼)
// ──────────────────────────────────────────────────────────────────────────

function LineRow({
  id,
  label,
  sub,
  color,
  value,
  max,
  step,
  blocked,
  blockedReason,
  shake,
  grams,
  kcal,
  onChange,
  onBlockedTouch,
}: {
  id: string
  label: string
  sub: string
  color: string
  value: number
  max: number
  step: number
  blocked: boolean
  blockedReason?: string
  shake: boolean
  grams: number
  kcal: number
  onChange: (v: number) => void
  onBlockedTouch: () => void
}) {
  return (
    <div className={'adj-line' + (blocked ? ' blocked' : '')}>
      <div className="adj-line-row1">
        <span
          className="adj-line-dot"
          style={{ background: blocked ? 'var(--rule-2)' : color }}
        />
        <span className="adj-line-name">{label}</span>
        {blocked ? (
          <span className={'adj-blocked-chip' + (shake ? ' shake' : '')}>
            <X size={9} strokeWidth={2.6} color="var(--terracotta)" />
            {blockedReason} 차단됨
          </span>
        ) : (
          <span className="adj-line-sub">{sub}</span>
        )}
        <span className="adj-line-pct">
          {value}
          <small>%</small>
        </span>
      </div>
      <SegSlider
        value={value}
        max={max}
        step={step}
        color={color}
        disabled={blocked}
        label={label}
        onChange={onChange}
        onBlockedTouch={onBlockedTouch}
      />
      {!blocked && (
        <div className="adj-line-row3">
          <span>
            <b>{Math.round(grams)}</b>g/일
          </span>
          <span>
            <b>{Math.round(kcal)}</b> kcal
          </span>
        </div>
      )}
      {/* unused id var to avoid eslint */}
      <span style={{ display: 'none' }}>{id}</span>
    </div>
  )
}

function SegSlider({
  value,
  max,
  step,
  color,
  disabled,
  label,
  onChange,
  onBlockedTouch,
}: {
  value: number
  max: number
  step: number
  color: string
  disabled: boolean
  label: string
  onChange: (v: number) => void
  onBlockedTouch: () => void
}) {
  // value > max 인 케이스 (예: 알고리즘이 단일 100% collapse 한 라인을 sheet 에서
  // max=70 으로 제한) 에서 pct 가 100% 를 넘어 thumb 이 viewport 밖으로 빠지는
  // 문제를 막기 위해 0~100 으로 clamp.
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="adj-range-wrap">
      <div className="adj-range-track">
        <div
          className="adj-range-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        aria-label={`${label} 비율`}
        className="adj-range-input"
        onChange={(e) => {
          if (disabled) {
            onBlockedTouch()
            return
          }
          onChange(Number(e.target.value))
        }}
        onMouseDown={(e) => {
          if (disabled) {
            e.preventDefault()
            onBlockedTouch()
          }
        }}
      />
      {!disabled && (
        <div
          className="adj-range-thumb"
          // CSS variable 로 pct 전달 — adjust-sheet.css 가 thumb 반지름만큼
          // 안쪽으로 조정해 0%/100% 에서도 thumb 이 track 안에 완전히 보임.
          style={{ ['--pct' as string]: pct } as React.CSSProperties}
        />
      )}
    </div>
  )
}
