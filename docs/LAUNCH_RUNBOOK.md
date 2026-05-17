# 파머스테일 출시 운영 매뉴얼

이 문서는 코드는 다 됐는데 운영자(=창업자)가 직접 등록/설정해야 출시가
되는 항목을 순서대로 정리한 체크리스트다.

각 단계는 **상단=차단 요소 (필수)**, **하단=권장**으로 구성. 위에서부터
순서대로 진행하면 누락 없이 끝낼 수 있다.

---

## 🚨 출시 차단 (전부 끝나야 결제 가능)

### 1. 통신판매업 신고
- **어디**: 인천 연수구청 경제일자리과 (전자상거래 담당) 또는 정부24
  (https://www.gov.kr) > "통신판매업 신고"
- **준비물**: 사업자등록증 사본, 구매안전서비스 이용 확인증 (Toss/네이버페이가 발급)
- **소요**: 신청 후 평균 3~5 영업일
- **반영**: 발급된 번호를 Vercel env 에 등록
  ```
  키:   NEXT_PUBLIC_MAIL_ORDER_NUMBER
  값:   제2026-인천연수-XXXX호  (실제 발급 형식)
  ```

### 2. Toss Payments 운영 키 발급
- **어디**: https://app.tosspayments.com → 가맹점 가입 → 심사 신청
- **준비물**: 사업자등록증, 통신판매업 신고증 (위 1번 선행)
- **반영**: Toss 대시보드에서 "라이브 키" 복사 후 Vercel env 등록
  ```
  키:   NEXT_PUBLIC_TOSS_CLIENT_KEY        값: live_ck_XXXXXXXXX
  키:   TOSS_SECRET_KEY                     값: live_sk_XXXXXXXXX
  ```
- 테스트 모드 안내 문구는 'live_' 키 등록되면 자동으로 사라짐 (이미 분기 처리됨)

### 3. Toss 웹훅 URL 등록
- **어디**: Toss 대시보드 → 설정 → 결제 → 웹훅
- **등록 URL**: `https://farmerstail.kr/api/payments/webhook`
- **수신 이벤트**: 전체 체크 (결제 완료/취소/가상계좌 입금/만료)
- **왜**: 가상계좌 입금 완료, 부분 환불, Toss 대시보드 수동 취소가 이걸 통해서만 동기화됨

### 4. Supabase Service Role Key
- **어디**: Supabase Dashboard → 프로젝트 → Settings → API → "service_role" secret
- **반영**: Vercel env
  ```
  키:   SUPABASE_SERVICE_ROLE_KEY     값: eyJhbGciOi...  (긴 JWT)
  ```
- ⚠️ **절대 클라이언트에 노출 금지** (NEXT_PUBLIC_* 접두사 안 됨)

### 5. CRON_SECRET 등록 (자동 cron 동작 필수)
- 미등록 시 모든 cron job 401 → 정기배송 결제/만료 쿠폰/환불 큐 정지
- **생성**: 로컬에서 `openssl rand -hex 32`
- **반영**: Vercel env
  ```
  키:   CRON_SECRET     값: 64자 16진수
  ```

### 6. 상품 사진 업로드
- **현재 상태**: DB 22개 상품 중 16개 `image_url` NULL → 카탈로그가 빈 박스
- **어디**: `/admin/products` → 각 상품 → 사진 업로드
- **권장 크기**: 1200×1200 이상 정사각형, JPG/WebP, 500KB 이하
- 카드/PDP/카탈로그 grid 가 모두 영향

### 7. Resend 도메인 인증 (주문 이메일)
- **어디**: https://resend.com → Domains → Add Domain `farmerstail.kr`
- DNS 레코드 4개 (SPF / DKIM / DMARC / MX) 등록 (Vercel DNS 또는 도메인 등록처)
- 인증 완료 후 API key 발급 → Vercel env
  ```
  키:   RESEND_API_KEY     값: re_XXXXXXXXX
  키:   EMAIL_FROM         값: "파머스테일 <no-reply@farmerstail.kr>"
  키:   EMAIL_REPLY_TO     값: story@farmerstail.kr
  ```
- 미등록 시 주문 확인 / 환불 / 환영 메일 전부 발송 안 됨 (코드는 silent skip)

### 8. Sentry 프로젝트 연결 (오류 모니터링)
- **어디**: https://sentry.io → Projects → Create → Next.js
- DSN 복사 후 Vercel env
  ```
  키:   NEXT_PUBLIC_SENTRY_DSN   값: https://xxxx@xxxx.ingest.sentry.io/xxxx
  키:   SENTRY_DSN               값: 같은 DSN (서버용)
  키:   SENTRY_ORG               값: 조직 slug
  키:   SENTRY_PROJECT           값: 프로젝트 slug
  키:   SENTRY_AUTH_TOKEN        값: source map upload 용
  ```
- 미등록 시 에러 / `captureBusinessEvent` 콜 전부 no-op → 결제 위변조 시도, DB 실패 등을 알아챌 수 없음

---

## ⚠️ 권장 (출시 차단은 아니지만 1주 안에)

### 9. 웹푸시 VAPID 키
- **생성**: 로컬에서 `npx web-push generate-vapid-keys`
- **반영**:
  ```
  키:   NEXT_PUBLIC_VAPID_PUBLIC_KEY    값: BL...
  키:   VAPID_PRIVATE_KEY               값: ...
  키:   VAPID_SUBJECT                   값: mailto:story@farmerstail.kr
  ```
- 미등록 시 푸시 알림 silent fail. 카트 리커버리/주문 상태 push 안 감

### 10. 카카오 채널 + 카카오 공유 SDK
- **카카오 채널**: https://center-pf.kakao.com → 채널 만들기 → 친구 추가용 URL 발급
  ```
  키:   NEXT_PUBLIC_KAKAO_CHANNEL_URL   값: https://pf.kakao.com/_xxxxx/chat
  ```
- **카카오 공유 SDK**: https://developers.kakao.com → 앱 등록 → JavaScript 키
  ```
  키:   NEXT_PUBLIC_KAKAO_JS_KEY        값: xxxxxxxxxxxxxx
  ```
- 미등록 시 ShareButton 이 카카오 우선 분기 못 타고 일반 Web Share / 클립보드로 fallback

### 11. Analytics
- **GA4**: https://analytics.google.com → 속성 → 데이터 스트림 → 측정 ID
  ```
  키:   NEXT_PUBLIC_GA_ID     값: G-XXXXXXXXXX
  ```
- **Meta Pixel** (광고 돌리면): https://business.facebook.com → 이벤트 매니저
  ```
  키:   NEXT_PUBLIC_META_PIXEL_ID   값: 1234567890
  ```

### 12. Anthropic API Key (영양 분석 자연어 코멘트)
- **어디**: https://console.anthropic.com → API Keys
- 미등록 시 분석 페이지의 AI 코멘트 섹션 비활성
  ```
  키:   ANTHROPIC_API_KEY     값: sk-ant-XXXX
  ```

---

## 📋 Vercel env 등록 순서

다 모은 후 한 번에 등록하는 게 좋다:

1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. 좌측 메뉴 **Environment** 에서 모두 `Production` 체크 (preview/development 분리 시 분리)
3. 위 1~12 항목 키를 한 번에 입력
4. 우상단 **Redeploy** → "Use existing build cache" 체크 해제 (env 반영 위해 새 빌드)
5. 배포 완료 후 https://farmerstail.kr 접속해 카탈로그 정상 표시 확인

---

## 🧪 E2E 테스트 시나리오

자세한 시나리오는 `docs/LAUNCH_E2E_TEST.md` 참조.

요약:
1. 회원가입 → 환영 메일 수신 → 환영 쿠폰 자동 적용 확인
2. 상품 카탈로그 → 카트 담기 → 결제 (테스트 카드) → 주문확인 메일
3. 가상계좌 결제 → 입금 (Toss 대시보드 수동) → 웹훅으로 paid 전환
4. 주문 취소 → 환불 처리 + 포인트/쿠폰 복원
5. 정기배송 신청 → 카드 등록 → 다음 결제일 cron 실행

---

## 🚦 출시 직전 마지막 확인

- [ ] `https://farmerstail.kr/legal/refund` 접근 가능 + 14일 환불 명시
- [ ] `https://farmerstail.kr/legal/privacy` PIPA 필수 항목 충족
- [ ] `https://farmerstail.kr/legal/terms` 이용약관
- [ ] footer 사업자정보에 통신판매업 번호 + FTC 조회 링크 정상
- [ ] 결제 페이지에서 "테스트 모드" 문구 사라짐
- [ ] 카탈로그 모든 상품에 이미지 노출
- [ ] 첫 주문 시 메일 + 푸시 정상 수신 (본인 계정으로 테스트)
- [ ] Sentry 에 테스트 에러 1건 인입 확인
- [ ] `/api/cron/refund-retry` 수동 호출 시 200 OK (Bearer CRON_SECRET)

---

## 🆘 출시 후 문제 시

| 증상 | 확인 위치 | 조치 |
|---|---|---|
| 결제 confirm 실패 폭주 | Sentry `order.payment.*` | Toss 대시보드에서 가맹점 상태 확인 |
| 주문은 됐는데 메일 안 옴 | Resend 대시보드 → Logs | 도메인 인증 상태, API 키 |
| 자동 환불이 안 됨 | `payment_refund_queue` 테이블 | status, last_error 확인 |
| 가상계좌 입금했는데 paid 안 됨 | Toss 웹훅 로그 | 웹훅 URL 등록 확인 |
| Cron 정지 | `cron_health` 테이블 | CRON_SECRET, vercel.json 확인 |
