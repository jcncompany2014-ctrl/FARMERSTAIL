'use client'

import { useEffect, useRef, useState } from 'react'
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
import { trackBoxRecommended, trackAnalysisViewed } from '@/lib/analytics'
import { createClient } from '@/lib/supabase/client'
import type { Formula, Reasoning } from '@/lib/personalization/types'
import AdjustSheet from './AdjustSheet'
import {
  fetchComputedFormula,
  invalidateComputedFormula,
} from '@/lib/personalization/formulaCache'
import './recommendation.css'
import './adjust-sheet.css'

/**
 * RecommendationBox — analysis 페이지 Magazine 레이아웃 안의
 * "화식 비율 선택 + 비율조정 + 시작하기 + 왜 이 비율" 블록.
 *
 * # 데이터 소스
 * 마운트 시 POST /api/personalization/compute → dog_formulas (cycle=1) 처방
 * fetch (formulaCache 로 AnalysisView 와 공유). 별도로 이 강아지의 구독 이력
 * (현재/과거)을 조회해 CTA 문구를 분기한다.
 *
 * # 표시 (2026-07-13 갈아엎기 — 사장님)
 *  - 화식 비율 3택 (곁들임 30 / 반반 60 / 완전 화식 100) — % 수치 대신 가치
 *    소구 카피. 곁들임=추천, 화식 입문 안내. 배송은 무조건 2주마다 고정.
 *  - CTA — 비율 조정(AdjustSheet) / 시작하기. 이 강아지가 첫 박스면 "첫 박스
 *    시작하기", 이미/과거 구독이면 "이 박스로 시작하기" (강아지별 판단).
 *  - Reasoning — "왜 이 비율일까요" 접이식.
 *
 * 옛 표시(kcal/분량/알고리즘 totals·전환 급여 가이드)는 제거 — 하루 g·kcal 는
 * 위 BoxMixCard 가 담당, 알고리즘 버전·전환 문구는 사장님 지시로 노출 중단.
 */

type State =
  | { status: 'loading' }
  | { status: 'ready'; formula: Formula }
  | { status: 'no_survey' }
  | { status: 'error'; message: string }

/** 화식 비율 3택 — % 수치 대신 이름 + 가치 소구 카피(사장님 확정 2026-07-13). */
const FRESH_TIERS = [
  {
    key: 'light',
    name: '곁들임',
    ratio: 30,
    badge: '추천',
    copy: '작은 비용으로 떼는 첫걸음, 기호성과 영양을 더해요',
    note: '화식이 처음이라면, 익숙해질 때까지 건사료와 섞어 급여하는 걸 권장해요',
  },
  {
    key: 'half',
    name: '반반',
    ratio: 60,
    copy: '화식 반 사료 반, 부담은 낮추고 균형은 챙겨요',
  },
  {
    key: 'full',
    name: '완전 화식',
    ratio: 100,
    copy: '매일 그릇 가득, 완벽한 영양과 행복을 담아요',
  },
] as const

type TierKey = (typeof FRESH_TIERS)[number]['key']

/** Reasoning ruleId 별 아이콘 — 정적 분기 (static-components 룰). */
function ReasoningIcon({
  ruleId,
  size = 12,
  strokeWidth = 2,
  color = 'var(--muted)',
}: {
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
  const [sheetOpen, setSheetOpen] = useState(false)
  // 이 강아지 구독 이력(현재/과거) — CTA 문구 분기. null = 조회 전(기본 '첫 박스').
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null)
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
              ('message' in json && json.message) || '추천을 불러오지 못했어요',
          })
          return
        }
        setState({ status: 'ready', formula: json.formula })
        // GA4 funnel — care goal 분포 + algorithm version 별 측정(내부 계측 유지).
        trackAnalysisViewed(dogId)
        const goalReason = json.formula.reasoning.find((r) =>
          r.ruleId.startsWith('goal-'),
        )
        const careGoal = goalReason ? goalReason.ruleId.replace('goal-', '') : null
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
            message:
              e instanceof Error
                ? e.message
                : '네트워크가 불안정해요. 다시 시도해 주세요',
          })
        }
      }
    })()
    return () => {
      cancelled = true
      // React 19 dev StrictMode 더블 fire 대응 (기존 주석 참조).
      if (fetchedRef.current === dogId) fetchedRef.current = null
    }
  }, [dogId])

  // 구독 이력 조회 — 상태 필터 없이(과거 취소분 포함) 이 강아지에 구독이 하나라도
  // 있었으면 '이 박스로 시작하기'. RLS 로 본인 소유 행만 보이므로 dog_id 만으로 충분.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('dog_id', dogId)
          .limit(1)
        if (!cancelled) setHasSubscription((data?.length ?? 0) > 0)
      } catch {
        if (!cancelled) setHasSubscription(false)
      }
    })()
    return () => {
      cancelled = true
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
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          {dogName} 맞춤 박스 준비 중
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
        hasSubscription={hasSubscription === true}
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
          invalidateComputedFormula(dogId)
        }}
      />
    </>
  )
}

function RecommendationView({
  formula,
  dogId,
  hasSubscription,
  onOpenAdjust,
}: {
  formula: Formula
  dogId: string
  hasSubscription: boolean
  onOpenAdjust: () => void
}) {
  // 사장님 2026-06-19 "왜 이 비율 공간차지 심해" — 기본 접힘, 탭해서 펼침.
  const [whyOpen, setWhyOpen] = useState(false)
  const [tier, setTier] = useState<TierKey>('light')
  const selected = FRESH_TIERS.find((t) => t.key === tier) ?? FRESH_TIERS[0]
  const ctaLabel = hasSubscription ? '이 박스로 시작하기' : '첫 박스 시작하기'

  return (
    <div className="fb-totals">
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
        얼마나 화식으로 드릴까요?
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--muted)',
          marginTop: 2,
          marginBottom: 12,
        }}
      >
        2주마다 정기배송으로 문 앞까지
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FRESH_TIERS.map((t) => {
          const sel = t.key === tier
          return (
            <button
              key={t.key}
              type="button"
              className="fb-tier"
              data-sel={sel ? 'true' : undefined}
              aria-pressed={sel}
              onClick={() => setTier(t.key)}
            >
              <div className="fb-tier-head">
                <span className="fb-tier-name">{t.name}</span>
                {'badge' in t && t.badge && (
                  <span className="fb-tier-badge">{t.badge}</span>
                )}
              </div>
              <div className="fb-tier-copy">{t.copy}</div>
              {'note' in t && t.note && (
                <div className="fb-tier-note">
                  <Info
                    size={13}
                    strokeWidth={2}
                    color="var(--terracotta)"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  />
                  {t.note}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="fb-cta-row" style={{ marginTop: 16 }}>
        <button type="button" className="fb-cta-ghost" onClick={onOpenAdjust}>
          비율 조정
        </button>
        <a
          href={`/dogs/${dogId}/order?fresh=${selected.ratio}`}
          className="fb-cta-prim"
          style={{ textDecoration: 'none' }}
        >
          {ctaLabel}
          <ArrowRight size={14} strokeWidth={2.4} color="#fff" />
        </a>
      </div>

      {/* 왜 이 비율(접기) */}
      {formula.reasoning.length > 0 && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 13,
            borderTop: '1px solid var(--rule)',
          }}
        >
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
            {formula.userAdjusted && <span className="fb-adj">사용자 조정됨</span>}
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
