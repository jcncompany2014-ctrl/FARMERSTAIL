/**
 * 추천 v3 — 설문/강아지 → NeedProfile 매퍼.
 *
 * 라이브 compute route 가 이미 조립하는 `AlgorithmInput` 을 그대로 재사용해
 * (DRY — DB 재조회 없음) v3 엔진 입력 NeedProfile 로 변환하는 **순수 함수**.
 * 식욕(taste)만 AlgorithmInput 에 없어 opts 로 별도 주입(라이브 타입 미오염).
 *
 * 매핑은 근거 기반:
 *  - weightGoal: 케어목표 체중관리 · BCS≥6 · 당뇨 → 감량 / BCS≤3 → 증량 / 그 외 유지.
 *  - senior: WSAVA size-aware 시니어 임계(소형 9세+ / 중형 7세+ / 대형 6세+).
 *  - functionalConcerns: 케어목표 + 만성질환 + GI 민감도 → 명확 신호만 매핑.
 *    (immune 은 설문 신호 부재 → 미매핑. 거짓 라우팅 안 함.)
 */
import type { AlgorithmInput } from '../types.ts'
import type { ConcernKey, NeedProfile } from './types.ts'

/** WSAVA size-aware 시니어 임계(개월). 라이브 firstBox applyAgeStage 와 동일. */
function seniorMonths(weightKg: number): number {
  return weightKg < 10 ? 108 : weightKg > 25 ? 72 : 84
}

function deriveWeightGoal(
  input: AlgorithmInput,
): NeedProfile['weightGoal'] {
  const overweight =
    input.careGoal === 'weight_management' ||
    (input.bcs !== null && input.bcs >= 6) ||
    input.chronicConditions.includes('diabetes')
  if (overweight) return 'loss'
  if (input.bcs !== null && input.bcs <= 3) return 'gain'
  return 'maintain'
}

/** 설문 taste('strong'|'normal'|'picky'|'reduced') → NeedProfile.appetite. */
function mapAppetite(raw?: string | null): NeedProfile['appetite'] {
  if (raw === 'picky') return 'picky'
  if (raw === 'reduced') return 'low'
  return 'normal' // 'strong' | 'normal' | undefined
}

const JOINT_CONDITIONS = [
  'arthritis',
  'ivdd',
  'patellar_luxation',
  'long_term_steroid',
]
const SKIN_CONDITIONS = ['allergy_skin', 'cds', 'cognitive_decline']
const DIGESTION_CONDITIONS = ['ibd', 'pancreatitis', 'epi']

function deriveConcerns(input: AlgorithmInput): ConcernKey[] {
  const set = new Set<ConcernKey>()
  if (input.careGoal === 'skin_coat') set.add('skin')
  if (input.careGoal === 'joint_senior') set.add('joint')
  for (const c of input.chronicConditions) {
    if (JOINT_CONDITIONS.includes(c)) set.add('joint')
    if (SKIN_CONDITIONS.includes(c)) set.add('skin')
    if (DIGESTION_CONDITIONS.includes(c)) set.add('digestion')
  }
  if (input.giSensitivity === 'frequent' || input.giSensitivity === 'always') {
    set.add('digestion')
  }
  return [...set]
}

/**
 * AlgorithmInput → NeedProfile.
 * @param opts.appetite 설문 식욕(answers.appetite) — AlgorithmInput 밖이라 별도 주입.
 */
export function toNeedProfile(
  input: AlgorithmInput,
  opts: { appetite?: string | null } = {},
): NeedProfile {
  return {
    weightGoal: deriveWeightGoal(input),
    activityLevel: input.activityLevel,
    allergies: input.allergies,
    appetite: mapAppetite(opts.appetite),
    senior: input.ageMonths >= seniorMonths(input.weightKg),
    functionalConcerns: deriveConcerns(input),
  }
}
