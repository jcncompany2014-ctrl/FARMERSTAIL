# 파머스테일 PWA — 2차 종합 감사 (110개 이슈)

날짜: 2026-05-15
대상: farmerstail-app (Next.js 16.2.3 + React 19 + Supabase)
배경: 1차 알고리즘 31개 수정 완료 후, 2차 광역 감사

총 110개 / Critical 17 · High 35 · Medium 41 · Low 17

---

## A. 알고리즘/로직 (40개)

### A.Critical (6)

1. **applyAgeStage 의 large-breed puppy 이중 실행** — `lib/personalization/firstBox.ts:301-342`. `<12mo` 분기 후 `isLargeBreedPuppy` 가 다시 들어가 mass 회계 오차 + chip 중복. → `else if` 로 분리.
2. **nextBox.applyWeek4StoolSignal — week2 가드 무효** — `lib/personalization/nextBox.ts:249-251`. `undefined !== null` = true 라 옵셔널 체이닝 가드 깨짐. → `week2 != null && week2.stoolScore !== null && >= 5`.
3. **nextBox.finalize — blocked + mainLine collapse 충돌** — `lib/personalization/nextBox.ts:400-408`. mainLine = 'basic' 인데 blocked 면 의도와 다른 라인이 1.0. → `mainLine = ALL_LINES.find(l => ratios[l] > 0 && !blocked.has(l))`.
4. **epsilonGreedy — OIV trials=0 arm 간 결정성 깨짐** — `lib/meta-learning/exploration.ts:62-71`. 모든 새 arm mean=1.0 이면 첫 arm 만 선택. → tiebreak 랜덤 또는 UCB1 로 업그레이드.
5. **predictBestTiming — bestRate 0 lock + 표본 부족 검정 없음** — `lib/meta-learning/intervention-windows.ts:58-67`. Wilson score interval 또는 Beta posterior 로 비교.
6. **decideToppers — round 후 cap 초과 가능** — `lib/personalization/firstBox.ts:1551-1561`. (0.165, 0.135) → (0.17, 0.14) = 0.31 cap 위반. → vegetable round 후 protein = cap - vegetable.

### A.High (9)

7. **applyChronicAdjustments — kidney Stage 4 / stage 미입력 동일 처리** — `firstBox.ts:475-507`. IRIS Stage 4 별도 처리 + 잘못된 입력 chip 알림.
8. **transferToTarget donor priority — chronic 충돌 시 임상적 안전 라인 우선 안 됨** — `firstBox.ts:591-608`. BCS 8 + 관절염 시 weight 보호. donor 동적 선정.
9. **quantize 잔차 흡수 — diff 음수 + 0% 라인 양수화 위험** — `quantize.ts:62-75`. Hamilton rounding (largest-remainder) 로 교체.
10. **computeRer — 50kg+ 거대견 ~200kcal underestimate** — `lib/nutrition.ts:212-222`. 70*W^0.75 통일 + risk flag.
11. **bcsMerFactor — BCS 1 (응급) 과 BCS 2 동일 1.20** — `lib/nutrition/guidelines.ts:138-157`. REFEEDING_RISK flag + 단계적 증량 plan.
12. **임신 multiplier SSOT 불일치** — `firstBox.ts:1328-1339` chip "~1.0×" vs `nutrition.ts:290-307` 실제 1.3×. → `guidelines.ts` 에 상수화 후 양쪽 import.
13. **analyzeImage — getImageData CORS SecurityError silent crash** — `lib/vision/canvas-analyzer.ts:62`. try/catch + crossOrigin='anonymous' + Supabase Storage CORS 헤더.
14. **recencyScore — date-only 입력 시 KST/UTC 9시간 어긋남** — `lib/personalization/reliability.ts:66-78`. KST 정오 normalize.
15. **currentMilestone — leap year + anniversary 정확도** — `lib/dashboard/milestones.ts:74-79`. YYYY-MM-DD anniversary 비교.

### A.Medium (15)

16. **applyChronicComboAdjustments — chip 진실성 깨짐 (ratio 변경 없이 발화 / 변경하고 미발화)** — `firstBox.ts:1239-1263`.
17. **decideTransition — homeCookingExperience null → aggressive 위험** — `firstBox.ts:1568-1575`. null → gradual default.
18. **feedGramsModel — expectedAdultWeight 누락 (do-calculus 청구항 정합성)** — `lib/counterfactual.ts:83-90`.
19. **applyActivityAdjustments donor 임계 0.15 너무 높음** — `firstBox.ts:1057-1110`. 동적 임계.
20. **populationReliability tolerance 0.3 — toy 견 outlier 못 잡음** — `reliability.ts:144-155`. size 별 ±15-30%.
21. **breedDistance — mix breed fallback 부정확** — `lib/breeds/cluster.ts:32-51`.
22. **compositeReliabilityWithPopulation 가중치 의도 불일치** — `reliability.ts:163-170`.
23. **predictBestTiming — hour×dow joint distribution confound** — `intervention-windows.ts:71-92`.
24. **transferToTarget — donor 배열에 'to' 포함 시 silent skip** — `lib/personalization/transfers.ts:26-44`.
25. **measurement-upgrade — home_analog MID 부분 보상 없음** — `lib/rewards/measurement-upgrade.ts:24-66`. LOW→MID 500P.
26. **clusterMeanBySize — 빈 cluster fallback cache 됨** — `cluster.ts:91-95`.
27. **parseMedicalRecord — weightKg 범위 검증 없음 (52kg 등 OCR 오류)** — `lib/vision/parseMedicalRecord.ts:202-205`. 0.1~150 범위 검증.
28. **composeMessage — 빈 template 시 빈 본문 푸시** — `lib/meta-learning/message-decomposition.ts:111-119`. fallback.
29. **debitPoints — balance read + RPC append race** — `lib/commerce/points.ts:106-118`. RPC 가 INSUFFICIENT code 반환.
30. **dailyGramsFromMix — 합 0 시 silent 0 반환** — `lib/personalization/lines.ts:177-191`. fallback.

### A.Low (10)

31. **computePersona — dataSufficiency 노출 없음** — `lib/persona.ts:138-141`.
32. **epsilonGreedy + decayingEpsilon 통합 헬퍼 부재** — `exploration.ts`.
33. **merConfidenceInterval — Monte Carlo CI 도입 기회** — `lib/nutrition/confidence-interval.ts`.
34. **computeWImage — issue 와 score weight 임계 불일치** — `lib/vision/w-image.ts:73-126`.
35. **formatToppers — 야채 → 육류 순서 hardcoded** — `lib/personalization/format.ts:54-63`.
36. **streaks — gap 정책 (1 cycle tolerance) 부재** — `lib/dashboard/streaks.ts:80-95`.
37. **applyGiSensitivity — EPI chronic 라인 매핑 누락** — `firstBox.ts:1396`.
38. **applyPreferredProteinBonus — 0.001 잔차 양자화 후 부풀려짐** — `firstBox.ts:1466-1485`. < 0.01 skip.
39. **detectChronicFromMedications — 첫 매칭 우선 dedup** — `lib/nutrition/drugs.ts:472-492`.
40. **formula diff — severity 변경 못 잡음 (전자상거래법 §13의2)** — `lib/personalization/diff.ts:122-137`. reasoning.action hash.

---

## B. UI/UX/디자인 (20개)

### B.Critical (4)

41. **viewport userScalable: false + maxScale 1 — WCAG 1.4.4 위반** — `app/layout.tsx:182-183`. → 키 제거 + 인풋 font-size: 16px.
42. **EmptyState 이모지 10개 — Lucide canon 위반** — `components/ui/EmptyState.tsx:59-70`. ShoppingCart/Heart/Package/Dog/FileText/... 로 1:1 매핑.
43. **AddressSearch 버튼 🔍** — `components/AddressSearch.tsx:103`. → `<Search />` Lucide.
44. **DiaryClient mood 5개 이모지 (😢😟😐🙂😊)** — `app/(main)/dogs/[id]/diary/DiaryClient.tsx:33,390-407`. Frown/Meh/Smile/Laugh 또는 BCS-스타일 pickcard.

### B.High (7)

45. **PWA 아이콘 빈약 — 180/152/167/384 누락 + maskable 미분리 + splash 없음** — `public/icons/`, `manifest.json`, `app/layout.tsx:157-168`.
46. **AppChrome 헤더 h-14 좁음 + 카트 뱃지 layout shift** — `components/AppChrome.tsx:171`. → h-16 + min-w-[20px].
47. **DogTabsNav 아이콘 18px / 라벨 10.5px 가독성 떨어짐** — `components/dogs/DogTabsNav.tsx:99-111`. 20px + 11px + py-2.5.
48. **27곳에서 raw `<img>` + alt="" 비-decorative** — Diary/Admin QnA/Reviews/Logo 다수. next/image 마이그레이션 + dog 이름 alt 자동 생성.
49. **Toast 닫기 ASCII × + 4px 패딩** — `components/ui/Toast.tsx:386-393`. Lucide X + p-2.
50. **다크모드 — 422줄 attribute selector swap (유지보수 폭탄)** — `globals.css:389-440`. `--surface-card` 토큰 도입.
51. **폰트 크기 8.5px ~ 13px 사이 12종 이상 흩뿌려짐** — type scale 토큰 (`--text-xs..xl`) 신규.

### B.Medium (7)

52. **Button 마이그레이션 미완 — 30+ 곳 중복 버튼 잔존** — `InstallPrompt.tsx`, `DiaryClient.tsx`, `Onboarding.tsx`. eslint warn rule + 1-by-1 교체.
53. **마이크로카피 — 해요체/하세요체/명령형 혼재** — voice-guidelines.md 미준수. 동사형 명사 통일.
54. **ProductGridSkeleton viewport 분기 — phone-frame CLS** — `Skeleton.tsx:86-98`. globals.css selector 추가.
55. **AsyncList 통합 컨테이너 부재 (4-state 보일러플레이트)** — empty/error/skeleton/populated 각 페이지에서 분기.
56. **AdjustSheet/RecommendationBox/WebChrome 800+줄 단일 파일** — split + 훅 분리.
57. **logo.png 67KB → SVG 5-10KB + currentColor 다크 대응**.
58. **backdrop-blur-xl 3개 sticky 표면 — 저사양 60fps 손상** — fallback `bg-bg/98`.

### B.Low (2)

59. **Onboarding 영문 대문자 라벨 (i18n 정책과 충돌)** — Slide03 패턴 따라 한글+영문.
60. **CookieConsent/ConsentLevelCard 회색조 — 브랜드 톤 단절** — terracotta CTA + .grain.

---

## C. 보안/Supabase/RLS (15개)

### C.Critical (4)

61. **apply_point_delta RPC — 임의 p_user_id 인자 → 타인 잔액 조작** — `20260425000000_atomic_points_coupons.sql:47-118`. → `IF p_user_id <> auth.uid() AND NOT is_admin() THEN RAISE`.
62. **submit_photo_request RPC — anon 노출 + p_photo_url 무검증** — `20260513000006_photo_request_tokens.sql:102-138`. → URL 인자 제거, RPC 내부에서 빌드.
63. **is_admin() fallback — profiles.role UPDATE 정책 누락 시 self-elevation** — `20260423000000_admin_role_to_app_metadata.sql:62-79`. → WITH CHECK role 변경 차단 + OR fallback 제거.
64. **주문 취소 — 환급/회수 같은 reference_id 로 unique 위반 → silent fail (무한 적립 가능)** — `app/api/orders/[id]/cancel/route.ts:200-220`. reference_id suffix 분리.

### C.High (4)

65. **fetch_vet_share — rate limit/brute-force 보호 없음 + 단톡방 leak 탐지 못함** — `20260513000003_vet_share_tokens.sql`. server route 경유 + 자동 알림 + expires 7일.
66. **PostgREST .or() filter 인젝션 — `,is_active.eq.false` 같은 chain 주입** — `app/api/search/suggest/route.ts:75-87`. 3번 .ilike() 분할 또는 RPC 바인딩.
67. **dog_invitations SELECT — token 컬럼 노출 + email match accept 우회** — `20260513000002_dog_members.sql:122-128`. view 분리.
68. **Chatbot — dogId 소유 검증 누락 + allergies prompt injection** — `app/api/chatbot/route.ts:64-84,74-82`. `.eq('user_id', user.id)` + `<dog_info>` 태그 격리.

### C.Medium (7)

69. **API 에러 메시지 — DB 원본 노출 (제약 이름/컬럼)** — `app/api/health/records/`, `cancel/`, `push-campaigns/`. `lib/api/errors.ts` wrapper.
70. **apply_point_delta unique_violation 멱등 — race 로 reference_id 선점 DOS** — #61 수정과 함께. admin_adjustment service_role only.
71. **Resend webhook secret 누락 시 우회** — `app/api/webhooks/resend/route.ts:47-88`. production guard 명시.
72. **medical_records 이미지 — 전용 private bucket 부재** — `20260513000010_progress_photos.sql:10-11`. `medical-records-images` bucket + 5분 signed URL.
73. **vet_share_tokens UPDATE — created_by/expires_at/accessed_count 임의 변경** — `20260513000003_vet_share_tokens.sql:40-53`. UPDATE 정책 → RPC 만.
74. **CSRF — sensitive POST 에 Origin/Referer 검증 없음** — `account/delete`, `orders/cancel`, `payments/confirm`. allowlist + SameSite=Strict 검토.
75. **allergies prompt injection** — #68 과 함께.

---

## D. 빌드/TS/테스트/CI (17개)

### D.High (7)

76. **테스트 커버리지 측정 없음 (≈40% 추정) — payments/auth/email 0개** — `package.json:test`. `--experimental-test-coverage` 추가.
77. **E2E 0개 — Toss confirm/onboarding/RLS 미검증** — Playwright 도입 (happy path 3개).
78. **TS noUncheckedIndexedAccess/exactOptional 미설정** — `tsconfig.json:7`. 4개 옵션 추가 + verify.
79. **8건 `as any[]` + eslint-disable (Supabase select)** — `app/(main)/mypage/{coupons,points,reviews,wishlist}`. supabase gen types + 도메인 타입.
80. **npm audit 11 vuln (1 mod, 10 high) — @capacitor/assets → tar** — `package.json:57`. overrides 또는 npx 일회성.
81. **CI 에 build/audit/preview deploy 없음** — `.github/workflows/ci.yml`. build job + audit gate + bundle analyzer.
82. **vercel.json — subscription-charge cron timeout 10s default (매출 누락 위험)** — `maxDuration: 300` 명시.
83. **eslint — `@typescript-eslint/no-floating-promises` 부재 (await 누락 silent)** — `eslint.config.mjs`. 즉시 추가.

### D.Medium (7)

84. **pre-commit hook 없음 — verify 수동** — simple-git-hooks + lint-staged.
85. **SW (`sw.js`) — 빌드 hash 없는 정적 + /monitoring bypass 없음** — `public/sw.js:6`. VERCEL_GIT_COMMIT_SHA 주입.
86. **images.minimumCacheTTL 1년 dev에서 디버깅 방해** — `next.config.ts:99`. NODE_ENV 분기.
87. **CSP — script-src 미설정 (/checkout XSS 방어)** — `next.config.ts:37-39,63-65`. Report-Only 먼저.
88. **Sentry client tracesSampleRate 균일 0.1 — 결제 90% 누락** — `instrumentation-client.ts:39`. tracesSampler 분기.
89. **Sentry source map — PR preview token 없으면 release 끊김** — `next.config.ts:163-165`. Preview env 토큰.
90. **bundle analyzer CI artifact 미적용 + pretendard 전체 import 가능성** — `npm run analyze` 자동화.

### D.Low (3)

91. **`--experimental-strip-types` + `--no-warnings` 부적절** — `package.json:12-13`. 노드 24.3+ 기본.
92. **`.nvmrc` + engines.node 미설정** — package.json.
93. **`*.test.tsx` glob 매칭 0개 silent 통과** — 생기면 추가.

---

## E. PWA/성능/접근성 (18개)

### E.Critical (3)

94. **SW Next.js hashed chunk 영구 캐시 → 흰 화면/ChunkLoadError** — `public/sw.js:133-157`. `_next/static/*` network-first.
95. **base64 업로드 — 5MB 이미지 13-15MB 메모리 spike + 6.7MB Vercel payload** — `MedicalRecordOcr.tsx:301`, `PhotoUploadClient.tsx:80`. FormData + Blob + OffscreenCanvas 다운스케일.
96. **survey/page.tsx 2053줄 단일 client + autosave deps 30+** — `app/(main)/dogs/[id]/survey/page.tsx`. step 별 next/dynamic + useDeferredValue.

### E.High (8)

97. **SW navigation 캐시 — 다중 사용자 시 인증 페이지 노출** — `sw.js:106-130`. /dashboard/mypage/dogs prefix 제외.
98. **InAppCamera — Capacitor 네이티브 카메라 미사용 + Info.plist 누락 가능** — `components/InAppCamera.tsx:74-99`. `@capacitor/camera` 추가.
99. **AppChrome cart count — 라우트 이동마다 fetch RTT** — `AppChrome.tsx:53-90`. 서버 컴포넌트 prop.
100. **analysis 페이지 — useParams + client fetch waterfall (LCP 800ms+ 빈 스피너)** — `app/(main)/dogs/[id]/analysis/page.tsx`. RSC 전환.
101. **(main) 87/118 페이지 'use client' (74%) — RSC 이점 절반 손실** — dogs/[id], mypage 우선.
102. **30+ 곳 raw `<img>` — LCP/CLS/대역폭** — products/blog/dogs 우선 next/image.
103. **react-query/SWR 미사용 — auth.getUser N회 RTT + 중복 요청** — 서버 fetch 우선 + 자체 SWR 헬퍼.
104. **ServiceWorkerRegister — 무조건 reload (결제 중 손실 위험)** — `components/ServiceWorkerRegister.tsx:77-90`. SKIP_WAITING 명시 동의시만.

### E.Medium (5)

105. **InAppCamera 캡처 dataUrl 메모리 점유 + native 해상도 그대로** — Blob URL + OffscreenCanvas 다운스케일.
106. **Manifest icons — 192/512 단일 + maskable 같은 PNG** — `manifest.json:21-46`. multi-size + maskable 별도.
107. **Sentry user/breadcrumb/태그 부재 — 결제 fail 어느 사용자 추적 불가** — instrumentation-client.ts. setUser + flow tag.
108. **(main) 인증 라우트 loading.tsx 누락 — RSC 전환 시 빈 화면** — dogs/, dogs/[id]/, mypage/, survey/. skeleton 추가.
109. **survey — /login client redirect UI flash + history pollution** — `survey/page.tsx:320-343`. server redirect.

### E.Low (2)

110. **theme-color 단일 + zoom 잠금** — `layout.tsx:174-184`. 다크/라이트 media + userScalable: true.

---

## 우선순위 권장 순서

### Phase 1 — 즉시 (Critical 17개, 출시 차단 요인)

보안 (#61, #62, #63, #64) → SW/메모리 (#94, #95) → 거대 단일 컴포넌트 (#96) → a11y/canon (#41, #42, #43, #44) → 알고리즘 정확도 (#1, #2, #3, #4, #5, #6).

### Phase 2 — 다음 sprint (High 35개)

D.High 의 #83 (no-floating-promises), #82 (cron timeout), #78 (TS strict 강화) — 인프라 기반.
A.High 9개 — 도메인 정확도.
C.High 4개 — 보안 leak 표면.
E.High 8개 — 성능/RSC 전환.
B.High 7개 — 사용자 첫인상.

### Phase 3 — 백로그 (Medium 41개)

알고리즘 chip 진실성, donor 정책 정비, type scale 토큰, 큰 컴포넌트 split, CSP, Sentry context.

### Phase 4 — 점진적 (Low 17개)

UCB1 / Monte Carlo CI / 통계 업그레이드, 마이크로카피 정비, 로고 SVG, 다크 theme-color.

---

## 메타 평가

- **디자인 시스템 토대 견고**: globals.css 토큰, Button/Form/Toast/Skeleton/EmptyState 중앙 컴포넌트, AppChrome/WebChrome 분리, phone-frame, focus mode hide.
- **보안 모델 신중**: atomic RPC + RLS 의도 명확. RPC 인자 검증 한 군데가 #61~63 처럼 self-elevation 가능성을 만들었지만 본질은 잘 설계됨.
- **알고리즘 청구항 정합성**: 1차 감사 후 정량적 모델은 정확해졌으나 chip 진실성 (chip text == 실제 ratio) invariant 보장 필요.
- **인프라 갭**: 테스트 커버리지/E2E/CI 빌드/CSP/Sentry context 가 솔로 창업자 단계 평균보다 약함. 매출 직결 (#82 cron timeout) 부터 차례로.
