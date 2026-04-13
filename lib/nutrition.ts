export type SurveyAnswers = {
  bodyCondition: 'skinny' | 'slim' | 'ideal' | 'chubby' | 'obese'
  allergies: string[]
  healthConcerns: string[]
  foodType?: string
  snackFreq?: string
  taste?: string
}

export type DogInfo = {
  weight: number
  ageValue: number
  ageUnit: 'years' | 'months'
  neutered: boolean
  activityLevel: 'low' | 'medium' | 'high'
}

export type BCSResult = {
  score: number
  label: string
  desc: string
  color: string
}

export type NutritionResult = {
  rer: number
  mer: number
  factor: number
  perMeal: number
  feedG: number
  stage: 'puppy' | 'adult' | 'senior'
  stageKR: string
  bcs: BCSResult
  protein: { pct: number; g: number }
  fat: { pct: number; g: number }
  carb: { pct: number; g: number }
  fiber: { pct: number; g: number }
  micro: Record<string, { val: number; unit: string; min: number }>
  caPRatio: string
}

function ageMonths(dog: DogInfo): number {
  return dog.ageUnit === 'years' ? dog.ageValue * 12 : dog.ageValue
}

function lifeStage(dog: DogInfo): 'puppy' | 'adult' | 'senior' {
  const m = ageMonths(dog)
  if (m < 12) return 'puppy'
  if (m >= 84) return 'senior'
  return 'adult'
}

function lifeStageKR(stage: 'puppy' | 'adult' | 'senior'): string {
  if (stage === 'puppy') return '성장기 (퍼피)'
  if (stage === 'senior') return '노령기 (시니어)'
  return '성견 (유지기)'
}

function bcsScore(body: SurveyAnswers['bodyCondition']): BCSResult {
  switch (body) {
    case 'skinny': return { score: 1, label: 'BCS 1-2', desc: '저체중 — 갈비뼈가 육안으로 확인됨', color: '#A6BEDA' }
    case 'slim': return { score: 3, label: 'BCS 3-4', desc: '약간 저체중 — 갈비뼈가 쉽게 촉진됨', color: '#8BA05A' }
    case 'ideal': return { score: 5, label: 'BCS 4-5', desc: '이상적 체중 — 허리 라인이 적절', color: '#6B7F3A' }
    case 'chubby': return { score: 7, label: 'BCS 6-7', desc: '과체중 — 갈비뼈 촉진이 어려움', color: '#D4B872' }
    case 'obese': return { score: 9, label: 'BCS 8-9', desc: '비만 — 지방 침착이 과도함', color: '#A0452E' }
  }
}

export function calculateNutrition(dog: DogInfo, answers: SurveyAnswers): NutritionResult {
  const w = dog.weight
  const RER = 70 * Math.pow(w, 0.75)
  const stage = lifeStage(dog)
  const bcs = bcsScore(answers.bodyCondition)
  let factor = 1.6

  if (stage === 'puppy') {
    const m = ageMonths(dog)
    if (m < 4) factor = 3.0
    else if (m < 8) factor = 2.5
    else factor = 2.0
  } else if (stage === 'senior') {
    factor = 1.2
  } else {
    if (dog.activityLevel === 'low') factor = 1.2
    else if (dog.activityLevel === 'high') factor = 1.8
    else factor = 1.6
  }

  if (bcs.score >= 7) factor *= 0.85
  else if (bcs.score >= 6) factor *= 0.92
  else if (bcs.score <= 2) factor *= 1.15
  else if (bcs.score <= 3) factor *= 1.08
  if (dog.neutered) factor *= 0.9

  const MER = Math.round(RER * factor)

  let proteinPct, fatPct, carbPct, fiberPct
  if (stage === 'puppy') {
    proteinPct = 32; fatPct = 22; carbPct = 38; fiberPct = 4
  } else if (stage === 'senior') {
    proteinPct = 30; fatPct = 14; carbPct = 44; fiberPct = 6
  } else {
    if (bcs.score >= 7) { proteinPct = 35; fatPct = 12; carbPct = 40; fiberPct = 7 }
    else if (bcs.score <= 3) { proteinPct = 30; fatPct = 22; carbPct = 40; fiberPct = 4 }
    else { proteinPct = 30; fatPct = 18; carbPct = 42; fiberPct = 5 }
  }

  if (answers.healthConcerns.includes('체중')) { proteinPct += 3; fatPct -= 3 }
  if (answers.healthConcerns.includes('피부/털')) { fatPct += 3; carbPct -= 3 }
  if (answers.healthConcerns.includes('소화')) { fiberPct += 2; carbPct -= 2 }
  if (answers.healthConcerns.includes('관절')) { proteinPct += 2; carbPct -= 2 }
  if (answers.healthConcerns.includes('신장')) { proteinPct -= 4; carbPct += 4 }

  const proteinG = Math.round((MER * proteinPct / 100) / 4)
  const fatG = Math.round((MER * fatPct / 100) / 9)
  const carbG = Math.round((MER * carbPct / 100) / 4)
  const fiberG = Math.round((MER * fiberPct / 100) / 4)

  // 미량영양소 (AAFCO 2024, /1000kcal ME)
  const microBase = stage === 'puppy'
    ? {
        calcium: { min: 3.0, rec: 4.5, unit: 'g' },
        phosphorus: { min: 2.5, rec: 3.5, unit: 'g' },
        omega6: { min: 3.3, rec: 5.0, unit: 'g' },
        omega3: { min: 0.2, rec: 0.5, unit: 'g' },
        vitA: { min: 1250, rec: 2500, unit: 'IU' },
        vitD: { min: 125, rec: 250, unit: 'IU' },
        vitE: { min: 12.5, rec: 25, unit: 'IU' },
        zinc: { min: 25, rec: 40, unit: 'mg' },
        iron: { min: 22, rec: 35, unit: 'mg' },
        copper: { min: 3.1, rec: 5, unit: 'mg' },
      }
    : {
        calcium: { min: 1.25, rec: 2.5, unit: 'g' },
        phosphorus: { min: 1.0, rec: 2.0, unit: 'g' },
        omega6: { min: 2.8, rec: 5.0, unit: 'g' },
        omega3: { min: 0.11, rec: 0.4, unit: 'g' },
        vitA: { min: 1250, rec: 2500, unit: 'IU' },
        vitD: { min: 125, rec: 250, unit: 'IU' },
        vitE: { min: 12.5, rec: 25, unit: 'IU' },
        zinc: { min: 20, rec: 35, unit: 'mg' },
        iron: { min: 10, rec: 25, unit: 'mg' },
        copper: { min: 1.85, rec: 4, unit: 'mg' },
      }

  const daily: Record<string, { val: number; unit: string; min: number }> = {}
  for (const k in microBase) {
    const m = microBase[k as keyof typeof microBase]
    daily[k] = {
      val: +(m.rec * MER / 1000).toFixed(2),
      unit: m.unit,
      min: +(m.min * MER / 1000).toFixed(2),
    }
  }

  if (answers.healthConcerns.includes('피부/털')) {
    daily.omega3.val *= 1.5
    daily.omega6.val *= 1.2
    daily.zinc.val *= 1.3
  }
  if (answers.healthConcerns.includes('관절')) daily.omega3.val *= 1.5
  if (answers.healthConcerns.includes('신장')) daily.phosphorus.val *= 0.7
  for (const k in daily) daily[k].val = +daily[k].val.toFixed(2)

  const caPRatio = (daily.calcium.val / daily.phosphorus.val).toFixed(1)

  return {
    rer: Math.round(RER),
    mer: MER,
    factor: +factor.toFixed(2),
    perMeal: Math.round(MER / 2),
    feedG: Math.round(MER / 1.2),
    stage,
    stageKR: lifeStageKR(stage),
    bcs,
    protein: { pct: proteinPct, g: proteinG },
    fat: { pct: fatPct, g: fatG },
    carb: { pct: carbPct, g: carbG },
    fiber: { pct: fiberPct, g: fiberG },
    micro: daily,
    caPRatio,
  }
}

export function getSupplements(concerns: string[]): Array<{ emoji: string; name: string; desc: string }> {
  const s: Array<{ emoji: string; name: string; desc: string }> = []
  if (concerns.includes('피부/털')) {
    s.push({ emoji: '🐟', name: '오메가-3 (EPA/DHA)', desc: '피부 장벽 강화, 모질 개선' })
    s.push({ emoji: '🧬', name: '아연 (Zinc)', desc: '피부 세포 재생 촉진' })
  }
  if (concerns.includes('관절')) {
    s.push({ emoji: '🦴', name: '글루코사민 + 콘드로이틴', desc: '연골 보호, 관절 윤활' })
    s.push({ emoji: '🌿', name: '초록입홍합', desc: '천연 항염, 관절 통증 완화' })
  }
  if (concerns.includes('소화')) {
    s.push({ emoji: '🦠', name: '프로바이오틱스', desc: '장내 유익균 증식' })
    s.push({ emoji: '🎃', name: '식이섬유 보충', desc: '장 운동 촉진, 변 상태 개선' })
  }
  if (concerns.includes('체중')) {
    s.push({ emoji: '🔥', name: 'L-카르니틴', desc: '지방 산화 촉진' })
  }
  if (concerns.includes('신장')) {
    s.push({ emoji: '💧', name: '수분 보충 강화', desc: '저인 식이와 충분한 수분' })
    s.push({ emoji: '🌱', name: '오메가-3 (EPA)', desc: '신장 염증 억제' })
  }
  if (concerns.includes('치아')) {
    s.push({ emoji: '🦷', name: '치석 관리 효소', desc: '치태 분해 효소' })
  }
  if (s.length === 0) {
    s.push({ emoji: '✅', name: '기본 종합비타민/미네랄', desc: 'AAFCO 기준 충족 보장' })
  }
  return s
}