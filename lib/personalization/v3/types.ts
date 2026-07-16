/**
 * 추천 엔진 v3 — 2-레이어 타입 SSOT.
 *
 * 레이어 A (베이스 SKU): "무슨 밥?" — 단백질·칼로리·기호성 적합도. 효능 단정 X.
 * 레이어 B (기능성 소스): "부족한 효능을 소스로" — add-on, status 보유.
 *
 * 효능 문구는 마스터레시피 충족률로 검증(catalog.ts 참고). 사료법 정합:
 * 질병 치료·예방 표방 금지, "풍부"(T1)는 충족률 ≥250% 검증분만.
 */

import type { ProteinKey as SkuModelProteinKey } from '../skuModel.ts'

/**
 * 확정 베이스 단백질 4종 (연어는 추후 출시 — 베이스 제외).
 *
 * skuModel(SSOT)에서 **파생**한다 — 2026-07-16 까지 여기 문자열을 따로 적어 둬서
 * 단백질이 늘거나 이름이 바뀌면 두 곳을 다 고쳐야 했다. 이제 skuModel 에 SKU 가
 * 추가되면 여기도 자동으로 따라오고, 연어가 출시되면 Exclude 만 지우면 된다.
 * (skuModel 은 import 가 없는 말단 모듈이라 순환 걱정 없음.)
 */
export type ProteinKey = Exclude<SkuModelProteinKey, 'salmon'>

/** 설문이 매핑되는 적합도 축 (레이어 A 스코어링 입력). */
export type NeedKey =
  | 'weight_loss'
  | 'weight_gain'
  | 'maintain'
  | 'activity_high'
  | 'activity_low'
  | 'sensitive'
  | 'palatability'
  | 'senior'
  | 'recovery'

/**
 * 노출 문구 근거 등급 (사료법 정합).
 *  - T1: 영양소 함량 사실 ("~이 풍부한") — 충족률 ≥250% 검증분만.
 *  - T2: 일반 영양 특성 (메커니즘 기반) — "저지방으로 열량 통제에 유리".
 *  - T3: 완곡한 기능 표현 — "~에 도움이 될 수 있는".
 *  - positioning: 매칭/마케팅용 (효능 주장 아님).
 */
export type EvidenceGrade = 'T1' | 'T2' | 'T3' | 'positioning'

export type EvidenceClaim = {
  /** 고객 노출 문구 (등급 규칙 준수). */
  text: string
  grade: EvidenceGrade
  /** 충족률(%) 또는 메커니즘 — 감사/검증용 근거. */
  basis: string
}

export type BaseSku = {
  /** 제품 slug (= products.slug 매칭). */
  id: string
  protein: ProteinKey
  nameKr: string
  nameEn: string
  kcalPer100g: number
  /** need 별 적합도 가중치 (0~1). 스코어링 입력 — 느슨해도 됨(매칭 신호). */
  fitTags: Partial<Record<NeedKey, number>>
  /** 노출 효능 문구 (등급 명시). */
  claims: EvidenceClaim[]
  /** 이 알레르기 라벨(설문)이 잡히면 후보에서 완전 제외. */
  excludeIfAllergy: string[]
  /** IgE 교차반응 경고 (차단 X, chip 만). */
  crossReactWith: string[]
}

/** 기능성 우려(설문) → 소스 타겟. */
export type ConcernKey = 'skin' | 'joint' | 'digestion' | 'immune'

export type SourceStatus = 'available' | 'coming_soon'

export type FunctionalSource = {
  id: string
  nameKr: string
  targetConcern: ConcernKey
  status: SourceStatus
  /** 효능 근거 — 출시 시 실제 ingredient 로 확정. */
  ingredientBasis: string
}

/** 설문 → need 프로필 (레이어 A·B 입력). */
export type NeedProfile = {
  weightGoal: 'loss' | 'gain' | 'maintain'
  activityLevel: 'low' | 'medium' | 'high'
  /** 설문 알레르기 라벨(한국어). */
  allergies: string[]
  /** 식욕/기호 — picky/회복기면 palatability 우선. */
  appetite: 'low' | 'normal' | 'picky'
  senior: boolean
  /** 기능성 우려(피부/관절/소화/면역) → 레이어 B. */
  functionalConcerns: ConcernKey[]
}

/** 추천 결정 추적 (explainability — 설문→need→필터→선택). */
export type TraceEntry = { step: string; detail: string }

// ──────────────────────────────────────────────────────────────────────────
// 레이어 A 엔진 결과 (Phase 2)
// ──────────────────────────────────────────────────────────────────────────

/** 선택된 베이스 SKU 한 종 + 믹스 비율. picks 의 ratio 합 = 1.0. */
export type SkuPick = {
  id: string
  protein: ProteinKey
  nameKr: string
  /** 믹스 비율 (0~1). 단일이면 1.0, 2종 믹스면 0.7/0.3. */
  ratio: number
  kcalPer100g: number
  /** 이 SKU 의 검증된 효능 문구 (catalog SSOT). */
  claims: EvidenceClaim[]
  /** 주(primary) SKU 면 true — UI 강조용. */
  isPrimary: boolean
}

/** 교차반응 경고 (차단 X — chip 만). */
export type CrossReactWarning = {
  /** 경고를 띄운 SKU 의 단백질. */
  protein: ProteinKey
  /** 매칭된 알레르기 라벨. */
  allergyLabel: string
}

/**
 * 레이어 A 결과 — "무슨 밥?" (베이스 SKU 선택 + 분량).
 *
 * pure function 출력. 레이어 B(기능성 소스)는 Phase 3 에서 별도 결합.
 * needsConsultation=true 면 picks 비어 있음(모든 단백질 알레르기 차단 등) —
 * 호출처가 상담 라우팅.
 */
export type LayerAResult = {
  /** 선택 SKU 1~2종 (ratio 합 1.0). needsConsultation 면 빈 배열. */
  picks: SkuPick[]
  /** 믹스 가중 평균 kcal/100g. */
  blendedKcalPer100g: number
  /** 입력 일일 칼로리(MER) 그대로. */
  dailyKcal: number
  /** 일일 급여 그램 = dailyKcal / blendedKcal × 100. */
  dailyGrams: number
  /** 교차반응 경고 (차단 안 함). */
  crossReactWarnings: CrossReactWarning[]
  /** 모든 후보가 알레르기로 차단 등 — 상담 라우팅 필요. */
  needsConsultation: boolean
  /** 상담 사유 (needsConsultation 일 때). */
  consultationReason?: string
  /** 후보별 적합도 점수 (admin 디버그/감사). */
  scores: Array<{ protein: ProteinKey; score: number }>
  /** 결정 추적 (explainability — admin 노출). */
  trace: TraceEntry[]
}

// ──────────────────────────────────────────────────────────────────────────
// 레이어 B 라우팅 결과 (Phase 3)
// ──────────────────────────────────────────────────────────────────────────

/** 기능성 우려 1건 → 소스 라우팅. */
export type SourceRoute = {
  concern: ConcernKey
  /** 매칭 소스 id (없으면 null). */
  sourceId: string | null
  sourceNameKr: string | null
  /** available=출시 / coming_soon=준비중 / none=소스 없음. */
  status: SourceStatus | 'none'
  /** 지금 박스에 실제로 추가 가능한가. */
  available: boolean
}

/**
 * 레이어 B 결과 — "부족한 효능을 소스로". 베이스 SKU 위 add-on.
 * 현재 소스 전부 coming_soon → 라우팅은 되지만 available=false(대기열).
 */
export type LayerBResult = {
  routes: SourceRoute[]
  /** coming_soon 소스로 매칭된 우려 — 출시 알림 waitlist 후보(Phase 5). */
  waitlistConcerns: ConcernKey[]
  trace: TraceEntry[]
}

/** 추천 최종 결과 — 레이어 A(밥) + 레이어 B(소스). */
export type RecommendationResult = {
  layerA: LayerAResult
  layerB: LayerBResult
  engineVersion: string
}

// ──────────────────────────────────────────────────────────────────────────
// 2주 피드백 훅 (Phase 3 — 재분석 시드)
// ──────────────────────────────────────────────────────────────────────────

/**
 * 첫 박스 ~2주 후 보호자 체크인 1건. 라이브 dog_checkins(week_2)와 정렬:
 * stool=Bristol 1~7(4 이상), coat/appetite/satisfaction=1~5(5 최고). null=무응답.
 */
export type TwoWeekFeedback = {
  stoolScore: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null
  coatScore: 1 | 2 | 3 | 4 | 5 | null
  appetiteScore: 1 | 2 | 3 | 4 | 5 | null
  satisfaction: 1 | 2 | 3 | 4 | 5 | null
}

/**
 * 2주 피드백 해석 — 재분석(runLayerA 재실행) 시드.
 * profileNudges 를 NeedProfile 에 머지해 재추천, addConcerns 는 레이어 B 로.
 */
export type FeedbackInterpretation = {
  /** 재추천 시 NeedProfile 에 머지할 신호(예: 식욕 저하→picky). */
  profileNudges: Partial<NeedProfile>
  /** 추가로 라우팅할 기능성 우려(예: 무른 변→소화). */
  addConcerns: ConcernKey[]
  /** 보호자·admin 노출 메모. */
  notes: string[]
  /** 재분석 권장 여부(전반 불만족 등). */
  shouldReanalyze: boolean
}
