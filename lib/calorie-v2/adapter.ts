/**
 * 칼로리 v2 — 레거시 어댑터 (1단계 코어 연결).
 *
 * 현행 설문/프로필(lib/nutrition.ts DogInfo·SurveyAnswers)을 v2 가산 사다리
 * (engine.calculateAdultFactor)에 물리는 최소 매핑. 2단계(설문 확장) 전까지의
 * 임시 규칙:
 *
 *  - BCS: 현행 9점 직접선택(bcsExact)/레거시 5단계 값을 그대로 주입
 *    (3분해 역산 deriveBCS 는 설문 개편 후).
 *  - isVeryInactive 프록시: 프로필 low + 일일 산책 <30분. v2 원칙대로 산책
 *    "시간"은 가산엔 안 쓰고(나쁜 예측변수) 초비활동 감산 신호로만.
 *  - isEasyKeeper·실외한랭·활동 객관증거: 설문 질문이 없어 비활성(2단계 추가).
 *  - 견종 플래그: 4단계에서 dogs.breed 연결 — 지금은 unknown(플래그 없음).
 */
import { breedToFlags, calculateAdultFactor } from './engine.ts'
import type { BreedFlags, FactorLine, SurveyInputV2 } from './types.ts'

export interface LegacyLadderInput {
  ageYears: number
  isNeutered: boolean
  activityLevel: 'low' | 'medium' | 'high'
  dailyWalkMinutes?: number | null
  /** 현행 설문의 BCS (bcsExact 우선, 없으면 5단계 매핑 점수). */
  bcs: number
  // ── 2b 설문 신호 (미입력 = 보수 기본값) ──
  isEasyKeeper?: boolean
  vigorousExercise?: 'none' | 'self_report' | 'objective' | null
  housing?: 'indoor' | 'indoor_outdoor' | 'outdoor' | null
  coldExposure?: boolean
  /** 4단계 — 견종 플래그 (breeds.breedFlagsFromLabel). 미전달 = 플래그 없음. */
  breedFlags?: BreedFlags
}

export function legacyAdultLadder(a: LegacyLadderInput): {
  factor: number
  lines: FactorLine[]
} {
  const s: SurveyInputV2 = {
    ageYears: a.ageYears,
    isNeutered: a.isNeutered,
    // bcs 직접 주입으로 미사용 — 형식상 이상 체형.
    bodyAssessment: { ribs: 'easy', waist: 'slight', abdomen: 'level' },
    // 격한 운동 응답이 있으면 그것이 프로필보다 우선(설문이 더 최신·구체 신호).
    activityIntensity:
      a.vigorousExercise === 'self_report' || a.vigorousExercise === 'objective'
        ? 'high'
        : a.vigorousExercise === 'none'
          ? a.activityLevel === 'medium'
            ? 'mid'
            : 'low'
          : a.activityLevel === 'high'
            ? 'high'
            : a.activityLevel === 'medium'
              ? 'mid'
              : 'low',
    activityEvidence:
      a.vigorousExercise === 'objective' ? 'objective' : 'self_report',
    isVeryInactive:
      a.activityLevel === 'low' &&
      a.dailyWalkMinutes != null &&
      a.dailyWalkMinutes >= 0 &&
      a.dailyWalkMinutes < 30,
    housing: a.housing ?? 'indoor',
    coldExposure: !!a.coldExposure,
    isEasyKeeper: !!a.isEasyKeeper,
  }
  return calculateAdultFactor(s, a.breedFlags ?? breedToFlags('unknown'), a.bcs)
}
