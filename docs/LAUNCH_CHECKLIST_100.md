# 출시 전후 100가지 체크리스트

R81~R88 (8 라운드) 코드 audit 후, 코드 외 영역 + 운영 SOP 정리.
**우선순위: A > B > C > D > E > F > G > H > I > J**

---

## A. 출시 직전 본인 직접 검증 (12) 🔴 출시 차단급

코드 audit 가 못 잡는 진짜 사용자 경험.

- [ ] **A1** 새 이메일로 회원가입 → 이메일 인증 → 강아지 등록 → 설문 → 분석 결과 끝까지
- [ ] **A2** 카탈로그 → PDP → 카트 → 결제 (카드 1만원) → 영수증 확인
- [ ] **A3** 결제 직후 환불 신청 → 포인트 환급 / 쿠폰 복원 / 적립 회수 확인
- [ ] **A4** 정기배송 등록 → 카드 등록 → 첫 박스 확인 → 일시정지 → 재시작 → 해지 전체 사이클
- [ ] **A5** 가상계좌 결제 1만원 → 입금 → 입금 확인 메일 → 환불 1:1 문의 안내 정상
- [ ] **A6** PWA "홈 화면에 추가" iOS Safari → standalone 동작
- [ ] **A7** PWA Android Chrome 동일 점검
- [ ] **A8** 푸시 알림 권한 요청 → 허용 → 테스트 푸시 수신 (본인 폰 2대)
- [ ] **A9** /mypage 모든 sub-route 진입 (orders/subscriptions/coupons/points/addresses/wishlist/reviews/notifications)
- [ ] **A10** /admin 진입 → 주문 / 구독 / 사용자 / 쿠폰 화면 정상 표시
- [ ] **A11** 카카오 OAuth 로그인 → 신규 가입자 → age-gate → /dashboard 진입
- [ ] **A12** 만 14세 미만 출생연도 시도 → 차단 안내 노출

---

## B. 환경 변수 + 외부 서비스 (12) 🔴 출시 차단급

- [ ] **B1** Vercel env var 100% 등록 (NEXT_PUBLIC_* + secrets) — `/api/health` 응답 확인
- [ ] **B2** Toss **live key** 등록 + 결제 1만원 실거래 → 환불 1회
- [ ] **B3** Resend domain verification (SPF/DKIM/DMARC) → MXToolbox 검증 통과
- [ ] **B4** Resend webhook URL Vercel 도메인 연결 + svix 서명 검증
- [ ] **B5** Supabase production 백업 자동 설정 (PITR / 일 1회)
- [ ] **B6** Vercel cron schedule 적용 확인 (deploy 후 33개 cron 모두 등록)
- [ ] **B7** Sentry production DSN + alert rule 설정 (Slack/email channel)
- [ ] **B8** Anthropic API 한도 모니터링 (월 예산 alert — $50 권장)
- [ ] **B9** 카카오 OAuth Redirect URI 화이트리스트 (production 도메인)
- [ ] **B10** Supabase Storage CORS 설정 (이미지 호스팅)
- [ ] **B11** NEXT_PUBLIC_SITE_URL = production domain (https://farmerstail.kr)
- [ ] **B12** CRON_SECRET 강도 (32+ 문자) + Vercel cron header 일치

---

## C. 법적 / 규제 final check (8)

- [ ] **C1** 통신판매업 신고 — 인천연수구 신고증 발급 확인 (제2026-인천연수구-1436호)
- [ ] **C2** 사업자등록증 식품판매업 추가 (또는 별도 신고)
- [ ] **C3** 사료제조업 신고 (자가 제조 시) 또는 OEM 계약서 (위탁 시)
- [ ] **C4** 광고/안내에 통신판매 vs 직접판매 표현 명확
- [ ] **C5** 개인정보 보호 책임자 분리 지정 (현재 대표 겸직 — R86 BACKLOG)
- [ ] **C6** PIPA 마케팅 동의 이력 5년 보존 (consent_log 자동 — R85 covered)
- [ ] **C7** 영업 배상책임보험 가입 (식품 사고 대비 — 5억 권장)
- [ ] **C8** 펫푸드 표시기준 라벨 인쇄본 검수 (별표 15의2 — R G3 covered)

---

## D. POST_LAUNCH_BACKLOG 우선순위 (14)

`docs/POST_LAUNCH_BACKLOG.md` 의 deferred 50+ 중 가장 임팩트 큰 14개.

- [ ] **D1** R83-C1: orders.recipient_* PII 익명화 (탈퇴자, 5년 후 cron)
- [ ] **D2** R83-C3: auth.users hard-delete (현재 5년 후 inert)
- [ ] **D3** R83-E3: 21개 cron `trackCron` 일괄 wrap (실패 모니터링)
- [ ] **D4** R84-C1: VA 환불계좌 입력 UI (현재 1:1 문의 안내)
- [ ] **D5** R84-B2: `product_variants.stock` 단위 잠금 (oversell 방지)
- [ ] **D6** R85-D6: refund-retry cron 매 30분 (현재 일 1회)
- [ ] **D7** R86-C1: SKU 식별 (`products.sku` 컬럼 추가)
- [ ] **D8** R86-C5: SUB10 쿠폰 `per_user_limit=1`
- [ ] **D9** R87-A2: transactional vs marketing from 도메인 분리
- [ ] **D10** R87-A3: 마케팅 메일 universal unsubscribe (HMAC user_id)
- [ ] **D11** R87-B2: 결제 폼 7개 input `<label>` 추가 (장차법 §14)
- [ ] **D12** R87-B3: CheckoutCouponSheet button-in-button 분리
- [ ] **D13** R87-C1: admin/subscriptions bulk create address fallback
- [ ] **D14** R87-C5: cron 실패 Slack/email 알림 (recordHealth error branch)

---

## E. 출시 day-1 SOP (10)

첫 24시간 모니터링 + 응답.

- [ ] **E1** 첫 24시간 30분마다 Sentry/Vercel dashboard 점검
- [ ] **E2** 첫 결제 발생 시 admin_audit_log + payment_events 확인
- [ ] **E3** 첫 환불 발생 시 Toss dashboard ↔ DB refunds row 비교
- [ ] **E4** 첫 회원가입 환영 메일 spam 폴더 확인 (Gmail / Naver / Daum)
- [ ] **E5** 첫 푸시 알림 실제 수신 확인 (본인 폰 iOS + Android)
- [ ] **E6** UptimeRobot / Better Uptime 등으로 `/api/health` 1시간마다 ping
- [ ] **E7** 첫 정기배송 카드 결제일 발화 확인 (KST 19시 cron)
- [ ] **E8** Slack #alerts 첫 알림 수신 확인
- [ ] **E9** admin 통계 대시보드 데이터 정상 (매출 / 신규 / 환불률)
- [ ] **E10** 사용자 1번 문의 발생 시 24시간 안에 응답

---

## F. 첫 주 운영 (10)

- [ ] **F1** 일 1회 매출/주문/환불/가입 summary 정리
- [ ] **F2** `cron_health` 매일 점검 (실패 cron 0건 유지)
- [ ] **F3** 결제 성공률 95%+ 유지 (실패 이유 5건 이상 시 조사)
- [ ] **F4** 환영 메일 open rate 30%+ (Resend dashboard)
- [ ] **F5** 푸시 발송 후 클릭률 5%+
- [ ] **F6** 회원가입 → 첫 주문 conversion 첫 50명 추적
- [ ] **F7** CS 응답 시간 SLA 24h 내
- [ ] **F8** Sentry 에러 매일 0건 (또는 모두 분류 + 우선순위 부여)
- [ ] **F9** 첫 주 사용자 5명 1:1 인터뷰 (전화/카톡 30분)
- [ ] **F10** 첫 박스 도착 후 사진 + 만족도 수집 (이메일 + push)

---

## G. 첫 달 마케팅 / Growth (10)

- [ ] **G1** Google Search Console 등록 + `sitemap.xml` submit
- [ ] **G2** Naver Search Advisor 등록 + 사이트 인증
- [ ] **G3** Open Graph 이미지 정상 표시 (Facebook Sharing Debugger 통과)
- [ ] **G4** Meta Pixel + GA4 이벤트 검증 (purchase / signup / begin_checkout 발화)
- [ ] **G5** 블로그 5편 (이미 작성) 주 1회 발행 schedule
- [ ] **G6** 인스타그램 채널 개설 + 첫 박스 사진 / 강아지 사진
- [ ] **G7** 카카오톡 오픈채팅방 개설 (커뮤니티 대체)
- [ ] **G8** 첫 추천 코드 사용자 발생 추적 (referral 카운터)
- [ ] **G9** 무료 시식 / 1+1 이벤트 1회 (지인 5명)
- [ ] **G10** 첫 리뷰 50개 수집 (사용자 리뷰 + 사진)

---

## H. 회계 / 세금 / 정산 (8)

- [ ] **H1** Toss 정산 주기 확인 (주 1회 정산 / D+2 입금)
- [ ] **H2** 부가세 신고 분기 (1월 / 7월) 준비
- [ ] **H3** 종합소득세 5월 신고 (개인사업자)
- [ ] **H4** 매출 ↔ 회계 sync (Excel 또는 회계 SaaS — 자비스 / 더존)
- [ ] **H5** 환불 회계 처리 (매출 차감 vs 별도 비용 — 회계사 상담)
- [ ] **H6** 포인트 ledger ↔ 회계 (적립금은 부채 → 차감)
- [ ] **H7** 첫 박스 50% 쿠폰 회계 처리 (할인 vs 마케팅비)
- [ ] **H8** payment_refund_queue 월 1회 회계 audit

---

## I. 물류 / 공급망 (8)

- [ ] **I1** 5종 SKU 초기 재고 확보 (각 50팩 이상 → 250팩)
- [ ] **I2** 포장재 (박스/완충재/스티커/송장 라벨) 준비
- [ ] **I3** 택배사 계약 (CJ대한통운 / 한진 — 단가 협상)
- [ ] **I4** 라벨 PDF 인쇄본 검수 (별표 15의2, R G3 covered)
- [ ] **I5** 신선식품 콜드체인 (냉동 화식 운송 안정)
- [ ] **I6** 출고 SLA 정의 (결제 후 1-2 영업일)
- [ ] **I7** 재고 부족 알림 (admin/restock-alerts cron 동작 확인)
- [ ] **I8** 첫 박스 포장 / 출고 본인 직접 1회 (프로세스 체화)

---

## J. 100명 / 1000명 milestone 후 작업 (8)

- [ ] **J1** 100명 도달: cohort 분석 (1주차 환불률, 2-4주차 재구매)
- [ ] **J2** 100명 도달: CS 자동화 (자주 묻는 질문 FAQ 보강)
- [ ] **J3** 1000명 도달: BACKLOG R83-R88 deferred 본격 적용
- [ ] **J4** 1000명 도달: customer support 인력 채용 검토
- [ ] **J5** 1000명 도달: 라이브 채팅 (Intercom) 또는 카톡 챗봇
- [ ] **J6** 1000명 도달: i18n 검토 (해외 진출 시)
- [ ] **J7** 1000명 도달: 네이티브 앱 (Capacitor build) 스토어 제출
- [ ] **J8** 1000명 도달: 시리즈 A 또는 정부 지원금 다음 라운드

---

## 진행 권고

**오늘**: A (12개) 끝까지 — 진짜 출시 가능한지 본인 검증
**내일**: B (12개) — 환경/외부 서비스 final
**모레**: C (8개) — 법적 서류 확인
**출시 D-day**: E (10개) 시작
**첫 주**: F (10개)
**첫 달**: G + H + I (26개)
**100명 후**: D (14개) + J 일부

D (BACKLOG) 는 출시 후 1-3개월에 분산. 코드 audit 는 R88 으로 끝.
