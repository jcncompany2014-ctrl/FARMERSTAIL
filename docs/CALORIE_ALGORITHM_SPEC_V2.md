# 파머스테일 칼로리 알고리즘 스펙 v2.0

> **목적**: 맞춤 설문 → 개별 반려견의 하루 필요 칼로리(DER) → 화식/건사료 급여 그램 산출.
> **대상**: 구현 에이전트(Claude Code). Next.js + Supabase(TypeScript) 기준.
> **철학**: "처음부터 정확"이 아니라 **"안전한 쪽(약간 낮게)에서 시작 → 재측정으로 수렴"**. 한국 반려견(소형·실내·중성화·과체중 다수)에 맞춘 **감산 지배형** 모델.

---

## 🚨 먼저 읽을 것 — 이 문서는 **설계도이지 현재 코드가 아닙니다**

이 스펙은 **원안 그대로** 보존돼 있습니다. 실제 프로덕션은 이 스펙을 **전부** 구현하지 않았고,
일부는 **의도적으로 다르게** 갑니다. 여기 적힌 코드를 "지금 이렇게 돈다"로 읽지 마세요.

| | 어디 |
|---|---|
| **실제로 도는 급여량 계산 (정본)** | `lib/nutrition.ts` 의 `calculateNutrition` — **여기가 유일한 정본** |
| 스펙에서 실제 이식된 부품 | `lib/calorie-v2/engine.ts` 의 5개: `calculateAdultFactor`·`breedToFlags`(계수 사다리 M4·M4b) · `deriveBCS`(M2a) · `estimateIdealBodyWeight`(M2b) · `feedbackAdjustment`(M10) |
| 미구현·삭제된 부분 | 아래 ⛔ 참조 |

### ⛔ 스펙에 있으나 구현하면 안 되는 것 / 이미 뒤집힌 것

1. **`classifyPath` 의 `vet_referral`·`reproduction` = "계산 중단"** → **폐기된 설계.**
   사장님이 2026-07-12 뒤집었습니다("계산 중단은 구독 흐름을 끊고 '긍정 먼저' 원칙과 충돌").
   **지금은 계산은 하되 수의 상담 배너를 강제 노출**합니다. 살아 있는 규칙 =
   `nutrition.ts` 의 `CALORIE_VET_ROUTE_FLAGS` / `needsCalorieVetRoute()`.
   임신/수유는 오히려 정본이 **더 정교**합니다(NRC 2006 §15 주차별·새끼수별 배수 + BCS 보정).
2. **`calculateRER`** → 정본에 이미 `computeRer` 로 있습니다(토이 보정 포함). **RER 을 두 곳에 두지 마세요.**
3. **`computeFeedingPlanV2` 통째로 이관** → 2026-07-17 검토 결과 **다운그레이드**로 판명(정본이 가진
   riskFlags·매크로·미량영양소·거대견 가드·신뢰도 안전보정이 스펙엔 없음 + 배분 모델이 구독 전용
   피벗 이전의 "화식30%+건사료70%" 전제라 현행 3티어와 어긋남). 자세한 근거 = [ALGORITHM_UPGRADES.md](./ALGORITHM_UPGRADES.md) ⛔ 절.

### 📦 미구현 부품(M5 감량노트·M8 간식실측·M9 배분·M9b 건사료폴백·M_aux 앳워터)

스펙대로 짠 구현체가 engine.ts 에 있었으나 **연결되지 않은 死코드**여서 **2026-07-17 삭제**했습니다
(오독 유발). 붙일 가치·선결 조건은 [ALGORITHM_UPGRADES.md](./ALGORITHM_UPGRADES.md) 에 정리돼 있고,
옛 구현 코드는 git 이력(`git log -- lib/calorie-v2/engine.ts`)에서 꺼낼 수 있습니다.
**붙일 땐 engine.ts 에 되살리지 말고 정본(`nutrition.ts`)에 구현하세요.**

---

## ⭐ v1 → v2 변경 요약 (Changelog)

| # | 항목 | 변경 내용 | 근거 |
|---|---|---|---|
| 1 | 🔴 **자견 성장식 상수 오류** | `RER(70)×3.2×(…)` → **`130×BW^0.75×3.2×(e^−0.87p−0.1)`**. 70 사용 시 약 46% 과소급여였음 | NRC 2006 |
| 2 | 🟢 **견종 플래그 시스템** | 견종 → kcal 계수 아님. **플래그(비만경향·토이·단두종·고활동·연골이형성)**로 변환해 기존 로직에 연결 | 개체차(±30%)가 견종 평균차 압도 |
| 3 | 🍖 **건사료 DB 우선 폴백** | ①사료 DB 조회 → ②라벨 kcal → ③앳워터 추정 3단. "목록에 없음" 로그로 DB 자가성장 | — |
| 4 | 📊 **BCS 3분해 질문** | "몇 점?" 직접 질문 폐기 → **갈비뼈·허리·배 3문항 → BCS 역산**. 이후 재측정 루프가 보정(옵션 C) | 견주 BCS 자가진단 부정확 |
| 5 | 🔧 **개체차 수정** | ±50% → **±30%**(개 기준. ±50%는 고양이 값) | WSAVA 2011 영양평가 가이드 |
| 6 | 📝 **MCS·시니어 단백질** | 구현 제외. **SKU 확장(시니어 라인) 참고 섹션에만 명시** | MCS는 칼로리 아닌 단백질 판단용 |
| + | 활동 가산 게이트 강화 | 자가보고 '활발' = 최대 +0.1. +0.2~0.4는 **객관 증거**(측정 운동시간·웨어러블·사역) 있을 때만 | 자가보고 활동은 DER 약한 예측변수 |
| + | RER 선형식 폐기 | `30×BW+70` 제거. 초소형견 과대추정(1.36kg에서 +26%)이라 **지수식만 사용** | Merck / Today's Vet Nurse |

---

## 0. 설계 원칙 (7가지)

1. **계수 인하 ≠ 열량 차감을 레이어로 분리.** 생리요인(중성화·나이·활동)→`M4`. 간식·타사료→`M8/M9`.
2. **과체중견은 이상체중(IBW)으로 RER 계산.**
3. **감산 지배형.** 기본 계수를 한국 표준 프로파일로 낮춰 깔고 대부분 빼고, 가산은 증거 게이트.
4. **활동은 강도로, 그것도 자가보고는 보수적으로.** 시간(duration)은 나쁜 예측변수.
5. **모든 출력은 "2~4주 시작 추정치".** 개체차 ±30%. 정밀도의 진짜 출처는 재측정 루프.
6. **체형은 "몇 점?" 대신 3분해 질문으로 받아 시스템이 BCS 산출.**
7. **견종은 kcal 숫자가 아니라 플래그.** 이중차감 금지.

---

## 1. 용어 (Glossary)

| 약어 | 뜻 | 비고 |
|---|---|---|
| RER | 안정시 에너지 | `70 × BW^0.75` (지수식만) |
| DER | 하루 필요 에너지 | `RER × factor`. 최종 산출 |
| BCS | 체형 점수 | 1~9. 5 이상. **3분해 질문으로 역산** |
| IBW | 이상체중 | BCS로 현재체중 보정 |
| ME | 대사가능 에너지 | 사료 kcal 기준 |
| 견종 플래그 | OB(비만경향)·TOY(토이과대추정)·BRA(단두종)·HD(고활동)·CHD(연골이형성) | 계수 아님, 동작 수정 |

---

## 2. 파이프라인 (Control Flow)

```
SurveyInput
   │
   ├─ [M4b] 견종 → 플래그(OB/TOY/BRA/HD/CHD)  ── 기존 플래그·기본값에 병합(OR)
   ├─ [M2a] 체형 3문항(갈비뼈·허리·배) → BCS 역산
   │
   ▼
[M1] 생애단계 라우터 ─┬─ 질병/투약 → 수의 라우팅(계산 중단)
                     ├─ 임신/수유  → [M7] 번식 분기(수의 상담)
                     ├─ 자견       → [M6] 성장 분기(130 정확식 + 토이 하향)
                     └─ 건강한 성견 →
                          [M2b] BCS → IBW
                          [M3]  RER = 70 × IBW^0.75
                          ├─ BCS ≥ 6 → [M5] 감량(RER×[0.8~1.0])
                          └─ BCS ≤ 5 → [M4] 성견 계수(감산 지배형, 견종 플래그 반영)
                                    ▼
                          DER = RER × factor
                                    ▼
                          [M8] 간식 차감(10% 룰) → mainPool
                                    ▼
                          [M9] 화식/건사료 배분
                               └ 건사료 kcal: [M9b] DB → 라벨 → 앳워터(M_aux)
                                    ▼
                              FeedingPlan
                                    │
                          [M10] 2~4주 재측정 → 계수 재조정(수렴)
```

---

## 3. 상수 (constants.ts)

```typescript
export const CAL = {
  // --- RER (지수식만) ---
  RER_COEF: 70, RER_EXP: 0.75,

  // --- 성견 계수 사다리 (감산 지배형) ---
  // BASE_ADULT = 중성화+실내+저활동 성견 = 한국 모달. AAHA 중성화 성견(1.4~1.6)의 하단,
  // 비활동/비만경향(1.0~1.2)의 상단이 만나는 지점의 의도적 중간값.
  // 과체중 비율 높으면 1.3으로 낮추는 것도 방어 가능(튜닝 포인트).
  BASE_ADULT: 1.4,

  // 감산
  D_AGE_MATURE: -0.1,   // 7~9세
  D_AGE_SENIOR: -0.2,   // 10세+
  D_EASY_KEEPER: -0.1,  // 쉽게 찌는 체질 (설문 OR 견종 OB 플래그 → 1회만)
  D_VERY_INACTIVE: -0.1,

  // 가산 (증거 게이트)
  A_INTACT: 0.2,
  A_UNDERWEIGHT: 0.2,          // BCS ≤ 3
  A_VIGOROUS_SELF: 0.1,        // 자가보고 '활발'은 최대 +0.1
  A_VIGOROUS_OBJECTIVE_MIN: 0.2,
  A_VIGOROUS_OBJECTIVE_MAX: 0.4, // 측정된 운동/사역 증거 있을 때만
  A_OUTDOOR_COLD: 0.15,        // 진짜 실외 거주 + 한랭

  FACTOR_FLOOR_MAINTENANCE: 1.0,
  FACTOR_CEIL_ADULT: 2.0,

  // --- 감량 분기 ---
  WEIGHT_LOSS_FACTOR_START: 1.0,
  WEIGHT_LOSS_FACTOR_FLOOR: 0.8,
  LOSS_RATE_MIN_PCT_WK: 0.5,
  LOSS_RATE_MAX_PCT_WK: 2.0,

  // --- 성장(자견) 분기 : NRC 2006 정확식 ---
  // ⚠️ v1 오류 수정: 앞 상수는 130. (70 사용 시 약 46% 과소급여)
  GROWTH_ME_COEF: 130,
  GROWTH_P_MULT: 3.2,
  GROWTH_P_DECAY: 0.87,
  GROWTH_P_OFFSET: 0.1,
  GROWTH_MULT_UNDER_4MO: 3.0,      // 간이 근사(×RER). 정확식과 병기.
  GROWTH_MULT_4MO_TO_ADULT: 2.0,
  GROWTH_TOY_DISCOUNT: 0.85,       // 초소형/토이: NRC 과대추정 → ~15% 하향

  // --- 번식(참고, 수의 라우팅) ---
  PREG_LAST_TRIMESTER_MIN: 1.6, PREG_LAST_TRIMESTER_MAX: 2.0,
  LACTATION_MIN: 2.0, LACTATION_MAX: 6.0,

  // --- 간식 ---
  TREAT_MAX_FRACTION: 0.10,

  // --- 화식 배분 ---
  DEFAULT_HWASIK_SHARE: 0.30,

  // --- 모디파이드 앳워터 (건사료 폴백용) ---
  ATWATER_PROTEIN: 3.5, ATWATER_FAT: 8.5, ATWATER_NFE: 3.5,

  // --- BCS → IBW 초과율 (BCS 6/7/8/9 = +10/20/30/40%) ---
  BCS_OVER_PCT: { 6: 0.10, 7: 0.20, 8: 0.30, 9: 0.40 } as Record<number, number>,

  // --- 재측정 피드백 ---
  MAINTAIN_TOLERANCE_PCT: 2.0,
  FEEDBACK_STEP_PCT: 0.10,

  // --- 개체차 (개 기준) ---
  INDIVIDUAL_VARIANCE_PCT: 30, // ⚠️ 30%(개). 50%는 고양이.
} as const;
```

---

## 4. 입력 스키마 (SurveyInput)

```typescript
export interface SurveyInput {
  currentWeightKg: number;
  ageYears: number;
  sex: 'male' | 'female';
  isNeutered: boolean;

  // 견종 (플래그 소스). 목록 밖이면 'mixed' 또는 'unknown'
  breed: BreedKey;

  // 생애단계
  lifeStage: 'puppy' | 'adult' | 'senior';
  isPregnant?: boolean;
  isLactating?: boolean;
  expectedAdultWeightKg?: number; // 자견 필수

  // 체형 3분해 (⚠️ "몇 점?" 직접질문 폐기)
  bodyAssessment: {
    ribs: 'visible' | 'easy' | 'slight_pressure' | 'hard';  // 갈비뼈
    waist: 'clear' | 'slight' | 'none';                     // 위에서 본 허리
    abdomen: 'tucked' | 'level' | 'sagging';                // 옆에서 본 배
  };

  // 활동 (강도 + 증거수준)
  activityIntensity: 'low' | 'mid' | 'high';
  activityEvidence: 'self_report' | 'objective'; // objective=측정/웨어러블/사역
  isVeryInactive: boolean;

  // 환경/체질
  housing: 'indoor' | 'indoor_outdoor' | 'outdoor';
  coldExposure: boolean;
  isEasyKeeper: boolean; // 설문 응답(견종 OB와 OR)

  // 건강 플래그 → 있으면 수의 라우팅
  healthFlags: Array<'hypothyroid'|'cushings'|'diabetes'|'cardiac'|'renal'|'other_illness'|'none'>;

  // 간식
  givesTreats: boolean;
  treatKcalPerDay?: number;

  // 급여 구성
  hwasikShare?: number;
  hwasikSku: 'chicken' | 'duck' | 'pork' | 'beef';
  hwasikKcalPer100g: number;   // ⚠️ SKU별 실측값(설계값 금지). 화식은 고소화율이라 앳워터 부적합.

  // 건사료 (DB 우선 3단 폴백)
  kibbleProductId?: string;    // 1순위: kibble_products DB
  kibbleKcalPer100g?: number;  // 2순위: 라벨 kcal
  kibbleGA?: GuaranteedAnalysis; // 3순위: 성분표 → 앳워터
  kibbleRawInput?: string;     // "목록에 없음"일 때 견주가 적은 사료명 → 로그
}

export interface GuaranteedAnalysis { // as-fed %
  crudeProtein: number; crudeFat: number; crudeFiber: number; moisture: number; ash: number;
}

export type BreedKey =
  | 'maltese' | 'poodle_toy' | 'pomeranian' | 'shih_tzu' | 'bichon' | 'chihuahua'
  | 'welsh_corgi' | 'dachshund' | 'cocker_spaniel' | 'golden_retriever'
  | 'labrador' | 'jindo' | 'schnauzer_mini' | 'yorkshire' | 'french_bulldog'
  | 'mixed' | 'unknown';
```

---

## 5. 출력 스키마 (FeedingPlan)

```typescript
export interface FeedingPlan {
  path: 'adult'|'weight_loss'|'growth'|'reproduction'|'vet_referral';
  derivedBcs: number;           // 3분해에서 역산된 BCS
  breedFlags: BreedFlags;       // 반영된 견종 플래그(투명성)
  idealWeightKg: number;
  rer: number;
  factor: number;
  factorBreakdown: FactorLine[];// 계수 근거 노출 = 마케팅 자산
  der: number;
  treatKcal: number;
  mainPoolKcal: number;
  hwasik: { kcal: number; grams: number; sku: string };
  kibble: { kcal: number; grams: number | null; source: 'db'|'label'|'atwater'|'none' };
  notes: string[];
  isEstimate: true;
}
export interface FactorLine { label: string; delta: number; }
export interface BreedFlags {
  obeseProne: boolean; toyOverestimate: boolean; brachycephalic: boolean;
  highDrive: boolean; chondrodystrophic: boolean;
}
```

---

## 6. 모듈별 명세

### M4b — 견종 → 플래그 `breedToFlags` (NEW)

```typescript
// 견종은 kcal을 직접 바꾸지 않는다. 플래그만 세팅해 기존 로직/기본값에 병합.
const BREED_PROFILES: Record<BreedKey, BreedFlags> = {
  maltese:        f({toyOverestimate:1}),
  poodle_toy:     f({toyOverestimate:1}),
  pomeranian:     f({toyOverestimate:1}),
  shih_tzu:       f({toyOverestimate:1, brachycephalic:1}),
  bichon:         f({toyOverestimate:1}),
  chihuahua:      f({toyOverestimate:1}),
  welsh_corgi:    f({obeseProne:1, chondrodystrophic:1}),
  dachshund:      f({obeseProne:1, chondrodystrophic:1}),
  cocker_spaniel: f({obeseProne:1}),
  golden_retriever:f({obeseProne:1}),
  labrador:       f({obeseProne:1}),          // POMC 변이: 식욕↑ + 대사율↓
  jindo:          f({highDrive:1}),           // 토종·활동적·마른편(서구 데이터셋 없음)
  schnauzer_mini: f({obeseProne:1}),          // 고지혈증 주의(지방)
  yorkshire:      f({toyOverestimate:1}),
  french_bulldog: f({obeseProne:1, brachycephalic:1}),
  mixed:          f({}),
  unknown:        f({}),
};
function f(p: Partial<BreedFlags>): BreedFlags {
  return { obeseProne:false,toyOverestimate:false,brachycephalic:false,highDrive:false,chondrodystrophic:false, ...boolify(p) };
}
export function breedToFlags(breed: BreedKey): BreedFlags { return BREED_PROFILES[breed] ?? BREED_PROFILES.unknown; }
```

**플래그 → 동작 (kcal 델타 아님):**
- `obeseProne` → `isEasyKeeper`를 OR로 true(감산 −0.1은 **1회만**). 관리 강도·리체크 주기↑.
- `toyOverestimate` → 성장 분기에서 `GROWTH_TOY_DISCOUNT` 적용. 성견에는 델타 없음(BW^0.75가 이미 처리).
- `brachycephalic` → 활동 기본값을 low로, `high`는 objective 증거 없으면 억제.
- `highDrive` → 활동 억제 안 함(그래도 가산은 게이트 통과 시에만).
- `chondrodystrophic` → 목표 BCS를 마른 쪽으로, 노트에 "마른 체형 유지가 의학적으로 중요(디스크·관절)" 추가.

### M2a — 체형 3문항 → BCS 역산 `deriveBCS` (NEW)

```typescript
// 갈비뼈를 1차 축으로, 허리·배로 ±조정. 견주가 "7점"을 고르는 것보다 정확.
export function deriveBCS(b: SurveyInput['bodyAssessment']): number {
  const base = { visible: 3, easy: 5, slight_pressure: 6, hard: 8 }[b.ribs];
  let bcs = base;
  // 허리+배가 과체중 방향으로 일치하면 +1, 마른 방향으로 일치하면 -1
  const heavy = (b.waist === 'none' ? 1:0) + (b.abdomen === 'sagging' ? 1:0);
  const lean  = (b.waist === 'clear' ? 1:0) + (b.abdomen === 'tucked' ? 1:0);
  if (heavy >= 2 && base >= 6) bcs = Math.min(9, base + 1);
  if (lean  >= 2 && base <= 5) bcs = Math.max(2, base - 1);
  return bcs;
}
```

| 갈비뼈 | 기본 BCS | 허리·배 보정 | 판정 |
|---|---|---|---|
| 보임(visible) | 3 | 잘록+올라감 → 2 | 저체중 |
| 쉽게 만져짐(easy) | 5 | — | 이상 |
| 살짝 눌러야(slight) | 6 | — | 과체중 초입 |
| 잘 안 만져짐(hard) | 8 | 없음+처짐 → 9 | 비만 |

### M2b — 이상체중 `estimateIdealBodyWeight`
```typescript
export function estimateIdealBodyWeight(currentKg: number, bcs: number): number {
  if (bcs <= 5) return currentKg;
  const over = CAL.BCS_OVER_PCT[bcs] ?? 0;
  return +(currentKg / (1 + over)).toFixed(2);
}
```

### M3 — RER (지수식만)
```typescript
export function calculateRER(ibwKg: number): number {
  // 선형식(30×BW+70)은 초소형견 과대추정으로 폐기. 지수식만.
  return +(CAL.RER_COEF * Math.pow(ibwKg, CAL.RER_EXP)).toFixed(1);
}
```

### M4 — 성견 계수 (감산 지배형 + 견종 반영) `calculateAdultFactor`
```typescript
export function calculateAdultFactor(s: SurveyInput, flags: BreedFlags): { factor: number; lines: FactorLine[] } {
  const lines: FactorLine[] = [];
  let fac = CAL.BASE_ADULT;
  lines.push({ label:'기본(중성화 성견·실내·저활동)', delta: CAL.BASE_ADULT });

  // === 감산 ===
  if (s.ageYears >= 10)      { fac += CAL.D_AGE_SENIOR; lines.push({label:'노령(10세+)', delta:CAL.D_AGE_SENIOR}); }
  else if (s.ageYears >= 7)  { fac += CAL.D_AGE_MATURE; lines.push({label:'중년(7~9세)', delta:CAL.D_AGE_MATURE}); }

  // easy-keeper: 설문 OR 견종 OB → 1회만
  if (s.isEasyKeeper || flags.obeseProne) { fac += CAL.D_EASY_KEEPER; lines.push({label:'쉽게 찌는 체질/비만경향견종', delta:CAL.D_EASY_KEEPER}); }
  if (s.isVeryInactive)     { fac += CAL.D_VERY_INACTIVE; lines.push({label:'거의 안 움직임', delta:CAL.D_VERY_INACTIVE}); }

  // === 가산(게이트) ===
  if (!s.isNeutered)        { fac += CAL.A_INTACT; lines.push({label:'미중성화', delta:CAL.A_INTACT}); }
  if (deriveBCS(s.bodyAssessment) <= 3) { fac += CAL.A_UNDERWEIGHT; lines.push({label:'저체중', delta:CAL.A_UNDERWEIGHT}); }

  // 활동 가산: 단두종이면 억제. 자가보고는 +0.1, 객관증거만 +0.2~0.4.
  if (s.activityIntensity === 'high' && !flags.brachycephalic) {
    const a = s.activityEvidence === 'objective' ? CAL.A_VIGOROUS_OBJECTIVE_MIN : CAL.A_VIGOROUS_SELF;
    fac += a; lines.push({label: s.activityEvidence==='objective' ? '규칙적 격한운동(측정)' : '활발(자가보고)', delta:a});
  }
  if (s.coldExposure && s.housing === 'outdoor') { fac += CAL.A_OUTDOOR_COLD; lines.push({label:'실외·한랭', delta:CAL.A_OUTDOOR_COLD}); }

  const clamped = Math.min(Math.max(fac, CAL.FACTOR_FLOOR_MAINTENANCE), CAL.FACTOR_CEIL_ADULT);
  return { factor: +clamped.toFixed(2), lines };
}
```

### M5 — 감량 분기 (v1과 동일)
```typescript
export function weightManagementBranch(flags: BreedFlags): { factor: number; notes: string[] } {
  const notes = [
    '감량 목표: 주당 0.5~2% 속도로 판단(저울 목표치 아님).',
    '종료는 체중 숫자 아니라 갈비뼈·허리(BCS)로.',
    '2~4주 재측정 후 감량 없으면 계수를 0.8까지 단계 인하(수의 감독 권장).',
    'BCS 8~9 또는 동반질환 시 수의 상담 필수.',
  ];
  if (flags.chondrodystrophic) notes.push('연골이형성 견종 — 마른 체형 유지가 디스크·관절에 특히 중요.');
  return { factor: CAL.WEIGHT_LOSS_FACTOR_START, notes };
}
```

### M6 — 성장 분기 (🔴 상수 130 수정 + 토이 하향)
```typescript
export function growthBranch(s: SurveyInput, flags: BreedFlags): { rer: number; factor: number; der: number; notes: string[] } {
  const adult = s.expectedAdultWeightKg ?? s.currentWeightKg;
  const p = s.currentWeightKg / adult;

  // 정확식(권장): NRC 2006. ⚠️ 앞 상수 130 (v1의 70 오류 수정)
  const meAccurate = CAL.GROWTH_ME_COEF * Math.pow(s.currentWeightKg, 0.75)
                   * CAL.GROWTH_P_MULT * (Math.exp(-CAL.GROWTH_P_DECAY * p) - CAL.GROWTH_P_OFFSET);

  // 간이식(참고): RER × 3.0/2.0
  const rer = calculateRER(s.currentWeightKg);
  const simpleFactor = p < 0.5 ? CAL.GROWTH_MULT_UNDER_4MO : CAL.GROWTH_MULT_4MO_TO_ADULT;

  let der = meAccurate;
  const notes = ['자견은 시작 추정치 — 주 1회 체중·BCS로 조정.'];
  if (flags.toyOverestimate) { der *= CAL.GROWTH_TOY_DISCOUNT; notes.push('토이 견종: 표준식 과대추정 보정(~15% 하향). BCS 기준 조정 우선.'); }

  return { rer, factor: simpleFactor, der: Math.round(der), notes };
}
```

### M8 — 간식 차감 (v1과 동일)
```typescript
export function applyTreatDeduction(der: number, s: SurveyInput) {
  if (!s.givesTreats) return { treatKcal: 0, mainPool: der, note: undefined as string|undefined };
  const cap = der * CAL.TREAT_MAX_FRACTION;
  const treatKcal = Math.min(s.treatKcalPerDay ?? 0, cap);
  const note = (s.treatKcalPerDay ?? 0) > cap ? `간식이 하루 필요량의 10%(${Math.round(cap)}kcal) 초과 — 줄이기 권장.` : undefined;
  return { treatKcal: Math.round(treatKcal), mainPool: der - treatKcal, note };
}
```

### M9b — 건사료 kcal 해석 (DB → 라벨 → 앳워터) `resolveKibbleKcal` (NEW)
```typescript
// 우선순위: ① DB(kibbleProductId 조회) ② 라벨 kcal ③ 성분표 앳워터
// 건사료는 소화율 보통이라 앳워터가 잘 맞음(화식과 달리 과소추정 문제 거의 없음).
export async function resolveKibbleKcal(s: SurveyInput, db: KibbleDb):
  Promise<{ kcalPer100g: number | null; source: 'db'|'label'|'atwater'|'none' }> {
  if (s.kibbleProductId) {
    const p = await db.getProduct(s.kibbleProductId);
    if (p?.kcalPer100g) return { kcalPer100g: p.kcalPer100g, source: 'db' };
  }
  if (s.kibbleKcalPer100g != null) return { kcalPer100g: s.kibbleKcalPer100g, source: 'label' };
  if (s.kibbleGA) return { kcalPer100g: modifiedAtwaterKcalPer100g(s.kibbleGA), source: 'atwater' };
  if (s.kibbleRawInput) await db.logMissing(s.kibbleRawInput); // 다음 매장투어 우선순위
  return { kcalPer100g: null, source: 'none' };
}
```

### M9 — 배분 + 그램 환산 `allocatePortions`
```typescript
export function allocatePortions(mainPool: number, s: SurveyInput, kibbleKcalPer100g: number|null) {
  const share = s.hwasikShare ?? CAL.DEFAULT_HWASIK_SHARE;
  const hwasikKcal = mainPool * share;
  const kibbleKcal = mainPool * (1 - share);
  const hwasikGrams = Math.round(hwasikKcal / (s.hwasikKcalPer100g / 100)); // 화식 실측값
  const kibbleGrams = kibbleKcalPer100g ? Math.round(kibbleKcal / (kibbleKcalPer100g / 100)) : null;
  return {
    hwasik: { kcal: Math.round(hwasikKcal), grams: hwasikGrams, sku: s.hwasikSku },
    kibble: { kcal: Math.round(kibbleKcal), grams: kibbleGrams },
  };
}
```

### M_aux — 모디파이드 앳워터 (건사료 폴백)
```typescript
export function modifiedAtwaterKcalPer100g(ga: GuaranteedAnalysis): number {
  const nfe = 100 - (ga.crudeProtein + ga.crudeFat + ga.crudeFiber + ga.moisture + ga.ash);
  const mePerKg = 10 * (CAL.ATWATER_PROTEIN*ga.crudeProtein + CAL.ATWATER_FAT*ga.crudeFat + CAL.ATWATER_NFE*Math.max(nfe,0));
  return +(mePerKg / 10).toFixed(1);
}
```

### M10 — 재측정 피드백 (옵션 C의 수렴 엔진)
```typescript
type Goal = 'maintain'|'lose'|'gain';
export function feedbackAdjustment(prevDer: number, weightDeltaPct: number, days: number, goal: Goal) {
  const weeks = days/7, rate = weightDeltaPct/weeks;
  if (goal === 'maintain') {
    if (Math.abs(weightDeltaPct) <= CAL.MAINTAIN_TOLERANCE_PCT) return { newDer: prevDer, note:'유지 양호.' };
    const dir = weightDeltaPct > 0 ? -1 : +1;
    return { newDer: Math.round(prevDer*(1+dir*CAL.FEEDBACK_STEP_PCT)), note: dir>0?'체중 증가 → −10%':'예상외 감량 → +10%' };
  }
  if (goal === 'lose') {
    if (rate < CAL.LOSS_RATE_MIN_PCT_WK) return { newDer: Math.round(prevDer*(1-CAL.FEEDBACK_STEP_PCT)), note:'감량 정체 → −10%' };
    if (rate > CAL.LOSS_RATE_MAX_PCT_WK) return { newDer: Math.round(prevDer*(1+CAL.FEEDBACK_STEP_PCT)), note:'감량 과속 → +10%' };
    return { newDer: prevDer, note:'감량 속도 적정.' };
  }
  return rate <= 0 ? { newDer: Math.round(prevDer*(1+CAL.FEEDBACK_STEP_PCT)), note:'증량 정체 → +10%' } : { newDer: prevDer, note:'증량 진행.' };
}
```
> **옵션 C 핵심**: BCS(3분해)는 "괜찮은 시작점"일 뿐. 견주 자가진단 오차는 이 루프가 2~4주마다 형태 변화 기준으로 잡아 수렴시킨다. BCS가 완벽하지 않아도 시스템 전체는 정답에 수렴.

---

## 7. 견종 플래그표 (한국 인기견)

> OB=비만경향, TOY=토이과대추정, BRA=단두종, HD=고활동, CHD=연골이형성

| 견종 | 플래그 | 처리 |
|---|---|---|
| 말티즈 | TOY | 성장식 하향·정밀 계량 |
| 토이/미니 푸들 | TOY | 동일 |
| 포메라니안 | TOY | 코트로 체형 가려짐 → 촉지 |
| 시츄 | TOY, BRA | 활동 가산 억제·열 주의 |
| 비숑 | TOY | 코트 촉지 |
| 치와와 | TOY | 절대량 작음 |
| 웰시코기 | OB, CHD | 마른 유지(디스크) |
| 닥스훈트 | OB, CHD | 마른 유지 의학적 필수 |
| 코커스패니얼 | OB | easy-keeper |
| 골든리트리버 | OB | easy-keeper |
| 래브라도 | OB | POMC 변이(식욕↑·대사↓) — 최고 경계 |
| 진돗개 | HD | 서구 데이터 없음 → 크기모델+재측정 |
| 미니슈나우저 | OB | 고지혈증 주의(지방 레시피) |
| 요크셔테리어 | TOY | 성장식 과대추정 직접 확인됨 |
| 프렌치불독 | OB, BRA | 활동 낮음·열 약함 |
| 믹스견 | (없음) | 크기모델 기본, 표현형 명확할 때만 플래그 |

---

## 8. 가드레일 & 클램프

1. **RER 바닥**: 유지 목적이면 `RER(IBW)` 아래 금지(계수 하한 1.0).
2. **감량 하한**: `RER(IBW)×0.8` 미만 금지, 지속 시 수의 안내.
3. **성견 계수 클램프** `[1.0, 2.0]`. **곱셈 금지**(가산+클램프).
4. **질병/투약 → 자동계산 중단**(수의 라우팅).
5. **개체차 ±30%(개)**: 모든 출력 `isEstimate:true` + "2~4주 재측정".
6. **이중차감 금지**: BASE에 든 요인(실내·중성화·저활동·소형)을 계수에서 또 빼지 않기. 견종 OB와 설문 easy-keeper는 OR로 묶어 **감산 1회**.
7. **화식 kcal = 실측값만**. 앳워터는 건사료 폴백 전용(화식은 고소화율이라 앳워터가 과소추정 → 과다급여 유발).
8. **자견 성장식 앞 상수 130 확인**(70 아님).

---

## 9. 오케스트레이터

```typescript
export async function computeFeedingPlan(s: SurveyInput, db: KibbleDb): Promise<FeedingPlan> {
  const flags = breedToFlags(s.breed);
  const bcs = deriveBCS(s.bodyAssessment);
  const path = classifyPath(s, bcs);
  const notes: string[] = [];

  if (path === 'vet_referral')   return vetReferral(s, flags, bcs, ['건강 상태로 자동 산출 대신 수의 상담 필요.']);
  if (path === 'reproduction')   return vetReferral(s, flags, bcs, reproductionBranch(s).notes, 'reproduction');

  if (path === 'growth') {
    const g = growthBranch(s, flags);
    return assemble(s, db, flags, bcs, { path, ibw: s.currentWeightKg, rer: g.rer,
      factor: g.factor, lines:[{label:`성장기 ×${g.factor}(근사)`, delta:g.factor}], der: g.der, notes: g.notes });
  }

  const ibw = estimateIdealBodyWeight(s.currentWeightKg, bcs);
  const rer = calculateRER(ibw);
  let factor: number, lines: FactorLine[];
  if (path === 'weight_loss') { const w = weightManagementBranch(flags); factor=w.factor; lines=[{label:'감량(RER×1.0)', delta:w.factor}]; notes.push(...w.notes); }
  else { const a = calculateAdultFactor(s, flags); factor=a.factor; lines=a.lines; if (flags.chondrodystrophic) notes.push('연골이형성 — 마른 체형 유지 권장.'); }

  return assemble(s, db, flags, bcs, { path, ibw, rer, factor, lines, der: Math.round(rer*factor), notes });
}

async function assemble(s, db, flags, bcs, x): Promise<FeedingPlan> {
  const t = applyTreatDeduction(x.der, s); if (t.note) x.notes.push(t.note);
  const k = await resolveKibbleKcal(s, db);
  const alloc = allocatePortions(t.mainPool, s, k.kcalPer100g);
  x.notes.push('이 값은 2~4주 시작 추정치입니다(개체차 ±30%). 재측정 후 조정하세요.');
  if (alloc.kibble.grams == null) x.notes.push('건사료 kcal 정보가 없어 건사료 그램 미산출.');
  return { path:x.path, derivedBcs:bcs, breedFlags:flags, idealWeightKg:x.ibw, rer:x.rer, factor:x.factor,
    factorBreakdown:x.lines, der:x.der, treatKcal:t.treatKcal, mainPoolKcal:Math.round(t.mainPool),
    hwasik:alloc.hwasik, kibble:{...alloc.kibble, source:k.source}, notes:x.notes, isEstimate:true };
}

export function classifyPath(s: SurveyInput, bcs: number): FeedingPlan['path'] {
  if (s.healthFlags.some(f=>f!=='none')) return 'vet_referral';
  if (s.isPregnant || s.isLactating) return 'reproduction';
  if (s.lifeStage === 'puppy') return 'growth';
  if (bcs >= 6) return 'weight_loss';
  return 'adult';
}
```

---

## 10. 테스트 케이스

### T1 — 전형적 한국 반려견 (감산)
6kg, 갈비뼈 easy·허리 clear·배 tucked(→BCS5), 8세, 중성화, 실내, 활동 low, easyKeeper, 화식 chicken(115), 건사료 350, 간식 없음, 30%.
- IBW=6, RER=70×6^0.75=**268.4**
- 계수 = 1.4 −0.1(중년) −0.1(easyKeeper) = **1.2** → DER=**322**
- 화식=322×0.3=96.6 → /1.15=**84g**, 건사료=225.4 → /3.5=**64g**
- ✅ 기존 1.6이면 429 → **감산형 −25%**

### T2 — 과체중 (감량)
8kg, 갈비뼈 hard·허리 none·배 sagging(→BCS9), 5세, 중성화, 실내.
- BCS9 → 초과 40% → IBW=8/1.4=**5.71**, RER=70×5.71^0.75=**259.3**
- 계수 1.0 → DER=**259**. notes: 주 0.5~2% 감량, BCS 종료, 재측정.

### T3 — 래브라도 (견종 OB 반영)
30kg, 갈비뼈 easy(→BCS5), 4세, 중성화, 실내, 활동 mid, breed=labrador.
- flags.obeseProne=true → easyKeeper 감산 발동
- IBW=30, RER=70×30^0.75=**897.4**
- 계수 = 1.4 −0.1(OB/easyKeeper) = **1.3** → DER=**1167**
- ✅ 견종이 kcal을 직접 바꾸지 않고 easy-keeper 감산 1회로만 반영(이중차감 없음).

### T4 — 자견 성장식 (130 검증)
현재 3kg, 성견예상 8kg, breed=poodle_toy(TOY).
- p=0.375
- 정확식=130×3^0.75×3.2×(e^(−0.87×0.375)−0.1)=130×2.280×3.2×(0.7215−0.1)=130×2.280×3.2×0.6215=**589.5**
- 토이 하향 ×0.85 = **501kcal**
- ✅ (만약 v1처럼 70을 썼다면 317kcal → 약 46% 과소. 상수 130 필수 확인.)

### T5 — 노령 저활동 (하한)
4kg, 갈비뼈 easy(→BCS5), 12세, 중성화, 실내, low, isVeryInactive, easyKeeper.
- RER=70×4^0.75=**198.0**, 계수=1.4−0.2−0.1−0.1=**1.0**(하한) → DER=**198**

---

## 11. Supabase 저장 구조

```sql
-- 급여 플랜(설문 스냅샷 + 결과)
create table feeding_plans (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid references dogs(id),
  survey_input jsonb not null,
  plan jsonb not null,
  path text not null,
  derived_bcs int,
  der int not null,
  created_at timestamptz default now()
);

-- 건사료 DB (매장 투어로 채움. DB-우선 폴백의 1순위)
create table kibble_products (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  product_name text not null,
  package_size text,
  kcal_per_100g numeric,                 -- 라벨값 있으면 최우선
  crude_protein numeric, crude_fat numeric, crude_fiber numeric,
  moisture numeric, ash numeric,         -- kcal 없는 제품 앳워터 백업
  kcal_source text,                      -- 'label'|'atwater'|'feeding_trial'
  search_keywords text,
  created_at timestamptz default now()
);

-- "목록에 없음" 로그 → 다음 투어 쇼핑리스트 (자가성장)
create table kibble_requests (
  id uuid primary key default gen_random_uuid(),
  raw_input text not null,
  request_count int default 1,
  status text default 'pending',         -- 'pending'|'added'
  created_at timestamptz default now()
);

-- 재측정 이력 (피드백 루프)
create table reweighs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid references dogs(id),
  weight_kg numeric not null, bcs int,
  measured_at timestamptz default now(),
  prev_der int, new_der int, adjust_note text
);
```

---

## 12. SKU 확장 시 참고 (지금 구현 X)

> 아래는 **시니어/고단백 SKU가 실제로 생겼을 때** 별도 레이어로 추가. 지금 칼로리 계산식에는 넣지 않음.

- **MCS(근육점수)**: BCS(체지방)와 독립 축. 과체중이면서 근손실 가능. **칼로리가 아니라 단백질(레시피) 판단용** — 근손실 감지 시 고단백 SKU 추천. 추천할 제품이 있어야 작동하므로 시니어 라인 출시와 함께 도입.
- **시니어 단백질**: 나이로 칼로리는 줄지만 단백질은 오히려 늘려야(근감소증 방지, 최대 +50%). 시니어 화식은 고단백·중지방으로. 계수(칼로리) 레이어가 아니라 레시피 추천 레이어.

---

## 13. 근거 부록 (핵심 인용)

| 값 | 근거 |
|---|---|
| RER = 70×BW^0.75 (지수식만, 선형식은 초소형견 과대추정) | AAHA 2021 / WSAVA / Merck |
| DER 계수 범위(중성화 1.4~1.6, 비활동/비만경향 1.0~1.2, 감량 1.0, 성장 3.0/2.0) | AAHA 2021 Nutrition/Weight Mgmt |
| 자견 정확식 **130**×BW^0.75×3.2×(e^−0.87p−0.1) | NRC 2006 |
| 토이/소형 자견 표준식 과대추정 | Yorkshire/Norfolk terrier 연구 (J Nutr Sci) |
| BCS 6~9 = 이상체중 대비 +10~40%, IBW로 RER 계산 | WSAVA/AAHA, Laflamme |
| 감량 1~2%/주, 형태 기준 종료 | AAHA 2014/2021 |
| 모디파이드 앳워터 3.5/8.5/3.5 (건사료), 고소화율 화식엔 과소추정 | AAFCO / Kienzle·Hill PLOS One 2013 |
| 개체차 ±30%(개) | WSAVA 2011 영양평가 가이드 |
| 견종 잔차 < 개체차 → 견종별 kcal표 부적절, 플래그로 | Bermingham 2014 메타분석 / Divol 2017 |
| 래브라도 POMC 변이: 식욕↑ + 대사율 ~25%↓ | Raffan 2016 Cell Metab / Dittmann 2024 Sci Adv |
| 비만경향 견종(퍼그·비글·골든·래브라도·코커·닥스훈트 등) | VetCompass, Pegram 2021 |
| 자가보고 활동은 DER 약한 예측변수 | 가속도계/FitBark DER 추정 부정확 연구 |
| 나이 age^−0.05 (10세 ≈ 2세의 −8%) | Divol & Priymenko 2017 (319마리, r²=0.836) |

---

## 14. 구현 체크리스트

- [ ] 🔴 자견 성장식 앞 상수 **130** 확인(70 아님) — T4로 회귀검증
- [ ] 체형 문항을 **3분해(갈비뼈·허리·배)**로, "몇 점?" 직접질문 제거
- [ ] 견종 → **플래그** 매핑, 계수 델타 아님. OB↔easyKeeper OR로 **감산 1회**
- [ ] 건사료 **DB→라벨→앳워터** 3단 폴백, "없음" → `kibble_requests` 로그
- [ ] 화식 kcal **SKU별 실측값** 하드코딩
- [ ] 활동 가산: 자가보고 +0.1, 객관증거만 +0.2~0.4, 단두종 억제
- [ ] 개체차 문구 **±30%**
- [ ] 계수 클램프 `[1.0,2.0]`, 곱셈 금지 유닛테스트
- [ ] 모든 계수 `factorBreakdown` UI 노출(투명성)
- [ ] MCS·시니어 단백질은 구현 제외, 문서에만 명시
- [ ] T1~T5 회귀 검증

---

*v2.0 — v1의 자견 성장식 상수 오류 수정, 견종 플래그·BCS 3분해·건사료 DB 폴백 추가, 개체차 ±30% 정정. 실측 데이터 축적 시 BASE_ADULT(1.4→1.3?)·각 Δ·화식 kcal 재튜닝 권장.*
