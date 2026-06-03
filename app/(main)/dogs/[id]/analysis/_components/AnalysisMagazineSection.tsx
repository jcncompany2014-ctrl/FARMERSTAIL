/**
 * AnalysisMagazineSection — 2026-05-21 Claude Design 'SURVEY TIME' handoff 의
 * Magazine Edition 시각 카드 묶음 (Hero → Diagnosis → Celebration → AtAGlance →
 * DailyEnergy → BoxMix → RecommendationBox → Nutrients → Trends → Supplements → CTA).
 *
 * 분할 (2026-05-27): AnalysisView.tsx 에서 추출. 시각 / 동작 / prop 모두 동일.
 * archive 모드일 때는 이 section 자체를 렌더하지 않음 — 호출부에서 조건 분기.
 */
'use client'

import { WARM_CREAM } from '@/components/analysis/magazine/palette'
import { HeroSection as MagHero } from '@/components/analysis/magazine/HeroSection'
import { DiagnosisCard as MagDiagnosis } from '@/components/analysis/magazine/DiagnosisCard'
import { CelebrationBanner as MagCelebration } from '@/components/analysis/magazine/CelebrationBanner'
import { AtAGlance as MagAtAGlance } from '@/components/analysis/magazine/AtAGlance'
import { DailyEnergyCard as MagDailyEnergy } from '@/components/analysis/magazine/DailyEnergyCard'
import {
  NutrientsCard as MagNutrients,
  type NutrientRow as MagNutrientRow,
} from '@/components/analysis/magazine/NutrientsCard'
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
import { stageFromKR } from '@/lib/nutrition'

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
}

export default function AnalysisMagazineSection({
  dogId,
  dogName,
  dogBreed,
  dogPhotoUrl,
  isArchive,
  ageLabel,
  weightKg,
  dateLabel,
  stage,
  bcsScore,
  bcsLabel,
  proteinPct,
  analysisDate,
  guidelineVersion,
  merKcal,
  merMin,
  merMax,
  rer,
  factor,
  feedG,
  nutrientRows,
  boxItems,
  supplementItems,
  history,
  totalCount,
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
          { label: `BCS ${bcsScore}/9 · ${bcsLabel}`, variant: 'soft' },
          { label: `단백 ${Math.round(proteinPct)}%`, variant: 'soft' },
        ]}
        headline={{
          intro: '단백질은',
          accentBrand: '넉넉히',
          middle: ', 지방은',
          accentOchre: '균형 있게',
          body: `${dogName}이의 ${bcsLabel} 체형에`,
          highlight: '맞춤 식단을 준비했어요.',
        }}
        guidelineLabel={`AAFCO ${guidelineVersion ?? '2024'} 영양 기준 충족`}
        versionLabel={`분석 · ${analysisDate}`}
      />
      <MagCelebration p={magP} dogName={dogName} dateLabel={dateLabel} />
      <MagAtAGlance
        p={magP}
        data={{
          kcalPerDay: Math.round(merKcal),
          feedGramPerDay: Math.round(feedG),
          kcalPerMeal: Math.round(merKcal / 2),
          bcsLabel: `BCS ${bcsScore}/9`,
        }}
      />
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
        }}
      />
      {/* 카드 순서 (사용자 지시 2026-05-21):
          BoxMix → RecommendationBox (정기배송+비율조정+왜이비율) →
          Nutrients (영양 균형) → 추이 → Supplements → MagCTA(보조) */}
      <MagBoxMix p={magP} dogName={dogName} items={boxItems} />
      {!isArchive && (
        <div style={{ marginTop: 14 }}>
          <RecommendationBox dogId={dogId} dogName={dogName} isSenior={isSenior} />
        </div>
      )}
      <MagNutrients p={magP} rows={nutrientRows} />
      <AnalysisTrendsCard
        dogId={dogId}
        dogName={dogName}
        history={history}
        totalCount={totalCount}
      />
      <MagSupplements p={magP} dogName={dogName} items={supplementItems} />
      <MagCTA p={magP} consultHref="/contact" />
      <div style={{ height: 12, background: magP.bg }} />
    </div>
  )
}
