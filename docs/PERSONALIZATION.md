# Personalization 시스템 — 개요와 운영 매뉴얼

> 화식 5종 + 동결건조 토퍼를 강아지별 비율로 조합하는 D2C 정기배송의 핵심
> 시스템. 사용자 응답을 받아 매월 비율을 미세 조정한다.

마지막 업데이트: 2026-05-03 (라운드 39, 알고리즘 v1.1)

---

## 1. 비즈니스 모델 한 줄 요약

> 동일 SKU 라인업, 강아지별 다른 **비율 + 토퍼**.

규제 회피 트릭이자 이 모델의 핵심. 5종 화식 SKU 는 각각 사료관리법 신고된
독립 제품이고, 우리가 하는 일은 그 **조합 비율 결정 + 패키징** 뿐. 매번
새 레시피를 만드는 게 아니라 등록된 제품의 mix.

---

## 2. 5종 라인업

| 라인 | 메인 단백질 | 컨셉 | 100g kcal | 알레르기 차단 |
|---|---|---|---|---|
| Basic | 닭 | 균형 기본식 | 215 | 닭·칠면조 |
| Weight | 오리 | 체중관리·노블 | 175 | (없음 — 오리는 노블) |
| Skin | 연어 | 피부·털 | 225 | 연어·생선 |
| Premium | 소 | 활력·근육 | 195 | 소고기 |
| Joint | 돼지 | 시니어·관절 | 200 | 돼지고기 |

상세 영양 분석은 화식 5종 보고서 (별도 문서) 참조.

---

## 3. 데이터 흐름

```
사용자 설문 제출
   ↓
설문 페이지 → surveys 테이블 + analyses 테이블 (영양 calc)
   ↓
analysis 페이지 진입
   ↓
RecommendationBox.tsx 가 POST /api/personalization/compute
   ↓
서버: 최신 surveys + analyses 로드 → decideFirstBox()
   ↓
dog_formulas (cycle_number=1) row insert
   ↓
보호자 화면: 추천 박스 카드 노출

—— 28일 후 ——

cron: /api/cron/personalization-progression (매일 KST 04:00)
   ↓
cycle 만료된 dog_formulas 식별 → 같은 강아지의 dog_checkins 로드
   ↓
decideNextBox() → 새 cycle row insert
   ↓
push 알림: "OOO이 다음 박스 준비됐어요"
```

---

## 4. 알고리즘 v1.x

### 4.1 decideFirstBox (`lib/personalization/firstBox.ts`)

설문 만으로 첫 박스 비율 결정. **30+ if-else 룰**, 우선순위 0~9.

| Priority | 영역 | 영향 | 예시 룰 |
|---|---|---|---|
| 0 | 알레르기 | 라인 0% 강제 | 닭 알레르기 → Basic 0 |
| 1 | 케어 목표 | 메인 라인 선택 | joint_senior → Joint 60% / Premium 30% / Skin 10% |
| 2 | 나이 | 시니어 자동 보정 | 7세+ → Joint 20% 가산, puppy → Weight/Joint 0% |
| 3 | 만성질환 | 라인 분기 | kidney → Premium 0%, IBD → 단일 단백질 강제 |
| 4 | BCS | 미세 조정 | BCS 8-9 → Weight 60% 메인 |
| 5 | 임신/수유 | kcal 조정 (calc) | pregnant → 1.5x 칼로리 (영양 calc) |
| 6 | GI 민감도 | 단일 단백질 | always → 가장 큰 라인 100% collapse |
| 7 | 선호 단백질 | 가산점 | salmon 선호 → Skin +5% |
| 8 | 토퍼 | 야채/육류 비중 | first 화식 → 토퍼 0%, BCS 6+ → 야채 ↑ |

출력 = `Formula`:
- `lineRatios`: 5종 라인 비율 (합 1.0, 0.1 단위 quantize)
- `toppers`: { protein, vegetable } — 화식 위에 추가 (cap 30%)
- `reasoning`: `Reasoning[]` — UI chip 데이터, 우선순위 오름차순
- `transitionStrategy`: aggressive / gradual / conservative
- `algorithmVersion`: 'v1.0.0' / 'v1.1.0'

### 4.2 decideNextBox (`lib/personalization/nextBox.ts`)

cycle 2+ 부터 호출. 이전 처방을 baseline 으로 두고 **체크인 응답으로 미세
조정**.

| Priority | 영역 | 룰 |
|---|---|---|
| 0 | 새 알레르기 | 재설문에 새 알레르기 추가 → 즉시 0% |
| 1 | 만족도 freeze | satisfaction === 5 → 큰 변화 회피 (우선) |
| 2 | 만족도 낮음 | satisfaction ≤ 2 → 수의사 상담 chip |
| 3 | 변 지속 무름 | week_2 + week_4 둘 다 무름 → 단일 단백질 collapse |
| 4 | 변 신호 | 한쪽만 무름 → Skin/Premium ↓ 5%, Weight ↑ |
| 5 | 털 | coat ≤ 2 → Skin +15%, coat 3 → +5% |
| 6 | 식욕 | appetite ≤ 3 + 선호 단백질 → 그 라인 +10% |

체크인 0개 (응답 없음) → 이전 비율 유지 + reasoning chip "응답 없음 → 유지".

### 4.3 핵심 원칙

1. **Pure function** — DB / 네트워크 / Date 호출 없음. 결정적, 테스트 가능.
2. **Audit trail** — 모든 룰 발화는 Reasoning 발화 → UI chip + 디버깅.
3. **Quantize 0.1 단위** — 운영 36조합 베이스 패치 매핑 가능, 사용자 직관.
4. **Conservative defaults** — 모호한 상황엔 단순 조합 + 토퍼 최소.
5. **점진 변화 (next)** — 매 cycle ±5~15%. 큰 swing 은 churn 유발.
6. **만족도 freeze** — "잘 되고 있을 때 안 건드림".

---

## 5. DB 스키마

### `surveys` (마이그 `20260502000001`)

기존 임상 평가 컬럼 (BCS / MCS / Bristol / 만성질환) +
**personalization 7 필드**:

| 컬럼 | 타입 | 의미 |
|---|---|---|
| care_goal | text | 케어 목표 5개 enum (1순위 변수) |
| home_cooking_experience | text | first / occasional / frequent |
| current_diet_satisfaction | smallint 1-5 | 4주차 비교 baseline |
| weight_trend_6mo | text | stable / gained / lost / unknown |
| gi_sensitivity | text | rare / sometimes / frequent / always |
| preferred_proteins | text[] | chicken/duck/beef/salmon/pork/lamb |
| indoor_activity | text | calm / moderate / active |

### `dog_formulas` (마이그 `20260502000002`)

매 cycle 처방. UNIQUE (dog_id, cycle_number).

| 컬럼 | 타입 | 의미 |
|---|---|---|
| dog_id | uuid | dogs FK |
| user_id | uuid | auth.users FK |
| cycle_number | smallint | 1, 2, 3, ... |
| formula | jsonb | { lineRatios, toppers } |
| reasoning | jsonb | Reasoning[] |
| transition_strategy | text | aggressive / gradual / conservative |
| algorithm_version | text | 'v1.0.0' 등 |
| user_adjusted | boolean | 사용자 직접 조정 여부 |
| daily_kcal / daily_grams | smallint | 영양 calc snapshot |
| applied_from / applied_until | date | cycle 적용 기간 |

### `dog_checkins` (마이그 `20260502000002`)

매 cycle 의 week_2 / week_4 응답. UNIQUE (dog_id, cycle_number, checkpoint).

| 컬럼 | 타입 | 의미 |
|---|---|---|
| cycle_number | smallint | 어느 cycle 에 대한 응답인지 |
| checkpoint | text | week_2 / week_4 |
| stool_score | smallint 1-7 | Bristol |
| coat_score | smallint 1-5 | 털 윤기 |
| appetite_score | smallint 1-5 | 식욕 |
| overall_satisfaction | smallint 1-5 | 종합 만족 (week_4 핵심) |
| photo_urls | text[] | 미래용 (vision 분석) |

---

## 6. API endpoints

| Method | Path | 용도 |
|---|---|---|
| POST | `/api/personalization/compute` | 첫 박스 처방 생성 (analysis 페이지 자동 호출) |
| POST | `/api/personalization/checkin` | 보호자 체크인 응답 저장 |
| POST | `/api/personalization/adjust` | 사용자 비율 직접 조정 |
| GET | `/api/cron/personalization-progression` | 매일 cycle 진행 (CRON_SECRET) |

전부 user-scoped (RLS) + rate limit + Zod 검증.

---

## 7. Cron 진행 흐름

```
매일 KST 04:00 (UTC 19:00)
  │
  ├─ dog_formulas 중 만료된 (applied_until <= today 또는
  │   applied_from NULL + created_at 28일 전) cycle 식별
  │
  ├─ dog 별 max(cycle_number) 만 추출 (이미 진행된 강아지 제외)
  │
  ├─ 각 강아지: latest survey + analysis + 현재 cycle checkins
  │
  ├─ decideNextBox(previousFormula, checkins, surveyInput, cycle+1)
  │
  ├─ 새 dog_formulas insert (applied_from=today, applied_until=+28d)
  │
  └─ push 알림: "OOO이 다음 박스 준비됐어요"
       category: 'order' (push_preferences.order_enabled 존중)
       tag: formula-cycle-{dogId}-{cycle} (OS dedupe)
```

가드: MAX_PER_RUN=100 / 50ms 딜레이 / Sentry trace / best-effort (한 강아지
실패해도 진행).

---

## 8. UI 통합

### 8.1 Analysis 페이지 (`/dogs/[id]/analysis`)

`RecommendationBox.tsx` 가 자동 노출. 영양 분석 ↔ AI 구조화 분석 사이 위치.

⚠️ **현재 placeholder 디자인.** 클로드 디자인 핸드오프 받으면 같은
컴포넌트 자리에서 교체 가능. API / 데이터 흐름은 그대로 유지.

표시 요소:
- 헤로 (이름 + 전환 전략 + kcal/g)
- Stacked bar (5 라인 비율)
- 라인 list (% + 부제)
- 토퍼 섹션 (있을 때)
- Reasoning chips (top 6)
- 알고리즘 버전 / 자동 조정 안내

### 8.2 Admin

| Path | 용도 |
|---|---|
| `/admin/personalization` | KPI + 케어목표 분포 + 알고리즘 시뮬레이터 |
| `/admin/personalization/picking-list` | 일일 박스 패킹 워크리스트 + CSV 다운로드 |

시뮬레이터는 client-side pure 호출 — 인풋 즉시 반영. 운영자가 새 룰 검증 /
클레임 대응에 사용.

---

## 9. 운영 KPI

| 지표 | 의미 | 대시보드 |
|---|---|---|
| `total_formulas` | 누적 처방 건수 | /admin/personalization |
| `user_adjusted_rate` | 사용자가 비율 수정한 % | /admin/personalization (낮을수록 알고리즘 정확) |
| `checkin_response_rate` | 응답률 | /admin/personalization |
| `care_goal_distribution` | 케어 목표 분포 | /admin/personalization (수요 예측) |
| `formula_changes_per_cycle` | cycle 별 평균 변화량 | (TBD — 알고리즘 v2 학습용) |

---

## 10. 출시 전 체크리스트

- [ ] 마이그 3개 prod 적용 확인
  - [ ] `20260502000000_newsletter_rls_tighten.sql`
  - [ ] `20260502000001_survey_personalization_fields.sql`
  - [ ] `20260502000002_personalization_tables.sql`
- [ ] PostgREST 캐시 reload (`NOTIFY pgrst, 'reload schema';`)
- [ ] 5종 SKU 가 `products` 테이블에 등록되었는지 (admin 입력)
- [ ] 첫 50명까진 운영자가 dog_formulas 결과 수동 검토 — 휴리스틱 학습
- [ ] LAUNCH_CHECKLIST.md 의 마이그/cron 섹션 동기화
- [ ] Joint 라인 효능 워딩 변호사 검토 (사료관리법 / 표시광고법)
- [ ] 클로드 디자인 핸드오프 → RecommendationBox 교체

---

## 11. 미래 (v1.x → v2)

- **사진 기반 분석** (`photo_urls` → Claude Vision) — Bristol/coat 자동 분류
- **Cohort 비교** — "당신 강아지 같은 5kg 7세 보호자의 80% 가 이 조정 후 만족"
- **다견 가구 정책** — 가입 흐름에 다견 옵션 + 박스 통합/할인
- **알고리즘 v2 (ML)** — user_adjusted 비율이 1년 후 충분히 쌓이면
  단순 if-else 룰 → 학습 모델로 전환

---

## 12. 디버그 / 트러블슈팅

### "Could not find the 'care_goal' column"
PostgREST 스키마 캐시 stale. SQL Editor 에서:
```sql
NOTIFY pgrst, 'reload schema';
```

### "추천 불러오지 못했어요"
- `/api/personalization/compute` 가 503/500 → DevTools Network 탭 확인
- 마이그 `20260502000002` 미적용 → dog_formulas 테이블 없음

### Cron 실패율 ↑
- Sentry 에서 `personalization.progression.failed` 검색
- DB 부하 ↑ 시 MAX_PER_RUN 줄이기 (현재 100)

### user_adjusted 비율 50%+
알고리즘 정확도 떨어진다는 신호. 룰 재검토 필요. 보통:
- 케어 목표 매핑이 너무 narrow 한 케이스 (예: "체중관리" 인데 사용자가
  Premium 도 늘리고 싶어함)
- 알레르기 대안 라인 결정이 사용자 의도와 어긋남
- 시뮬레이터 (`/admin/personalization`) 로 회귀 검증
