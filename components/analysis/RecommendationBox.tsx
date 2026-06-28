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
  ArrowRight,
  Info,
  ChevronDown,
} from 'lucide-react'
import { dailyGramsFromMix } from '@/lib/personalization/lines'
import { transitionLabel } from '@/lib/personalization/format'
import { trackBoxRecommended, trackAnalysisViewed } from '@/lib/analytics'
import type {
  Formula,
  Reasoning,
} from '@/lib/personalization/types'
import AdjustSheet from './AdjustSheet'
import {
  fetchComputedFormula,
  invalidateComputedFormula,
} from '@/lib/personalization/formulaCache'
import './recommendation.css'
import './adjust-sheet.css'

/**
 * RecommendationBox — analysis 페이지 Magazine 레이아웃 안의
 * "정기배송 신청 + 비율조정 + 왜 이 비율" 블록.
 *
 * # 데이터 소스
 * 마운트 시 POST /api/personalization/compute → dog_formulas (cycle=1) 처방
 * fetch 또는 새로 생성 (formulaCache 로 AnalysisView 와 공유).
 *
 * # 표시 영역 (현재 렌더)
 *  - Totals — kcal/일 · 분량 g · 알고리즘 버전 + 전환 급여 가이드
 *  - CTA — 비율 조정(AdjustSheet) / 정기배송 신청
 *  - Reasoning — "왜 이 비율일까요" 접이식 (알고리즘 결정 근거)
 *
 * Hero·Bar·SKU·Toppers·영양카드 등 옛 fb-* 시각은 2026-05-21 Magazine
 * 컴포넌트로 대체되어 제거됨 (정리: 2026-06-27).
 */

type State =
  | { status: 'loading' }
  | { status: 'ready'; formula: Formula }
  | { status: 'no_survey' }
  | { status: 'error'; message: string }

type Scale = '1w' | '2w' | '4w'

/** 전환 전략별 실행 가이드 한 줄 (H6 — formula.transitionStrategy 시각화). */
const TRANSITION_HINT: Record<Formula['transitionStrategy'], string> = {
  aggressive:
    '바로 100% 급여해도 좋아요 — 이미 화식·생식 중이거나 첫 급여라 적응 부담이 낮아요.',
  gradual: '기존 사료와 섞어 2주에 걸쳐 화식 비율을 천천히 늘려 주세요.',
  conservative:
    '소화가 예민하거나 만성질환이 있어요. 4주에 걸쳐 아주 천천히 전환하세요.',
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
  isSenior = false,
}: {
  dogId: string
  dogName: string
  /** 노령기 여부 — AdjustSheet 의 senior 단백/지방 상한 경고에 사용. */
  isSenior?: boolean
}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [scale] = useState<Scale>('1w')
  const [sheetOpen, setSheetOpen] = useState(false)
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (fetchedRef.current === dogId) return
    fetchedRef.current = dogId
    let cancelled = false
    ;(async () => {
      try {
        // 공유 fetch — AnalysisView 와 중복 POST 제거 (audit P0: double-compute).
        const { httpOk, body: json } = await fetchComputedFormula(dogId)
        if (cancelled) return
        if (!httpOk || !('ok' in json) || json.ok !== true) {
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
        setState({
          status: 'ready',
          formula: json.formula,
        })
        // GA4 funnel — care goal 분포 + algorithm version 별 측정.
        trackAnalysisViewed(dogId)
        const goalReason = json.formula.reasoning.find((r) =>
          r.ruleId.startsWith('goal-'),
        )
        const careGoal = goalReason
          ? goalReason.ruleId.replace('goal-', '')
          : null
        trackBoxRecommended({
          dogId,
          cycleNumber: json.formula.cycleNumber,
          careGoal,
          algorithmVersion: json.formula.algorithmVersion,
        })
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : '네트워크가 불안정해요. 다시 시도해 주세요',
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
      <section className="fb-state fb-state-no-survey" style={{ marginTop: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
          맞춤 박스를 받으려면 설문이 필요해요
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--muted)',
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          5분이면 끝나요. {dogName} 맞춤 박스를 바로 추천해 드릴게요.
        </div>
        <a
          href={`/dogs/${dogId}/survey`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '10px 18px',
            background: 'var(--terracotta)',
            color: '#fff',
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          설문 시작하기
          <ArrowRight size={11} strokeWidth={2.4} />
        </a>
      </section>
    )
  }
  if (state.status === 'error') {
    return (
      <section className="fb-state" style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 12, fontWeight: 600 }}>
          박스 추천을 불러오지 못했어요
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--muted)',
            marginBottom: 14,
            fontFamily: 'var(--font-mono), monospace',
          }}
        >
          {state.message}
        </div>
        <button
          type="button"
          onClick={() => {
            // ref 리셋 + state 강제 loading → useEffect 재진입 위해 page reload
            // (가장 단순). production 에선 retry counter 두고 limit 가능.
            if (typeof window !== 'undefined') window.location.reload()
          }}
          style={{
            appearance: 'none',
            border: '1px solid var(--terracotta)',
            background: '#fff',
            color: 'var(--terracotta)',
            padding: '8px 16px',
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          다시 시도
        </button>
      </section>
    )
  }

  return (
    <>
      <RecommendationView
        formula={state.formula}
        dogId={dogId}
        scale={scale}
        onOpenAdjust={() => setSheetOpen(true)}
      />
      <AdjustSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        formula={state.formula}
        dogId={dogId}
        dogName={dogName}
        isSenior={isSenior}
        onSaved={(next) => {
          setState({ status: 'ready', formula: next })
          // 처방이 바뀌었으니 공유 캐시 무효화 — 다음 마운트가 새 결과를 받도록.
          invalidateComputedFormula(dogId)
        }}
      />
    </>
  )
}

function RecommendationView({
  formula,
  dogId,
  scale,
  onOpenAdjust,
}: {
  formula: Formula
  dogId: string
  scale: Scale
  onOpenAdjust: () => void
}) {
  // 1주 / 2주 / 4주 분량 — quantize 잔차 흡수.
  // 2w/4w 가 정기배송 portion (하이브리드/풀 화식) 과 직결.
  // 1w = 7일, 2w = 15일 (반달 portion), 4w = 30일 (한달 풀 portion)
  // — order 페이지 cycleDays 와 일치 (calendar month).
  const days = scale === '1w' ? 7 : scale === '2w' ? 15 : 30
  // 사장님 2026-06-19 "왜 이 비율 공간차지 심해" — 기본 접힘, 탭해서 펼침.
  const [whyOpen, setWhyOpen] = useState(false)
  const totalKcal = useMemo(() => formula.dailyKcal, [formula.dailyKcal])
  /**
   * 라인 mix 기준 실제 일일 화식 g — order 페이지 / compute API 와 동일
   * dailyGramsFromMix 헬퍼 사용 (단일 진실 소스).
   */
  const dailyGramsByMix = useMemo(
    () => dailyGramsFromMix(formula.lineRatios, formula.dailyKcal),
    [formula.lineRatios, formula.dailyKcal],
  )
  const totalGrams = useMemo(
    () => Math.round(dailyGramsByMix * days),
    [dailyGramsByMix, days],
  )

  return (
    <>
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
            <div className="l">
              {scale === '1w' ? '1주' : scale === '2w' ? '2주' : '4주'} 분량
            </div>
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
        {/* 전환 급여 가이드 (H6) — formula.transitionStrategy 시각화. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            marginBottom: 12,
            background: 'rgba(79,106,72,0.08)',
            borderRadius: 8,
            border: '1px solid rgba(79,106,72,0.16)',
          }}
        >
          <Calendar
            size={14}
            strokeWidth={2}
            color="var(--moss, #4f6a48)"
            style={{ marginTop: 1, flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
              전환 급여 · {transitionLabel(formula)}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--muted)',
                marginTop: 2,
                lineHeight: 1.5,
              }}
            >
              {TRANSITION_HINT[formula.transitionStrategy]}
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
            href={`/dogs/${dogId}/order`}
            className="fb-cta-prim"
            style={{ textDecoration: 'none' }}
          >
            정기배송 신청
            <ArrowRight size={14} strokeWidth={2.4} color="#fff" />
          </a>
        </div>
      </div>

      {/* 왜 이 비율(접기) — 정기배송 신청 박스 바로 아래(사장님 2026-06-19). */}
      {formula.reasoning.length > 0 && (
        <div className="fb-reasoning" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="fb-sub-lbl"
            onClick={() => setWhyOpen((v) => !v)}
            aria-expanded={whyOpen}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              font: 'inherit',
              padding: 0,
              margin: 0,
            }}
          >
            <GitBranch size={11} strokeWidth={2} color="var(--muted)" />왜 이 비율일까요
            {formula.userAdjusted && (
              <span className="fb-adj">사용자 조정됨</span>
            )}
            <ChevronDown
              size={14}
              strokeWidth={2.2}
              color="var(--muted)"
              style={{
                marginLeft: 'auto',
                transition: 'transform 200ms',
                transform: whyOpen ? 'rotate(180deg)' : 'none',
              }}
            />
          </button>
          {whyOpen && (
            <>
              <ul className="fb-reason-list" style={{ marginTop: 10 }}>
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
            </>
          )}
        </div>
      )}
    </>
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
