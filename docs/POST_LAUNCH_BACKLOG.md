# 출시 후 1~3개월 백로그

출시 차단 요소는 아니지만 운영 안정성/사용자 신뢰/성장에 도움 되는 항목.
우선순위는 trafic 패턴이 모인 후 정렬해도 됨.

---

## 🟠 1주차 — 운영 가동 직후

### a11y / WCAG
- 일기/리뷰 사진의 `alt=""` (decorative) → 사용자 업로드 사진은 alt 텍스트 입력 옵션 추가 (스크린 리더 사용자가 컨텍스트 파악 가능)
- DiaryClient 사진 첨부 시 "사진 설명 (선택)" 필드
- ReviewForm 사진에도 alt 옵션

### Sentry 알림 룰
- `order.payment.subtotal_mismatch` / `order.payment.total_mismatch` → Slack #alerts (위변조 시도)
- `order.payment.points_inflated` → Slack #alerts (포인트 어뷰징)
- `refund_queue.permanent_failure` → Slack #alerts (운영자 수동 처리 필요)
- `cron_health` 실패 → 매일 09시 요약 메일

### 모니터링 대시보드
- Vercel Analytics → Speed Insights (LCP/INP/CLS) 7일 트렌드
- Supabase Database → Performance → slow query (>500ms)
- Resend → Logs → 이메일 bounce/complaint rate

---

## 🟢 2-4주차 — 사용자 피드백 반영

### 결제 정밀화
- 부분 환불 UI (현재는 전체 환불만, 부분 환불은 Toss 대시보드 수동)
- 환불 사유 통계 → admin 대시보드 도넛 차트
- 결제 수단별 전환율 비교 (카드 vs 가상계좌)

### 카탈로그
- 카테고리/태그 필터 (현재 정렬만 있음)
- "방금 산 이웃" social proof (privacy 이슈로 익명화 필요)
- 재입고 알림 신청 → 도착 시 카카오톡 send (Resend 메일은 OK)

### 영양 알고리즘
- 사용자가 분석 결과에 대해 "주려고 했는데 안 먹어요" 피드백 → 라인 비율 학습
- 체중 변화 추적 → 자동 cycle 비율 조정 (이미 일부 있음, 정밀화)
- 만성질환 새 키워드 (피부염, 슬개골 등) 카테고리 확장

### 정기배송
- 일시 정지 ↔ 재시작 UX (현재 cancel + 재구독)
- 다음 결제일 7/3/1일 전 reminder 메일/푸시 단계화
- 박스 도착 후 만족도 점검 (간단 1~5점)

---

## 🟡 1-3개월차 — 성장 인프라

### 🔒 PIPA 강화 — 탈퇴자 데이터 익명화 (D+30, 1-2시간)

R82 검토 결과 발견된 PIPA 보강 항목 — 데이터 손실 위험이 있어 PMF 검증 후
신중하게 처리. 정책 페이지엔 이미 명시되어 있지만 실제 코드 동작은 불완전.

#### C2: orders.recipient_* 익명화
- 회원 탈퇴 시 `orders.recipient_name/phone/address/zip` 평문 5년 보관
- PIPA §21 "보존 기록은 별도 DB 분리 + 익명화" 원칙 위배 소지
- Fix: `/api/account/delete` 에 orders / subscriptions / cs_messages 익명화
  (이름→`탈퇴회원-{userId8}`, phone→마스킹, address→마스킹)

#### C3: auth.users hard-delete
- 현재 `supabase.auth.admin.deleteUser(id, true)` soft-delete → email 영구 보존
- privacy 정책 "5년 후 즉시 파기" 와 불일치
- Fix: `account-purge` cron 끝에 `deleteUser(id, false)` hard-delete 추가
- 주의: ON DELETE CASCADE 다른 테이블 영향 — orders 5년 보존 위해
  `orders.user_id ON DELETE SET NULL` 또는 별도 archive 테이블 필요

#### C5: 의료·일지·사진 데이터 정리
- 현재 `/api/account/delete` 가 dog_invitations / medical_records /
  progress_photos / sensitivity_snapshots / dog_diary / feed_intake_history /
  chatbot_history / cs_messages / coupon_redemptions / user_integrations /
  feeding_outcomes / meta_learning_events / inactive_coupons 정리 안 함
- auth.users soft-delete 라 ON DELETE CASCADE 도 동작 안 함
- Fix: delete route 의 Promise.all 에 명시 delete 추가

#### Migration 작업
별도 R-cycle (R90+) 로 진행. archive 테이블 + cron + 단위 테스트 필요.
PMF 후 베타 50명 데이터 안정화된 다음 진행 권장.

---

### 🐕 AI 사진 분석 (핵심 차별화 기능) — D+30 ~ D+60

펫푸드 D2C 의 진짜 차별화 — 사료 회사는 못 함. Claude vision (claude-haiku-4-5)
이미 사용 가능. 점진 출시: 변 사진 분석 → 피모 → 시계열 트렌드.

#### Phase 1: 변 사진 분석 (D+30 ~ D+45, 약 4시간 작업)
- 사용자가 변 사진 업로드 (모바일 카메라 직접 캡처)
- Claude vision → **Bristol Stool Scale 1-7 자동 분류**
  - 현재: `surveys.bristol_stool_score` 사용자 자가 입력 (주관적, 일관성 ↓)
  - 신규: AI 가 객관적·일관성 있게 분류
- 응답 형식:
  ```
  "Bristol 6 (묽음). 지난 주 4 → 이번 주 6 으로 악화.
  새 사료 전환 직후라면 정상. 5일째 같으면 사료 비율 25% 줄이고
  단호박 1티스푼 추가해보세요."
  ```
- DB: `dog_photo_analyses` 신규 테이블 (photo_url, category='stool', score, ai_response, created_at)
- 빈도 제한: 주 3-4회 (변 상태 변화 빠름)
- 비용: 1회 ~30-40원 (vision = text 대비 1.5배)

#### Phase 2: 피모(털) 상태 분석 (D+45 ~ D+60, 약 3시간 작업)
- 강아지 등·옆구리·꼬리 사진 → AI 분석:
  - 윤기/건조함/탈모 패턴
  - 비듬·발진 의심 부위
  - 영양 결핍 신호 (단백질·오메가-3·아연 부족)
- 응답: 추천 SKU + "2주 지켜보고 호전 없으면 동물병원" 등 행동 가이드
- 빈도: 주 1회 (피모 변화 느림)

#### Phase 3: 시계열 트렌드 + 푸시 자동화 (D+60 ~ D+90, 약 2시간)
- 일별/주별 차트 — Bristol score 추이, 피모 점수 추이
- "지난 주보다 묽어졌어요" 자동 알림
- 진단 결과를 다이어리(`dog_diary`) 항목으로 자동 저장

#### 비용 통제
- 무료 사용자: 일 1회 한도 (피모/변 각각)
- **정기배송 회원: 무제한** ← lock-in 강력 hook
- Anthropic monthly cap $200 (약 28만원) — 도달 시 503 fallback

#### 출시 전 검증
- 베타 50명한테 1주 동안 사진 50장 받아서 정확도 검증
- Bristol 점수 사람 vs AI 일치율 80%+ 목표
- 정확도 70% 미만이면 모델 변경 (claude-sonnet) 또는 출시 보류

#### 차별화 가치
- 매월 새 기능 출시 = 인스타 콘텐츠 + 뉴스레터 소재
- LTV ↑↑ (사진 분석 history 가 곧 lock-in)
- 펫푸드 D2C 의 진정한 "AI 영양사" 컨셉 핵심

---

### SEO / 콘텐츠
- 블로그 article 정기 (산지 이야기 / 영양 가이드 / 사용자 후기)
- 구조화 데이터 JSON-LD: Product / Article / Breadcrumb (이미 일부 있음)
- 카테고리 페이지 별 unique meta description
- Google Search Console 등록 + sitemap submit

### 마케팅
- Meta Pixel: 구매 이벤트 + 카트 이벤트 검증 (이미 코드 있음, 실제 이벤트 매니저에서 받아지는지 확인)
- 카카오톡 친구 추가 후 자동 환영 메시지 (카카오 채널 운영자 도구)
- 첫 구매 후 7일 / 14일 / 30일 시점 follow-up 메일 시퀀스
- 친구초대 보상 milestone 도달자 socials (인스타 / 카카오 채널)

### 모바일 네이티브
- Capacitor build → iOS App Store / Google Play 제출
- 푸시 토큰 native 등록 흐름 검증
- iOS / Android 결제 (Toss SDK 가 native WebView 에서 정상 동작)

### 데이터 / 인사이트
- 사용자 cohort 별 LTV 추적 (이미 `cohort_ltv_function` RPC 있음)
- 재구매율 / 이탈률 / NPS
- 카트 이탈 단계 추적 (어느 step 에서 가장 많이 이탈하는지)

---

## ⬜ 분기별 (3-6개월)

### 인프라
- Supabase → Pro plan 검토 (현재 free / 무료 한도 모니터링)
- Vercel → Pro 검토 (cron 빈도 / 도메인 / Analytics 무제한)
- Sentry → Team plan (사용자 quota)
- Resend → 발송량 따라 plan upgrade

### 법무 / 정책
- 개인정보처리방침 갱신 (분기 검토)
- 약관 변경 시 사용자 재동의 흐름
- 개인정보 처리 위탁 계약서 (Resend / Vercel / Supabase)
- 정보보호 자체 점검 (개인정보보호위원회 가이드)

### 운영 효율
- admin 대시보드 권한 분리 (사장 / CS / 마케터)
- 자동 응답 챗봇 (이미 chatbot 있음 — FAQ 데이터 보강)
- 배송 추적 자동 알림 (이미 review-prompts / order-delivered 있음)

---

## 🔬 깊은 디버깅 후보 (시간 여유 있을 때)

### TypeScript / 타입 정합성
- `payment_refund_queue` 테이블 generate types 후 cast 제거 (audit 2-2)
- `coupon_expiry_notifications` cast 우회 → types 갱신
- `as any` / `eslint-disable` 주석 검토

### 테스트 커버리지
- `lib/rewards/cap.ts` unit test
- `lib/rate-limit.ts` DB-backed 분기 test
- `app/api/cron/refund-retry/route.ts` mock Toss fail/success

### 성능
- LCP 이미지 next/image 최적화
- 카탈로그 grid virtualization (상품 100+ 시)
- Supabase RPC 인덱스 점검 (slow query 발견 시)

---

## 우선순위 매트릭스

| 영역 | 임팩트 | 노력 | 우선순위 |
|---|---|---|---|
| Sentry 알림 룰 | 운영 안전망 | 1h | 🔴 |
| 일기 alt 옵션 | a11y 보완 | 2h | 🟢 |
| Resend bounce 모니터 | 메일 전달률 | 1h | 🟠 |
| 카테고리 필터 | 카탈로그 UX | 1d | 🟠 |
| 정기배송 pause | 이탈 방지 | 2d | 🟠 |
| Meta Pixel 검증 | 광고 ROAS | 0.5d | 🟡 |
| 블로그 article 정기 | SEO 트래픽 | 매주 4h | 🟡 |
| 네이티브 앱 store 제출 | 채널 확장 | 1주 | ⬜ |

---

## 🔍 R83 6-agent audit deferred (출시 후 1-2주)

R83 (2026-05-27) 의 5개 그룹 병렬 audit 에서 발견된 32+ Critical 중 출시
차단급은 즉시 fix, 나머지는 베타 50명 데이터 누적 후 우선순위 재조정.

### 결제·환불 (B)
- **B3: webhook CANCELED race** — 동시 CANCELED webhook 두 개가 거의 동시에 들어오면
  payment_events 에 음수 amount row 두 개 insert 가능. 발생 확률 매우 낮음 (Toss 가
  같은 paymentKey 에 cancel 두 번 동시 안 보냄). 보강: payment_events 에
  (order_id, event_type, amount) partial unique index 추가.
- **B4: webhook DONE race** — `paid → paid` 동시 webhook 시 `.eq('payment_status', 'pending')`
  조건절을 update 에 추가하면 first-write-wins. ledger unique index 가 보호 중이라
  대부분 안전하지만 명시화.
- **B6: 부분 cancel 시 쿠폰 환급 누락** — cancel-items 코멘트에 명시. 부분 환불에서
  쿠폰 사용 카운트 그대로 유지. 베타에서 부분 환불 빈도 낮음 → post-PMF.
- **B8: subscription-charge orderId 비대칭** — confirm route 는 order_number(short)
  로 추적, subscription-charge 는 order.id(UUID). reconcile 시 cross-ref 어려움.
  운영 confusion 만 (catastrophic 아님).

### DB migration (C)
- **C4: 20260525000001/2 timestamp 중복 4개 파일** — Supabase CLI 가 사전식 정렬로
  실행하므로 실제 적용은 됐을 가능성. `select * from supabase_migrations.schema_migrations
  where version like '20260525%'` 로 row 수 확인 후 누락 있으면 재적용.

### 프론트엔드 (D)
- **D2: Toss SDK reject → 고아 주문** — `payment.requestPayment(...)` reject 시 catch
  에서 order 를 cancel/delete 처리. 사용자가 SDK 모달 ESC 로 닫으면 pending order 가
  DB 에 누적. 사용자 다음 결제 시 새 주문번호 생성 → 고아 누적. order-expire cron 이
  20시간 후 정리하지만 명시 cleanup 권장.
- **D3: CartList undo 토스트 stale user closure** — 다른 탭 로그아웃 후 클릭 시 만료
  user.id 로 insert 시도 → RLS 거부. UI 정합하지만 의도와 다름.
- **D4: RestockButton fetch 후 race** — `setSubscribed(!subscribed)` 가 클로저 값 사용.
  `setSubscribed((prev) => !prev)` 로 변경 + body.success 도 체크.
- **D6: CheckoutCouponSheet button-in-button** — `<button>` 안에 `<span role="button">`
  중첩. 브라우저별 동작 차이. 외부 sibling 으로 분리.
- **D7: addresses POST 응답 무시** — best-effort 의도지만 실패 시 토스트 1줄 안내.

### Cron / 인프라 (E)
- **E3: 21개 cron `trackCron` 누락** — 실패 시 cron_health 미기록 → Slack 알림 안 옴.
  cart-recovery / subscription-reminders / restock-alerts / birthday-coupons /
  review-prompts / coupon-expiry / dog-age-update / personalization-progression /
  personalization-approval-timeout / weight-reminder / subscription-cleanup /
  account-purge / onboarding-funnel / vip-coupons / inactive-coupons /
  sensitivity-snapshots / meta-weights / reanalyze-trigger / push-lifecycle /
  inventory-forecast / reanalysis-reminder-6m. 일괄 trackCron wrap.
- **E4: onboarding-funnel push ledger 누락** — push tag OS dedupe 만 의존 →
  사용자가 7일 이내 매일 같은 알림 받을 수 있음. `onboarding_push_log` 테이블 추가.
- **E5: inactive-coupons pagination 누락** — `listUsers({perPage:1000})` 단일 페이지.
  1000명 초과 시 영구 누락. nextPage 루프.
- **E6: 3개 cron UTC 0시 동시 발화** — subscription-reminders / birthday-coupons /
  reanalysis-reminder-6m 동시 발화 → DB connection burst. 1~3분 stagger.
- **E7: weight-reminder N+1** — RPC 없으면 dogs N마리 × weight_logs query.
  단일 join query 로 재작성.
- **E8: personalization-progression batch** — dogs 별 `for...of` sequential lookup.
  IN-list 단일 query 로.
- **E9: coupon-expiry 비결정적** — `profiles.limit(MAX_PER_RUN=200)` 을 쿠폰마다
  fetch. 5개 쿠폰이면 1000명 처리. cursor-based.
- **E10: restock-alerts 영구 실패 retry** — notifyRestock 실패 시 notified_at 안
  박혀서 다음 cron 재시도 → 푸시 폭주 가능. fail_count 컬럼 또는 강제 마킹.
- **E11: push-lifecycle 의도 vs 실제** — 주석 "hourly" 인데 schedule `0 10 * * *` 일
  1회. medication reminder 가 19시(KST)만 발화. Pro plan 으로 hourly 권장 또는 의도 명시.
- **E12: refund-retry schedule 누락** — vercel.json 에 cron 등록 없음. 일 1회 (`0 20`)
  로 추정되는데 backoff (5분/15분/1시간/6시간) 의미 무력. Pro plan `*/15 * * * *` 권장.

### 우선순위 (포스트-PMF, 베타 50명 데이터 후)
| 영역 | 임팩트 | 노력 |
|---|---|---|
| E3 trackCron 일괄 wrap | 운영 안전망 | 2h |
| E5 inactive-coupons pagination | 사용자 누락 | 1h |
| E4 onboarding-funnel ledger | UX (반복 알림) | 2h |
| D2 Toss SDK reject orphan | 결제 흐름 정합 | 1h |
| E7/E8/E9 N+1 + batch | cron timeout 회피 | 1d |
| E10 restock-alerts retry cap | 푸시 폭주 방지 | 1h |
| B6 부분 cancel 쿠폰 | 환불 정합 | 2h |
| C4 timestamp 중복 확인 | DB schema 점검 | 30m |
| LTV 코호트 분석 | 의사결정 | 2d | ⬜ |
