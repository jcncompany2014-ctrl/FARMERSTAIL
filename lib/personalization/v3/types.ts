/**
 * 추천 엔진 v3 — 2-레이어 타입 SSOT.
 *
 * 레이어 A (베이스 SKU): "무슨 밥?" — 단백질·칼로리·기호성 적합도. 효능 단정 X.
 * 레이어 B (기능성 소스): "부족한 효능을 소스로" — add-on, status 보유.
 *
 * 효능 문구는 마스터레시피 충족률로 검증(catalog.ts 참고). 사료법 정합:
 * 질병 치료·예방 표방 금지, "풍부"(T1)는 충족률 ≥250% 검증분만.
 */

/** 확정 베이스 단백질 4종 (연어는 추후 출시 — 베이스 제외). */
export type ProteinKey = 'chicken' | 'duck' | 'pork' | 'beef'

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
