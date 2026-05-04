/**
 * Farmer's Tail — Personalization 타입.
 *
 * 5종 화식 (Basic 닭 / Weight 오리 / Skin 연어 / Premium 소 / Joint 돼지) +
 * 동결건조 토퍼 2종 (육류 / 야채) 을 강아지별 비율로 조합하는 personalization
 * 시스템의 핵심 데이터 구조.
 *
 * 알고리즘 (`firstBox.ts`) 가 설문 응답 + 영양 계산 결과를 받아 Formula 를
 * 출력. 출력은 DB `dog_formulas` 테이블에 저장되고, UI 에서 추천 박스 카드로
 * 노출. cycle 별 (보통 4주마다) 재실행해 비율 조정.
 */

/** 5종 화식 라인 식별자. SKU id 가 아니라 "라인" — 실제 SKU 는 분량/포장
 * 별로 여러 개 있을 수 있음. 알고리즘은 라인 단위로 비율 결정. */
export type FoodLine = 'basic' | 'weight' | 'skin' | 'premium' | 'joint'

/** 토퍼 카테고리. 화식 위에 추가로 뿌려지는 동결건조 보조식. */
export type ToppperType = 'protein' | 'vegetable'

/** 첫 박스 전환 전략 — 사용자의 화식 경험에 따라 보수성 조절. */
export type TransitionStrategy =
  /** 화식 자주/매일 — full ratio 즉시 적용 */
  | 'aggressive'
  /** 화식 가끔 경험 — 점진 전환 */
  | 'gradual'
  /** 화식 처음 — 4주 전환기 protocol, 단순 조합 + 토퍼 최소 */
  | 'conservative'

/** 비율 (0.0~1.0, 합 1.0). DB 에는 100 곱한 정수로 저장 (decimal 회피). */
export type Ratio = number

/**
 * 알고리즘 결정 근거 한 건. UI 에서 chip 으로 표시되어 보호자에게 "왜
 * 이 비율로 정해졌는지" 투명하게 노출. 디버깅/audit 시에도 핵심.
 */
export type Reasoning = {
  /** 어떤 입력 신호가 룰을 발화시켰는지 (사람 읽기 쉽게). */
  trigger: string
  /** 무엇을 조정했는지 (formula 변경 내용). */
  action: string
  /** UI 칩에 노출할 짧은 한국어 라벨 (≤ 18자 권장). */
  chipLabel: string
  /** 0(가장 중요) ~ 9(부드러운 nudge). 알레르기 0, 케어목표 1, BCS 3 등. */
  priority: number
  /** 룰 ID — 알고리즘 버전 변경 시 추적. snake_case. */
  ruleId: string
}

/**
 * 체크인 응답 한 건 — dog_checkins 테이블 row 와 1:1 매핑.
 *
 * 매 cycle 의 week_2 / week_4 체크인 결과. decideNextBox 가 input 으로 받아
 * 다음 cycle 비율을 조정. 응답 안 한 cycle 은 빈 배열 — 알고리즘이 빈 배열도
 * 정상 처리해야 함 (응답률 30~40% 가정).
 */
export type Checkin = {
  cycleNumber: number
  /** 'week_2' = 위장 적응 신호 / 'week_4' = 종합 평가 */
  checkpoint: 'week_2' | 'week_4'
  /** Bristol 1-7 (4 = 이상). null = 응답 안 함. */
  stoolScore: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null
  /** 1-5 (5 = 매우 윤기). null = 응답 안 함. */
  coatScore: 1 | 2 | 3 | 4 | 5 | null
  /** 1-5 (5 = 매우 왕성). null = 응답 안 함. */
  appetiteScore: 1 | 2 | 3 | 4 | 5 | null
  /** 1-5 (5 = 매우 만족). week_4 의 핵심 신호. null = 응답 안 함. */
  overallSatisfaction: 1 | 2 | 3 | 4 | 5 | null
  /** 응답 시각 — 늦은 응답 (3주 후 week_2) 처리 시 가중치 ↓. */
  respondedAt: string
}

/** 알고리즘 input — 설문 + 강아지 + 영양 calc 합성. */
export type AlgorithmInput = {
  // ── dogs ──
  dogId: string
  dogName: string
  ageMonths: number
  weightKg: number
  neutered: boolean
  activityLevel: 'low' | 'medium' | 'high'

  // ── surveys (필수) ──
  bcs: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | null
  /** 알레르기 라벨 — surveys.answers.allergies 그대로 (한국어). */
  allergies: string[]
  /** 만성질환 키 — kidney / arthritis / ibd / pancreatitis 등. */
  chronicConditions: string[]
  pregnancy: 'none' | 'pregnant' | 'lactating' | null
  /** 케어 목표 — 알고리즘 1순위 변수. null 이면 'general_upgrade' fallback. */
  careGoal:
    | 'weight_management'
    | 'skin_coat'
    | 'joint_senior'
    | 'allergy_avoid'
    | 'general_upgrade'
    | null

  // ── surveys (선택, personalization v3) ──
  homeCookingExperience: 'first' | 'occasional' | 'frequent' | null
  currentDietSatisfaction: 1 | 2 | 3 | 4 | 5 | null
  weightTrend6mo: 'stable' | 'gained' | 'lost' | 'unknown' | null
  giSensitivity: 'rare' | 'sometimes' | 'frequent' | 'always' | null
  preferredProteins: string[]
  indoorActivity: 'calm' | 'moderate' | 'active' | null
  /** 일일 산책 분 (선택). v1.2 활동량 룰에서 사용. null = 미입력. */
  dailyWalkMinutes: number | null

  // ── 임신/수유 정밀화 (v1.3, NRC 2006 ch.15 Table 15-3) ──
  /**
   * 임신 주차 (1~9). late gestation (≥6주차) 는 RER × 1.6-2.0 권장.
   * null = 미입력 시 보수적으로 1.5× 사용 (기존 v1.2 동작).
   * 출처: NRC (2006) "Nutrient Requirements of Dogs and Cats" Table 15-3.
   */
  pregnancyWeek: number | null
  /**
   * 출산 산자수 (lactation kcal multiplier 결정). RER × (2.0 + 0.25*n) for
   * n=1-4, ×3.0~4.0 for n≥5. null = 보수적 2.0× 사용.
   * 출처: NRC 2006 Table 15-3.
   */
  litterSize: number | null

  // ── 임상 안전 정밀화 (v1.3 Phase A2) ──
  /**
   * 예상 성견 체중 (kg). 대형견 (≥25kg) puppy 의 Ca:P 상한 룰 발화 —
   * AAFCO 2024 Dog Food Nutrient Profiles "Growth (Large size)" 정의.
   * NRC 2006 ch.15 — 대형견 puppy 의 Ca 1.8% DM 상한 (DOD/HOD 예방).
   * null = 미입력 시 일반 puppy 처방.
   */
  expectedAdultWeightKg: number | null
  /**
   * IRIS CKD 단계 (1~4). 만성 신장질환 진단견의 처방 분기:
   *  · Stage 1-2: 단백질 정상 (Premium 정상) + 인 제한 chip
   *  · Stage 3-4: 단백질 제한 (Premium 0%, 현 동작)
   *  · null + chronicConditions.kidney: 보수적 Stage 3+ 처방
   * 출처: IRIS (2019) Staging of CKD Guidelines www.iris-kidney.com.
   */
  irisStage: 1 | 2 | 3 | 4 | null

  // ── nutrition calc 결과 ──
  /** 일일 권장 칼로리 (MER). */
  dailyKcal: number
  /** 일일 권장 그램. */
  dailyGrams: number
}

/** 알고리즘 output — 한 강아지의 한 cycle 처방. */
export type Formula = {
  /** 5종 라인 비율 — Record value 합 1.0. quantized to 0.1 단위. */
  lineRatios: Record<FoodLine, Ratio>

  /** 토퍼 비중 — 화식 위에 얹는 추가량 (kcal 기준). 합계가 0.3 (30%) 넘으면
   * 화식이 주식이 아니게 되니 알고리즘이 자체 cap. */
  toppers: {
    protein: Ratio
    vegetable: Ratio
  }

  /** reasoning 배열 — 우선순위 오름차순 정렬됨. UI 가 위에서부터 노출. */
  reasoning: Reasoning[]

  /** 첫 박스 전환 전략. */
  transitionStrategy: TransitionStrategy

  /** 영양 calc 그대로 — 박스 분량 산정에 사용. */
  dailyKcal: number
  dailyGrams: number

  /** cycle 번호 — 첫 박스는 1. 이후 4주마다 +1. */
  cycleNumber: number

  /** 알고리즘 버전 — 룰 변경 추적. semver. */
  algorithmVersion: string

  /** 사용자가 추천 비율을 직접 수정했는지. true 면 reasoning 에 "사용자 조정"
   * 추가. 첫 출력은 항상 false. */
  userAdjusted: boolean
}

/**
 * decideNextBox 의 input — 이전 cycle 처방 + 체크인 + 최신 설문.
 *
 * cycle N+1 의 비율은 다음 신호 합성:
 *   1. previousFormula 의 lineRatios — baseline (큰 변화 회피, churn 방지)
 *   2. checkins — week_2/week_4 응답 → 미세 조정 (지방 ↓ / 야채 ↑ 등)
 *   3. surveyInput — 알레르기/케어목표 변경 시 큰 swing 가능 (설문 재제출)
 */
export type NextBoxInput = {
  previousFormula: Formula
  checkins: Checkin[]
  surveyInput: AlgorithmInput
  /** 새 cycle 번호 — typically previous.cycleNumber + 1 */
  cycleNumber: number
}

/**
 * UI 에 노출할 라인 메타 — name / subtitle / 색상 등. lines.ts 의 상수와
 * 매칭. DB 에는 안 들어감 — 알고리즘 출력 후 UI 가 join.
 */
export type FoodLineMeta = {
  line: FoodLine
  /** 영문 라인명 — 'Basic', 'Weight', 'Skin', 'Premium', 'Joint' */
  name: string
  /** 한국어 부제 — '닭 · 균형식' */
  subtitle: string
  /** 메인 단백질 키 — preferred_proteins / allergies 매핑용. */
  mainProtein: 'chicken' | 'duck' | 'salmon' | 'beef' | 'pork'
  /** 알고리즘이 즉시 0% 처리해야 할 알레르기 라벨 (한국어). */
  blockingAllergies: string[]
  /**
   * IgE 교차반응 — 이 라인이 알레르기로 차단됐을 때 보호자에게 같이
   * 경고할 다른 알레르기 라벨. 차단은 안 함 (false positive 비용 큼) —
   * chip 만 push (priority 0, 'cross-react' ruleId).
   *
   * 근거:
   *  · Bexley et al. 2017 Vet Dermatol 28(1):31-e7 — chicken/turkey IgE cross
   *  · Kuehn et al. 2018 Vet Dermatol 29(4):343-e119 — fish parvalbumin cross
   *  · Olivry & Mueller 2019 BMC Vet Res 15:140 — beef/lamb BSA 부분 cross
   */
  crossReactWith?: string[]
  /** 한 줄 효능 요약 — 박스 카드 노출. */
  benefit: string
  /** 100g 당 kcal — 박스 분량 산정. */
  kcalPer100g: number
  /**
   * Dry-matter 단백질 비중 (%). 라인 mix 의 영양 단면 계산 (CKD IRIS 단백질
   * 평가, lactation 단백질 충족 검증) 에 사용.
   * 값은 화식 5종 영양 분석 보고서 v2 (2026-04) batch 평균. 실제 ±5% 변동.
   */
  proteinPctDM: number
  /**
   * Dry-matter 지방 비중 (%). 췌장염 fat-ceiling 룰 (DM <15%) 검증의 핵심
   * 입력 — Xenoulis (2015) J Small Anim Pract 56(1):13-26.
   */
  fatPctDM: number
  /** UI 색상 토큰 (CSS variable name 또는 hex). */
  color: string
}
