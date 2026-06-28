# FD식 자동회원가입 설계서 (트랙B)

> 상태: **설계 초안 (회차315)**. 사장님 확정 전까지 **코드/DB/인증 0수정**.
> 확정(2026-06-16): 방식 = "FD식 전면 — 익명설문 → 결과 직전 가입".
> 이 문서는 계획만 담는다. 실제 구현은 사장님이 단계별로 GO 한 뒤 착수.

---

## ★ AS-BUILT 현황 (회차331 갱신 — 아래 원안보다 우선)

> **회차321 전략 피벗**으로 원안 일부가 대체됨: 웹=콜드트래픽 미끼(라이트), 앱=본진(임상).
> 아래 §1~§8 은 원래 설계(임상 8스텝 재사용·블러 티저)라 일부 STALE — 실제는 다음과 같이 빌드됨.

**완성·배포대기(로컬, DB/auth 0접촉, 전부 localStorage):**
- `lib/autosignup-draft.ts` — 익명 초안 영속(key `ft:autosignup-draft`·7일만료). +테스트 6 (회차330).
- `lib/start-teaser.ts` — draft→`calculateNutrition` 매핑→간결 실값(merKcal·feedG·체형코멘트·추천단백질). +테스트 6 (회차329).
- `app/start/page.tsx`(+`layout.tsx` pass-through) — 랜딩(WebChrome) + 강아지 기본 step0 폼(`StartClient.tsx`, 8필드).
- `app/start/survey/page.tsx` — **chrome 없는 클린 풀스크린** 설문 라우트(로고+나가기만).
- `app/start/StartSurvey.tsx` — **웹 라이트 5문항**(체형 3택·알레르기·입맛·현재식사·건강관심사, None옵션) → **간결 티저**(실값+정직 디스클레이머+리셋).

**AS-BUILT 흐름**: `/start`(랜딩+step0) → `/start/survey`(라이트 5문항) → 티저 결과 → CTA `정밀 분석 받기`→`/signup`.
- 원안 §3 → **옵션A(localStorage) 채택**. 원안 §4 임상 8스텝 → **라이트 5문항으로 대체**. 원안 블러 티저 → **간결 실값 공개**(정밀은 앱 유도).

**남은(전부 사장님 게이트 — 무단 착수 금지):**
- **B4** 결과 직전 인라인 자동가입(웹) — auth 인접.
- **B5** draft→dogs+surveys+analyses 이관(`applyAutosignupDraft`) — DB/auth 불변영역. 이메일확인 ON시 첫로그인 복원 분기(원안 §3 옵션A).
- **B6** 진입 CTA `planHref`(미인증) `/signup`→`/start` flip — 전 마케팅 페이지. (B4/B5 완성 전엔 무의미하므로 후순위.)
- **해제 질문 2개**: ⓐ 가입 위치 = 웹 인라인 vs 앱(현 CTA→/signup) · ⓑ Supabase 이메일확인 ON/OFF.

---

## 0. 목표 (FD 레퍼런스)

파머스독(thefarmersdog.com)은 **가입을 강요하지 않고** 먼저 강아지 정보를
물어보는 익명 퀴즈(`/quiz`)를 돌린 뒤, **결과/플랜을 보여주기 직전**에
이메일+비번으로 계정을 만든다. 즉 "가치(맞춤 분석)를 먼저 보여주고, 그걸
저장·열람하려면 가입" 순서다.

우리 현재 구조는 **정반대** — 가입이 맨 앞이라 비회원은 분석을 한 번도 못 본다.
이걸 FD식(익명 설문 → 결과 직전 가입)으로 뒤집는 게 트랙B.

---

## 1. 현재 아키텍처 (정확한 실측 — 회차315 정독)

### 1-A. 진입/가입
- `/signup` (`app/(auth)/signup/page.tsx`, client) — **web+app 공유, (auth) 그룹 = 불변영역**.
  - `supabase.auth.signUp({ email, password, options.data.signup_profile })`.
  - **만 14세 가드**: `birthYear` → `MAX_BIRTH_YEAR = currentYear - 14` (client) +
    `handle_new_user` 트리거가 `UNDER_14` reject (server). 2중 가드.
  - **이메일확인 분기(R84-1)**: Supabase "Confirm email" ON 이면 `signUp` 직후
    `data.session === null` → RLS가 profiles/consent/referral 쓰기 전부 거부.
    이때는 `sessionStorage('pending_signup_profile')` 캐시 + "인증 메일 보냈어요"
    안내 화면 → 사용자가 메일 링크 → 첫 로그인 시 복원.
    OFF 이면 즉시 `profiles.update` + `consent_log.insert` + referral RPC → `/dashboard`.
  - 동의: `agreeRequired`(필수: 14세+약관+개인정보), `agreeMarketingEmail/Sms`(선택,
    `consent_log` + `MARKETING_POLICY_VERSION`).
  - 소셜: 카카오/애플 OAuth (callback 서버, referral은 sessionStorage roundtrip).

### 1-B. 강아지 생성
- `/dogs/new` — `dogs` 행 생성. 영양계산 입력값 보유:
  `weight, age_value, age_unit, neutered, activity_level, gender` (+ weight_method 등).

### 1-C. 설문 게이트
- `app/(main)/dogs/[id]/survey/page.tsx` (server component):
  - `if (!user) redirect('/login?next=...')` — **인증 필수**.
  - `dogs` 소유 검증 (`user_id` 일치) 아니면 `/dogs`.
  - **30일 재분석 락** (`analyses` 최신행 기준; 체중/약물 "중요변경" 시만 우회).

### 1-D. 설문 제출 (`SurveyClient.tsx` `saveAndGoResult` 498~794)
순서:
1. `supabase.auth.getUser()` — 미인증이면 `/login`.
2. `surveys` insert — `{ dog_id, user_id, answers(JSONB), mcs_score, bristol…,
   chronic_conditions, budget_tier, … }` (다수 컬럼).
3. `dogs` update — `prescription_diet`, `weight_method/weight_measured_at` (조건부).
4. **`calculateNutrition(dog물리데이터, answers)`** — 클라이언트 계산 (RER/MER/매크로/미량).
   ← **여기서 dog의 weight·age·neutered·activity·gender 가 반드시 필요**.
5. `analyses` insert — `{ dog_id, survey_id, user_id, rer, mer, …, supplements, risk_flags }`.
6. `POST /api/rewards/survey-completion` (설문완료 포인트, best-effort).
7. `localStorage(STORAGE_KEY)` autosave 삭제.
8. `router.push('/dogs/[id]/analysis?fromSurvey=1')`.

**관여 테이블**: `dogs`, `surveys`, `analyses` — 전부 RLS `user_id` 게이트.
설문은 **dog가 먼저 존재**해야 성립 (dog_id FK + 물리데이터 의존).

---

## 2. 갭 분석 — FD식으로 가려면 풀어야 할 5가지

| # | 갭 | 난이도 | 비고 |
|---|---|---|---|
| G1 | 영양계산이 `dogs` 물리데이터 의존 → 익명단계에서 **강아지 기본정보(체중·나이·중성화·활동량·성별)를 먼저 수집**해야 함 | 중 | 설문 앞에 "강아지 기본" 스텝 추가 (현재 `/dogs/new` 필드 = 설문 안으로 흡수) |
| G2 | **이메일확인 ON 이면 signUp 직후 session=null → RLS가 dogs/surveys/analyses 쓰기 전부 차단** → 즉시 이관 불가 | **상** | 핵심 분기점. §3 참조 |
| G3 | 익명(비로그인)은 RLS상 어떤 테이블도 못 씀 → **초안 보관처** 결정 필요 (localStorage vs 서버 draft 테이블) | 상 | DB 테이블 신설 시 사장님 확인 (migration) |
| G4 | 설문 게이트(`survey/page.tsx`)가 인증·dog소유를 강제 → 공개 라우트는 **이 게이트 밖**에 새로 만들어야 (기존 게이트는 보존) | 중 | 앱/웹 분리 + 불변 게이트 보존 |
| G5 | 가입 후 분석은 **클라 계산** → 익명 때 미리 계산해 두고 가입 직후 그대로 저장? or 가입 직후 재계산? | 하 | 익명단계 계산 결과를 초안에 같이 저장 → 이관 시 재사용(중복계산 회피) |

---

## 3. 핵심 분기점 G2 — "이메일확인 ON/OFF" 에 따른 두 설계

가장 중요한 결정. 현 `/signup` 코드는 **둘 다** 핸들한다(ON=메일대기, OFF=즉시).
FD식 자동가입도 이 분기를 반드시 흡수해야 한다.

### 옵션 A — 초안은 **localStorage**, 이관은 "첫 인증 세션"에서 (이메일확인 ON/OFF 모두 안전)
- 익명 설문 답변 + 강아지 기본 + (선택)미리계산 분석 = `localStorage('ft:autosignup-draft')`.
- 결과 직전 인라인 가입(`auth.signUp`).
  - **OFF**: 즉시 session 있음 → 그 자리에서 dogs+surveys+analyses 생성 → 결과.
  - **ON**: session=null → "메일 인증하세요" 안내 + draft는 localStorage 유지 →
    메일 링크 → 첫 로그인 시 `applyAutosignupDraft()`(신규, `applySignupProfile` 형제)
    가 draft 픽업해 dogs+surveys+analyses 생성 → 결과로.
- **장점**: DB 테이블 신설 0 (migration 불필요), RLS 안건드림, 기존 패턴(`applySignupProfile`) 재사용.
- **단점**: 기기/브라우저 바뀌면 draft 유실(메일을 다른 기기서 열면 못 살림). FD도
  사실상 같은 한계 — 같은 세션 가정. 허용 가능한 트레이드오프.
- **추천**. 불변영역 침범 최소, migration 없음, "설계서 먼저 → 안전 증분".

### 옵션 B — 초안은 **서버 `survey_drafts` 테이블**(anon insert), 토큰 키로 이관
- 익명도 anon-key로 `survey_drafts(token, payload JSONB)` insert (RLS: anon insert-only).
- 가입 시 토큰을 계정에 연결 → 서버 액션이 draft→dogs/surveys/analyses 이관 후 draft 삭제.
- **장점**: 기기 바뀌어도 토큰만 있으면 생존, 서버 검증 강함.
- **단점**: **DB migration 필요(사장님 확인 必)** + anon RLS 정책 신설(보안 표면↑) +
  PIPA(익명 PII 보관기간/파기) 설계 부담. 과설계 위험.
- 보류 — 옵션 A로 충분하면 불필요.

> **권고**: **옵션 A 채택**. migration·RLS·신규 보안표면 0. 기존 이메일확인 분기와
> `applySignupProfile` 복원 패턴을 그대로 빌려 위험을 최소화.

---

## 4. 목표 흐름 (옵션 A 기준)

```
[공개 라우트 /start (또는 /quiz·/plan — 네이밍 사장님 결정)]   ← WebChrome, 인증 게이트 없음
  → 스텝0: 강아지 기본 (이름·체중·나이·중성화·활동량·성별)   ← G1: /dogs/new 필드 흡수
  → 스텝1~8: 기존 설문 (body·muscle·stool·diet·allergy·status·budget…)  ← 컴포넌트 재사용
  → (익명 미리계산) calculateNutrition → 결과 미리보기 "블러/티저"
  → ★ 결과 직전 인라인 가입(이메일+비번+필수동의, 만14세 가드)   ← (auth) signUp 로직 재사용
       ├ 이메일확인 OFF: 즉시 dogs+surveys+analyses 생성 → /analysis 전체공개
       └ 이메일확인 ON : draft localStorage 유지 + 메일안내 → 첫 로그인 시 이관 → /analysis
```

**비회원이 보는 가치**: 가입 전 "티저 결과"(예: 체형·하루 권장 칼로리 일부)는 노출,
**전체 분석(매크로·미량·보충제·SKU·가격)** 은 가입 후 — FD의 "결과 보려면 가입" 동형.

---

## 5. 단계별 구현 계획 (각 단계 작고 검증가능, 안전/위험 플래그)

| Phase | 내용 | 영역 | 선행 |
|---|---|---|---|
| **B0** | (이 문서) 설계 확정 + 사장님 5개 결정(§7) | 안전(문서) | — |
| **B1** | 공개 라우트 골격 `/start` (WebChrome pass-through, 인증게이트 없음, 빈 셸 + "강아지 기본" 스텝0 폼만) | 안전(신규 web 라우트, 기존 불변) | B0 |
| **B2** | 익명 설문 엔진 — 기존 `SurveyClient`/steps 를 **dog 불요 모드**로 재사용(props로 draft 주입, getUser 의존 제거한 분기) — **로직 복제 아닌 분기 추가** | 중(설문 컴포넌트, 로직보존) | B1 |
| **B3** | 익명 `calculateNutrition` 미리계산 + **티저 결과 미리보기**(블러/일부공개) | 안전(클라 계산, 표시) | B2 |
| **B4** | 인라인 가입 카드(결과 직전) — `(auth)` signUp 로직 **호출/재사용**(만14세·동의·이메일확인 분기 그대로) | **위험(auth 인접 — 신중)** | B3 |
| **B5** | 이관 함수 `applyAutosignupDraft()` (OFF=즉시, ON=첫로그인 복원) → dogs+surveys+analyses 생성 = `saveAndGoResult` 로직 재사용 | **위험(DB쓰기·인증)** | B4 |
| **B6** | 진입점 전환 — 마케팅 CTA `planHref(미인증)` 를 `/signup` → `/start` 로 (사장님 GO 시) | 중(전 페이지 CTA) | B5 |
| **B7** | 검증(tsc+eslint+E2E 익명→가입→분석 흐름) + 회귀(기존 /dogs/[id]/survey 게이트 흐름 무손상) | 안전(검증) | B6 |

각 Phase는 1~2 파일/틱, tsc+eslint GREEN, 로직보존. **B4·B5는 불변영역 인접 → 사장님
명시 GO 전 미착수**. DB migration 발생 시(옵션 B로 선회할 경우만) 사장님 별도 확인.

---

## 6. 불변(INVARIANT) 보존 체크

- (auth) signUp/consent/redirect 로직 = **재사용(호출)**, fork·재작성 금지.
- 만 14세 가드 (client `MAX_BIRTH_YEAR` + 트리거 `UNDER_14`) = 그대로 통과.
- 기존 `/dogs/[id]/survey` 서버 게이트(인증·dog소유·30일락) = **무손상 보존**
  (공개 라우트는 게이트 밖 신규 — 기존 흐름 그대로 동작).
- 결제/체크아웃, 법정 SiteFooter, DB apply(migration), git commit/push, 배포 = 불변.
- 정직성: 티저 결과에 가짜 수치·질병 단정·레시피 노출·가짜 기관 보증 금지.

---

## 7. 사장님 결정 (B0 게이트)

> 회차315 사장님 답변 반영:

1. **공개 라우트 이름** → ✅ **`/start`** 확정.
2. **초안 보관 방식** → ⏳ 보류("이해 안 됨" — 회차316 쉬운설명 후 재질문). 기술추천=옵션A(localStorage).
3. **이메일확인(Confirm email) 현재 설정** → ⏳ 미확인. ON/OFF? (Supabase Auth 설정.
   ON이면 "가입 직후 즉시 결과" 대신 "메일 인증 후 결과"가 기본. 단 옵션A면 같은 브라우저에서
   메일 확인 시 초안 생존 → 정상 동작. 교차기기만 유실).
4. **티저 공개 범위** → ✅ **대부분 블러 처리** 확정. (가입 전엔 거의 다 가리고, 핵심 일부만
   살짝 노출 → 가입 유도 강. 정직성: 블러 뒤 가짜 수치 금지, 실제 계산값을 가리는 것.)
5. **강아지 기본정보 수집 위치** → ✅ **설문 맨 앞 스텝0로 흡수** 확정. (`/dogs/new` 필드를
   익명 설문 안으로. 비회원이 dog 없이 바로 설문 시작.)

**B1 착수 잔여 게이트**: #2(초안방식) 확정 + #3(이메일확인 설정) 확인.

---

## 8. 참고 파일 (구현 시 진입점)

- 가입: `app/(auth)/signup/page.tsx` (signUp·동의·이메일확인 분기·14세 가드)
- 가입 복원 패턴: `lib/auth/applySignupProfile`(형제 `applyAutosignupDraft` 신설 모델)
- 설문 게이트: `app/(main)/dogs/[id]/survey/page.tsx` (보존 대상)
- 설문 엔진: `app/(main)/dogs/[id]/survey/SurveyClient.tsx` (`saveAndGoResult` 498~794 = 이관 로직 원형)
- 영양계산: `calculateNutrition` (클라), `getSupplements`/`getConditionSupplements`
- 동의: `lib/consent` (`MARKETING_POLICY_VERSION`)
- 진입 CTA: 각 마케팅 페이지 `planHref(isAuthed)` = `isAuthed ? '/dogs/new' : '/signup'`

---

_관련: [[project_survey_autosignup]] · FD_CLONE_QUEUE.md 트랙B · [[feedback_separation_of_concerns]]_
