'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { userFacingError } from '@/lib/error-message'
import {
  FOOD_LINE_META,
  ALL_LINES,
  lineDailyGrams,
} from '@/lib/personalization/lines'
import { snapBoxLines } from '@/lib/personalization/boxComposition'
import {
  togglePick as reducePick,
  ratiosFromPicks,
  picksChanged,
  MAX_PICKS,
} from '@/lib/personalization/boxPicks'
import { petName } from '@/lib/korean'
import {
  computeNutrientPanel,
  clinicalCheckForPanel,
} from '@/lib/personalization/nutrientPanel'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { haptic } from '@/lib/haptic'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { trackBoxAdjusted } from '@/lib/analytics'
import { recipeChipOfLine, recipeColorOfLine, recipeNameOfLine, recipeTitleOfLine } from './display'

/**
 * AdjustSheet — 박스에 담을 레시피 고르기.
 *
 * # 2026-07-15 전면 재설계 (사장님 "이 비율 조정 페이지 완전히 잘못됐거든?")
 * 이전엔 5종에 0~70% 슬라이더를 줬는데, **실제 박스는 1종 100% 아니면 2종
 * 50:50 뿐**이다(boxComposition.snapBoxLines). 그래서 보호자가 오리20/연어20/
 * 한우35/흑돼지25 로 맞춰 저장해도 박스는 한우50/흑돼지50 으로 스냅됐다 —
 * UI 가 지키지도 못할 약속을 하고, 화면의 g·kcal·영양 단면이 전부 실제 박스와
 * 다른 숫자였다. 게다가 판매하지도 않는 연어(준비중)가 목록에 있었다.
 *
 * 지금은 박스 그대로를 조작한다: **레시피 2칸을 채운다.**
 *  · 1칸 = 그 레시피 100%
 *  · 2칸 = 각각 50%
 *  · 판매 4종만(연어 제외 — RECIPE_LINES). 알레르기 차단 레시피는 못 고름.
 * 슬라이더·합계 100% 검증·리밸런스가 전부 사라졌다 — 애초에 표현 불가능한
 * 상태를 만들 수 없으니 검증할 것도 없다.
 *
 * # 저장
 * POST /api/personalization/adjust → user_adjusted=true. 보내는 lineRatios 는
 * 이미 스냅된 값(0.5/0.5 또는 1.0)이라 서버 스냅과 화면이 100% 일치한다.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D09): 흰 시트(위 모서리 12) · 회색 면 칸 + 왼쪽 레시피 색 띠 ·
 *   고른 칸 = 먹색 동그라미 체크 · 주 버튼 먹색. 화면 글자에서 비율 %·영양소 %를 뺐다(사장님 결정 목록):
 *   칸 위 "50%" → "반반", 영양 구성 "단백질 49% 이상" → 막대, "kcal/100g" → "100g당 열량".
 *   계산(lineDailyGrams·computeNutrientPanel·저장 값)은 그대로다.
 */

/** 판매 중인 레시피만. 연어(skin)는 준비중 — 사장님 2026-07-13.
 *  표시 순서는 plan 페이지(RECIPE_LINES)와 동일: 치킨·한우·오리·흑돼지. */
const RECIPE_LINES: FoodLine[] = ['weight', 'premium', 'basic', 'joint']

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
  // 추천 = 실제 박스(스냅된 1~2종). 알고리즘 원본 비율이 아니라 이걸 기준으로
  // 해야 시트가 '받는 박스' 카드와 같은 것을 보여준다.
  const recommended: FoodLine[] = useMemo(
    () => snapBoxLines(formula.lineRatios).map((x) => x.line),
    [formula],
  )

  const [picks, setPicks] = useState<FoodLine[]>(recommended)
  const [strategy, setStrategy] = useState<'now' | 'next'>('next')
  const [shakeId, setShakeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  // ★자체 구현 시트에 모달 동작이 비어 있었다 (2026-08-08 a11y 감사).
  //  Esc 미지원·포커스 트랩 없음·배경 Tab 누수·스크롤락 없음 — 결제 금액에
  //  직결되는 시트(분석→박스 구성)가 유일하게 정본(useModalA11y)을 안 썼다.
  useModalA11y({ open, onClose, containerRef: sheetRef })
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

  // open 변경 / formula 변경 → 추천으로 재초기화.
  useEffect(() => {
    if (open) setPicks(recommended)
  }, [open, recommended])

  const ratios = useMemo(() => ratiosFromPicks(picks), [picks])
  const changed = picksChanged(picks, recommended)
  const canSave = picks.length > 0 && !saving

  /** 규칙 판정은 boxPicks(테스트 있음)에 맡기고 여기선 피드백만. */
  function onPick(line: FoodLine) {
    const { picks: next, rejected } = reducePick(picks, line, blocked)
    if (rejected) {
      setShakeId(line)
      haptic('warn')
      setTimeout(() => setShakeId(null), 380)
      return
    }
    haptic('tick')
    setPicks(next)
  }

  function onReset() {
    haptic('tick')
    setPicks(recommended)
  }

  async function onSave() {
    if (!canSave) return
    setSaving(true)
    setErr(null)
    try {
      const lineRatios = ratios
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
        const msg = ('message' in json && json.message) || '저장에 실패했어요'
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
      setErr(
        userFacingError(e, '네트워크가 불안정해요. 다시 시도해 주세요'),
      )
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

  // 칸 위 글자 — 비율 % 대신 말로(사장님 결정 목록: 고객 문구에서 비율 % 빼기). 계산은 아래 pct 그대로.
  const pct = picks.length === 1 ? 100 : 50
  const shareLabel = picks.length === 1 ? '한 가지' : '반반'

  return (
    <>
      <div className="adj-scrim adj-open" onClick={onClose} />
      <div
        ref={sheetRef}
        className="adj-sheet adj-open"
        style={{ transform: `translateY(${dragY}px)` }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adj-title"
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
            <div className="adj-kicker">레시피</div>
            {/* 제목 글꼴은 앱 틀의 h2 규칙이 준다. */}
            <h2 id="adj-title">레시피 고르기</h2>
            <div className="adj-sub">
              {/* 친근형(petName)으로 감싸 받침 유무와 무관히 조사 정확 —
                  모음명 "나우"→"나우의"(기존 "나우이의"✗), 받침명 "푸린"→"푸린이의". */}
              <strong>{petName(dogName)}</strong>의 박스에 담을 화식
            </div>
          </div>
          <button
            type="button"
            className="adj-x"
            onClick={onClose}
            aria-label="닫기"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="adj-body">
          {/* 박스 2칸 — 실제 박스가 이렇게 생겼다. 담긴 것만 보인다. */}
          <div className="adj-slots" aria-label="박스에 담긴 레시피">
            {[0, 1].map((i) => {
              const line = picks[i]
              if (!line) {
                return (
                  <div className="adj-slot empty" key={i}>
                    <span>한 가지 더</span>
                    <small>골라도 되고, 안 골라도 돼요</small>
                  </div>
                )
              }
              const color = recipeColorOfLine(line)
              const name = recipeNameOfLine(line)
              // 제목 = 팩 영어 이름 + 회색 한글 상품 이름(사장님 2026-10-10).
              const title = recipeTitleOfLine(line)
              return (
                <button
                  type="button"
                  className="adj-slot filled ft-no-press"
                  key={i}
                  style={{ ['--c' as string]: color }}
                  onClick={() => onPick(line)}
                  aria-label={`${name} 빼기`}
                >
                  <span className="adj-slot-band" aria-hidden />
                  <span className="adj-slot-pct">{shareLabel}</span>
                  {title.en ? (
                    <>
                      <span className="adj-slot-name adj-en ft-num">{title.en}</span>
                      <small className="adj-slot-ko">{title.ko}</small>
                    </>
                  ) : (
                    <span className="adj-slot-name">{name}</span>
                  )}
                  <small className="adj-slot-amt">
                    {/* 비율은 칼로리에 적용 — 무게를 반반으로 쪼개면 안 된다.
                        레시피마다 kcal/100g 가 달라(115 vs 120) 같은 50%라도
                        무게가 다르다(lineDailyGrams 참고). */}
                    하루 {Math.round(lineDailyGrams(line, pct / 100, formula.dailyKcal))}g ·{' '}
                    {Math.round((formula.dailyKcal * pct) / 100)}kcal
                  </small>
                </button>
              )
            })}
          </div>

          <NutrientLivePreview
            ratios={ratios}
            formula={formula}
            isSenior={isSenior}
            picks={picks}
          />

          {/* 레시피 4종 */}
          <div className="adj-sect-lbl">
            <div className="l">레시피 고르기</div>
            <div className="r">
              최대 {MAX_PICKS}가지 · 2가지면 <b>반반</b>
            </div>
          </div>
          <div className="adj-pick-grid">
            {RECIPE_LINES.map((line) => {
              const meta = FOOD_LINE_META[line]
              const isPicked = picks.includes(line)
              const isBlocked = blocked.has(line)
              const isRec = recommended.includes(line)
              const title = recipeTitleOfLine(line)
              return (
                <button
                  type="button"
                  key={line}
                  className={
                    'adj-pick ft-no-press' +
                    (isPicked ? ' on' : '') +
                    (isBlocked ? ' blocked' : '') +
                    (shakeId === line ? ' shake' : '')
                  }
                  style={{ ['--c' as string]: recipeColorOfLine(line), ['--chip' as string]: recipeChipOfLine(line) }}
                  aria-pressed={isPicked}
                  onClick={() => onPick(line)}
                >
                  <span className="adj-pick-top">
                    <span className="adj-pick-dot" />
                    <span className={title.en ? 'adj-pick-name adj-en ft-num' : 'adj-pick-name'}>{title.en ?? title.ko}</span>
                  </span>
                  {title.en && <span className="adj-pick-ko">{title.ko}</span>}
                  {isPicked && (
                    <span className="adj-pick-check" aria-hidden>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  )}
                  <span className="adj-pick-sub">
                    {isBlocked
                      ? `${meta.blockingAllergies[0] ?? '알레르기'} 때문에 못 담아요`
                      : meta.benefit}
                  </span>
                  {isRec && !isBlocked && (
                    <span className="adj-pick-rec">추천</span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="adj-pick-hint">
            {picks.length >= MAX_PICKS
              ? '2칸이 다 찼어요. 새로 고르면 먼저 담은 게 빠져요.'
              : '한 가지만 담아도 괜찮아요. 두 가지면 반반으로 나눠 담아요.'}
          </p>

          {/* 왜 한 가지를 권하는지 (사장님 2026-07-15). 첫 박스는 알고리즘이 이미
              단일로 추천하지만, 보호자가 2종을 고르려 할 때 이유를 알고 고르게
              한다 — 막지는 않는다.
              ⚠️ 문구 수위: "알레르기를 알 수 있다"까지 가면 과장이다. 진짜 진단은
              8~12주 엄격한 제거식이가 필요하고 우리 박스는 그걸 대체하지 못한다.
              "원인을 좁히기 쉽다" 선에서 멈춘다. */}
          {picks.length === 1 ? (
            <p className="adj-single-note is-good">
              <strong>처음엔 한 가지로 시작하는 게 좋아요.</strong>{' '}
              새 음식에 무른 변이나 가려움 같은 반응이 나타나도, 단백질이 하나면
              원인을 좁히기 쉬워요. 잘 맞는 걸 확인한 다음에 늘려도 늦지 않아요.
            </p>
          ) : (
            <p className="adj-single-note">
              <strong>두 가지를 함께 담으면</strong> 혹시 반응이 나타났을 때 어느
              쪽 때문인지 가리기 어려워요. 아직 화식이 처음이라면 한 가지로
              시작해 보시는 걸 권해요.
            </p>
          )}

          {/* 전환 전략 */}
          <div className="adj-strategy">
            <span className="adj-strategy-t">언제부터</span>
            <span className="l">이 변경을 언제부터 적용할까요?</span>
            <div className="adj-seg" role="radiogroup" aria-label="적용 시점">
              <button
                type="button"
                role="radio"
                aria-checked={strategy === 'next'}
                className={'ft-no-press' + (strategy === 'next' ? ' on' : '')}
                onClick={() => setStrategy('next')}
              >
                다음 박스부터
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={strategy === 'now'}
                className={'ft-no-press' + (strategy === 'now' ? ' on' : '')}
                onClick={() => setStrategy('now')}
              >
                이번 박스 즉시
              </button>
            </div>
          </div>

          {/* footer note */}
          <p className="adj-footer-note">
            <span className="ic" aria-hidden />
            <span>
              직접 고르면 <b>&apos;직접 고른 레시피&apos;</b>로 저장돼요. 다음
              추천을 만들 때 이 선택을 참고해요.
            </span>
          </p>

          {err && (
            <p className="adj-err" role="alert">
              {err}
            </p>
          )}
        </div>

        {/* sticky CTA */}
        <div className="adj-cta-bar">
          <button
            type="button"
            className="adj-ghost"
            onClick={onReset}
            disabled={!changed}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 5v5h5" />
              <path d="M4.5 10A8 8 0 1 1 6 16.5" />
            </svg>
            추천으로
          </button>
          <button
            type="button"
            className="adj-save"
            disabled={!canSave}
            onClick={onSave}
          >
            {saving ? '저장 중...' : '저장'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * 영양 막대의 끝 — 단백질·지방을 **같은 자**로 잰다(시안 D09: 단백질 막대가 지방보다 길다). 끝 값 55 는
 * 4종 비교 화면 단백질 축과 같은 눈금(lib/sku-nutrition-matrix RADAR_AXIS_MAX.protein_pct).
 * 정확한 % 를 글자로 쓰지 않고 막대 길이로만 보여 준다(성분% 노출 금지).
 */
const NUTRIENT_BAR_MAX = 55
const PROTEIN_BAR_MAX = NUTRIENT_BAR_MAX
const FAT_BAR_MAX = NUTRIENT_BAR_MAX

/**
 * 임상 권고 경고 — 엔진 라벨(nutrientPanel)은 운영용 약어·기준 출처(AAFCO·CKD·Ca:P·DM %)가 섞여 있어
 * 고객 화면에선 같은 뜻의 쉬운 말로 바꿔 보여 준다. 판정(clinicalCheckForPanel)은 그대로다.
 */
const WARN_PLAIN: Record<string, string> = {
  'protein-low': '단백질이 기준보다 적은 조합이에요',
  'fat-low': '지방이 기준보다 적은 조합이에요',
  'senior-protein-high': '노령견에게는 단백질이 많은 조합이에요',
  'senior-fat-high': '노령견에게는 지방이 많은 조합이에요',
  'pancreatitis-fat-high': '췌장염이 있는 아이에게는 지방이 많은 조합이에요',
  'large-puppy-ca-p': '자라는 대형견에게는 칼슘이 많은 조합이에요',
  'ca-p-low': '칼슘보다 인이 많은 조합이에요',
  'cardiac-sodium-high': '심장이 약한 아이에게는 나트륨이 많은 조합이에요',
  'ckd-protein-high': '신장이 약한 아이에게는 단백질이 많은 조합이에요',
}

/**
 * 고른 레시피의 영양 단면 + 임상 권고 위반 안내.
 * "이 선택이 영양적으로 어떤 의미" 를 즉시 보여주고, 췌장염 지방 상한 초과 같은
 * 위반이 생기면 경고.
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
  picks,
}: {
  ratios: Record<FoodLine, number>
  formula: Formula
  isSenior?: boolean
  picks: FoodLine[]
}) {
  const panel = useMemo(() => computeNutrientPanel(ratios), [ratios])

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

  const codes = new Set(check.warnings.map((w) => w.code))
  const proteinWord = codes.has('protein-low')
    ? '적음'
    : [...codes].some((c) => c.endsWith('protein-high'))
      ? '많음'
      : '넉넉함'
  const fatWord = codes.has('fat-low')
    ? '적음'
    : [...codes].some((c) => c.endsWith('fat-high'))
      ? '많음'
      : '알맞음'
  const proteinW = Math.max(0, Math.min(100, (panel.proteinPctDM / PROTEIN_BAR_MAX) * 100))
  const fatW = Math.max(0, Math.min(100, (panel.fatPctDM / FAT_BAR_MAX) * 100))

  return (
    <div className="adj-live">
      {/* 담긴 레시피 띠 — 1칸이면 통짜, 2칸이면 반반. */}
      <div
        className="adj-live-bar"
        aria-hidden
        style={{ gridTemplateColumns: picks.map(() => '1fr').join(' ') || '1fr' }}
      >
        {ALL_LINES.map((k) => {
          const v = ratios[k] ?? 0
          if (v === 0) return null
          return <i key={k} style={{ background: recipeColorOfLine(k) }} />
        })}
      </div>
      <div className="adj-live-nutri-label">영양 구성</div>
      {/* 보증성분 규칙(2026-07-18 사장님): 정확한 % 노출 금지 → 막대로만. [[feedback_no_exact_nutrient_percent]] */}
      <div className="adj-live-nutri-grid">
        <span className="k">단백질</span>
        <span className="bar" aria-label={`단백질 ${proteinWord}`}>
          <i style={{ width: `${proteinW}%` }} />
        </span>
        <span className="k">지방</span>
        <span className="bar" aria-label={`지방 ${fatWord}`}>
          <i style={{ width: `${fatW}%` }} />
        </span>
      </div>
      <div className="adj-live-kcal">
        <span>100g당 열량</span>
        <strong>{panel.kcalPer100g}kcal</strong>
      </div>
      {check.warnings.length > 0 && (
        <div className="adj-live-warn" role="note">
          {check.warnings.map((w) => (
            <p key={w.code} className="adj-live-warn-row">
              {WARN_PLAIN[w.code] ?? w.label}
            </p>
          ))}
          <p className="adj-live-warn-foot">이 조합으로 바꾸기 전에 수의사와 한 번 상의해 주세요.</p>
        </div>
      )}
    </div>
  )
}
