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
| LTV 코호트 분석 | 의사결정 | 2d | ⬜ |
