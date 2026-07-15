'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { trackBoxRecommended, trackAnalysisViewed } from '@/lib/analytics'
import { Skeleton } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import type { Formula } from '@/lib/personalization/types'
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
        // 카드 미등록·미결제 row 는 제외 — 배송지까지 갔다가 카드 등록에서
        // 취소하면 구독 row 만 남는데 그건 '이미 구독한' 게 아니다. plan
        // page 의 isFirstBox 판정과 동일 기준(2026-07-14).
        const { data } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('dog_id', dogId)
          .or(
            'billing_key.not.is.null,last_charged_at.not.is.null,total_deliveries.gt.0',
          )
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
    // 스피너 대신 최종(RecommendationView) 형태의 스켈레톤 — 로딩 잔재가 옛
    // 디자인처럼 스쳐 보이지 않고 skeleton→콘텐츠로 매끄럽게 전환(사장님).
    return (
      <div className="fb-totals" aria-busy="true" aria-label={`${dogName} 맞춤 박스 준비 중`}>
        <Skeleton className="h-4 w-40" />
        <div style={{ marginTop: 6 }}>
          <Skeleton className="h-3 w-28" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="w-full h-16" rounded="lg" />
          ))}
        </div>
      </div>
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
        <Link
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
        </Link>
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
  dogId,
  hasSubscription,
  onOpenAdjust,
}: {
  dogId: string
  hasSubscription: boolean
  onOpenAdjust: () => void
}) {
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

      {/* 컴팩트 3분할 — 결과지는 '빠르게 훑는' 화면이라 압축. 자세한 설명은
          플랜(상품) 페이지가 담당(사장님 2026-07-14). */}
      <div className="fb-tier-grid" role="radiogroup" aria-label="화식 비율 선택">
        {FRESH_TIERS.map((t) => {
          const sel = t.key === tier
          return (
            <button
              key={t.key}
              type="button"
              className="fb-tierc"
              data-sel={sel ? 'true' : undefined}
              role="radio"
              aria-checked={sel}
              onClick={() => setTier(t.key)}
            >
              {'badge' in t && t.badge && (
                <span className="fb-tierc-badge">{t.badge}</span>
              )}
              <span className="fb-tierc-name">{t.name}</span>
              <span className="fb-tierc-sub">화식 {t.ratio}%</span>
            </button>
          )
        })}
      </div>
      {/* 선택한 티어의 카피·안내만 한 줄씩 — 컴팩트 유지. */}
      <div className="fb-tierc-desc">{selected.copy}</div>
      {'note' in selected && selected.note && (
        <div className="fb-tier-note" style={{ marginTop: 7 }}>
          <Info
            size={13}
            strokeWidth={2}
            color="var(--terracotta)"
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          {selected.note}
        </div>
      )}

      <div className="fb-cta-row" style={{ marginTop: 16 }}>
        <button type="button" className="fb-cta-ghost" onClick={onOpenAdjust}>
          비율 조정
        </button>
        <Link
          href={`/dogs/${dogId}/plan?fresh=${selected.ratio}`}
          className="fb-cta-prim"
          style={{ textDecoration: 'none' }}
        >
          {ctaLabel}
          <ArrowRight size={14} strokeWidth={2.4} color="#fff" />
        </Link>
      </div>

      {/* 추천 근거는 위 '추천 레시피' 카드(BoxMixCard) 안으로 이동 — 접이식이
          아니라 레시피 바로 밑에서 바로 보이게(사장님 2026-07-14). */}
    </div>
  )
}

