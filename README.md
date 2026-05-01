# Farmer's Tail · 파머스테일

수의영양학으로 설계한 D2C 반려견 식품 플랫폼. Next.js 16 + Supabase + Capacitor 기반의 웹 + iOS / Android 앱.

> 프로젝트는 Solo dev (안성민 · 이준호) 운영. 출시 전 점검은 **`LAUNCH_CHECKLIST.md`** 우선 — 키 발급 / 신고 / 도메인 / 마이그레이션 적용 등 외부 사전 작업 정리되어 있어요.

---

## 빠른 시작

```bash
# 1. 의존성
npm install

# 2. 환경변수
cp .env.example .env.local      # 또는 lib/env.ts 보고 직접 채움
# 최소: SUPABASE_URL / SUPABASE_ANON_KEY / SERVICE_ROLE_KEY 만 있어도 부팅

# 3. 마이그레이션 (Supabase 프로젝트가 비어 있으면)
npx supabase db push

# 4. 개발 서버
npm run dev                     # http://localhost:3000

# 5. 테스트
npm run test:watch              # Node native test runner
npm run test:e2e                # Playwright (선택)
```

## 핵심 디렉토리

```
app/
  (main)/         앱 전용 라우트 — dashboard, dogs, mypage 일부 (AppChrome wrap)
  (auth)/         signup, login (chrome 없이 단독)
  admin/          관리자 콘솔 (admin role 만)
  api/            서버 라우트 (route handlers)
    cron/         vercel.json 에 등록된 정기 작업 — bearer 인증
    payments/     Toss confirm / webhook / billing-issue
    push/         Web Push + Native (APNs/FCM) 등록
    privacy/      개인정보보호법 §35 본인 데이터 export
    webhooks/     Resend (bounce / complaint) 자동 처리
  legal/          terms / privacy / refund (전자상거래법 + PIPA)
components/       재사용 UI — admin/, products/, ui/
lib/              순수 함수 + 클라이언트
  api/            Zod 스키마 + parseRequest helper
  commerce/       order FSM, points, shipping, addresses
  email/          Resend 템플릿 (orders / cart / restock / subscription)
  payments/toss/  Toss 결제 + 정기결제 빌링키
  push/           web-push (PWA) + native.ts (APNs/FCM HTTP)
  sentry/         비즈니스 트레이싱 헬퍼
  supabase/       client / server / admin helpers
proxy.ts          Next 16 middleware — admin 가드 + rate limit + app/web 분기
supabase/migrations/  34개 마이그레이션 (날짜순)
public/icons/     PWA 아이콘 (192, 512)
capacitor.config.ts   네이티브 앱 셸 (com.farmerstail.app)
```

## 도메인 / 모델

```
사용자
 ├─ profiles (이름·전화·주소·생년·마케팅 동의·tier)
 ├─ addresses (다중 배송지)
 ├─ dogs → surveys → analyses (영양 분석 v2: WSAVA BCS9 + 만성질환 11종)
 │   ├─ weight_logs, health_logs, dog_reminders
 ├─ orders → order_items (Toss 결제 + payment_status FSM)
 ├─ subscriptions → subscription_items + subscription_charges (정기결제 cron)
 ├─ reviews (구매 인증 + photo_urls)
 ├─ wishlists / cart_items / point_ledger / coupon_redemptions
 ├─ consent_log (마케팅 동의 이력 — 정보통신망법 §50 증적)
 ├─ push_subscriptions (Web Push) + native_push_tokens (APNs/FCM)

관리자
 └─ /admin/*  — JWT app_metadata.role='admin'
    · 주문 / 정기배송 / 결제 이력 / 컬렉션 / 쿠폰 / 이벤트
    · 검색 인사이트 (인기 검색어 + 0건)
    · Feature Flags (A/B 테스트 admin)
    · 회원 관리
```

## Cron 작업 (`vercel.json`)

| Path | UTC | KST | 역할 |
|---|---|---|---|
| `subscription-reminders` | 00:00 | 09:00 | 정기배송 N일 전 안내 |
| `birthday-coupons` | 00:00 | 09:00 | 생일 당일 BIRTHDAY10 발급 |
| `dog-age-update` | 00:30 | 09:30 | birth_date 기반 age_value 갱신 + 생일 푸시 |
| `restock-alerts` | 01:00 | 10:00 | 재입고 구독자에게 1회 발송 |
| `review-prompts` | 01:00 | 10:00 | 배송 완료 D-3 후 리뷰 안내 |
| `coupon-expiry` | 02:00 | 11:00 | 만료 D-3 임박 쿠폰 안내 |
| `cart-recovery` | 09:00 | 18:00 | 장바구니 회수 메일 |
| `subscription-charge` | 19:00 | 04:00 (다음날) | 정기배송 자동 빌링 |

모든 cron 은 `Authorization: Bearer ${CRON_SECRET}` 검증. 누락 시 401.

## 기술 스택

- **Next.js 16** — App Router, Server Components, Turbopack, ISR
- **Supabase** — Postgres + Auth + Storage + Realtime + RLS
- **Toss Payments** — 결제 + 정기결제(billingKey) + webhook
- **Resend** — 트랜잭션 + 마케팅 이메일 (광고 표기 자동)
- **Anthropic Claude Haiku 4.5** — 영양 분석 commentary
- **Sentry** — 에러 / 트레이싱 / replay (한국 PII auto-scrub)
- **Capacitor 8** — iOS / Android 네이티브 셸 (remote URL 패턴)
- **Tailwind v4** + 브랜드 토큰 (cream / terracotta / moss)
- **Pretendard / Noto Serif KR / Cormorant Garamond** — 한국어 + 영문 에디토리얼

## 보안 / 법규

| 항목 | 처리 |
|---|---|
| **Zod 검증** | 11개 user-facing API route 전부, `lib/api/schemas.ts` SSOT |
| **Rate limit** | `lib/rate-limit.ts` — bucket-based, IP 키, payment / Anthropic 보호 |
| **Admin 가드** | `proxy.ts` JWT 1차 + 라우트 핸들러 `isAdmin()` 2차 (DB profiles fallback) |
| **CSP / HSTS / Permissions-Policy** | `next.config.ts` 보안 헤더 8종 |
| **개인정보보호법 §30/§35/§36/§37** | privacy 페이지 12 섹션 + /mypage/privacy 본인 열람 |
| **정보통신망법 §50** | (광고) 표기 + double opt-in + 수신거부 ack |
| **전자상거래법 §13** | 사업자정보 footer + 식품정보고시 14항목 |
| **만 14세 게이트** | signup form + OAuth callback + DB 트리거 (3중) |
| **PII Sentry 스크럽** | 주민번호/휴대폰/사업자/계좌 자동 마스킹 |

## 운영 모니터링

- `/api/health` — DB ping + 빌드 SHA. UptimeRobot 1분 폴링.
- `/admin` — 매출 / 주문 / 정기배송 / 카테고리 도넛 / 식품정보 채움률 / 코호트
- `/admin/subscriptions/charges` — 자동결제 성공률 / 실패 큐
- `/admin/search` — 인기 / 0건 검색어
- `/admin/feature-flags` — A/B 테스트 (코드 deploy 없이 즉시 반영)
- Sentry tracesSampler — 결제 / cron 1.0, analysis 1.0, health 0.01
- 실시간 주문 알림 — admin 헤더 OrderRealtimeBell (Supabase Realtime)

## 출시 전 체크리스트

→ **`LAUNCH_CHECKLIST.md`** 참조. 환경변수 / 외부 서비스 / 도메인 / 신고 / 앱스토어
모든 사전 작업이 정리되어 있어요.

## 사고 대응 (런북)

→ **`docs/RUNBOOK.md`** 참조. 결제 실패 폭증, DB 연결 한도, 메일 발송 실패 등.

## 라이선스

Private — 모든 권리는 (주)Farmer's Tail 에 있어요.
