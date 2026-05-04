'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2,
  Calendar,
  Scale,
  Shield,
  Heart,
  Stethoscope,
  Baby,
  AlertCircle,
  Plus,
  Sparkles,
  GitBranch,
  ArrowLeft,
  ArrowRight,
  Drumstick,
  Bird,
  Fish,
  Beef,
  Sprout,
  Info,
} from 'lucide-react'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import { computeNutrientPanel } from '@/lib/personalization/nutrientPanel'
import type {
  Formula,
  FoodLine,
  Reasoning,
} from '@/lib/personalization/types'
import AdjustSheet from './AdjustSheet'
import './recommendation.css'
import './adjust-sheet.css'

/**
 * RecommendationBox — analysis 페이지의 "첫 박스 추천" 섹션.
 *
 * Claude Design 핸드오프 (2026-05-03 result page) 적용 + 사용자 피드백 반영
 * (SKU carousel edge-bleed 제거 → 자연스러운 padding 22px).
 *
 * # 데이터 소스
 * 마운트 시 POST /api/personalization/compute → dog_formulas (cycle=1) 처방
 * fetch 또는 새로 생성. user_adjusted 인 경우 reasoning 의 마지막 priority=9
 * "사용자 조정됨" chip 으로 표시.
 *
 * # 표시 영역
 *  1. Hero — kicker (메인 라인 케어 컨셉) + 강아지 이름 + 1주/4주 toggle
 *  2. Bar viz — 5 라인 + 토퍼 stacked bar (legend 포함)
 *  3. SKU horizontal carousel — 메인 라인 카드들 (0% 라인 제외)
 *  4. Toppers — 야채 / 육류 토퍼 (있을 때만)
 *  5. Reasoning chain — 알고리즘 결정 근거 (input → decision)
 *  6. Totals — kcal / 그램 / 박스 무게 + CTA (주문 / 비율 조정)
 *
 * 비율 조정 sheet 는 placeholder (CTA 'fb-cta-ghost' 클릭 시 toast).
 * 추후 별도 디자인 핸드오프로 확장.
 */

type State =
  | { status: 'loading' }
  | { status: 'ready'; formula: Formula }
  | { status: 'no_survey' }
  | { status: 'error'; message: string }

type Scale = '1w' | '4w'

/** 메인 라인별 한 줄 효능 — UI 카드의 blurb. */
const LINE_BLURBS: Record<FoodLine, string> = {
  basic: '단일 단백원 · 소화 부담 낮음',
  weight: '고단백 · 저지방 · 체중관리',
  skin: '오메가-3 · 항염증 지원',
  premium: '철·아연·B12 풍부',
  joint: 'B1·콜린 풍부 · 인지 기능 지원',
}

/** 메인 라인별 단백질 한국어 라벨 (UI 메타). */
const LINE_PROTEIN_KR: Record<FoodLine, string> = {
  basic: '닭',
  weight: '오리',
  skin: '연어',
  premium: '소',
  joint: '돼지',
}

/** 라인 아이콘 — 정적 분기. React 19 의 static-components 룰 충족. */
function LineIcon({ line, size = 16, strokeWidth = 1.8 }: { line: FoodLine; size?: number; strokeWidth?: number }) {
  switch (line) {
    case 'basic': return <Drumstick size={size} strokeWidth={strokeWidth} />
    case 'weight': return <Bird size={size} strokeWidth={strokeWidth} />
    case 'skin': return <Fish size={size} strokeWidth={strokeWidth} />
    case 'premium': return <Beef size={size} strokeWidth={strokeWidth} />
    case 'joint': return <Sparkles size={size} strokeWidth={strokeWidth} />
  }
}

/** Reasoning ruleId 별 아이콘 — 정적 분기 (static-components 룰). */
function ReasoningIcon({ ruleId, size = 12, strokeWidth = 2, color = 'var(--muted)' }: {
  ruleId: string
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const props = { size, strokeWidth, color }
  if (ruleId.startsWith('allergy-') || ruleId.startsWith('next-allergy-')) return <Shield {...props} />
  if (ruleId.startsWith('age-')) return <Calendar {...props} />
  if (ruleId.startsWith('chronic-')) return <Stethoscope {...props} />
  if (ruleId.startsWith('bcs-')) return <Scale {...props} />
  if (ruleId.startsWith('pregnancy-')) return <Baby {...props} />
  if (ruleId.startsWith('gi-') || ruleId.startsWith('next-stool-')) return <AlertCircle {...props} />
  if (ruleId.startsWith('topper-')) return <Plus {...props} />
  if (ruleId === 'user-adjusted') return <Info {...props} />
  if (ruleId.startsWith('next-coat-') || ruleId.startsWith('next-appetite-')) return <Heart {...props} />
  return <Sparkles {...props} />
}

export default function RecommendationBox({
  dogId,
  dogName,
}: {
  dogId: string
  dogName: string
}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [scale, setScale] = useState<Scale>('1w')
  const [sheetOpen, setSheetOpen] = useState(false)
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (fetchedRef.current === dogId) return
    fetchedRef.current = dogId
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/personalization/compute', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dogId }),
        })
        const json = (await res.json()) as
          | { ok: true; formula: Formula }
          | { ok?: false; code?: string; message?: string }
        if (cancelled) return
        if (!res.ok || !('ok' in json) || json.ok !== true) {
          if ('code' in json && json.code === 'NO_SURVEY') {
            setState({ status: 'no_survey' })
            return
          }
          setState({
            status: 'error',
            message:
              ('message' in json && json.message) ||
              '추천을 불러오지 못했어요',
          })
          return
        }
        setState({ status: 'ready', formula: json.formula })
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : '네트워크 오류',
          })
        }
      }
    })()
    return () => {
      cancelled = true
      // React 19 dev StrictMode 의 mount→unmount→mount 더블 fire 대응:
      // ref 를 그대로 두면 두 번째 mount 가 early return 으로 빠지고
      // 첫 fetch 가 완료돼도 cancelled=true 라 setState 무시 → 영원히 loading.
      // ref 를 리셋해 두 번째 mount 가 새 fetch 를 시작하도록.
      if (fetchedRef.current === dogId) fetchedRef.current = null
    }
  }, [dogId])

  // ── 로딩 / 에러 / no_survey ──
  if (state.status === 'loading') {
    return (
      <section className="fb-state" style={{ marginTop: 24 }}>
        <Loader2
          size={18}
          strokeWidth={2}
          color="var(--terracotta)"
          className="animate-spin"
        />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            {dogName} 맞춤 박스 계산 중
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--muted)',
              marginTop: 1,
              fontFamily: 'var(--font-mono), monospace',
              letterSpacing: 0.04,
            }}
          >
            ALGORITHM v1
          </div>
        </div>
      </section>
    )
  }
  if (state.status === 'no_survey') {
    return (
      <section className="fb-state" style={{ marginTop: 24 }}>
        박스 추천을 받으려면 설문을 먼저 완료해 주세요.
      </section>
    )
  }
  if (state.status === 'error') {
    return (
      <section className="fb-state" style={{ marginTop: 24 }}>
        박스 추천을 불러오지 못했어요. 잠시 후 페이지를 새로고침해 주세요.
      </section>
    )
  }

  return (
    <>
      <RecommendationView
        formula={state.formula}
        dogName={dogName}
        dogId={dogId}
        scale={scale}
        setScale={setScale}
        onOpenAdjust={() => setSheetOpen(true)}
      />
      <AdjustSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        formula={state.formula}
        dogId={dogId}
        dogName={dogName}
        onSaved={(next) => {
          setState({ status: 'ready', formula: next })
        }}
      />
    </>
  )
}

function RecommendationView({
  formula,
  dogName,
  dogId,
  scale,
  setScale,
  onOpenAdjust,
}: {
  formula: Formula
  dogName: string
  dogId: string
  scale: Scale
  setScale: (s: Scale) => void
  onOpenAdjust: () => void
}) {
  // 1주 / 4주 분량 — quantize 잔차 흡수.
  const days = scale === '1w' ? 7 : 28
  const totalKcal = useMemo(() => formula.dailyKcal, [formula.dailyKcal])
  const totalGrams = useMemo(
    () => Math.round(formula.dailyGrams * days),
    [formula.dailyGrams, days],
  )

  const selectedLines = useMemo(
    () =>
      ALL_LINES.filter((line) => formula.lineRatios[line] > 0).sort(
        (a, b) => formula.lineRatios[b] - formula.lineRatios[a],
      ),
    [formula.lineRatios],
  )

  // 메인 라인 — kicker 표시용.
  const mainLine = selectedLines[0]
  const mainMeta = mainLine ? FOOD_LINE_META[mainLine] : null

  // Spec A — 메인 화식 5종 합 = 100% (정량 영양 책임), 토퍼 = 별도 0~30% 보너스.
  // 메인과 토퍼를 같은 100% 안에 끼워 분배하지 않음 (이전 Spec B 잔재 제거).
  const topperTotalPct = Math.round(
    (formula.toppers.protein + formula.toppers.vegetable) * 100,
  )

  // 알고리즘이 0% 처리한 라인 = blocked. reasoning ruleId allergy-* 가 있으면
  // 알레르기 차단 라인으로 추정.
  const blockedLines = useMemo(() => {
    const set = new Set<FoodLine>()
    for (const r of formula.reasoning) {
      const m = r.ruleId.match(/^(?:next-)?allergy-(basic|weight|skin|premium|joint)$/)
      if (m) set.add(m[1] as FoodLine)
    }
    return set
  }, [formula.reasoning])

  return (
    <>
      {/* Hero */}
      <div className="fb-hero" style={{ marginTop: 24 }}>
        <div className="fb-kicker">
          <span className="fb-kicker-dot" />
          {mainMeta
            ? `${mainMeta.name} · ${mainMeta.subtitle.replace(/^[^·]+·\s*/, '')}`
            : '추천 박스'}
        </div>
        <h2 className="fb-h1">
          <span className="fb-name">{dogName}</span>이의
          <br />
          {formula.cycleNumber === 1 ? '첫' : `${formula.cycleNumber}번째`} 박스
        </h2>
        <div className="fb-toggle" role="tablist" aria-label="박스 분량">
          <button
            role="tab"
            aria-selected={scale === '1w'}
            onClick={() => setScale('1w')}
          >
            1주분
          </button>
          <button
            role="tab"
            aria-selected={scale === '4w'}
            onClick={() => setScale('4w')}
          >
            4주분
          </button>
          <i className="fb-toggle-thumb" data-pos={scale} />
        </div>
      </div>

      {/* Bar viz — Spec A: 메인 5종만 stack (합 100%), 토퍼는 카드 아래 별도 섹션. */}
      <div className="fb-bar-wrap">
        <div className="fb-bar-axis">
          <span>메인 화식 5종 100%</span>
          {topperTotalPct > 0 && (
            <span>+ 토퍼 보너스 {topperTotalPct}%</span>
          )}
        </div>
        <div className="fb-bar">
          {selectedLines.map((line) => {
            const pct = Math.round(formula.lineRatios[line] * 100)
            if (pct === 0) return null
            return (
              <span
                key={line}
                className="fb-bar-seg"
                style={{
                  width: `${pct}%`,
                  background: FOOD_LINE_META[line].color,
                }}
                title={`${FOOD_LINE_META[line].name} ${pct}%`}
              />
            )
          })}
        </div>
        <div className="fb-bar-legend">
          {ALL_LINES.map((line) => {
            const pct = Math.round(formula.lineRatios[line] * 100)
            const blocked = blockedLines.has(line)
            const off = pct === 0
            return (
              <div
                key={line}
                className={`fb-leg${off ? ' off' : ''}${blocked ? ' blk' : ''}`}
              >
                <span
                  className="fb-leg-dot"
                  style={{
                    background: off
                      ? 'var(--rule-2)'
                      : FOOD_LINE_META[line].color,
                  }}
                />
                <span className="fb-leg-l">{FOOD_LINE_META[line].name}</span>
                <span className="fb-leg-pct">
                  {blocked ? '차단' : `${pct}%`}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* SKU horizontal carousel */}
      {selectedLines.length > 0 && (
        <div className="fb-sku-scroll" role="region" aria-label="선택된 화식 라인">
          {selectedLines.map((line, i) => {
            const meta = FOOD_LINE_META[line]
            const pct = Math.round(formula.lineRatios[line] * 100)
            const grams = Math.round(formula.lineRatios[line] * totalGrams)
            const kcal = Math.round(formula.lineRatios[line] * totalKcal)
            return (
              <article
                key={line}
                className="fb-sku"
                style={{ ['--sku' as string]: meta.color }}
              >
                <div className="fb-sku-head">
                  <div className="fb-sku-icon">
                    <LineIcon line={line} />
                  </div>
                  <div className="fb-sku-idx">
                    {String(i + 1).padStart(2, '0')} /{' '}
                    {String(selectedLines.length).padStart(2, '0')}
                  </div>
                </div>
                <div className="fb-sku-line">{meta.name}</div>
                <div className="fb-sku-sub">{meta.subtitle}</div>
                <div className="fb-sku-pct">
                  <span className="num">{pct}</span>
                  <small>%</small>
                </div>
                <div className="fb-sku-blurb">{LINE_BLURBS[line]}</div>
                <div className="fb-sku-meta">
                  <div>
                    <span className="l">단백원</span>
                    <span className="v">{LINE_PROTEIN_KR[line]}</span>
                  </div>
                  <div>
                    <span className="l">그램</span>
                    <span className="v">{grams}g</span>
                  </div>
                  <div>
                    <span className="l">kcal</span>
                    <span className="v">{kcal}</span>
                  </div>
                </div>
                <div className="fb-sku-bar">
                  <span style={{ width: `${pct}%` }} />
                </div>
              </article>
            )
          })}
          <div className="fb-sku-end">
            <ArrowLeft size={14} strokeWidth={2} color="var(--muted)" />
            <span>옆으로 스와이프</span>
          </div>
        </div>
      )}

      {/* Toppers */}
      {(formula.toppers.vegetable > 0 || formula.toppers.protein > 0) && (
        <div className="fb-toppers">
          <div className="fb-sub-lbl">
            <Plus size={11} strokeWidth={2.4} color="var(--muted)" />
            동결건조 토퍼
          </div>
          <div className="fb-topper-row">
            {formula.toppers.vegetable > 0 && (
              <VeggieTopper
                pct={Math.round(formula.toppers.vegetable * 100)}
                grams={Math.round(formula.toppers.vegetable * totalGrams)}
              />
            )}
            {formula.toppers.protein > 0 && (
              <MeatTopper
                pct={Math.round(formula.toppers.protein * 100)}
                grams={Math.round(formula.toppers.protein * totalGrams)}
              />
            )}
          </div>
        </div>
      )}

      {/* 영양 단면 — 라인 mix 의 weighted DM% (v1.5+) */}
      <NutrientPanelCard formula={formula} />

      {/* Reasoning */}
      {formula.reasoning.length > 0 && (
        <div className="fb-reasoning">
          <div className="fb-sub-lbl">
            <GitBranch size={11} strokeWidth={2} color="var(--muted)" />왜 이 비율일까요
            {formula.userAdjusted && (
              <span className="fb-adj">사용자 조정됨</span>
            )}
          </div>
          <ul className="fb-reason-list">
            {formula.reasoning.slice(0, 6).map((r, i) => (
              <ReasonRow key={i} reasoning={r} />
            ))}
          </ul>
          {formula.reasoning.length > 6 && (
            <p
              style={{
                fontSize: 10,
                color: 'var(--muted)',
                marginTop: 8,
                textAlign: 'center',
              }}
            >
              +{formula.reasoning.length - 6}개 룰 더 적용됨
            </p>
          )}
        </div>
      )}

      {/* Totals + CTA */}
      <div className="fb-totals">
        <div className="fb-totals-stat">
          <div>
            <div className="l">kcal/일</div>
            <div className="v">
              {totalKcal}
              <small> kcal</small>
            </div>
          </div>
          <div>
            <div className="l">{scale === '1w' ? '1주' : '4주'} 분량</div>
            <div className="v">
              {totalGrams.toLocaleString()}
              <small> g</small>
            </div>
          </div>
          <div>
            <div className="l">알고리즘</div>
            <div
              className="v"
              style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 14 }}
            >
              {formula.algorithmVersion}
            </div>
          </div>
        </div>
        <div className="fb-cta-row">
          <button
            type="button"
            className="fb-cta-ghost"
            onClick={onOpenAdjust}
          >
            비율 조정
          </button>
          <a
            href={`/dogs/${dogId}/analysis`}
            className="fb-cta-prim"
            style={{ textDecoration: 'none' }}
          >
            이 박스 주문하기
            <ArrowRight size={14} strokeWidth={2.4} color="#fff" />
          </a>
        </div>
      </div>
    </>
  )
}

function VeggieTopper({
  pct,
  grams,
}: {
  pct: number
  grams: number
}) {
  return (
    <div className="fb-topper" style={{ ['--sku' as string]: 'var(--moss)' }}>
      <div className="fb-topper-icon">
        <Sprout size={15} strokeWidth={1.8} />
      </div>
      <div className="fb-topper-body">
        <div className="fb-topper-lbl">야채 토퍼</div>
        <div className="fb-topper-sub">동결건조 · 당근·호박</div>
      </div>
      <div className="fb-topper-pct">
        <span className="num">{pct}</span>
        <small>%</small>
        <span className="g">{grams}g</span>
      </div>
    </div>
  )
}

function MeatTopper({ pct, grams }: { pct: number; grams: number }) {
  return (
    <div className="fb-topper" style={{ ['--sku' as string]: '#A86B4A' }}>
      <div className="fb-topper-icon">
        <Drumstick size={15} strokeWidth={1.8} />
      </div>
      <div className="fb-topper-body">
        <div className="fb-topper-lbl">육류 토퍼</div>
        <div className="fb-topper-sub">동결건조 · 닭가슴·연어</div>
      </div>
      <div className="fb-topper-pct">
        <span className="num">{pct}</span>
        <small>%</small>
        <span className="g">{grams}g</span>
      </div>
    </div>
  )
}

function ReasonRow({ reasoning }: { reasoning: Reasoning }) {
  return (
    <li className="fb-reason-row" title={reasoning.action}>
      <div className="fb-reason-from">
        <ReasoningIcon ruleId={reasoning.ruleId} />
        <span>{reasoning.trigger}</span>
      </div>
      <div className="fb-reason-arrow">
        <svg viewBox="0 0 24 8" width="24" height="8" aria-hidden="true">
          <path
            d="M0 4 H20 M16 1 L20 4 L16 7"
            stroke="var(--rule-2)"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="fb-reason-to">
        <span>{reasoning.chipLabel}</span>
        <Info size={11} strokeWidth={2} color="var(--muted)" />
      </div>
    </li>
  )
}

/**
 * 영양 단면 카드 — 라인 mix 의 weighted DM% (단백질/지방/100g 당 kcal,
 * 그리고 admin override 가 있는 경우 Ca/P/Na). 사용자에게 "내 강아지 박스의
 * 영양 균형" 을 직관적으로 보여줌.
 */
function NutrientPanelCard({ formula }: { formula: Formula }) {
  // override 는 v1.4+ admin GUI 가 DB 에 저장. RecommendationBox 는 이미
  // compute API 가 주입한 final formula 의 ratio 만 받아 hardcoded 라인
  // 메타로 panel 산출. (override 적용 결과는 알고리즘 내부에서 이미 처방에
  // 반영됨 — UI 는 lineRatios 만으로도 충분.)
  const panel = computeNutrientPanel(formula.lineRatios)
  const tier = (
    pct: number,
    low: number,
    high: number,
  ): 'low' | 'ok' | 'high' => {
    if (pct < low) return 'low'
    if (pct > high) return 'high'
    return 'ok'
  }
  const proteinTier = tier(panel.proteinPctDM, 18, 35)
  const fatTier = tier(panel.fatPctDM, 5.5, 18)

  return (
    <div className="fb-nutri">
      <div className="fb-sub-lbl">
        <Sparkles size={11} strokeWidth={2.4} color="var(--muted)" />
        영양 단면 · 라인 평균
      </div>
      <div className="fb-nutri-grid">
        <NutriCell
          label="단백질"
          value={`${panel.proteinPctDM}%`}
          subValue="DM"
          tier={proteinTier}
          hint={
            proteinTier === 'low'
              ? 'AAFCO 18% 미만'
              : proteinTier === 'high'
                ? '고단백 (활동량 ↑ 권장)'
                : 'AAFCO 충족'
          }
        />
        <NutriCell
          label="지방"
          value={`${panel.fatPctDM}%`}
          subValue="DM"
          tier={fatTier}
          hint={
            fatTier === 'low'
              ? 'AAFCO 5.5% 미만'
              : fatTier === 'high'
                ? '고지방 — 췌장염견 주의'
                : '안전 범위'
          }
        />
        <NutriCell
          label="kcal/100g"
          value={panel.kcalPer100g.toString()}
          subValue="평균"
          tier="ok"
          hint="박스 분량 기준"
        />
      </div>
      {panel.calciumPctDM !== null &&
        panel.phosphorusPctDM !== null &&
        panel.calciumPhosphorusRatio !== null && (
          <div className="fb-nutri-grid" style={{ marginTop: 6 }}>
            <NutriCell
              label="Ca"
              value={`${panel.calciumPctDM}%`}
              subValue="DM"
              tier="ok"
            />
            <NutriCell
              label="P"
              value={`${panel.phosphorusPctDM}%`}
              subValue="DM"
              tier="ok"
            />
            <NutriCell
              label="Ca:P"
              value={panel.calciumPhosphorusRatio.toFixed(2)}
              subValue="ratio"
              tier={
                panel.calciumPhosphorusRatio > 1.8
                  ? 'high'
                  : panel.calciumPhosphorusRatio < 1.0
                    ? 'low'
                    : 'ok'
              }
              hint={
                panel.calciumPhosphorusRatio > 1.8
                  ? '대형견 puppy 1.8 상한'
                  : '안전 범위'
              }
            />
          </div>
        )}
      {panel.sodiumPctDM !== null && (
        <p className="fb-nutri-foot">
          나트륨 <b>{panel.sodiumPctDM}% DM</b>
          {panel.sodiumPctDM > 0.3 && (
            <span className="fb-nutri-warn">
              {' '}
              · 심장병견 0.3% 권고 초과
            </span>
          )}
        </p>
      )}
    </div>
  )
}

function NutriCell({
  label,
  value,
  subValue,
  tier,
  hint,
}: {
  label: string
  value: string
  subValue?: string
  tier: 'low' | 'ok' | 'high'
  hint?: string
}) {
  const color =
    tier === 'low'
      ? 'var(--muted)'
      : tier === 'high'
        ? 'var(--terracotta)'
        : 'var(--moss)'
  return (
    <div className="fb-nutri-cell">
      <div className="fb-nutri-cell-l">{label}</div>
      <div className="fb-nutri-cell-v">
        <span style={{ color }}>{value}</span>
        {subValue && <small>{subValue}</small>}
      </div>
      {hint && (
        <div className="fb-nutri-cell-hint" style={{ color }}>
          {hint}
        </div>
      )}
    </div>
  )
}
