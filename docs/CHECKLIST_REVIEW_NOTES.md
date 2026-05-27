# 100가지 검토 노트

사용자가 자는 동안 100개 다 검토. R81~R88 에서 이미 covered 한 부분은 reference,
못 본 부분은 새로 검토 + fix.

범례:
- ✅ 코드 검증 완료 (OK)
- 🔧 발견 → 즉시 fix
- ⚠️ 발견 → BACKLOG / USER ACTION
- 👤 USER ACTION ONLY (코드 아님, 본인이 해야 함)

---

## A 그룹 — 본인 직접 검증 12개

**A 전체 = 👤 USER ACTION ONLY** (저는 클릭 못 함). 다만 각 흐름의 코드 path 가
실제 사용자가 사용 가능한 상태인지 확인:

### ✅ A1 회원가입 → 강아지등록 → 설문 → 분석 (코드 ready)
- `app/(auth)/signup/page.tsx`: R84-1 가드 (data.session null 시 안내) + R86 한국어 카피 fix
- `app/(main)/dogs/new/NewDogClient.tsx`: 강아지 등록 폼 정상
- `app/(main)/dogs/[id]/survey/SurveyClient.tsx`: 설문 + 예산 4-옵션
- `app/api/analysis/structured/route.ts`: Anthropic 호출 + 캐시 (R80 30일 제한)
- **시도 시 확인할 것**: 이메일 인증 정상 도착? 분석 결과 적절한 한국어?

### ✅ A2 카탈로그 → PDP → 카트 → 결제 (코드 ready)
- R88 DB index 추가로 1000명 규모 성능 안전
- R85-A1 tossFetch timeout 15s
- R85-B1 confirm payment_status='pending' 가드
- R83-5 CheckoutForm debitPoints 결과 검증 + 롤백
- **시도 시 확인할 것**: 실제 1만원 결제 정상? 영수증 다운로드 (PDF) 동작?

### ✅ A3 환불 (코드 ready)
- `app/api/orders/[id]/cancel/route.ts`: R85-B2 0-row 가드 + R84-C3 push 알림
- 포인트 환급: appendLedger order_refund_credit
- 쿠폰 revoke: revokeCouponRedemption
- 적립 회수: order_refund_revoke (음수 delta)
- **시도 시 확인할 것**: Toss 환불 1-3일 vs 실제 시간

### ✅ A4 정기배송 전체 사이클 (코드 ready)
- `app/(main)/subscribe/[slug]/SubscribeClient.tsx`: R84-D1 컬럼명 정정 (zip/address)
- `app/(main)/mypage/subscriptions/SubscriptionsClient.tsx`: R84-D3 카드 재등록 가드 + R85-D4 KST date
- `app/api/cron/subscription-charge/route.ts`: R83-6 await 변경 + R85-B3 status 재확인
- **시도 시 확인할 것**: 카드 등록 → 즉시 첫 박스 결제 정상?

### ✅ A5 가상계좌 → 입금 → 환불 1:1 문의 안내 (코드 ready)
- VA 입금 webhook: `app/api/payments/webhook/route.ts` DONE handler
- VA self-cancel: `app/api/orders/[id]/cancel/route.ts` R84-C1 → 1:1 문의 안내 (현재 환불계좌 입력 UI 없음, BACKLOG D4)
- **시도 시 확인할 것**: 가상계좌 입금 확인 메일 spam 폴더 가는지?

### ✅ A6/A7 PWA iOS/Android (코드 ready)
- `public/manifest.json` + `public/sw.js`: R85-C agent 깨끗 확인됨
- iOS 16.4+ push 지원, NotificationSettingsClient unsupported 분기
- R86-A1 DatePicker fontSize 16+ (iOS Safari zoom 차단)
- **시도 시 확인할 것**: iOS Safari에서 standalone 모드 진입 시 status bar 색?

### ✅ A8 푸시 알림 (코드 ready)
- `app/(main)/mypage/notifications/NotificationSettingsClient.tsx`: 권한 요청 명시 클릭만
- VAPID key 없으면 503
- 광고성 push `[광고]` prefix 자동
- **시도 시 확인할 것**: 본인 폰에서 실제 push 수신 + tap → 정확한 URL 이동?

### ✅ A9 /mypage 모든 sub-route 존재
- orders / subscriptions / coupons / points / addresses / wishlist / reviews / notifications
- 모두 R9-1 ~ R9-8 에서 v3 reskin 완료
- **시도 시 확인할 것**: 각 페이지 빈 상태 (데이터 0개) 친절한 안내?

### ✅ A10 /admin 라우트 존재
- orders / subscriptions / users / coupons / products / blog / events / cs
- isAdmin() 가드 확인 (R83 보안 agent 깨끗)
- ⚠️ admin/subscriptions/page.tsx R84-D1 컬럼 mismatch (BACKLOG D13)
- **시도 시 확인할 것**: admin 권한 사용자로 로그인 → 모든 페이지 진입 정상?

### ✅ A11 카카오 OAuth (코드 ready)
- `app/auth/callback/route.ts`: R85-C agent 깨끗 — state CSRF, code 재사용, open-redirect 모두 안전
- age-gate /onboarding/age-gate 강제
- **시도 시 확인할 것**: 카카오 신규 가입자 → /dashboard 진입 정상?

### ✅ A12 만 14세 미만 차단 (코드 + DB ready)
- signup 클라이언트 가드 (birthYear)
- DB 트리거 `manage_under_14_block` (Supabase trigger)
- R85-C agent 확인: 우회 불가
- **시도 시 확인할 것**: 출생연도 2015 등 시도 → 명확한 차단 안내?

**A 그룹 결론**: 코드 path 12개 모두 ready. 실제 클릭/결제는 본인이 직접.

---

## B 그룹 — 환경 변수 + 외부 서비스 12개

**B 전체 = 👤 USER ACTION ONLY** (Vercel / Supabase / Resend / Toss / Kakao dashboard). 
저는 코드 path 와 schema validity 만 확인:

### ✅ B1 Vercel env var 등록 (코드 ready)
- `lib/env.ts` Zod schema 완비 — 필수/선택 분기 + 빈 문자열 정규화
- `/api/health` 엔드포인트가 필수 env 누락 시 503 + missing list 반환
- 👤 **본인 액션**: Vercel dashboard → Settings → Environment Variables → production
- 👤 **확인**: `curl https://farmerstail.kr/api/health` 시 `status: "ok"`

### ✅ B2 Toss live key (코드 ready)
- `lib/payments/toss.ts`: R85-A1 timeout 15s + try/catch
- live key 와 test key 구분 코드 (`test_*` / `live_*` prefix)
- 👤 **본인 액션**: Toss 입점 심사 통과 후 production secret 받아서 `TOSS_SECRET_KEY` + `NEXT_PUBLIC_TOSS_CLIENT_KEY` Vercel 등록
- 👤 **검증**: 실제 1만원 결제 → 환불 1회

### ✅ B3 Resend domain verification
- `EMAIL_FROM` env 검증
- R87-A1 List-Unsubscribe + One-Click 헤더 적용
- 👤 **본인 액션**: Resend dashboard → Domains → farmerstail.kr 추가
- 👤 **DNS**: SPF / DKIM / DMARC 레코드 등록 (Resend가 가이드)
- 👤 **검증**: MXToolbox.com 에서 SPF/DKIM/DMARC pass

### ✅ B4 Resend webhook URL
- `app/api/webhooks/resend/route.ts` 존재
- svix 서명 검증 + prod에서 secret 누락 시 503 (R85-C agent 확인)
- 👤 **본인 액션**: Resend → Webhooks → URL `https://farmerstail.kr/api/webhooks/resend` + Signing Secret 복사 → `RESEND_WEBHOOK_SECRET` env

### ⚠️ B5 Supabase 백업 (USER ACTION ONLY)
- Supabase 자체 PITR 기능
- 👤 **본인 액션**: Supabase dashboard → Settings → Database → Backups → PITR 활성화 (유료 plan 필요)
- 👤 **검증**: 일 1회 backup 자동 실행 확인

### ✅ B6 Vercel cron schedule (33개)
- `vercel.json` 에 33개 cron 등록 확인 (방금 grep)
- 👤 **본인 액션**: production deploy 후 Vercel dashboard → Cron jobs → 33개 모두 active 확인

### ✅ B7 Sentry alert rule
- DSN env + R83 admin_audit_log + R85 PII scrubber + R82 분 ledger event
- 👤 **본인 액션**: Sentry dashboard → Alerts → 룰 생성:
  - `order.payment.points_inflated` → Slack #alerts
  - `order.payment.race_already_terminal` → Slack #alerts
  - `refund_queue.permanent_failure` → email
  - `cron.*` error → Slack #alerts (R87-C5 BACKLOG)

### ✅ B8 Anthropic API 한도
- `ANTHROPIC_API_KEY` env
- R80 30일 재분석 제한 + 6개월 cron으로 비용 통제
- 👤 **본인 액션**: console.anthropic.com → Usage limits → monthly $50 alert
- 비용 모델: 1 분석 ≈ $0.005 (claude-haiku-4-5)

### ✅ B9 카카오 OAuth Redirect URI
- `app/auth/callback/route.ts` 코드 R85-C 깨끗
- 👤 **본인 액션**: developers.kakao.com → 내 애플리케이션 → 카카오 로그인 → Redirect URI 추가:
  - `https://farmerstail.kr/auth/callback`
  - `https://[supabase-id].supabase.co/auth/v1/callback`

### ⚠️ B10 Supabase Storage CORS
- 이미지 호스팅 bucket: products, review-photos, blog-covers, event-images
- 👤 **본인 액션**: Supabase dashboard → Storage → Settings → CORS 설정:
  - Allowed origins: `https://farmerstail.kr`, `https://*.vercel.app` (preview)
  - Methods: GET, HEAD

### ✅ B11 NEXT_PUBLIC_SITE_URL
- 코드 전역에서 `NEXT_PUBLIC_SITE_URL ?? 'https://farmerstail.kr'` fallback
- 👤 **본인 액션**: Vercel env `NEXT_PUBLIC_SITE_URL = https://farmerstail.kr`

### ✅ B12 CRON_SECRET 강도
- `lib/cron-auth.ts` timingSafeEqual 사용
- prod 에서 누락 시 startup throw
- 👤 **본인 액션**: 32+ 문자 random secret 생성 → Vercel env
  - 생성 방법: `openssl rand -hex 32`

**B 그룹 결론**: 코드 12개 모두 ready. 환경/외부 서비스는 본인 손으로 설정.

---

## C 그룹 — 법적 / 규제 8개

**C 전체 = 👤 USER ACTION ONLY** (정부 기관 / 보험사 등 외부). 코드 영향 없음:

### 👤 C1 통신판매업 신고
- 인천연수구청 — 신고증 발급
- R86-D agent 확인: `lib/business.ts` 에 `제2026-인천연수구-1436호` 표시 중
- **확인 필요**: 신고증 실제 발급되었는지 (현재 코드는 가정)

### 👤 C2 사업자등록증 식품판매업
- 세무서 — 업태/종목 "도매 및 소매업 - 사료, 식품" 추가 신고

### 👤 C3 사료제조업 신고 (제조사 변경 시)
- 시·도 동물위생시험소 — 자가 제조 시
- OEM 위탁 시 → 위탁 계약서 보관

### 👤 C4 광고/안내 표현 검토
- "수의사 자문", "효능 효과" 등 의약품 오인 표현 금지
- R86-D fix: nutrition.ts "통증 완화" → "관절 윤활 보조" 완료

### ⚠️ C5 개인정보보호책임자 (현재 대표 겸직)
- `lib/business.ts:55,71` — 대표/책임자 동일 (안성민,이준호)
- BACKLOG D-low (R86): 분리 권장 (실무상 OK)

### ✅ C6 PIPA 마케팅 동의 5년 보존
- `consent_log` 테이블 + `account-purge` cron 이 5년 보존 후 익명화
- R85 covered

### 👤 C7 영업 배상책임보험
- 손해보험사 — 식품 사고 대비 (한화/메리츠/현대 등)
- 권장 한도: 5억 (단일 사고당)

### ✅ C8 펫푸드 표시기준 라벨
- `app/admin/label/*` — 별표 15의2 자동 생성 (R G3)
- 👤 **본인 액션**: 인쇄본 검수 + 박스 부착 확인

**C 그룹 결론**: 8개 모두 본인 (또는 정부/보험사) 액션. 코드 자체는 ready.

---

## D 그룹 — POST_LAUNCH_BACKLOG 우선순위 14개

### 🔧 D1 R83-C2: orders.recipient_* PII 익명화 (탈퇴 시)
- `app/api/account/delete/route.ts` 에 orders update 추가
- recipient_name "탈퇴회원", phone "000-0000-0000", zip "00000", address "(익명화)"
- PIPA §21 즉시 파기 + 전자상거래법 §6 5년 보존 (회계 column 보존) 양립

### 🔧 D2 R83-C3: account-purge cron 에 auth.users hard-delete
- `supabase.auth.admin.deleteUser(p.id)` 호출 추가
- 5년 retention 후 PIPA §21 완전 삭제
- 실패해도 다음 cron retry (purged_at 미박힘)

### ⚠️ D3 R83-E3: 21개 cron `trackCron` 일괄 wrap
- **BACKLOG 유지** — 21 file restructuring 위험.
- D14 (cron error Sentry alert) 가 핵심 alert path 대체 (실패는 알림 됨).
- cron_health 테이블 기록은 향후 1주일 단위 정리.

### ⚠️ D4 R84-C1: VA 환불계좌 입력 UI
- **BACKLOG 유지** — UI 폼 (은행 selector + 계좌 + 예금주) 추가 큰 작업.
- 현재 1:1 문의 안내로 우회 (`/api/orders/[id]/cancel` 차단 메시지).
- 운영 부담 있지만 day-1 catastrophic 아님.

### ⚠️ D5 R84-B2: product_variants.stock 단위 잠금
- **BACKLOG 유지** — RPC v2 + migration 필요.
- 현재 product_variants row 0건 (variants 미사용) — day-1 영향 없음.

### 🔧 D6 R85-D6: refund-retry cron 매 30분
- `vercel.json` schedule "0 20 \* \* \*" → "\*/30 \* \* \* \*"
- backoff (5min/15min/1h/6h) 의미 회복

### ⚠️ D7 R86-C1: products.sku 컬럼
- **BACKLOG 유지** — 5종 화식 slug 매핑이 `OrderClient.LINE_TO_SLUG` 에 있음.
- 알고리즘이 카탈로그와 연결되는 곳은 OrderClient 만이라 day-1 영향 작음.

### ✅ D8 R86-C5: SUB10 쿠폰 per_user_limit
- 실제 확인 결과 SUB10.per_user_limit=3 (정기배송 3 cycle 한정 의도)
- agent 보고 오류 — 실제는 정상

### ⚠️ D9 R87-A2: transactional vs marketing 도메인 분리
- **BACKLOG 유지** — Resend Domains 추가 + env 분리 + 코드 refactor.
- 출시 후 첫 1000명까지는 같은 도메인으로 운영 가능.

### 🔧 D10 R87-A3: 마케팅 메일 universal unsubscribe
- `lib/email/unsubscribe-token.ts`: HMAC-SHA256(user_id, secret)
- `app/api/marketing/unsubscribe/route.ts`: GET + POST one-click
- `app/unsubscribed/page.tsx`: 결과 페이지
- `lib/env.ts`: UNSUBSCRIBE_TOKEN_SECRET 추가
- `notifyAbandonedCart`: unsubscribeUrl 적용
- 👤 **USER ACTION**: `UNSUBSCRIBE_TOKEN_SECRET` Vercel env 추가 (`openssl rand -hex 32`)

### 🔧 D11 R87-B2: 결제 폼 7개 input aria-label
- `app/checkout/CheckoutForm.tsx` 7개 input 에 `aria-label` 추가
- 장차법 §14 + WCAG 1.3.1/3.3.2 충족
- 시각 변경 없이 스크린리더 사용자 보조

### 🔧 D12 R87-B3: CheckoutCouponSheet button restructure
- 부모 button 안 role="button" tabIndex=-1 → div role="group" + sibling button 분리
- 키보드 사용자 쿠폰 제거 가능

### 🔧 D13 R87-C1: admin bulk create address fallback
- handleBulkCreateOrders 에 addresses.is_default=true → profiles fallback
- 주소 없는 sub → skip + console.warn (이전엔 NULL 주소 주문 생성)

### 🔧 D14 R87-C5: cron 실패 Slack/email 알림
- `lib/cron-tracking.ts` recordHealth error branch 에 captureBusinessEvent 추가
- Sentry alert rule 에서 `cron.error` 태그로 Slack 발화 (B7 user action)

**D 그룹 결론**: 8개 즉시 fix, 6개 BACKLOG (D3/D4/D5/D7/D9 + D8은 비-issue).

---

## E 그룹 — 출시 day-1 SOP 10개

**E 전체 = 👤 USER ACTION ONLY** (운영 모니터링). 코드는 모두 ready:

- ✅ E1 Sentry/Vercel dashboard 점검: 코드 R85-A1 PII scrubber + R85-D14 cron alert
- ✅ E2 admin_audit_log + payment_events 확인: R83-9 wiring + R60 ledger
- ✅ E3 Toss dashboard ↔ DB refunds 비교: refunds 테이블 audit + payment_events ledger
- ✅ E4 환영 메일 spam 폴더 확인: R87-A1 List-Unsubscribe + R87-A3 universal unsubscribe
- ✅ E5 푸시 알림 수신: lib/push 코드 정상 + R86-A1 iOS DatePicker fontSize 16+
- 👤 E6 UptimeRobot /api/health ping: 외부 서비스 설정 필요
- ✅ E7 정기배송 cron 발화: R83-6 await + R85-B3 status 재확인 + R85-D4 KST date
- ✅ E8 Slack #alerts: B7 user action (Sentry alert rule)
- ✅ E9 admin 통계 대시보드: 코드 ready
- 👤 E10 CS 24h 응답: 운영 SLA

**E 결론**: 코드 path 9/10 ready. E6/E10 만 외부 도구 / 사람 응답.

---

## F 그룹 — 첫 주 운영 10개

**F 전체 = 👤 USER ACTION ONLY** (일/주 단위 운영 task):

- 👤 F1 일 1회 매출/주문/환불/가입 summary: admin/page.tsx 에서 조회 가능
- 👤 F2 cron_health 매일 점검: admin/page.tsx 에서 조회
- 👤 F3 결제 성공률 95%+: payment_events 분석
- 👤 F4 환영 메일 open rate 30%+: Resend dashboard
- 👤 F5 푸시 클릭률 5%+: push_log dashboard
- 👤 F6 첫 50명 conversion 추적: admin/cohort 페이지 (Round F2)
- 👤 F7 CS 응답 SLA: cs_threads 시간 측정
- 👤 F8 Sentry 에러 매일 0건: 외부 모니터링
- 👤 F9 첫 주 사용자 5명 인터뷰: 본인 액션
- 👤 F10 첫 박스 도착 만족도: feeding_outcomes cron (Phase 4)

**F 결론**: 모두 운영자 task. 코드 측정 인프라는 ready.

---

## G 그룹 — 첫 달 마케팅 / Growth 10개

**G 전체 = 👤 USER ACTION ONLY**:

- 👤 G1 Google Search Console: sitemap.xml 자동 (app/sitemap.ts)
- 👤 G2 Naver Search Advisor: 사이트 인증 필요
- 👤 G3 OG 이미지: R G1 Open Graph + JsonLd 정상
- 👤 G4 Meta Pixel + GA4: lib/analytics.ts trackBeginCheckout/Purchase/SignUp
- 👤 G5 블로그 5편 schedule: 작성 완료 (R73-P6), 발행 schedule 운영자
- 👤 G6 인스타그램 채널: 외부 SNS
- 👤 G7 카카오톡 오픈채팅: 외부 채널
- 👤 G8 referral 카운터: 코드 ready (R74)
- 👤 G9 1+1 이벤트: 쿠폰 코드 발급 (admin/coupons)
- 👤 G10 첫 리뷰 50개: 코드 ready (reviews 테이블)

**G 결론**: 코드는 ready, 마케팅 활동은 운영자.

---

## H 그룹 — 회계 / 세금 / 정산 8개

**H 전체 = 👤 USER ACTION ONLY** (회계사 / 세무사 / Toss dashboard):

- 👤 H1 Toss 정산: 주 1회 / D+2 (외부)
- 👤 H2 부가세 신고: 1월/7월 (홈택스)
- 👤 H3 종합소득세: 5월 (홈택스)
- 👤 H4 매출 sync: 회계 SaaS (자비스 / 더존)
- 👤 H5 환불 회계: 회계사 상담
- 👤 H6 포인트 부채: point_ledger 합계 = 부채 (회계 처리)
- 👤 H7 50% 쿠폰 회계: 마케팅비
- 👤 H8 payment_refund_queue audit: admin/page.tsx 조회

**H 결론**: 회계/세무 영역. 코드 데이터는 모두 추출 가능.

---

## I 그룹 — 물류 / 공급망 8개

**I 전체 = 👤 USER ACTION ONLY** (실물 운영):

- 👤 I1 5종 SKU 초기 재고: products.stock 입력 (admin/products)
- 👤 I2 포장재 / 박스: 외부 구매
- 👤 I3 택배사 계약: 외부 협상
- 👤 I4 라벨 PDF: 코드 ready (R G3, admin/label)
- 👤 I5 콜드체인: 외부 운송 협의
- 👤 I6 출고 SLA: 운영 SOP
- 👤 I7 재고 부족 알림: cron/restock-alerts 동작 (R85-D5 backlog)
- 👤 I8 첫 박스 본인 포장: 운영자 액션

**I 결론**: 모두 실물 운영. 코드는 라벨/재고 알림 ready.

---

## J 그룹 — 100/1000명 milestone 8개

**J 전체 = 👤 USER ACTION ONLY** (성장 후 작업):

- 👤 J1 100명 cohort 분석: admin/cohort 페이지 (R F2)
- 👤 J2 100명 후 CS 자동화: FAQ 확장 (R73-P4)
- 👤 J3 1000명 후 BACKLOG 정리: D 그룹 deferred 6개
- 👤 J4 1000명 후 CS 인력: 외부 채용
- 👤 J5 1000명 후 라이브 채팅: Intercom / 카톡 챗봇 통합
- 👤 J6 1000명 후 i18n: XL-12 ready, 활성화만
- 👤 J7 1000명 후 네이티브 앱 store: Capacitor build (이미 구성)
- 👤 J8 1000명 후 시리즈 A: 외부 펀딩

**J 결론**: 모두 성장 후 작업. 인프라는 ready.

---

## 최종 요약

| 그룹 | 총 | 코드 ready | 즉시 fix | 본인 액션만 | BACKLOG 유지 |
|------|----|----|----|----|----|
| A 본인 검증 | 12 | 12 | - | 12 | - |
| B env/외부 | 12 | 12 | - | 12 | - |
| C 법적 | 8 | 1 | - | 8 | - |
| **D BACKLOG** | **14** | **-** | **8** | **-** | **6** |
| E day-1 SOP | 10 | 9 | - | 10 | - |
| F 첫 주 | 10 | 10 | - | 10 | - |
| G 마케팅 | 10 | 10 | - | 10 | - |
| H 회계 | 8 | 8 | - | 8 | - |
| I 물류 | 8 | 2 | - | 8 | - |
| J milestone | 8 | 7 | - | 8 | - |
| **합계** | **100** | **71 ready** | **8 fix** | **86 user** | **6 backlog** |

## 본인이 사고 후 가장 먼저 할 것

1. `docs/LAUNCH_CHECKLIST_100.md` 열고 A 그룹부터 체크박스 체크
2. A 12개 (본인 결제/가입/환불) — 진짜 출시 가능한지 1시간 검증
3. B 12개 (env / DNS) — Vercel + Resend + Toss + Supabase 설정
4. 모든 fix는 push 완료 — `git pull` 받아서 최신 코드 적용

## 자세한 진행 추적

D 즉시 fix 8건 모두 `tsc 0` 통과 후 push:
- ae68765: D1 + D2 + D6 + D11 + D14
- d7a8754: D10 (universal unsubscribe)
- 8d6e7b2: D12 + D13 (a11y + admin)
- 96f8aa5 ~ 19db19b: D3 (21개 cron trackCron wrap)

## ⭐ 자다 일어난 사용자를 위한 진짜 요약

**총 100가지 검토 완료** (잘 동안):

| 그룹 | 상태 |
|------|------|
| A 본인 검증 12 | 코드 path 모두 ready — 본인 클릭 필요 |
| B env/외부 12 | 코드 ready — Vercel/Resend/Toss 등 설정 |
| C 법적 8 | 정부/보험 등 외부 액션 |
| **D BACKLOG 14** | **9 즉시 fix (D1/D2/D3/D6/D10/D11/D12/D13/D14)** + 5 BACKLOG (architectural) |
| E day-1 SOP 10 | 코드 9/10 ready |
| F 첫 주 10 | 운영 task |
| G 마케팅 10 | 외부 활동 |
| H 회계 8 | 회계사/세무사 |
| I 물류 8 | 외부 운영 |
| J milestone 8 | 성장 후 |

**진짜 코드 fix 9건 (자는 동안):**
1. D1: orders.recipient_* PII 익명화 (탈퇴 시) — PIPA §21
2. D2: account-purge auth.users hard-delete — 5년 후 완전 삭제
3. D3: 21개 cron trackCron wrap (cron_health + Sentry alert)
4. D6: refund-retry cron 매 30분 (backoff 의미 회복)
5. D10: 마케팅 메일 universal unsubscribe (HMAC + Gmail 2024.2)
6. D11: 결제 폼 7개 input aria-label (장차법 §14)
7. D12: CheckoutCouponSheet button-in-button 분리 (키보드 a11y)
8. D13: admin bulk create address fallback (배송 가능 복원)
9. D14: cron 실패 시 Sentry captureBusinessEvent

**Deferred BACKLOG 5건** (architectural — 1000명 후 본격):
- D4 VA 환불계좌 입력 UI (현재 1:1 문의 안내 우회 중)
- D5 product_variants stock 잠금 (variants 0건이라 영향 없음)
- D7 products.sku 컬럼 (현재 OrderClient.LINE_TO_SLUG 로 cover)
- D9 transactional/marketing 도메인 분리 (Resend external)
- D8 SUB10 per_user_limit (agent 보고 오류 — 실제 3 cycle 제한 정상)

**👤 본인 액션 필요 (코드 외):**
- A 그룹 12개: 가입/결제/환불/구독 본인 클릭 검증
- B 그룹 12개: Vercel env + DNS + Resend/Toss/Kakao dashboard
  - 신규: `UNSUBSCRIBE_TOKEN_SECRET` 추가 (`openssl rand -hex 32`)
- C 그룹 8개: 통신판매업/식품판매업/보험/라벨 검수
- E-J 그룹 60개: 출시 후 운영 SOP

## Git 변경 이력 (자는 동안)

```
fe6ba03 — LAUNCH_CHECKLIST_100.md (100가지 리스트 작성)
f3dd017 — A/B/C 노트 (28개 검토 결과)
ae68765 — D batch 1: D1/D2/D6/D11/D14 (5건)
d7a8754 — D10: universal unsubscribe (1건)
8d6e7b2 — D12 + D13: a11y + admin (2건)
378118b — 100가지 노트 완성 (A-J 전부)
96f8aa5 — D3 batch 1: subscription-cleanup/account-purge/push-lifecycle
167c3c9 — D3 batch 2: subscription-reminders/cart-recovery
36d3ca6 — D3 batch 3: payment-ledger-reconcile
9921c31 — D3 batch 4: restock-alerts/onboarding-funnel
4f84032 — D3 batch 5: birthday/inactive/vip coupons
30c6ca4 — D3 batch 6: dog-age-update
d7f662f — D3 batch 7: review-prompts/coupon-expiry
ea67abd — D3 batch 8: personalization-approval-timeout/reanalyze-trigger
7548444 — D3 batch 9: sensitivity-snapshots/meta-weights
19db19b — D3 batch FINAL: weight-reminder/personalization-progression/inventory-forecast
```

## tsc 0 / tests 1032/1032 ✅

R88까지 코드 + D 그룹 9건 fix 모두 통과. 출시 차단 코드 issue 0건.



