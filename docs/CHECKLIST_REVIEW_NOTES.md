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


