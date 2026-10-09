'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { userFacingError } from '@/lib/error-message'
import Link from 'next/link'
import { business } from '@/lib/business'
import { trackBoxRecommended, trackAnalysisViewed } from '@/lib/analytics'
import { Skeleton } from '@/components/ui/Skeleton'
import { createClient } from '@/lib/supabase/client'
import type { Formula } from '@/lib/personalization/types'
import { petName } from '@/lib/korean'
import AdjustSheet from './AdjustSheet'
import {
  fetchComputedFormula,
  invalidateComputedFormula,
} from '@/lib/personalization/formulaCache'
import {
  FRESH_TIERS,
  type FreshTierKey,
} from '@/lib/subscription/freshTier'
import './recommendation.css'
import './adjust-sheet.css'

/**
 * RecommendationBox — analysis 페이지 Magazine 레이아웃 안의
 * "화식 비율 선택 + 레시피 고르기 + 시작하기" 블록.
 *
 * # 데이터 소스
 * 마운트 시 POST /api/personalization/compute → dog_formulas (cycle=1) 처방
 * fetch (formulaCache 로 AnalysisView 와 공유). 별도로 이 강아지의 구독 이력
 * (현재/과거)을 조회해 CTA 문구를 분기한다.
 *
 * # 표시 (2026-07-13 갈아엎기 — 사장님)
 *  - 화식 비율 3택 (곁들임 30 / 반반 50 / 완전 화식 100) — % 수치 대신 가치
 *    소구 카피. 곁들임=추천, 화식 입문 안내. 배송은 무조건 2주마다 고정.
 *  - CTA — 레시피 고르기(AdjustSheet) / 시작하기. 이 강아지가 첫 박스면 "첫 박스
 *    시작하기", 이미/과거 구독이면 "이 박스로 시작하기" (강아지별 판단).
 *
 * 옛 표시(kcal/분량/알고리즘 totals·전환 급여 가이드)는 제거 — 하루 g·kcal 는
 * 위 BoxMixCard 가 담당, 알고리즘 버전·전환 문구는 사장님 지시로 노출 중단.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08·I06·I07):
 *  - 회색 면 + 왼쪽 6px 머스타드 띠 카드. 비율 3칸은 네모 버튼(고른 것 = 먹색), "추천" 배지는 윗선 한가운데.
 *    칸 아래 "화식 30%" 같은 비율 %는 뺐다(고객 문구에서 비율 % 금지).
 *  - '비율 조정' 버튼 이름 → 열리는 창 이름과 같은 '레시피 고르기'(사장님 결정 12).
 *  - 이미 구독 중이면 '시작하기'를 숨긴다(사장님 결정 11) — 처방 응답의 subscribedLocked(AnalysisView 가 hideStart 로
 *    넘김) 또는 이 강아지의 살아 있는 구독(status active·paused, 아래 hasLive 조회)이 있을 때. 주문 화면도 같은
 *    기준으로 새 신청을 막는다.
 *  - 그리는 부분은 RecommendationPanel 로 나눴다 — 점검 화면(/design-check/analysis)이 상태별로 예시 값을 넣어 본다.
 *    불러오기·저장 로직은 이 컨테이너에 그대로다.
 */

export type RecommendationState =
  | { status: 'loading' }
  | { status: 'ready'; formula: Formula }
  | { status: 'no_survey' }
  | { status: 'consultation'; reason: string }
  | { status: 'error'; message: string }

/** 화식 비율 3택 — % 수치 대신 이름 + 가치 소구 카피(사장님 확정 2026-07-13). */
// 티어 정의는 정본 lib/subscription/freshTier (FRESH_TIERS). 3화면 공유.
type TierKey = FreshTierKey

/** 분석 페이지 → 플랜 고르기 카드로 바로 내려가는 주소 값(`?focus=plan`). lib/payments/trial-notify 와 공유. */
const PLAN_FOCUS_PARAM = 'plan'

export default function RecommendationBox({
  dogId,
  dogName,
  isSenior = false,
  hideStart = false,
}: {
  dogId: string
  dogName: string
  /** 노령기 여부 — AdjustSheet 의 senior 단백/지방 상한 경고에 사용. */
  isSenior?: boolean
  /** 이미 구독 중 — '시작하기' 버튼을 숨긴다(사장님 결정 11). */
  hideStart?: boolean
}) {
  const [state, setState] = useState<RecommendationState>({ status: 'loading' })
  const [sheetOpen, setSheetOpen] = useState(false)
  // 이 강아지 구독 이력(현재/과거) — CTA 문구 분기. null = 조회 전(기본 '첫 박스').
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null)
  // 지금 살아 있는 구독(진행 중·일시정지 — 카드 등록 전 포함)이 있나 — 있으면 '시작하기'를 숨긴다(사장님 결정 11).
  //   주문 화면이 같은 기준(active·paused)으로 새 신청을 막으므로, 보여 주면 눌러도 "이미 있어요"로 끝나는 버튼이다.
  //   조회가 실패하면 false 그대로 — 예전처럼 버튼이 보인다(막다른 길보다 낫다).
  const [hasLive, setHasLive] = useState(false)
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
        // 안전 게이트 — 판매 레시피가 전부 알레르기면 박스 대신 상담 안내.
        if (json.needsConsultation) {
          setState({
            status: 'consultation',
            reason:
              json.consultationReason ??
              '입력하신 알레르기로 지금 판매하는 레시피가 모두 제외됐어요. 맞춤 상담을 도와드릴게요.',
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
              userFacingError(e, '네트워크가 불안정해요. 다시 시도해 주세요'),
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
        // 살아 있는 구독 — 상태만 본다(읽기 전용, 결정 11). 오류면 그대로 둔다.
        const { data: live, error: liveErr } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('dog_id', dogId)
          .in('status', ['active', 'paused'])
          .limit(1)
        if (!cancelled && !liveErr) setHasLive((live?.length ?? 0) > 0)
      } catch {
        if (!cancelled) setHasSubscription(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dogId])

  return (
    <>
      <RecommendationPanel
        state={state}
        dogId={dogId}
        dogName={dogName}
        hasSubscription={hasSubscription === true}
        hideStart={hideStart || hasLive}
        onOpenAdjust={() => setSheetOpen(true)}
      />
      {state.status === 'ready' && (
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
      )}
    </>
  )
}

/** 카드 겉틀 — 회색 면 + 왼쪽 6px 머스타드 띠(시안 D08·I06). */
function CardFrame({
  label,
  children,
  extra,
}: {
  label: string
  children: ReactNode
  extra?: { id?: string; ref?: React.Ref<HTMLElement>; busy?: boolean; consult?: boolean }
}) {
  return (
    <section
      id={extra?.id}
      ref={extra?.ref}
      aria-label={label}
      aria-busy={extra?.busy || undefined}
      className={extra?.consult ? 'fb-totals fb-consult' : 'fb-totals'}
    >
      {children}
    </section>
  )
}

/**
 * 그리는 부분 — 상태별 카드. 데이터·저장은 위 컨테이너(RecommendationBox)가 맡는다.
 * 점검 화면이 상태마다 예시 값을 넣어 쓴다.
 */
export function RecommendationPanel({
  state,
  dogId,
  dogName,
  hasSubscription,
  hideStart = false,
  onOpenAdjust,
}: {
  state: RecommendationState
  dogId: string
  dogName: string
  hasSubscription: boolean
  hideStart?: boolean
  onOpenAdjust: () => void
}) {
  // ── 로딩 / 에러 / no_survey ──
  if (state.status === 'loading') {
    // 스피너 대신 최종(RecommendationView) 형태의 스켈레톤 — 로딩 잔재가 옛
    // 디자인처럼 스쳐 보이지 않고 skeleton→콘텐츠로 매끄럽게 전환(사장님).
    return (
      <CardFrame label={`${dogName} 맞춤 박스 준비 중`} extra={{ busy: true }}>
        <Skeleton className="h-5 w-48" rounded="sm" />
        <div style={{ marginTop: 8 }}>
          <Skeleton className="h-4 w-36" rounded="sm" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 14 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="w-full h-[60px]" rounded="sm" />
          ))}
        </div>
      </CardFrame>
    )
  }
  if (state.status === 'no_survey') {
    return (
      <CardFrame label="설문 안내">
        <span className="fb-card-title">맞춤 박스를 받으려면 설문이 필요해요</span>
        {/* "5분이면 끝나요" → 시작 화면과 같은 "2분이면 돼요"(사장님 결정 목록 — 문구가 서로 달랐다). */}
        <p className="fb-card-body">
          2분이면 돼요. {petName(dogName)} 맞춤 박스를 바로 추천해 드릴게요.
        </p>
        <Link href={`/dogs/${dogId}/survey`} className="fb-cta-prim" style={{ marginTop: 14 }}>
          설문 시작하기
        </Link>
      </CardFrame>
    )
  }
  // 안전 게이트 — 판매 레시피가 전부 알레르기라 자동 추천 불가 → 상담 안내.
  if (state.status === 'consultation') {
    return (
      <CardFrame label="상담 안내" extra={{ consult: true }}>
        <span className="fb-card-kicker">맞춤 박스 추천</span>
        <h2 className="fb-card-heading">
          {petName(dogName)} 맞춤 추천은
          <br />
          상담이 필요해요
        </h2>
        {/* 서버 안내(consultationReason)는 "…맞춤 상담을 도와드릴게요"로 끝나서, 뒤에 붙이던
            "…함께 찾아드릴게요"와 같은 말을 두 번 했다(사장님 결정 목록). 상담 게이트는 알레르기 한 경우뿐이라
            (lib/personalization/v3/engine) 시안 문장 하나로 말한다. */}
        <p className="fb-card-body">
          입력하신 알레르기로 지금 판매하는 레시피가 모두 빠졌어요. 알레르기를 피하면서도 잘 맞는 레시피를 함께
          찾아드릴게요.
        </p>
        {business.kakaoChannelUrl && (
          <a
            href={business.kakaoChannelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fb-cta-kakao"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#191919"
                d="M12 4C6.9 4 3 7.2 3 11.1c0 2.5 1.6 4.7 4.1 5.9l-.9 3.3c-.1.3.3.6.6.4l3.9-2.6c.4 0 .9.1 1.3.1 5.1 0 9-3.2 9-7.1S17.1 4 12 4z"
              />
            </svg>
            카카오톡으로 문의하기
          </a>
        )}
      </CardFrame>
    )
  }
  if (state.status === 'error') {
    return (
      <section aria-label="추천 불러오기 실패" className="fb-state">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#595959" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z" />
          <path d="M9.5 12.5l5 5M14.5 12.5l-5 5" stroke="#C63D2A" />
        </svg>
        <p className="fb-state-title">박스 추천을 불러오지 못했어요</p>
        <p className="fb-state-body">{state.message}</p>
        <button
          type="button"
          className="fb-cta-prim"
          style={{ marginTop: 14, alignSelf: 'stretch' }}
          onClick={() => {
            if (typeof window !== 'undefined') window.location.reload()
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 12a8 8 0 1 1-2.3-5.6" />
            <path d="M20 4v4.5h-4.5" />
          </svg>
          다시 시도
        </button>
      </section>
    )
  }

  return (
    <RecommendationView
      dogId={dogId}
      hasSubscription={hasSubscription}
      hideStart={hideStart}
      onOpenAdjust={onOpenAdjust}
    />
  )
}

function RecommendationView({
  dogId,
  hasSubscription,
  hideStart,
  onOpenAdjust,
}: {
  dogId: string
  hasSubscription: boolean
  hideStart: boolean
  onOpenAdjust: () => void
}) {
  const [tier, setTier] = useState<TierKey>('light')
  const selected = FRESH_TIERS.find((t) => t.key === tier) ?? FRESH_TIERS[0]
  const ctaLabel = hasSubscription ? '이 박스로 시작하기' : '첫 박스 시작하기'

  // 알림에서 바로 플랜 고르기로 — `?focus=plan` 으로 들어오면 이 카드로 내려간다(체험단 도장
  // 알림 "카드 등록해 주세요", 2026-10-01). 추천 박스는 페이지가 뜬 뒤 따로 불러오므로 해시(#)로는
  // 못 간다 — 카드가 그려진 이 시점에 한 번만 스크롤한다.
  const rootRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('focus') !== PLAN_FOCUS_PARAM) return
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  return (
    <CardFrame label="화식 양 고르기" extra={{ id: 'plan-select', ref: rootRef }}>
      {/* h2 는 앱 틀에서 제목 글꼴이 된다 — 이 카드 제목은 본문 굵은 글자(시안)라 h3. */}
      <h3 className="fb-card-q">얼마나 화식으로 드릴까요?</h3>
      <span className="fb-card-sub">2주마다 정기배송으로 문 앞까지</span>

      {/* 컴팩트 3분할 — 결과지는 '빠르게 훑는' 화면이라 압축. 자세한 설명은
          플랜(상품) 페이지가 담당(사장님 2026-07-14). */}
      <div className="fb-tier-grid" role="radiogroup" aria-label="화식 양 선택">
        {FRESH_TIERS.map((t) => {
          const sel = t.key === tier
          return (
            <button
              key={t.key}
              type="button"
              className="fb-tierc ft-no-press"
              data-sel={sel ? 'true' : undefined}
              role="radio"
              aria-checked={sel}
              onClick={() => setTier(t.key)}
            >
              {'badge' in t && t.badge && (
                <span className="fb-tierc-badge">{t.badge}</span>
              )}
              <span className="fb-tierc-name">{t.label}</span>
            </button>
          )
        })}
      </div>
      {/* 선택한 티어의 카피·안내만 한 줄씩 — 컴팩트 유지. */}
      <p className="fb-tierc-desc">{selected.copy}</p>
      {'note' in selected && selected.note && (
        <p className="fb-tier-note">
          <span aria-hidden className="fb-tier-note-dot" />
          {selected.note}
        </p>
      )}

      <div className="fb-cta-col">
        {!hideStart && (
          <Link href={`/dogs/${dogId}/plan?fresh=${selected.ratio}`} className="fb-cta-prim" data-tour="plan">
            {ctaLabel}
            <span aria-hidden>→</span>
          </Link>
        )}
        <button type="button" className="fb-cta-ghost" onClick={onOpenAdjust}>
          레시피 고르기
        </button>
      </div>

      {/* 추천 근거는 위 '추천 레시피' 카드(BoxMixCard) 안으로 이동 — 접이식이
          아니라 레시피 바로 밑에서 바로 보이게(사장님 2026-07-14). */}
    </CardFrame>
  )
}
