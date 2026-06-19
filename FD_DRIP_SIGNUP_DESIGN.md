# FD식 드립 회원가입 구현 설계서 (B4 + B5)

> 출처: `drip-signup-design` 워크플로우(회차332, 5에이전트 병렬 인증기계 정독 → 검증 합성).
> 범위: `/start/survey` 라이트 설문 중간에 가입 정보 점진 수집 → 마지막 "결과 보기" 시
> `supabase.auth.signUp`(이메일확인 ON) → 메일 인증 후 첫 로그인 시 localStorage 초안을
> dogs/surveys/analyses로 이관.

## 0. 전제 (사장님 확정 + 불변)

- 가입 = 웹 인라인 **드립**. 필드 = 이메일·비밀번호·보호자 이름·약관/개인정보 동의·만14세.
  휴대폰·주소는 첫 주문 때(`phone:'' zip:'' address:''`로 넘김).
- **이메일확인 ON**: signUp 직후 `data.session === null`. 메일 인증 → 첫 로그인 시 이관.
- 불변: ①(auth)/signup **미수정**(호출/재사용만) ②비번 localStorage 금지(메모리 only)
  ③만14세 가드 보존 ④DB apply/migration 금지(설계만) ⑤가짜데이터 금지 ⑥웹 라우트 규칙.

### ★ 결정적 발견 (구현 전 반드시 반영)
- **만14세 트리거 `enforce_min_age_14`는 `birth_year IS NULL`이면 통과**(`supabase/migrations/20260424000004_profile_birth_year.sql`).
  → 체크박스만으로는 14세 가드가 **DB에서 작동 안 함**. **출생연도(birth_year) 수집 필수**.
  (사장님 "만14세"의 실효 메커니즘 = 출생연도 입력. 기존 /signup도 출생연도로 가드.)
- **consent_log channel CHECK = ('email','sms','consent_level','newsletter')** — 'terms'/'privacy' 채널 없음.
  → 필수 동의(약관·개인정보)는 **DB 미기록, 클라 게이트(`agreeRequired`)로만 강제**(기존 signup과 동일).

## 1. 드립 흐름 — phase 상태

```ts
type Phase = 'survey' | 'signup' | 'result'   // StartSurvey 에 도입
```
라이트 5문항(STEPS: body/allergy/taste/food/health)은 그대로 + draft 저장 유지(PII 아님).
가입 필드는 **STEPS에 안 섞고 별도 분기**(비번이 answers=draft에 들어가면 안 됨 + 칩 UI와 안 맞음).

| 위치 | 수집 | 검증 |
|---|---|---|
| body | (설문) | 기존 |
| allergy | (설문) | 기존 |
| **allergy 뒤 인라인** | **보호자 이름 · 이메일** | 이름 2자+ / 이메일 regex (메모리 only, draft 미저장 권장) |
| taste / food / health | (설문) | 기존 |
| **마지막 스텝 다음 = signup phase** | **비밀번호 · 출생연도 · [필수]약관/개인정보+만14세** | 비번 6자+ / birth_year ≤ currentYear-14 / agreeRequired |
| 제출 후 = result phase | 티저 노출 | — |

- 마지막 `handlePrimary`의 `setShowResult(true)` → `setPhase('signup')`. 티저의 `<Link href="/signup">` → 인라인 가입 카드.
- 이름·이메일은 signup phase에서 읽기전용 요약 + 수정 링크.

## 2. 비밀번호 보안 (불변 ②)
- 비번 = `useState` 메모리 only, signUp 직전까지. `saveAutosignupDraft` 시그니처 `{dog,answers}` **불변**(새 필드 금지 = 구조적 안전).
- result phase 진입 시 `setPassword('')` 즉시 폐기.
- **단위테스트**: 전체 플로우 후 `localStorage['ft:autosignup-draft']`에 password 문자열 부재 assert.

## 3. 계정 생성 (B4) — signUp + 이메일확인 분기

### 3.1 signUp 인자 (기존 signup 형태 그대로 조립, (auth) 파일 미수정)
```ts
supabase.auth.signUp({
  email: email.trim(), password,          // 비번=메모리
  options: { data: { signup_profile: {    // ★ top-level 'name' 금지 — 반드시 중첩
    name: guardianName.trim(), phone: '', zip:'', address:'', address_detail:'',
    birth_year: birthYearNum,             // ★ 만14세 가드 발동 필수
    birth_month: null, birth_day: null,
    agree_email: agreeMarketingEmail, agree_sms: agreeMarketingSms,
    referral_code: '',
  } } },
})
```
- top-level `name` 금지 이유: `handle_new_user` 트리거가 top-level name을 읽으면 "name 비어있음=복원신호"가 깨짐. 중첩 → 트리거 영향 0.
- signUp 호출은 라이브러리 API라 (auth) 파일에 종속 안 됨 → 인자만 동일 조립 = 재사용.

### 3.2 이메일확인 ON (session=null) 처리
1. **즉시 티저 노출**(`computeStartTeaser(draft)` — 클라 계산, 무인증) → `setPhase('result')`.
2. 안내: "{email}로 인증 메일을 보냈어요. 링크 누른 뒤 로그인하면 앱에서 정밀 분석을 저장·열람할 수 있어요." (가짜 0)
3. draft 유지(dog+answers는 이미 localStorage, 비번 제외 자동). **DB write 0**(RLS 거부 — 시도 금지).
4. 에러 = `humanizeSignupError` 동일 정책(재사용 or 동일 매핑 복제).
5. (방어) OFF여서 session 존재 시 → 즉시 이관 후 `/dogs/[id]/analysis`로 한 줄 분기.

## 4. 이관 (B5) — `applyAutosignupDraft`

### 4.1 훅 = 첫 로그인 진입점 (`app/(auth)/login/page.tsx` handleLogin, applySignupProfile 복원 직후·`router.push` 앞)
```ts
const draft = loadAutosignupDraft()
if (draft && isDogDraftComplete(draft.dog)) {
  const dogId = await applyAutosignupDraft(supabase, signedIn.id, draft)
  clearAutosignupDraft()
  router.replace(`/dogs/${dogId}/analysis?fromSurvey=1`); return
}  // try/catch — 이관 실패가 로그인 막지 않음
```

### 4.2 본문 = `saveAndGoResult`(SurveyClient 498-794) mirror (익명이라 dogs INSERT 선행)
`dogs INSERT`(NewDogClient 217-234 shape) → answers 매핑(start-teaser 재사용: body→bodyCondition 등) →
`surveys INSERT`(saveAndGoResult surveyInsertPayload 동일컬럼, 라이트라 임상필드 null/기본, budget_tier cast 패턴) →
`calculateNutrition` → supplements/nextReview → `analyses INSERT`(704-730 컬럼 1:1) → return dogId.
- **멱등 가드**: 이관 전 `dogs.eq('user_id').limit(1)` 존재 확인 → 있으면 스킵. `clearAutosignupDraft()` 1회성. (기존 회원 추가 강아지 등록과 비충돌 조건 — 확인 필요.)
- 부분 실패 시 draft clear 보류(재시도 가능).

## 5. 구현 분해 (1~2파일/틱, 각 tsc+eslint GREEN)
| 슬라이스 | 범위 | 파일 |
|---|---|---|
| **B4-1** | phase state + 이름·이메일 인라인 스텝 + signup phase UI(비번·출생연도·약관). **signUp 미연결**(UI만, 리스크 격리) | `app/start/StartSurvey.tsx` |
| **B4-2** | signUp 호출 + 이메일확인 분기(티저+안내, DB write 0) + humanizeSignupError | `app/start/StartSurvey.tsx` (+`lib/` 헬퍼 가능) |
| **B5-1** | `lib/auth/applyAutosignupDraft.ts`: dogs→surveys→analyses(saveAndGoResult mirror) + 멱등 가드 | 신규 `lib/auth/applyAutosignupDraft.ts` |
| **B5-2** | login handleLogin 훅(draft→이관→clear→/analysis, push 앞) | `app/(auth)/login/page.tsx` |
- 권장 순서 B4-1→B4-2→B5-1→B5-2. B4-1은 signUp 미연결이라 안전(먼저 머지 가능).

## 6. 리스크 (적대검증) / 확인 필요
- **R1(높음·법적)**: 14세 트리거 birth_year NULL 통과 → **출생연도 수집 필수**(클라 MAX_BIRTH_YEAR + 트리거 2중).
- **R2(중)**: 이메일확인 ON 교차기기 유실(draft는 가입 기기 localStorage) → 안내카피 "가입한 기기서 로그인" + graceful(이관실패 무시). 근본해결=서버draft(옵션B, DB인접→사장님 확인).
- **R3(높음)**: draft 비번 누출 → 시그니처 불변 + 단위테스트 assert.
- **R4(중)**: 미인증 RLS 거부 → ON 분기에서 이관 시도 금지.
- **R5(중)**: 이관 멱등 결여 → dog 존재 가드 + clear 1회성.
- **R7(중)**: (auth)/login 수정 = 정식 훅 지점(signup_profile 복원도 이미 거기) — auth 인접이나 GO 받음(사장님 "가입 웹에서" = GO).
- **확인 필요**: ①출생연도 UI(R1, 만14세 실효) ②이름·이메일 draft 저장 여부(기본 미저장) ③멱등 조건(기존회원 비충돌) ④교차기기 유실 허용범위.

## 7. 파일
- 수정: `app/start/StartSurvey.tsx`(B4-1/2), `app/(auth)/login/page.tsx`(B5-2 훅).
- 신규: `lib/auth/applyAutosignupDraft.ts`(B5-1).
- 재사용(미수정): `app/(auth)/signup/page.tsx`(277-304 signUp 형태), `lib/auth/applySignupProfile.ts`, `lib/autosignup-draft.ts`, `lib/start-teaser.ts`, `lib/consent.ts`.
- 이관 원형(정독·재사용): `SurveyClient.tsx`(498-794), `NewDogClient.tsx`(217-234).
- 트리거 근거(미수정): `supabase/migrations/20260424000004_profile_birth_year.sql`.
