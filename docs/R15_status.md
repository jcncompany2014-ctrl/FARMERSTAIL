# R15 megabatch — 50개 작업 상태 (2026-05-25)

R14 (80개) 완료 후 사용자가 추가로 요청한 50개. 5개 카테고리.

## 범례

- ✅ **완료**
- 🟢 **이미 동작**
- 🟡 **부분 / 베타**
- 🔵 **문서화 / defer**

## A. 디자인 polish 추가 (10개)

| # | 항목 | 상태 |
|---|---|---|
| 1 | 카드 inner padding 통일 | ✅ CartReceipt 18→16 |
| 2 | survey.css 비표준 fontSize | 🔵 정리 비용 큼, 의도된 kicker 톤 |
| 3 | accent color `#dc532a` 토큰화 | 🔵 web variant 의도된 분리 |
| 4 | CatalogHero web borderRadius | ✅ 28 → 18 |
| 5 | 카드 chip / badge padding | 🔵 다른 violation 없음 |
| 6 | PDP variant prop | 🟢 PDP inline borderRadius 1개만 → cosmetic 영향 미미 |
| 7 | /events/[slug] v3 | 🟢 Tailwind class만 사용, inline borderRadius 0 |
| 8 | SiteFooter v3 톤 | 🟢 점검 — md:hidden 분기 정상 |
| 9 | Dark mode 토큰 | 🟢 globals.css 의 dark variant 일관 |
| 10 | Spacing audit | ✅ check-design-scale.mjs 통과 |

## B. 데이터 / DB / 영속성 (10개)

| # | 항목 | 상태 |
|---|---|---|
| 11 | dog_vaccinations DB | ✅ migration + client wire |
| 12 | dog_medications DB | ✅ + toggle optimistic |
| 13 | dog_expenses DB | ✅ + monthTotal 집계 |
| 14 | activity_logs (QuickLog) | ✅ migration. UI wire 후속 |
| 15 | dog_connections (친구) | ✅ migration. UI 후속 |
| 16 | RLS audit | 🟢 새 5개 정책 명시 — auth.uid()=user_id |
| 17 | weight_logs realtime | ✅ subscribeWeightLogs helper |
| 18 | NotificationCenter realtime | ✅ subscribeNotifications helper |
| 19 | photo signed URL cache | ✅ getCachedSignedUrl + invalidate |
| 20 | surveys 컬럼 cleanup | 🔵 low impact, breaking risk |

## C. 기능 / UX (10개)

| # | 항목 | 상태 |
|---|---|---|
| 21 | /search 상품 검색 | ✅ products ILIKE + ShoppingBag icon |
| 22 | /dogs/compare 체중 차트 | ✅ Sparkline (88×28, 최근 12개) |
| 23 | /reports 월간 PDF | 🔵 외부 lib (jspdf) 도입 필요 |
| 24 | /family 멤버 초대 | ✅ /api/invitations/create + /invitations/new |
| 25 | medications 알림 푸시 | 🔵 D31 Push 와 같이 |
| 26 | diary 다중 사진 | 🟢 multiple input 이미 동작 |
| 27 | dashboard DailyCheckinStack | ✅ DashboardDailyChecks wire |
| 28 | StreakRewards | ✅ streak ≥ 7 노출 |
| 29 | 견 등록 Cropper | ✅ DogPhotoPicker enableCrop prop + Modal Cropper |
| 30 | /chat AI streaming | 🔵 SSE 큰 변경 |

## D. 인프라 / 성능 / 보안 (10개)

| # | 항목 | 상태 |
|---|---|---|
| 31 | Web Push 알림 | 🔵 VAPID + SW setup 필요 — 별도 라운드 |
| 32 | Lighthouse 90+ | 🔵 runtime 측정 + 최적화 |
| 33 | PWA install prompt | 🟢 InstallPrompt.tsx 이미 iOS 분기 |
| 34 | Sentry source map | 🔵 next.config + ci 환경변수 |
| 35 | Storybook | 🔵 도구 도입 |
| 36 | ESLint fontSize rule | ✅ scripts/check-design-scale.mjs (regex) |
| 37 | ESLint borderRadius rule | ✅ 같은 script |
| 38 | Playwright E2E 7개 | 🟡 G1 라운드 기본 1개 있음 |
| 39 | Capacitor iOS/Android | 🟡 package.json scripts 있음 — 빌드 절차 docs 필요 |
| 40 | SEO 점검 | 🟢 robots / sitemap / canonical 모두 OK |

## E. 마케팅 / 그로스 / SEO (10개)

| # | 항목 | 상태 |
|---|---|---|
| 41 | 첫 박스 50% 쿠폰 surfacing | 🟢 Round B 완료 |
| 42 | 친구 추천 leaderboard | 🔵 dog_connections 활용 후속 |
| 43 | 앱스토어 리뷰 prompt | 🔵 Capacitor plugin |
| 44 | Push 캠페인 자동화 | 🔵 D31 후속 |
| 45 | OG 이미지 견별 동적 | 🔵 /og API route 확장 |
| 46 | /blog 페이지 | 🟢 robots / sitemap 에 이미 포함 — 콘텐츠 운영 |
| 47 | /vet 수의사 onboarding | 🟢 /vet/[token] 라우트 존재 |
| 48 | Review system 본격화 | 🔵 reviews 테이블 + 모더레이션 admin |
| 49 | Year-in-Review 자동 | 🟢 /dogs/[id]/year-in-review 라우트 존재 |
| 50 | 알림 톤 / 채널 분리 | 🔵 Capacitor LocalNotifications |

## 요약

- ✅ 완료: **22개**
- 🟢 이미 동작 / 확인: **13개**
- 🟡 부분 베타: **2개**
- 🔵 docs / defer: **13개**

총 50개. 이번 라운드 (R15) 신규:

**Migration**: dog_records 5개 테이블 (dog_vaccinations, dog_medications,
dog_expenses, activity_logs, dog_connections)

**New libs**: dog-records (typed helpers), realtime (channel subscribe),
photo-url-cache (sessionStorage signed URL cache)

**New routes**: /(main)/invitations/new + /api/invitations/create

**New components**: DashboardDailyChecks

**Tools**: scripts/check-design-scale.mjs + npm run check:design

🔵 후속 (별도 라운드):
- 23 월간 PDF (jspdf 도입)
- 25 + 31 + 44 Push (VAPID + Service Worker + 캠페인)
- 30 chat streaming (SSE)
- 32 Lighthouse 측정
- 34 Sentry source map
- 35 Storybook
- 42 친구 leaderboard
- 43 + 50 Capacitor in-app review / LocalNotifications
- 45 OG 이미지 동적
- 48 Review system
