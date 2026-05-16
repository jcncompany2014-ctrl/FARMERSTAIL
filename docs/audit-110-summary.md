# 110개 감사 — 사용자용 정리 (2026-05-15 ~ 16)

> 26 commits, 552 tests pass, 마이그레이션 4건 prod 적용.
> 발명 모듈은 여전히 flag default OFF — 상품성 테스트 그대로 진행 가능.

---

## 🎯 한 줄 요약

기존에 잘 작동하던 부분은 그대로 유지하면서:
- **보안 구멍 12개 막음** (RPC 권한 검증, anon 노출 차단, self-elevation 방어 등)
- **알고리즘 정확도 25개 개선** (Stage 4 CKD 분리, RER 거대견, Wilson interval, Hamilton rounding 등)
- **사용자 경험 15개 개선** (viewport zoom 허용, 이모지 → Lucide 아이콘, 카메라 메모리 spike, SW 흰화면 등)
- **인프라 13개 보강** (테스트 552개, E2E Playwright, CI build/audit, type-aware lint 등)
- **나머지 25개** 는 sprint 단위 큰 작업으로 명시 + 일부 진행

---

## 🔴 가장 중요한 변경 (Critical) — 즉시 효과

### 1. 보안 — "내 데이터가 안전한가?"

| 이전 (위험) | 이후 (안전) |
|---|---|
| 로그인한 사용자가 콘솔 한 줄로 **타인 포인트 조작** 가능 | `apply_point_delta` RPC 에 `auth.uid()` 검증 추가 |
| 토큰 만 알면 누구나 **친구 사진 부탁** 페이지에 임의 URL 주입 (추적 픽셀 가능) | `submit_photo_request` 익명 접근 차단, 서버 라우트만 가능 |
| 사용자가 자기 `profiles.role = 'admin'` 한 줄로 **관리자 자가승격** 가능 | DB 트리거가 role 변경 차단 + `is_admin()` 함수 fallback 제거 |
| 주문 취소 시 환급/회수가 **무한 적립** 버그 가능 (unique 충돌) | `order_refund_credit` / `order_refund_revoke` 로 referenceType 분리 |
| 수의사 공유 토큰 leak 시 14일간 무제한 열람 + 토큰 임의 연장 | 7일로 단축 + 분당 10회 rate limit + token immutable 트리거 |
| Chatbot 이 다른 사용자 강아지 정보 노출 가능 + allergies prompt injection | `user_id` 검증 추가 + `<dog_info>` 태그 격리 + 명령 무시 지시 |

### 2. 알고리즘 정확도 — "내 강아지에게 맞는 처방인가?"

| 이전 (틀림) | 이후 (정확함) |
|---|---|
| `<12개월 puppy` 룰 + `대형견 puppy` 룰이 **동시에** 실행 → 사료 비율 회계 오차 + chip 2개 발화 | `else if` 로 분리 — 단일 chip, 정확한 비율 |
| BCS 1 (생명 위협)과 BCS 2 (저체중)가 **똑같이** ×1.20 보정 → BCS 1 환자 refeeding syndrome 위험 | BCS 1 별도 분기 + `REFEEDING_RISK` flag + 수의사 상담 강제 |
| **임신 칼로리 chip** "~1.0×" 표시인데 실제로는 1.3× 적용 → 보호자 신뢰 깨짐 | `PREGNANCY_RER_MULTIPLIER` SSOT 도입 — chip 과 실제 값 일치 |
| **CKD Stage 4** (응급 수준)이 Stage 3 / stage 미입력과 동일 처리 | Stage 4 별도: Premium=0 + Weight=0 + 단백질 ≤14% DM 응급 chip |
| **거대견 70kg** RER 계산이 표준 NRC 대비 ~200 kcal 적게 산출 | 표준 70*W^0.75 통일 + `GIANT_BREED` risk flag |
| 메시지 시점 학습이 **첫 응답** 받으면 거기로 lock 됨 (noise 취약) | Wilson 95% 신뢰 하한 비교 → 표본 큰 시간대 우위 |
| 사료 비율 양자화 시 잔차를 1개 라인에 몰아넣음 → 음수 클램프 위험 | Hamilton (largest-remainder) 방식 — 합 항상 정확 1.0 |

### 3. 사용자 경험 — "쓰기 편한가?"

| 이전 (불편) | 이후 (편안함) |
|---|---|
| viewport `userScalable: false` — **WCAG 위반**, 시니어 사용자 핀치 줌 불가 | zoom 허용 + iOS 자동 줌 방지 위해 input 16px 강제 |
| 카트/위시리스트 빈 상태 등 핵심 화면에 **이모지 10종** (🛒🤎📦🐕…) | Lucide 아이콘 1:1 매핑 (ShoppingCart, Heart, Package, Dog…) |
| 다이어리 mood 5개 **이모지 (😢😟😐🙂😊)** 플랫폼별 다르게 렌더링 | Lucide Frown/Annoyed/Meh/Smile/Laugh + aria-label/pressed |
| 카메라 캡처 native 해상도 (4032×3024) 그대로 → **모바일 OOM 위험** | long edge 1280px 다운스케일 + Blob URL (~300-500KB) |
| 의료기록/사진 업로드 시 5MB base64 → **13-15MB 메모리 spike** | FormData + Blob 직접 전송 (메모리 정상, payload 33% 절감) |
| 새 배포 후 **흰 화면 / ChunkLoadError** 발생 가능 (SW 가 chunk 영구 캐시) | `_next/static/*` SW 캐시에서 제외 — Next.js immutable HTTP 캐시에 위임 |
| Toast 닫기 버튼 ASCII `×` + 4px 터치 영역 | Lucide X + 32px 터치 영역 (iOS/Android 표준 충족) |
| 헤더/탭바 아이콘 18px / 라벨 10.5px — **시니어 가독성 부족** | 20px / 11px + py-2.5 (iOS HIG 권장에 한 단계 가까이) |
| 설문 페이지에서 한 글자 칠 때마다 26개 상태 동기 저장 → **입력 지연** | 500ms debounce 후 결정적 저장 (모바일 입력 지연 해소) |

---

## 🟠 중요한 변경 (High)

### 4. 발명 알고리즘 청구항 정합성

- **counterfactual.feedGramsModel** 가 이전엔 단순 모델 — 이제 `calculateNutrition()` 호출. do-calculus 시뮬레이션이 실제 처방과 일치.
- **신뢰도 가중 평균** 가중치 명시: `w_method=0.5, w_pop=0.3, w_robust=0.2` 합 1.0 invariant 검증.
- **메타 학습 epsilon-greedy** 가 trials=0 arm 들 사이 무작위 균등 선택 (이전엔 첫 arm 만 selected).
- **클러스터 정합성** size 별 tolerance (toy 15%, giant 30%) — toy 견 outlier 검출 가능.

### 5. 보안 추가 보호

- `dog_invitations` token 컬럼 누출 (email 매칭 우회) 차단 → token 만 RPC 로 조회.
- `vet_share_tokens` UPDATE 시 token/expires_at/accessed_count 등 임의 변경 차단 트리거.
- `search/suggest` PostgREST `.or()` 인젝션 차단 — `,is_active.eq.false` 같은 filter chain 주입.
- Resend webhook secret 누락 시 production 503 fail-fast.
- CSRF — sensitive POST 에 Origin/Referer allowlist 검증 (production + vercel + localhost).
- 의료기록 전용 private bucket + 5분 signed URL helper.

### 6. 데이터 정확도

- 의료기록 OCR weightKg 0.1~150kg 범위 검증 (OCR "52" 같은 단위 누락 차단).
- chatbot dogId 본인 소유 검증 (UUID leak 시 데이터 노출 차단).
- `recencyScore` date-only 입력 KST 정오 normalize — 9시간 어긋남 해소.
- `currentMilestone` 1주년/2주년 anniversary calendar-aware (월/일 매칭) — 4년 1일 어긋남 해소.

### 7. 성능 (Core Web Vitals)

- Survey 페이지 server-side 인증 + 강아지 소유 검증 → UI flash 제거.
- /dogs 페이지 server component 전환 → 빈 스피너 800ms+ 제거.
- AppChrome 카트 카운트 라우트 이동마다 fetch → visibility/event 만 trigger.
- analysis 페이지 server wrapper — JS hydration ~5KB 절감.
- 이미지 dev cache 0 (production 1년) — 디자인 검토 시 즉시 반영.

---

## 🟢 인프라 보강

### 8. 테스트
- **552개 unit test** (기존 547 + swr-lite 5개 추가) 모두 통과.
- **3개 E2E** (Playwright): landing, auth-gate, pwa — Pixel 7 + iPhone 14, KR locale.
- **test:coverage** 스크립트 신규.

### 9. CI 확장
- 기존: lint + tsc + test
- 추가: **build (next build 검증)** + **npm audit prod-only high+** + **bundle analyzer artifact** + **Playwright e2e (PR 시)** = 총 5개 job.

### 10. 타입 안전성
- **Supabase Database types** 자동 생성 (100KB) — `lib/supabase/types.ts`.
- TS strict 추가 옵션: `noFallthroughCasesInSwitch`, `noImplicitOverride`.
- `tsconfig.strict.json` 별도 — `noUncheckedIndexedAccess` 점진 마이그용.

### 11. 코드 품질
- **eslint type-aware**: `@typescript-eslint/no-floating-promises` (warn) — 외부 호출 silent fail 차단.
- **pre-commit hook**: `npm run install:hooks` 후 commit 시 자동 lint+tsc.
- **API error wrapper** (`lib/api/errors.ts`): DB 원본 message Sentry 보존, client generic — 스키마 누출 차단.
- **SWR-lite** (`lib/swr-lite.ts`): react-query 없이 50줄 dedup+cache (테스트 5개).

### 12. PWA 보강
- SVG 아이콘 (`icon.svg` + `icon-maskable.svg`) — vector, multi-size 자동.
- Service Worker:
  - 빌드 v3 → v4, 인증 페이지 (/dashboard, /mypage, /dogs, /cart, /checkout, /survey, /admin, /vet/) 캐시 제외.
  - /monitoring (Sentry tunnel) bypass.
  - 자연 활성화 시 자동 reload 차단 (사용자 명시 클릭만).

### 13. 운영
- **Vercel cron timeout**: subscription-charge / personalization-progression 등 매출/회복 cron 300초 (이전 default 10초 — 사용자 100명 넘으면 누락 위험).
- **theme-color** 라이트/다크 media 분기 — status bar 아이콘 충돌 해소.
- **type scale 토큰** (`--text-xs ~ --text-2xl`) 신규 — 폰트 12종 흩뿌려진 것 점진 통일 기반.
- **surface-card 토큰** — 다크모드 422줄 swap 대체 가능 (점진).

---

## 📦 마이그레이션 (prod 적용 완료)

1. `security_critical_fixes` — apply_point_delta auth + submit_photo_request anon 제거 + is_admin OR fallback 제거 + profiles.role trigger
2. `security_high_fixes` — vet_share expires 7d + dog_invitations view + vet_share tampering trigger
3. `lookup_invitation_by_token_rpc` — 받은 사람 invitation token RPC 조회
4. `medical_records_bucket_only` — private bucket 생성 (storage RLS 정책은 대시보드 작업 별도)

---

## 🗂️ 본 세션에 미완료 (별도 sprint)

각각 시간 규모상 한 세션에 못 끝남:

| 작업 | 규모 | 비고 |
|---|---|---|
| #96 survey 2053줄 8 step 온전 분할 | 4-6시간 | page.tsx RSC wrapper 만 완료 |
| #101 모든 (main) 87 페이지 RSC 전환 | 수일 | /dogs, /dashboard, analysis page wrapper 완료 |
| #103 react-query 도입 | 수일 | SWR-lite 50줄로 대체 |
| `noUncheckedIndexedAccess` | 2-3일 | 280 호환 에러, tsconfig.strict.json 준비 |
| Database generic 활성화 | 1-2일 | 70+ 호환 에러, types.ts 보유 |
| #52 Button 30+곳 마이그 | 2-3시간 | inline 디자인 의도 많음 — 선별적 |
| #50/#51 토큰 사용처 마이그 | 수시간 | survey.css 일부만 완료 |
| #69 cron 라우트 wrapper 잔여 | 1-2시간 | 핵심 8개 완료, cron 내부 4개 남음 |
| storage.objects RLS 정책 | 30분 | 대시보드/CLI 작업 (MCP 권한 한계) |
| Vercel Preview SENTRY_AUTH_TOKEN | 30분 | env 추가 (운영 작업) |

---

## 🚀 결과적으로 무엇이 달라졌나?

1. **솔로 창업자가 안심하고 잘 수 있다** — RPC 권한, self-elevation, CSRF, 무한 적립 같은 critical 보안 구멍 막혔음.
2. **보호자가 받는 추천이 실제와 일치** — chip 텍스트와 사료 비율, 임신 칼로리 multiplier 등 SSOT 통일.
3. **응급 케이스에 응급 처방** — BCS 1 refeeding, CKD Stage 4, 췌장+비만 weight 보호.
4. **시니어 사용자도 쓸 수 있다** — viewport zoom 허용, 폰트 16px+, 터치 영역 32-48px.
5. **모바일에서 안 깨진다** — 카메라 메모리 spike 해소, base64 → FormData, SW chunk 캐시 안전.
6. **새 배포 후 흰 화면 없다** — SW `_next/static` 제외 + 인증 페이지 캐시 제외.
7. **테스트 안전망** — 552 unit + 3 e2e + 5 CI jobs.
8. **다음 sprint 준비됨** — Database types, strict tsconfig, Playwright config 모두 보유.

---

## 📁 핵심 파일 위치 (다음 sprint 참고)

- `docs/audit-110.md` — 110개 전체 항목별 status + 우선순위
- `docs/audit-110-summary.md` — 이 파일
- `lib/api/errors.ts` — DB 에러 wrapper (모든 라우트 점진 적용)
- `lib/storage/medical-records.ts` — 의료기록 signed URL helper
- `lib/swr-lite.ts` — 가벼운 dedup cache
- `lib/supabase/types.ts` — generated Database types (opt-in)
- `tsconfig.strict.json` — noUncheckedIndexedAccess 점진 마이그
- `tests/e2e/` — Playwright happy path 3개
- `supabase/migrations/20260515*` — 본 세션 적용 마이그레이션 3건

---

## 🔑 commit log (audit-110 작업 전체)

```
242f028  (main) 페이지 9개 RSC 전환 (dogs/[id], mypage, edit, approve, formulas,
         analyses/[id], dogs/new, mypage/subscriptions, notifications)
a10d4f8  survey 8 step 컴포넌트 분할 (SurveyClient 2061 → 885줄)
82ad5f6  noUncheckedIndexedAccess 활성화 + 265 batch fix
9e2215b  browser supabase client Database generic 활성화 + 30 fix
e082406  checkin page server wrapper
fe64579  noUncheckedIndexedAccess lib/ 일부 fix
4721c79  admin + server Database generic 활성화 + 42 fix
abb7b89  audit-110 사용자용 정리 보고서
71dadcc  sprint: cron + Diary next/image + /dogs RSC
3a63abb  TS strict 옵션 + survey RSC + Playwright + SWR-lite
34c2551  Supabase types + opt-in 점진 sprint
56a5106  cron wrapper batch + medical bucket + PWA SVG + 마이크로카피
9417e5a  API error wrapper + Supabase types placeholder
c76c9e6  surface-card + type scale 시멘틱 토큰
c2d0066  camera 다운스케일 + Sentry user + loading.tsx
2e6cf14  UI fallback + API errors + CSP + CI
44fa3d8  Medium/Low 정밀도 9개
136a654  CI build + audit job
b5bf645  헤더 호흡 + 탭nav 가독성 + Toast 닫기
b9ab069  보안 leak High 4건 + vet token tampering
81a48aa  cart count + analysis page RSC 진입
1e61d9c  알고리즘 High 9개 — IRIS Stage + RER + Wilson + SSOT
aa8c689  vercel cron + eslint + audit + test scripts
571da37  알고리즘 Critical 6개
3a3014c  viewport zoom + EmptyState/AddressSearch/Diary Lucide
3879b15  SW 캐시 정책 + 다운스케일 업로드 + survey debounce
2e1cc8e  RPC auth.uid() + anon 차단 + self-elevation 방어
```

각 commit 은 audit-110.md 의 항목 번호 (#1~#110) 와 직접 연결됨.
