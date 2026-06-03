# 추천 알고리즘 v2.0 재설계 (Re-foundation)

> 2026-06-03 · 최종 마스터 레시피 v2.1 기준 정합.
> 원칙: **임상 룰 엔진은 보존, SKU/라인 차대(샤시)만 재구축.**
> from-scratch 재작성 금지 — ~30개 인용 임상 룰 + 1049 테스트는 자산.

---

## 0. 왜

기존 알고리즘은 **옛 5-SKU 가정**(basic/weight/skin/premium/joint = 개념 라벨)으로
설계됐고, 최종 레시피의 **4 SKU + 연어보류 + 페르소나**와 개념이 어긋난다.
대표 증상: "체중관리 목표 → 오리 추천"(레시피는 닭=다이어트). 패치로 땜질하면
라인 이름과 실제가 영구히 어긋난 채 남는다. → 정체성을 **단백질 기준**으로 재정의.

이미 완료: **① 에너지밀도 교정** (닭130/오리150/돼지140/소160), **② 가용성 게이트**
(연어/토퍼 미오픈 자동 재분배). 둘 다 이 재설계의 일부로 흡수됨.

---

## 1. SKU 모델 SSOT (신설 `lib/personalization/skuModel.ts`)

라인 정체성 = **단백질 키** (`chicken`·`duck`·`pork`·`beef`·`salmon`).
개념(체중관리 등)은 **메타데이터**로 강등. allergy-sku-matrix 의 `mainProtein`
(이미 chicken/duck/...)과 **자동 통합**.

| 키(신) | 구(舊) | 단백질 | 페르소나 | 컨셉(메타) | kcal/100g | 토핑 | 차단 알레르기 | 교차반응 |
|---|---|---|---|---|---|---|---|---|
| `chicken` | basic | 닭가슴살 | 모찌 | 체중관리·항염 | 130 | 강황 | 닭·칠면조 | (어류 주의) |
| `duck` | weight | 오리안심 | 코코 | 알레르기·장건강(노블) | 150 | 사과 | 오리 | 닭·칠면조 |
| `pork` | joint | 돼지안심 | 토토 | 기호·신경 B1 | 140 | 무 | 돼지 | — |
| `beef` | premium | 한우목심 | 바람이 | 활력·프리미엄 | 160 | 블루베리 | 소고기·양고기 | 양고기 |
| `salmon` | skin | 연어 | (시니어) | 피부·털 EPA/DHA **[보류]** | (보류) | — | 연어·생선·흰살생선 | 어류 |

영양 프로파일(단백질/지방/Ca/P/Na/omega %DM)은 레시피 검증매트릭스에서
**target × 충족률**로 유도 (Phase E) — 예: 닭 단백질 = 20.7 × 2.39 ≈ 49.5%DM.

각 SkuDef: `{ protein, personaName, concept, kcalPer100g, profile{...}, slug,
blockingAllergies, crossReactWith, careGoalAffinity[], topping, deferred? }`.

---

## 2. 케어목표 → 단백질 (레시피 페르소나 기준 재유도)

| 케어 목표 | 신 매핑 | 구 매핑(오류) | 근거 |
|---|---|---|---|
| 체중관리 | **chicken**(닭) | weight=오리 ❌ | 닭 130kcal 최저 + 강황(모찌) |
| 알레르기 회피 | **duck**(오리) + pork + (salmon) | 분산 | 노블 단백질, allergy-matrix와 일치 |
| 활력 | **beef**(소) | beef ✓ | 헴철·B12 (바람이) |
| 기호·노견 | **pork**(돼지) | pork ✓ | B1 714% (토토) |
| 피부·털 | **salmon**→게이트→**duck** | skin=연어 | 연어 보류 시 오리(연어유 최다) + 영양제 |

---

## 3. 임상 룰 재배선 (로직 보존, 타겟만 교체)

~30개 룰의 **수의학 로직은 그대로**, 참조 단백질만 레시피 기준으로:

| 임상 의도 | 신 타겟 | 비고 |
|---|---|---|
| 비만/체중감량/당뇨/저활동 | chicken(닭, 최저kcal) | 구: weight(오리) → **핵심 교정** |
| 저단백(CKD 3-4) | beef 0%(소=고단백 차단) | 로직 동일 |
| 저지방(췌장염) | 최저지방 SKU로 shift | dmFatPct는 신 profile로 |
| 단일단백(IBD) | GI게이트가 메인 단일화 | 동일 |
| 관절(arthritis) | pork(돼지) + 글루코사민 권장 | 전용 관절SKU 없음 → 보조 |
| 피부염/CDS | salmon→게이트→duck + 오메가 | 게이트 흡수 |
| 활동량↑ | beef(소, 헴철) | 동일 |

> 슬개골/IVDD/갑상선/Cushing 등 "비만 악화" 룰: weight→**chicken** 일괄.

---

## 4. 시스템 통합

- `lib/personalization/lines.ts` (FOOD_LINE_META 등) → **skuModel 에서 파생/대체**.
- `lib/allergy-sku-matrix.ts` (SKU_META, C01~B05) → skuModel 의 단백질 키로 통합
  (중복 제거, 단일 진실).
- `skuMap.ts`(②) LINE_TO_SLUG → skuModel.slug 로 흡수.
- 영양 게이지/스파이더/비교 페이지 등 UI는 skuModel 참조.

---

## 5. 마이그레이션 / 호환

- **DB `algorithm_food_lines`**: `line` 컬럼 값 basic→chicken… + CHECK 제약 갱신
  + 프로파일(profile) 값 레시피 재정합. (신규 마이그레이션, 기존 미수정.)
- **DB `dog_formulas`**: 기존 formula JSONB 의 lineRatios 키가 구(basic…)라
  **키 rename 마이그레이션** 필요 (출시 전 테스트 데이터 — 소량). 또는 cycle1
  recompute. → 무중단 보장.
- **알고리즘 버전** `v1.6.1` → `v2.0.0`.

---

## 6. 실행 단계 (각 단계 tsc+test 검증 후 다음)

- **A. skuModel.ts SSOT 신설** + 프로파일 레시피 유도 (= ④ 흡수). 단위 테스트.
- **B. FoodLine 키 rename** (basic→chicken …) — types/lines/firstBox/nextBox/
  quantize/transfers/nutrientPanel/skuMap. tsc가 누락 전수 검출.
- **C. 케어목표 + 임상 룰 타겟 재배선** (= ③ 흡수). 테스트 갱신.
- **D. allergy-sku-matrix·기타 SKU lib 통합** (중복 제거).
- **E. DB 마이그레이션** (algorithm_food_lines + dog_formulas + 프로파일).
- **F. 테스트 전면 갱신 + 전체 검증 + v2.0 + 문서.**

각 단계 끝에 `npx tsc --noEmit` + `npm test` 그린 확인. 회귀 0 목표.

---

## 구현 결과 (2026-06-03) — 완료

- **① 에너지 + ② 게이트 + A skuModel** — 커밋 `d4d50bb`
- **③ 컨셉 정렬 + ④ 프로파일** — 커밋 `212c9e8`
  - ③는 **③-A 리바인드** 채택: 풀 키 rename 이 535곳/46파일이라 위험 과대 →
    `weight` 키 = 닭 바인딩 스왑으로 **임상 룰 ~30개 무변경** 레시피 정합.
  - 라인 키(basic/weight/…)는 내부 식별자 유지 (skuModel 이 SSOT,
    `LEGACY_LINE_TO_PROTEIN` 매핑). 사용자 0 영향.
  - `lines.ts` → skuModel 파생, DB `algorithm_food_lines` 프로파일 정합.
  - `ALGORITHM_VERSION` v2.0.0, 테스트 1063 그린.

### 백로그 (follow-up)
- **칩 텍스트 한글화** — 일부 chip 이 'Weight'/'Basic' 영문 키명 하드코드
  (③-A 에선 Weight=닭=체중관리라 의미는 맞음 — 한글화는 polish).
- **severe 췌장염 flag** — 화식 최저지방 닭 19%DM > 엄격 <15%. severe 는
  수의 처방식 필요 → 룰에 "화식 부적합" 경고 추가 권장.
- **Phase D** allergy-sku-matrix 통합 — 별 시스템(SKU코드)이라 보류 (이미 정확).
- **토퍼 4종 생성** — 가격·중량 정보 필요.
- **제품 라벨 (원 P0)** — 4 화식 `products.nutrition_facts/ingredients/
  feeding_guide/allergens` 를 레시피로 채우기 (사료관리법 표시기준).
