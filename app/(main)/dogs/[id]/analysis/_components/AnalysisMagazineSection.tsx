/**
 * AnalysisMagazineSection — 2026-05-21 Claude Design 'SURVEY TIME' handoff 의
 * Magazine Edition 시각 카드 묶음 (Hero → Diagnosis → DailyEnergy → BoxMix → RecommendationBox → CTA).
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 / prop 모두 동일.
 * archive 모드일 때는 이 section 자체를 렌더하지 않음 — 호출부에서 조건 분기.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08·I06·I07): 웜 크림 바탕을 걷고 흰 바탕에 카드마다 시안 값.
 *   · 진단 칩: '체형 5/9'·'단백 49% 이상' → '성견'·'알맞은 체형'(사장님 결정 목록 — 전문용어·영양소 % 빼기).
 *   · 문장: "땅콩이의 BCS 4-5 체형에" → "땅콩이의 알맞은 체형에"(저장 라벨 대신 보호자가 아는 말).
 *   · 풋터: 'AAFCO · FEDIAF · NRC 기준 충족' → '국제 영양 기준을 충족해요'.
 *   · 추천을 못 불러왔거나 상담이 필요할 때(boxHidden)는 추천 레시피 카드를 그리지 않는다 — 예전엔 임시
 *     자리채움(오리+한우)이 '추천 레시피'로 그려졌다. 그 자리는 RecommendationBox 의 실패·상담 카드가 맡는다(시안 I06·I07).
 */
'use client'

import type { ReactNode } from 'react'
import { petName } from '@/lib/korean'
import { V3 } from '@/lib/design/tokens'
import { HeroSection as MagHero } from '@/components/analysis/magazine/HeroSection'
import { DiagnosisCard as MagDiagnosis } from '@/components/analysis/magazine/DiagnosisCard'
import { DailyEnergyCard as MagDailyEnergy } from '@/components/analysis/magazine/DailyEnergyCard'
import {
  BoxMixCard as MagBoxMix,
  type BoxMixItem as MagBoxMixItem,
} from '@/components/analysis/magazine/BoxMixCard'
import type { Reasoning as MagBoxReasoning } from '@/lib/personalization/types'
import { CTAStack as MagCTA } from '@/components/analysis/magazine/CTAStack'
import RecommendationBox from '@/components/analysis/RecommendationBox'
import { bodyShape, stageChip } from '@/components/analysis/display'
import {
  stageFromKR,
  needsCalorieVetRoute,
  hasBcsWeightConflict,
} from '@/lib/nutrition'

type Props = {
  dogId: string
  dogName: string
  dogBreed: string | null
  dogPhotoUrl: string | null
  isArchive: boolean
  ageLabel: string
  weightKg: number
  stage: string
  bcsScore: number
  bcsLabel: string
  /** 진단 카드 풋터 날짜 — "9월 30일". */
  analysisDate: string
  merKcal: number
  merMin: number
  merMax: number
  rer: number
  factor: number
  boxItems: MagBoxMixItem[]
  /** dog별 formula 아직 로딩 중 — 박스는 가짜 placeholder 대신 스켈레톤. */
  boxLoading?: boolean
  /** 추천을 못 불러왔거나(실패·설문 없음) 상담이 필요하다 — 추천 레시피 카드를 그리지 않는다. */
  boxHidden?: boolean
  /** 추천 근거 — 추천 레시피 카드 안에 바로 노출(사장님 2026-07-14). */
  boxReasoning?: MagBoxReasoning[]
  /** 칼로리 v2 2e — 위험 플래그 (에너지 카드 직하 수의 상담 배너 판정). */
  riskFlags?: string[]
  /** 칼로리 v2 6단계 — 계수 사다리 (에너지 카드 내 근거 노출). */
  factorBreakdown?: { label: string; delta: number }[] | null
  /** 이미 구독 중 — '시작하기'를 숨긴다(사장님 결정 11). */
  hideStart?: boolean
  /** 점검 화면(/design-check/analysis) 전용 — 화식 양 카드 자리에 예시 상태를 꽂는다. 실제 화면은 비워 둔다. */
  recommendationOverride?: ReactNode
}

export default function AnalysisMagazineSection({
  dogId,
  dogName,
  dogBreed,
  dogPhotoUrl,
  isArchive,
  ageLabel,
  weightKg,
  stage,
  bcsScore,
  bcsLabel,
  analysisDate,
  merKcal,
  merMin,
  merMax,
  rer,
  factor,
  boxItems,
  boxLoading,
  boxHidden = false,
  boxReasoning,
  riskFlags,
  factorBreakdown,
  hideStart = false,
  recommendationOverride,
}: Props) {
  // 노령기 여부 — AdjustSheet 의 senior 단백/지방 상한 경고에 신뢰성 있게 전달
  // (reasoning ruleId 엔 시니어 신호가 없어 stage 에서 파생).
  const isSenior = stageFromKR(stage) === 'senior'
  const shape = bodyShape(bcsScore, bcsLabel)
  return (
    <div>
      <MagHero
        dogName={dogName}
        ageLabel={ageLabel}
        breedLabel={dogBreed}
        weightKg={weightKg}
        photoUrl={dogPhotoUrl}
      />
      <MagDiagnosis
        chips={[
          { label: stageChip(stage), variant: 'primary' },
          { label: shape.phrase, variant: 'soft' },
        ]}
        lines={[
          '단백질은 넉넉히, 지방은 균형 있게',
          // 체형 미입력이면 "~체형에"를 지어내지 않는다.
          shape.phrase === '체형 미입력'
            ? `${petName(dogName)}에게`
            : `${petName(dogName)}의 ${shape.phrase}에`,
        ]}
        highlight="맞춤 식단을 준비했어요."
        versionLabel={`분석 · ${analysisDate}`}
      />
      {/* 2026-06-19 사장님 "전체적으로 마음에 안듦 — 강력 업그레이드": 중복 제거.
          · Celebration("처방 준비됐어요") = 바로 위 Diagnosis 메시지와 중복 → 삭제
          · AtAGlance(435·270·BCS) = 상단 sticky바 + 아래 DailyEnergy 와 숫자 중복 → 삭제
          숫자 반복(435 ×4·BCS ×3)·preamble 과부하 완화. */}
      <MagDailyEnergy
        dogName={dogName}
        data={{
          mer: Math.round(merKcal),
          rer,
          factor,
          merMin,
          merMax,
          breakdown: factorBreakdown,
        }}
      />
      {/* 칼로리 v2 2e (경고 강화 절충 — 사장님 확정 2026-07-12) — 임신·수유/
          대사질환 등 칼로리 민감 케이스는 에너지 수치 직하에 수의 상담 배너
          강제 노출. "긍정 먼저" 페이지 순서는 유지하되 책임 안내를 수치 옆에. */}
      {needsCalorieVetRoute(riskFlags) && (
        <p
          role="note"
          style={{
            margin: '14px 20px 0',
            padding: '12px 14px',
            borderRadius: 4,
            background: '#FBE7E2',
            borderLeft: `4px solid ${V3.sale}`,
            fontSize: 15,
            lineHeight: 1.6,
            color: '#7A2A1E',
            wordBreak: 'keep-all',
          }}
        >
          위 숫자는 시작 참고치예요. 임신·수유 중이거나 대사에 영향을 주는 질환이 있는 아이는{' '}
          <strong style={{ fontWeight: 800 }}>급여량을 꼭 수의사와 함께 정해 주세요.</strong>
        </p>
      )}
      {/* 체중↔체형 모순 — 설문에서 경고했는데도 그대로 제출된 경우(사장님
          2026-07-14). 계산은 그대로 하되 "이 숫자는 두 입력이 어긋난 상태에서
          나왔다"는 사실을 결과지에도 남긴다. 급여량 카드 직후에 둬야 그 숫자를
          어떻게 받아들일지 판단이 선다. */}
      {hasBcsWeightConflict(riskFlags) && (
        <p
          role="note"
          style={{
            margin: '14px 20px 0',
            padding: '12px 14px',
            borderRadius: 4,
            background: V3.soft,
            borderLeft: `6px solid ${V3.mustard}`,
            fontSize: 15,
            lineHeight: 1.6,
            color: V3.inkSoft,
            wordBreak: 'keep-all',
          }}
        >
          <strong style={{ fontWeight: 800, color: V3.ink }}>체중과 체형 답변이 서로 맞지 않았어요.</strong>
          <br />
          체중은 줄었는데 체형은 더 통통해졌다고(또는 그 반대로) 입력돼서, 위 급여량은 둘 중 하나가 어긋난 상태로
          계산됐어요. <strong style={{ fontWeight: 800, color: V3.ink }}>체중을 다시 재보시거나 수의사와 한 번 상의해 주세요.</strong>
        </p>
      )}
      {/* 카드 순서 (사용자 지시 2026-05-21):
          BoxMix → RecommendationBox (정기배송+레시피 고르기) → MagCTA(보조) */}
      {!boxHidden && (
        <MagBoxMix
          dogName={dogName}
          items={boxItems}
          loading={boxLoading}
          reasoning={boxReasoning}
        />
      )}
      {!isArchive &&
        (recommendationOverride ?? (
          <RecommendationBox dogId={dogId} dogName={dogName} isSenior={isSenior} hideStart={hideStart} />
        ))}
      {/* 2026-06-19 사장님 "영양 균형 카드 아예 없애" — NutrientsCard 제거. */}
      {/* 추이 카드 제거 (2026-07-14 사장님) — 이 카드는 '설문 기록' 기반이라
          구독 시작 후엔 갱신이 거의 없다(보호자는 재설문 대신 체중만 기록).
          추이는 자주 갱신되는 체중 기록 기반으로 개요 페이지가 담당. */}
      {/* 맞춤 영양제 박스 제거(2026-07-13 사장님) — 판매할 영양제 제품이 아직
          없어 추천이 이르다. getSupplements/analysis.supplements 배선은 향후
          영양제 라인 출시 대비해 그대로 유지(데이터·매핑은 살아 있음). */}
      <MagCTA
        // ★/contact 는 웹 문의 페이지 — 앱 전용 화면((main))에서 웹으로 빠지는
        //   동선이었다(사장님 2026-09-05). 앱의 1:1 상담(/chat)으로.
        consultHref="/chat"
        reportHref={`/dogs/${dogId}/vet-report`}
      />
    </div>
  )
}
