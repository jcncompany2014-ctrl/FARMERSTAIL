/**
 * AnalysisMagazineSection — 2026-05-21 Claude Design 'SURVEY TIME' handoff 의
 * Magazine Edition 시각 카드 묶음 (Hero → Diagnosis → Celebration → AtAGlance →
 * DailyEnergy → BoxMix → RecommendationBox → Nutrients → Trends → Supplements → CTA).
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 / prop 모두 동일.
 * archive 모드일 때는 이 section 자체를 렌더하지 않음 — 호출부에서 조건 분기.
 */
'use client'

import { petName } from '@/lib/korean'
import { WARM_CREAM } from '@/components/analysis/magazine/palette'
import { HeroSection as MagHero } from '@/components/analysis/magazine/HeroSection'
import { DiagnosisCard as MagDiagnosis } from '@/components/analysis/magazine/DiagnosisCard'
import { DailyEnergyCard as MagDailyEnergy } from '@/components/analysis/magazine/DailyEnergyCard'
import { type NutrientRow as MagNutrientRow } from '@/components/analysis/magazine/NutrientsCard'
import {
  BoxMixCard as MagBoxMix,
  type BoxMixItem as MagBoxMixItem,
} from '@/components/analysis/magazine/BoxMixCard'
import {
  SupplementsCard as MagSupplements,
  type SupplementItem as MagSupplementItem,
} from '@/components/analysis/magazine/SupplementsCard'
import { CTAStack as MagCTA } from '@/components/analysis/magazine/CTAStack'
import RecommendationBox from '@/components/analysis/RecommendationBox'
import AnalysisTrendsCard from '@/components/analysis/AnalysisTrendsCard'
import { stageFromKR, needsCalorieVetRoute } from '@/lib/nutrition'

type HistoryPoint = {
  date: string
  bcs: number
  weight: number
}

type Props = {
  dogId: string
  dogName: string
  dogBreed: string | null
  dogPhotoUrl: string | null
  isArchive: boolean
  ageLabel: string
  weightKg: number
  dateLabel: string
  stage: string
  bcsScore: number
  bcsLabel: string
  proteinPct: number
  analysisDate: string
  guidelineVersion: string | null | undefined
  merKcal: number
  merMin: number
  merMax: number
  rer: number
  factor: number
  feedG: number
  nutrientRows: MagNutrientRow[]
  boxItems: MagBoxMixItem[]
  supplementItems: MagSupplementItem[]
  history: HistoryPoint[]
  totalCount: number
  /** 칼로리 v2 2e — 위험 플래그 (에너지 카드 직하 수의 상담 배너 판정). */
  riskFlags?: string[]
  /** 칼로리 v2 6단계 — 계수 사다리 (에너지 카드 내 근거 노출). */
  factorBreakdown?: { label: string; delta: number }[] | null
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
  proteinPct,
  analysisDate,
  merKcal,
  merMin,
  merMax,
  rer,
  factor,
  boxItems,
  supplementItems,
  history,
  totalCount,
  riskFlags,
  factorBreakdown,
}: Props) {
  const magP = WARM_CREAM
  // 노령기 여부 — AdjustSheet 의 senior 단백/지방 상한 경고에 신뢰성 있게 전달
  // (reasoning ruleId 엔 시니어 신호가 없어 stage 에서 파생).
  const isSenior = stageFromKR(stage) === 'senior'
  return (
    <div style={{ background: magP.bg, marginTop: 12, paddingBottom: 4 }}>
      <MagHero
        p={magP}
        dogName={dogName}
        ageLabel={ageLabel}
        breedLabel={dogBreed}
        weightKg={weightKg}
        photoUrl={dogPhotoUrl}
      />
      <MagDiagnosis
        p={magP}
        dogName={dogName}
        chips={[
          { label: stage || '성견 유지', variant: 'primary' },
          { label: `BCS ${bcsScore}/9`, variant: 'soft' },
          { label: `단백 ${Math.round(proteinPct)}%`, variant: 'soft' },
        ]}
        headline={{
          intro: '단백질은',
          accentBrand: '넉넉히',
          middle: ', 지방은',
          accentOchre: '균형 있게',
          body: `${petName(dogName)}의 ${bcsLabel} 체형에`,
          highlight: '맞춤 식단을 준비했어요.',
        }}
        guidelineLabel="AAFCO 2024 · NRC 2006 기준 충족"
        versionLabel={`분석 · ${analysisDate}`}
      />
      {/* 2026-06-19 사장님 "전체적으로 마음에 안듦 — 강력 업그레이드": 중복 제거.
          · Celebration("처방 준비됐어요") = 바로 위 Diagnosis 메시지와 중복 → 삭제
          · AtAGlance(435·270·BCS) = 상단 sticky바 + 아래 DailyEnergy 와 숫자 중복 → 삭제
          숫자 반복(435 ×4·BCS ×3)·preamble 과부하 완화. */}
      <MagDailyEnergy
        p={magP}
        dogName={dogName}
        data={{
          mer: Math.round(merKcal),
          rer,
          factor,
          merMin,
          merMax,
          guideline: 'NRC 2006',
          breakdown: factorBreakdown,
        }}
      />
      {/* 칼로리 v2 2e (경고 강화 절충 — 사장님 확정 2026-07-12) — 임신·수유/
          대사질환 등 칼로리 민감 케이스는 에너지 수치 직하에 수의 상담 배너
          강제 노출. "긍정 먼저" 페이지 순서는 유지하되 책임 안내를 수치 옆에. */}
      {needsCalorieVetRoute(riskFlags) && (
        <section style={{ background: magP.bg, padding: '0 20px 4px' }}>
          <div
            className="rounded px-4 py-3 text-[12px] leading-relaxed font-bold"
            style={{
              background: 'color-mix(in srgb, var(--terracotta) 10%, white)',
              border:
                '1px solid color-mix(in srgb, var(--terracotta) 35%, transparent)',
              color: 'var(--ink)',
            }}
          >
            위 수치는 시작 참고치예요. 임신·수유 중이거나 대사에 영향을 주는
            질환이 있는 아이는{' '}
            <strong>급여량을 꼭 수의사와 함께 정해 주세요.</strong>
          </div>
        </section>
      )}
      {/* 카드 순서 (사용자 지시 2026-05-21):
          BoxMix → RecommendationBox (정기배송+비율조정+왜이비율) →
          Nutrients (영양 균형) → 추이 → Supplements → MagCTA(보조) */}
      <MagBoxMix p={magP} dogName={dogName} items={boxItems} />
      {!isArchive && (
        <div style={{ marginTop: 14 }}>
          <RecommendationBox dogId={dogId} dogName={dogName} isSenior={isSenior} />
        </div>
      )}
      {/* 2026-06-19 사장님 "영양 균형 카드 아예 없애" — NutrientsCard 제거. */}
      {/* 추이 카드는 비교할 기록(2회+)이 있을 때만 — 첫 분석에선 "2회 이상
          하면 표시돼요" 빈 placeholder 가 전환 화면을 어수선하게 했음(2026-06-19). */}
      {history.length >= 2 && (
        <AnalysisTrendsCard
          dogId={dogId}
          dogName={dogName}
          history={history}
          totalCount={totalCount}
        />
      )}
      <MagSupplements p={magP} dogName={dogName} items={supplementItems} />
      <MagCTA p={magP} consultHref="/contact" />
      <div style={{ height: 12, background: magP.bg }} />
    </div>
  )
}
