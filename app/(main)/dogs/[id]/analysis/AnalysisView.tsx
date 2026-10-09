'use client'

/**
 * 분석 결과 화면(/dogs/[id]/analysis · 지난 분석 /dogs/[id]/analyses/[analysisId]).
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08·A01·A02·A07·I06·I07):
 *   그리는 부분을 AnalysisResultView 로 나눴다(같은 파일) — 데이터 불러오기·판정은 AnalysisView 그대로.
 *   점검 화면(/design-check/analysis, 미리보기 전용)이 같은 화면에 예시 값을 넣어 로그인 없이 시안과 나란히 본다.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import ResultTour from '@/components/v3/tour/ResultTour'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { fetchComputedFormula } from '@/lib/personalization/formulaCache'
import { weightReliability } from '@/lib/personalization/reliability'
import type { BoxMixItem as MagBoxMixItem } from '@/components/analysis/magazine/BoxMixCard'
import {
  merConfidenceInterval,
} from '@/lib/nutrition/confidence-interval'
import {
  riskFlagLabel,
  riskFlagTerm,
  riskFlagDesc,
  riskFlagSeverity,
} from '@/lib/nutrition/risk-flags'
import { FOOD_LINE_META, lineDailyGrams } from '@/lib/personalization/lines'
import { snapBoxLines } from '@/lib/personalization/boxComposition'
import type { Formula, Reasoning } from '@/lib/personalization/types'
import {
  weightFromRER,
  formatAgeLabel,
} from '@/lib/v3-helpers/analysis-view'
import { analysisDateText, bodyShape, recipeNameOfLine } from '@/components/analysis/display'
import { V3 } from '@/lib/design/tokens'
import AnalysisEmptyState from './_components/AnalysisEmptyState'
import AnalysisStickySummary from './_components/AnalysisStickySummary'
import AnalysisArchiveBanner from './_components/AnalysisArchiveBanner'
import AnalysisMagazineSection from './_components/AnalysisMagazineSection'
import AnalysisLoading from './loading'
import { optionalSkipped } from '@/lib/survey/refine'
import AiCommentCard from '@/components/v3/AiCommentCard'
import AnalysisCTASection from './_components/AnalysisCTASection'
import VetShareButton from '@/components/VetShareButton'
import { PANCREATITIS_GATE_COPY } from '@/lib/personalization/plain-reason'

type Analysis = {
  id: string
  /** 이 분석을 만든 설문 행 — 결과 화면 "정확도 올리기" 판정용(select('*') 라 런타임엔 있다). */
  survey_id?: string | null
  mer: number
  rer: number
  factor: number
  stage: string
  bcs_label: string
  bcs_score: number
  protein_pct: number
  protein_g: number
  fat_pct: number
  fat_g: number
  carb_pct: number
  carb_g: number
  fiber_pct: number
  fiber_g: number
  feed_g: number
  ca_p_ratio: number
  supplements: string[]
  commentary: string | null
  created_at: string
  // v2 추가
  risk_flags?: string[] | null
  vet_consult_recommended?: boolean | null
  next_review_date?: string | null
  guideline_version?: string | null
  // 칼로리 v2 6단계 — 계수 사다리 (과거 분석은 null)
  factor_breakdown?: { label: string; delta: number }[] | null
  // AI 코멘트 캐시 (2026-07-16) — structured 라우트가 채운 JSON. 없으면 카드가 fetch.
  structured_analysis?: { summary?: string; nextActions?: string[] } | null
}

type Dog = {
  id: string
  name: string
  breed: string | null
  birth_date: string | null
  age_value: number | null
  age_unit: string | null
  photo_url: string | null
  // 분석 카드에 표시할 실제 등록 체중. RER 역산(weightFromRER)은 70·W^0.75 를
  // 뒤집는데 computeRer 가 토이견(<2kg)에 다른 식을 써서 역산이 부정확하다.
  weight: number | null
  // H5: MER 신뢰구간을 실제 체중 측정 신뢰도로 산정하기 위해 추가.
  weight_method: string | null
  weight_measured_at: string | null
}

/** 처방(추천 박스) 불러오기 결과 — 추천 레시피 카드를 그릴지 정한다(그리기 판단만). */
type RecOutcome = 'loading' | 'ready' | 'consult' | 'failed'

export default function AnalysisView({
  dogId,
  analysisId,
  surveyBlocked,
  refineBlocked = false,
}: {
  dogId: string
  /** When set, load this specific historical analysis instead of the latest. */
  analysisId?: string
  /**
   * R80-P1: survey 30일 가드로 redirect 된 경우 남은 일수 (1-30).
   * useEffect 에서 1회 toast 표시 후 URL 정리.
   */
  surveyBlocked?: boolean
  /** "정확도 올리기"(?refine=1)가 월 한도에 막혀 돌아온 경우 — 카드를 숨기고 문구를 바꾼다. */
  refineBlocked?: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  // R80-P1: 30일 가드 안내 toast — server page 에서 prop 으로 받음.
  // mount 직후 1회만, URL 의 from/days query 제거해 새로고침 시 재발 X.
  // 사장님 2026-06-19: 토스트가 2번 떴음 → ref 가드로 이중 발화(StrictMode·재마운트) 차단.
  const blockedToastShownRef = useRef(false)
  useEffect(() => {
    if (!surveyBlocked) return
    if (blockedToastShownRef.current) return
    blockedToastShownRef.current = true
    toast.info(
      refineBlocked
        ? '추가 답변도 재분석으로 계산돼요. 이번 달 재분석 3회를 모두 써서 다음 달에 이어서 답할 수 있어요. 체중이나 건강 정보가 바뀌었다면 바로 다시 분석할 수 있어요.'
        : '이번 달 재분석 3회를 모두 사용했어요. 다음 달에 다시 할 수 있어요. 체중이나 건강 정보가 바뀌었다면, 정보를 고친 뒤 바로 다시 분석할 수 있어요.',
    )
    // URL 정리
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('from')
      url.searchParams.delete('days')
      window.history.replaceState({}, '', url.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [dog, setDog] = useState<Dog | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  // 실패를 "결과 없음"으로 위장하지 않기 위한 상태(2026-08-05).
  const [loadError, setLoadError] = useState(false)
  // 설문 v4 — 마지막 설문이 선택 묶음을 건너뛰었으면 "정확도 올리기" 카드(lib/survey/refine).
  const [canRefine, setCanRefine] = useState(false)
  // 2026-05-21: Magazine BoxMixCard 를 실제 추천 알고리즘과 연동.
  // RecommendationBox 도 자체 fetch 중이라 중복 호출이지만 첫 박스 시점
  // formula 는 deterministic — 가벼운 작업이라 두 번 호출 허용.
  const [formula, setFormula] = useState<Formula | null>(null)
  // formula fetch 진행중 플래그 — 박스가 '가짜 placeholder → 진짜'로 튀는 대신
  // 로딩 스켈레톤을 보이게.
  const [formulaLoading, setFormulaLoading] = useState(true)
  // 같은 응답으로 추천 레시피 카드를 그릴지 정한다 — 실패·상담이면 카드 대신 RecommendationBox 의 안내 카드만
  // (2026-10-09, 시안 I06·I07). 예전엔 실패해도 임시 자리채움(오리+한우)이 '추천 레시피'로 그려졌다.
  const [recOutcome, setRecOutcome] = useState<RecOutcome>('loading')
  // 구독 중 재설문 — 적용 중 레시피를 지켰다는 신호(2026-09-25). 안내 한 줄을 붙인다.
  // ★2026-10-09 사장님 결정 11: 이 신호가 있으면 이미 구독 중이라 '시작하기'·'정기배송 신청하기'를 숨긴다.
  //   (이 화면이 확실히 아는 구독 신호는 이것뿐 — 더 넓히려면 구독 조회가 상태를 같이 읽어야 한다. 보고서 참고.)
  const [subscribedLocked, setSubscribedLocked] = useState(false)
  // Legacy commentary fetch 는 StructuredAnalysis v2 가 대체. 상태 변수는 제거.

  // R37b — 설문에서 넘어온 직후 (?fromSurvey=1) 스크롤 위치 reset.
  // 라우터 캐시로 인해 이전 페이지의 스크롤 위치가 유지될 수 있음. 결과
  // 페이지는 항상 top 부터 — 사용자 경험상 처음부터 읽도록.
  // 설문 직후(fromSurvey)는 AppChrome 이 헤더·탭을 숨기는 focusMode(R36)라
  // 이 화면 스스로 출구를 제공해야 한다 — 없으면 구독 CTA 외엔 나갈 길이 없는
  // 함정이 된다(앱은 엣지 스와이프 뒤로가기도 막혀 있다. 2026-09-02 사장님 실발생).
  const [fromSurvey, setFromSurvey] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    if (q.get('fromSurvey') === '1') {
      setFromSurvey(true)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [])

  // 설문 완료 포인트 토스트 제거 (2026-07-16 포인트 전면 폐기) — 적립 자체가
  // 없어졌으니 표시할 것도 없다. 혜택은 자동할인으로 통일.

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 추이 카드 제거(2026-07-14) 후엔 **타깃 1행 + 총건수**만 있으면 된다. 예전엔
      // select('*') limit 50 으로 대형 JSON 컬럼(structured_analysis 등)을 최대 50행
      // 끌어오고, dog→analyses 를 순차 await 했다. dog·타깃·카운트를 병렬로 묶고
      // 타깃 1행만 전체 select 한다(2026-07-17 perf).
      const targetQuery = analysisId
        ? supabase
            .from('analyses')
            .select('*')
            .eq('id', analysisId)
            .eq('dog_id', dogId)
            .eq('user_id', user.id)
            .maybeSingle()
        : supabase
            .from('analyses')
            .select('*')
            .eq('dog_id', dogId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

      const [{ data: dogData }, { data: target }, { count }] = await Promise.all([
        supabase
          .from('dogs')
          .select(
            'id, name, breed, birth_date, age_value, age_unit, photo_url, weight, weight_method, weight_measured_at',
          )
          .eq('id', dogId)
          .eq('user_id', user.id)
          .maybeSingle(),
        targetQuery,
        supabase
          .from('analyses')
          .select('id', { count: 'exact', head: true })
          .eq('dog_id', dogId)
          .eq('user_id', user.id),
      ])

      if (!dogData) {
        router.push('/dogs')
        return
      }
      setDog(dogData)

      if (!target) {
        setLoading(false)
        return
      }

      setTotalCount(count ?? 0)
      // audit #79: generated analyses row 와 도메인 Analysis 타입 nullable 차이
      // — UI 가 null fallback 이미 처리. cast 우회.
      setAnalysis(target as unknown as Analysis)
      setLoading(false)

      // 이 분석을 만든 설문이 선택 묶음을 건너뛰었나 — 실패해도 카드만 안 뜬다(silent).
      const surveyId = (target as { survey_id?: string | null }).survey_id
      if (surveyId && !analysisId) {
        const { data: sv, error: svErr } = await supabase
          .from('surveys')
          .select('answers')
          .eq('id', surveyId)
          .eq('user_id', user.id)
          .maybeSingle()
        if (!svErr && sv) setCanRefine(optionalSkipped(sv as { answers?: unknown }))
      }
    }
    // R97-B (D7): load() 내부 auth/dogs/analyses fetch 중 throw (네트워크
    // 끊김 / Supabase 5xx / RLS 거부) 시 setLoading(false) 미도달 → 무한
    // 스피너 먹통이었음. rejected promise 를 .catch 로 잡아 loading 해제 →
    // AnalysisEmptyState (돌아가기 + 설문 CTA) 로 graceful 후퇴.
    // ★2026-08-05 — 스피너는 풀었지만 **오류 상태를 안 만들어서**, analysis 가
    //   null 이면 AnalysisEmptyState 가 떴다. 그 화면은 "분석 결과가 없어요 /
    //   설문을 완료하면…" + **"설문 시작하기"** 버튼이다.
    //   즉 잠깐 데이터가 끊긴 **유료 구독자가 자기 분석이 사라진 줄 알고 설문을
    //   다시 돌리게** 된다(새 analyses 행 + 재제안 카운트 오염).
    //   빈 상태와 실패는 다른 화면이어야 한다 — MedicationsClient 가 이미
    //   loadError 로 그렇게 하고 있다.
    void load().catch((e) => {
      console.error('analysis load', e)
      setLoadError(true)
      setLoading(false)
    })
  }, [dogId, analysisId, router, supabase])

  // formula fetch — Magazine BoxMixCard 가 dog 별 동적 lineRatios 표시 위해.
  // dogId 만 있으면 되므로 dog state 로딩을 기다리지 않고 병렬 발화(2026-07-17 perf).
  // archive 모드(analysisId 지정)는 현 시점 formula 의미 없어 skip.
  useEffect(() => {
    if (analysisId) return
    let cancelled = false
    ;(async () => {
      try {
        // 공유 fetch — RecommendationBox 와 중복 POST 제거 (audit P0: double-compute).
        const { httpOk, body: json } = await fetchComputedFormula(dogId, 1)
        if (cancelled) return
        if (!httpOk || json.ok !== true) {
          setRecOutcome('failed')
          return
        }
        setFormula(json.formula)
        setSubscribedLocked(json.subscribedLocked === true)
        setRecOutcome(json.needsConsultation ? 'consult' : 'ready')
      } catch {
        // 실패 — 추천 레시피 카드는 그리지 않고 RecommendationBox 의 '불러오지 못했어요'가 대신한다.
        if (!cancelled) setRecOutcome('failed')
      } finally {
        // 성공/실패 무관 로딩 종료.
        if (!cancelled) setFormulaLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, analysisId])

  // Legacy commentary fetch effect 는 StructuredAnalysis v2 가 대체. 제거.

  if (loading) return <AnalysisLoading />

  // 불러오기 실패 — "없음"이 아니라 "못 불러왔음"이라고 말한다.
  if (loadError) {
    return (
      <section
        role="alert"
        style={{ padding: '64px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14 }}
      >
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>
          분석을 불러오지 못했어요.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            height: 54,
            padding: '0 28px',
            border: `1.5px solid ${V3.ink}`,
            borderRadius: 4,
            background: '#FFFFFF',
            color: V3.ink,
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </section>
    )
  }

  if (!analysis || !dog) {
    return <AnalysisEmptyState dogId={dogId} />
  }

  const isArchive = !!analysisId

  // ────────────────────────────────────────────────────────────────
  // Magazine Edition (2026-05-21) — Claude Design 'SURVEY TIME' handoff.
  // ────────────────────────────────────────────────────────────────
  const magAgeLabel = formatAgeLabel(dog)
  // 현재 분석은 등록된 실제 체중을 그대로 표시한다. RER 역산은 토이견(<2kg)
  // 에서 +14~48% 오차 + asymmetric care goal 의 safetyWeightShift 가 섞인
  // "내부 목표체중" 이라 사용자가 입력한 값과 다르다. archive(과거 분석)는
  // 당시 체중을 따로 저장하지 않아 그 분석의 RER 로 역산(차선).
  // 자견 월간 자동 갱신 행(2026-10-01)은 계산에 쓴 체중을 저장한다(weight_kg, 서버만 씀) —
  // 그 값을 먼저 쓴다. 안 그러면 "1.5kg · 하루 ○kcal(1.8kg 기준)"처럼 칼로리와 체중이 갈린다.
  const rowWeightKg = Number((analysis as { weight_kg?: number | string | null }).weight_kg ?? NaN)
  const magWeightKg =
    Number.isFinite(rowWeightKg) && rowWeightKg > 0
      ? +rowWeightKg.toFixed(1)
      : !isArchive && dog.weight != null
        ? +dog.weight.toFixed(1)
        : +weightFromRER(analysis.rer).toFixed(1)
  // MER 신뢰구간 — 체중 측정 신뢰도(method+recency)로 폭 결정. MER=RER=70×W^0.75
  // 라 체중 측정 품질이 구간을 지배한다 (H5: 이전엔 null 고정 → 가짜 ±8%).
  const merAccuracy = weightReliability(
    dog.weight_method,
    dog.weight_measured_at,
  )
  const magMerCi = merConfidenceInterval(analysis.mer, merAccuracy)
  // 박스 레시피 줄 — 실제 추천 알고리즘 (formula.lineRatios) 결과로 동적 생성.
  // FOOD_LINE_META 매핑(정본 skuModel.LEGACY_LINE_TO_PROTEIN): basic=오리 / weight=닭 / skin=연어(보류) / premium=소 / joint=돼지.
  // 2026-10-09 앱 새 디자인 — 부제는 보호자가 아는 말로(시안 D08). 'B1·콜린'·'헴 철분'·'多' 같은 약어·한자를 뺐다.
  const MAG_LINE_SUB: Record<string, string> = {
    basic: '닭·소를 뺐어요 · 알레르기가 걱정될 때',
    weight: '고단백 · 브로콜리 · 체중 관리에', // 닭 = 조단백 최고(저칼로리 아님 — v4.0 130kcal, 2026-09-26)
    skin: '오메가3 · 피부·털',
    premium: '철분이 풍부해요 · 활동량 많은 아이에게',
    joint: '부드럽고 소화가 편해요',
  }
  // 박스는 SKU 최대 2종 (1종 100% / 2종 50:50) — snapBoxLines 로 스냅(사장님
  // 2026-07-13). 임상 lineRatios 는 reasoning 근거로 유지, 여기선 배송·표시용만.
  // formula 없으면(로딩) 닭50·소50 자리채움 — 로딩 중엔 스켈레톤이, 실패·상담이면 카드 자체가 안 그려진다.
  const boxLines = formula
    ? snapBoxLines(formula.lineRatios)
    : [
        { line: 'basic' as const, ratio: 0.5 },
        { line: 'premium' as const, ratio: 0.5 },
      ]
  const magBoxItems: MagBoxMixItem[] = boxLines.map(({ line, ratio }) => {
    const meta = FOOD_LINE_META[line]
    const pct = Math.round(ratio * 100)
    return {
      key: line,
      name: meta.name,
      ko: `${recipeNameOfLine(line)} 레시피`,
      pct,
      kcal: Math.round(analysis.mer * ratio),
      // ★하루 양 = 레시피 고르기 창과 같은 함수(lineDailyGrams — 레시피마다 100g당 열량으로 나눔, 2026-10-09).
      //   예전엔 analysis.feed_g(평균 열량 밀도로 낸 값) × 비율이라, 같은 아이가 이 카드에선 256g, 창에선 231g·240g 이었다
      //   (앱시안 결정 3번 '동작' "하루 양이 화면마다 다름"). formula.dailyKcal = analysis.mer 라 창과 같은 숫자가 된다.
      g: Math.round(lineDailyGrams(line, ratio, analysis.mer)),
      sub: MAG_LINE_SUB[line] ?? meta.benefit,
    }
  })

  return (
    <>
    <AnalysisResultView
      model={{
        dogId,
        dogName: dog.name,
        dogBreed: dog.breed,
        dogPhotoUrl: dog.photo_url,
        analysisId: analysis.id,
        createdAt: analysis.created_at,
        mer: analysis.mer,
        rer: analysis.rer,
        factor: analysis.factor,
        // 위쪽 요약 줄의 하루 양 = 아래 박스 레시피 하루 양의 합(같은 lineDailyGrams) — 한 화면에서 두 숫자가 갈리지 않게.
        //   처방을 불러오기 전(로딩)엔 저장된 feed_g.
        feedG: formula ? magBoxItems.reduce((s, it) => s + it.g, 0) : analysis.feed_g,
        stage: analysis.stage,
        bcsScore: analysis.bcs_score,
        bcsLabel: analysis.bcs_label,
        riskFlags: (analysis.risk_flags ?? []).filter(Boolean),
        vetConsult: analysis.vet_consult_recommended ?? false,
        factorBreakdown: analysis.factor_breakdown ?? null,
        aiCached: analysis.structured_analysis ?? null,
        ageLabel: magAgeLabel,
        weightKg: magWeightKg,
        merMin: magMerCi.low,
        merMax: magMerCi.high,
        isArchive,
        fromSurvey,
        totalCount,
        canRefine,
        refineBlocked,
        subscribedLocked,
        // 사장님 결정 11 — 이미 구독 중이면 '시작하기'·'정기배송 신청하기'를 숨긴다.
        hideStart: subscribedLocked,
        boxItems: magBoxItems,
        boxLoading: formulaLoading && !formula,
        boxHidden: recOutcome === 'failed' || recOutcome === 'consult',
        boxReasoning: formula?.reasoning ?? [],
        // 췌장염 급성/중증 하드 게이트 (formula reasoning priority 0) — 최상위.
        pancreatitisGate: !!formula?.reasoning.find(
          (r) => r.ruleId === 'pancreatitis-severe-unsuitable',
        ),
      }}
      onCloseFocus={() => router.replace('/dashboard')}
    />
    {/* 결과 화면 둘러보기(앱시안 결정 4번) — 설문 직후 + 그 강아지의 첫 분석일 때만 시작(lib/result-tour). */}
    <ResultTour place="result" dogName={dog.name} fromSurvey={fromSurvey} analysisCount={totalCount} />
    </>
  )
}

/** 그리는 데 필요한 값 전부 — AnalysisView 가 채우고, 점검 화면은 예시 값으로 채운다. */
export type AnalysisResultModel = {
  dogId: string
  dogName: string
  dogBreed: string | null
  dogPhotoUrl: string | null
  analysisId: string
  createdAt: string
  mer: number
  rer: number
  factor: number
  feedG: number
  stage: string
  bcsScore: number
  bcsLabel: string
  riskFlags: string[]
  vetConsult: boolean
  factorBreakdown: { label: string; delta: number }[] | null
  aiCached: { summary?: string; nextActions?: string[] } | null
  ageLabel: string
  weightKg: number
  merMin: number
  merMax: number
  isArchive: boolean
  fromSurvey: boolean
  totalCount: number
  canRefine: boolean
  refineBlocked: boolean
  subscribedLocked: boolean
  /** 이미 구독 중 — 시작·신청 버튼을 숨긴다(사장님 결정 11). */
  hideStart: boolean
  boxItems: MagBoxMixItem[]
  boxLoading: boolean
  boxHidden: boolean
  boxReasoning: Reasoning[]
  pancreatitisGate: boolean
}

/**
 * 분석 결과 그리기(데이터 판정 없음). 순서는 시안 D08 — 요약 줄 → 머리 띠 → 분석 한 줄 → 하루 에너지(도장 그림자) →
 * 추천 레시피 → 화식 양 → 문의·저장 타일 → 보호자님께(AI) → 4종 비교 → (설문 직후 안내) → 버튼 → 참고할 점 → 지난 기록 링크.
 */
export function AnalysisResultView({
  model: m,
  onCloseFocus,
  recommendationOverride,
}: {
  model: AnalysisResultModel
  onCloseFocus: () => void
  /** 점검 화면 전용 — 화식 양 카드 자리에 예시 상태를 꽂는다. */
  recommendationOverride?: ReactNode
}) {
  const shape = bodyShape(m.bcsScore, m.bcsLabel)
  const dateText = analysisDateText(m.createdAt, { withYear: m.isArchive })
  return (
    // 줄 높이는 시안과 같은 기본값(normal) — 앱 기본 1.5 를 따르면 한 줄 글자마다 몇 px 씩 커져 카드가 길어진다.
    <div style={{ paddingBottom: 28, color: V3.ink, lineHeight: 'normal' }}>
      {/* 설문 직후(focusMode — AppChrome 헤더 숨김)의 출구. 처음엔 우상단
          떠 있는 원형 X 였는데 사장님 기각(2026-09-05 "토스 화면처럼 상단
          고정바에") — AppChrome 헤더와 같은 문법의 sticky 바 + 우측 X 로.
          2026-10-09 앱 새 디자인(시안 A02): 흰 60px 줄 + 아래 1px 선, 제목 18 굵게, 닫기 48. */}
      {m.fromSurvey && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            background: V3.paper,
            borderBottom: `1px solid ${V3.rule}`,
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          <div
            style={{
              height: 60,
              boxSizing: 'border-box',
              padding: '0 6px 0 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800 }}>분석 결과</span>
            <button
              type="button"
              aria-label="분석 닫고 홈으로"
              onClick={onCloseFocus}
              className="flex items-center justify-center transition active:scale-95"
              style={{ width: 48, height: 48, background: 'none', border: 'none', cursor: 'pointer', color: V3.ink }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <AnalysisStickySummary
        dogName={m.dogName}
        merKcal={m.mer}
        feedG={m.feedG}
        shapeLabel={shape.phrase}
        analysisDate={dateText}
        stickyBelowBar={m.fromSurvey}
      />

      {/* 참고할 점(안전·주의 신호) — 결과 최상단이 아니라 페이지 최하단으로 이동
          (사장님 지시 2026-06-19, 긍정 결과 먼저·참고는 마지막). 렌더는 하단
          AnalysisCTASection 뒤. */}

      {/* 히스토리 뷰: 이 분석이 언제 것인지 명시 */}
      {m.isArchive && <AnalysisArchiveBanner dogId={m.dogId} analysisDate={dateText} />}

      {/* ─────────────────────────────────────────────────────────────
          Magazine Edition (2026-05-21) — 새 분석 결과 카드 묶음.
          archive 모드에서는 숨김 (역사적 데이터 컨텍스트와 충돌 방지).
          ───────────────────────────────────────────────────────────── */}
      {!m.isArchive && (
        <AnalysisMagazineSection
          dogId={m.dogId}
          dogName={m.dogName}
          dogBreed={m.dogBreed}
          dogPhotoUrl={m.dogPhotoUrl}
          isArchive={m.isArchive}
          ageLabel={m.ageLabel}
          weightKg={m.weightKg}
          stage={m.stage}
          bcsScore={m.bcsScore}
          bcsLabel={m.bcsLabel}
          analysisDate={dateText}
          merKcal={m.mer}
          merMin={m.merMin}
          merMax={m.merMax}
          rer={m.rer}
          factor={m.factor}
          boxItems={m.boxItems}
          boxLoading={m.boxLoading}
          boxHidden={m.boxHidden}
          boxReasoning={m.boxReasoning}
          riskFlags={m.riskFlags}
          factorBreakdown={m.factorBreakdown}
          hideStart={m.hideStart}
          recommendationOverride={recommendationOverride}
        />
      )}

      {/* AI 코멘트 — 급여량 카드 바로 아래. 숫자는 규칙, 이 카드만 AI 가 그 아이
          사정을 읽고 쓴다(2026-07-16 연결). archive(과거 분석)에선 안 부른다 —
          지난 데이터에 AI 비용 낭비. 서버 캐시(structured_analysis) 있으면 그걸 쓴다. */}
      {!m.isArchive && (
        <AiCommentCard analysisId={m.analysisId} dogName={m.dogName} cached={m.aiCached} />
      )}

      {/* Round C1 (2026-05-20): 4종 SKU 비교 페이지로 CTA.
          ?dog= — /compare 는 강아지 경로 밖이라 앱 헤더 ← 가 어느 분석 화면으로
          올라갈지 모른다. 이 강아지 id 를 실어 보내 ← 가 여기로 돌아오게 한다
          (AppChrome parentForPath, 사장님 2026-10-02 "뒤로가기 없음"). */}
      {!m.isArchive && (
        <Link
          href={`/compare?dog=${m.dogId}`}
          className="transition active:scale-[0.99]"
          style={{
            margin: '14px 20px 0',
            minHeight: 72,
            padding: '0 16px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            color: V3.ink,
            textDecoration: 'none',
            background: V3.soft,
            borderLeft: `6px solid ${V3.mustard}`,
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>4종 레시피 비교</span>
            <span style={{ fontSize: 16, fontWeight: 800 }}>닭고기·오리·흑돼지·한우 한눈에 보기</span>
          </span>
          <span aria-hidden style={{ fontSize: 18, fontWeight: 800 }}>
            →
          </span>
        </Link>
      )}

      {/* 가격 안심(PriceFramingCard, 한 끼 단가·카페 라떼 비교)은 2026-07-14
          사장님 지시로 삭제 — 가격은 플랜/배송 스텝에서만 다룬다. */}

      {/* 설문 v4 — 관문에서 "건너뛰고 결과 보기"를 고른 경우: 선택 4개를 이어서 답하는
          자리(사장님 9/21 "결과 화면에서 정확도 올리기"). ?refine=1 은 마지막 설문의 답을
          그대로 들고 선택 묶음 첫 화면에서 시작한다(lib/survey/refine.ts). */}
      {/* ★구독 중 재설문 안내 (2026-09-25 출시 전 점검 3차). 바뀐 답변으로 지금 받는
          박스를 몰래 바꾸지 않는다 — 다음 레시피 제안에서 금액 동의와 함께 반영된다. */}
      {!m.isArchive && m.subscribedLocked && (
        <section
          aria-label="정기배송 레시피 안내"
          style={{
            margin: '16px 20px 0',
            padding: 16,
            borderRadius: 4,
            border: `1.5px solid ${V3.ink}`,
            display: 'grid',
            gridTemplateColumns: '26px 1fr',
            columnGap: 10,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: 1 }}>
            <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
            <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
          </svg>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>정기배송 레시피는 그대로예요</span>
            <span style={{ fontSize: 15, lineHeight: 1.6, color: V3.inkSoft }}>
              바뀐 답변은 다음 레시피 제안 때 반영돼요. 금액이 달라지면 먼저 여쭤볼게요.
            </span>
          </span>
        </section>
      )}

      {!m.isArchive && m.canRefine && !m.refineBlocked && (
        <Link
          href={`/dogs/${m.dogId}/survey?refine=1`}
          className="transition active:scale-[0.99]"
          style={{
            margin: '12px 20px 0',
            padding: '16px 14px 16px 16px',
            borderRadius: 4,
            color: V3.ink,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: V3.soft,
            borderLeft: `6px solid ${V3.mustard}`,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: V3.inkMute }}>
              <span aria-hidden style={{ width: 8, height: 8, background: V3.mustard }} />
              정확도 올리기
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>아직 답하지 않은 질문 4개가 있어요</span>
            <span style={{ fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>
              지금 먹는 사료 · 산책 · 운동·사는 곳 · 먹는 약. 1분이면 급여량이 더 정확해져요.
            </span>
          </span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      )}

      <AnalysisCTASection
        dogId={m.dogId}
        dogName={m.dogName}
        isArchive={m.isArchive}
        hideStart={m.hideStart}
      />

      {/* 참고할 점(안전·주의 신호) — 페이지 최하단(사장님 지시 2026-06-19,
          긍정 결과 먼저·참고는 마지막). 심각도순 정렬·없으면 비표시. 참고(info)만
          이면 차분한 톤, 위험/주의·수의상담은 경고 톤. */}
      {(() => {
        const flags = m.riskFlags
        const vet = m.vetConsult
        // 췌장염 급성/중증 하드 게이트 (formula reasoning priority 0) — 최상위.
        const gateChip = m.pancreatitisGate
        if (flags.length === 0 && !vet && !gateChip) return null
        const rankOf = (f: string) => {
          const s = riskFlagSeverity(f)
          return s === 'critical' ? 0 : s === 'high' ? 1 : 2
        }
        const sorted = [...flags].sort((a, b) => rankOf(a) - rankOf(b))
        const hasSerious = gateChip || vet || flags.some((f) => rankOf(f) <= 1)
        const toneOf = (s: 'critical' | 'high' | 'info') =>
          s === 'critical' ? V3.sale : s === 'high' ? V3.mustard : '#8A8A8A'
        return (
          <section
            aria-label={hasSerious ? '꼭 확인하세요' : '참고할 점'}
            style={{
              margin: '30px 20px 0',
              padding: 16,
              borderRadius: 4,
              background: V3.soft,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              wordBreak: 'keep-all',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={hasSerious ? V3.sale : V3.mustard} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 4l9 16H3z" />
                <path d="M12 10v4M12 17h.01" />
              </svg>
              {hasSerious ? '꼭 확인하세요' : '참고할 점'}
            </span>

            {gateChip && (
              <p
                style={{
                  margin: 0,
                  padding: '10px 12px',
                  borderRadius: 4,
                  background: '#FBE7E2',
                  borderLeft: `4px solid ${V3.sale}`,
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.55,
                  color: '#7A2A1E',
                }}
              >
                {PANCREATITIS_GATE_COPY}
              </p>
            )}

            {vet && (
              <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 15, fontWeight: 800, lineHeight: 1.5 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={V3.sale} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M6 3v6a4 4 0 0 0 8 0V3" />
                  <path d="M10 13v3a5 5 0 0 0 10 0v-2" />
                  <circle cx="20" cy="12" r="2" />
                </svg>
                이 분석은 수의사 상담을 권장해요.
              </span>
            )}

            {sorted.map((f) => {
              const sev = riskFlagSeverity(f)
              const c = toneOf(sev)
              return (
                <div key={f} style={{ display: 'grid', gridTemplateColumns: '6px 1fr', columnGap: 10 }}>
                  <span aria-hidden style={{ width: 6, height: 6, marginTop: 10, background: c }} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      {/* M7 — 색상 외 텍스트 태그로 심각도 전달(색맹 a11y). */}
                      <span
                        style={{
                          height: 22,
                          padding: '0 6px',
                          boxSizing: 'border-box',
                          borderRadius: 4,
                          background: '#FFFFFF',
                          border: `1px solid ${sev === 'info' ? '#D5D3D4' : c}`,
                          fontSize: 12,
                          fontWeight: 800,
                          color: sev === 'critical' ? V3.sale : sev === 'high' ? V3.ink : V3.inkMute,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {sev === 'critical' ? '위험' : sev === 'high' ? '주의' : '참고'}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: sev === 'critical' ? V3.sale : V3.ink }}>
                        {riskFlagLabel(f)}
                      </span>
                      {riskFlagTerm(f) && (
                        <span style={{ fontSize: 13, color: V3.inkMute }}>{riskFlagTerm(f)}</span>
                      )}
                    </span>
                    {riskFlagDesc(f) && (
                      <span style={{ fontSize: 15, lineHeight: 1.55, color: V3.inkSoft }}>{riskFlagDesc(f)}</span>
                    )}
                  </span>
                </div>
              )
            })}

            {/* 수의사 공유 CTA — 수의 상담 권장 + 실제 위험 플래그가 있을 때만.
                이 순간이 수의사가 데이터를 볼 가장 필요한 지점인데, 여태 "상담을
                권장해요" 안내만 있고 실제 공유 경로가 없었다(기능·진입점은 완성돼
                DogDetail 에 있었으나 이 문맥엔 없었다). risk_flags 없이 vet 권장만
                있는 경우(임신 등)는 굳이 공유 유도 안 함 — 공유할 위험 데이터가 없다. */}
            {vet && flags.length > 0 && (
              <div style={{ paddingTop: 12, borderTop: '1px solid #E0DDDE' }}>
                <p style={{ margin: '0 0 8px', fontSize: 14, color: V3.inkMute }}>
                  이 분석을 수의사에게 그대로 보여드릴 수 있어요.
                </p>
                <VetShareButton dogId={m.dogId} dogName={null} />
              </div>
            )}
          </section>
        )
      })()}

      {/* 이전 분석 기록 — 페이지 최하단에 눈에 덜 띄는 텍스트 링크로(사장님
          2026-07-14 "최하단에 잘 안 보이게"). 찾는 사람만 찾으면 되는 보조 동선. */}
      {!m.isArchive && m.totalCount > 1 && (
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center' }}>
          <Link
            href={`/dogs/${m.dogId}/analyses`}
            style={{
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              fontSize: 15,
              fontWeight: 700,
              color: V3.inkMute,
              textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
          >
            이전 분석 기록 {m.totalCount}회 보기
          </Link>
        </div>
      )}
    </div>
  )
}
