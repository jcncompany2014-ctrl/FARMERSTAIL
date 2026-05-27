# 사용자 액션 체크리스트 — 자고 일어나서 보는 문서

> **이 문서는 "내가 할 수 없고 안성민 본인이 직접 해야 하는 작업"만 정리.**  
> 코드 변경은 다 끝났음 (자세한 건 `git log` 와 `docs/AUDIT_REPORT.md` 참고).
>
> 작성: 2026-05-26 (Claude — Anthropic)  
> 다음 검토: 자고 일어났을 때, 카페24/카카오/Toss 진행 상황 보고 갱신.

---

## 🎯 자고 일어나서 가장 먼저 (5분 안에)

**한 줄 요약:** 어제 만든 git commit 들 push 부터 하고 시작.

```powershell
cd C:\Users\A\Desktop\projects\farmerstail-app
git status                      # 어떤 변경 있는지 확인
git log --oneline origin/main..HEAD   # push 안 된 commit 목록
git push origin main            # push (Vercel 자동 배포 트리거됨)
```

Push 후 2~3분 안에 Vercel 새 배포 Ready. 그 뒤 본 문서의 액션 진행.

### 어젯밤 작업 요약 (자고 있는 동안)

총 **10+ commit** 누적. 주요 변경:

1. `docs/USER_ACTIONS.md` 신규 — 이 문서
2. `app/admin/products/ProductForm.tsx` — placeholder "(주)강진팜" → "강원평창팜"
3. `lib/email/templates/newsletter-welcome.ts` 신규 — 구독 confirm 후 자동 환영 메일
4. `lib/email/templates/newsletter-vol-01.ts` 신규 — 첫 정기 뉴스레터 (BCS 자가 체크)
5. `scripts/send-newsletter-vol-01.ts` 신규 — 수동 발송 스크립트
6. `supabase/seed/blog-posts.sql` 신규 — 블로그 글 5편 (BCS / 화식 FAQ / 단백질 알레르기 / 글루코사민 / 정기배송 vs 단품)
7. `docs/CHEATSHEET.md` 신규 — 운영 1페이지 명령어 모음
8. Audit 결과 자잘한 fix — 도메인 오타 (vet-report `.com` → `.kr`), 이메일 일관성 (`hello@` → `story@`), URL canonical 통일 (10곳 fallback `www.` 추가)
9. `app/api/payments/webhook/route.ts` + `app/api/payments/confirm/route.ts` — 결제 실패 시 payment_events 원장 wiring 보강 (audit G1 — CRITICAL)
10. `app/(main)/layout.tsx` — robots noindex 가드 추가 (50+ 인증 페이지 일괄 보호)
11. `eslint.config.mjs` — _ prefix unused vars 의도 ignore 패턴
12. `.env.example` — 누락된 13개 env 추가 (APNS/FCM/RESEND_WEBHOOK_SECRET 등)
13. `LAUNCH_CHECKLIST.md` — 진행 상황 체크박스 업데이트

---

## 🔴 Tier 1 — 출시 전 무조건 (이번 주 안에)

### 1. 카페24 호스팅 해지 → 5분 통화
- **무엇:** 미사용 쇼핑몰 호스팅 해지 (도메인은 유지)
- **왜:** 매월 호스팅 요금 절약 + 카카오 OAuth 락 해제 (현재 카페24가 카카오 앱 잠그고 있음)
- **어떻게:**
  1. **전화 1588-3284** (평일 09:00–18:00) — 가장 빠름
  2. "쇼핑몰 호스팅 해지 — 사업자등록 후 D2C 자체 운영으로 전환"
  3. ⚠️ **반드시 명시:** "도메인 farmerstail.kr 은 유지, 호스팅만 해지"
  4. 통화 후 카톡 알림으로 해지 확인 메시지 도착
- **예상 시간:** 5–10분

### 2. Toss Payments 입점 심사 결과 수신 (1~3일 대기 중)
- **현재 상태:** 어제 신청 완료, 1~3일 내 문자/전화 연락
- **연락 받으면:**
  1. 사업자등록증 / 통신판매업 신고증 PDF 추가 요청 시 즉시 업로드
  2. 운영 키 발급되면 → **다음 항목 진행 (#3)**

### 3. Toss 운영 키 교체 (심사 통과 후)
- **무엇:** 현재 Vercel env의 테스트 키 (`test_xxx`) 를 운영 키 (`live_xxx`) 로 교체
- **준비물:** Toss 가맹점 콘솔 → 개발자 센터 → API 키
- **단계:**
  1. https://app.tosspayments.com → 개발자센터 → **운영 키** 복사
  2. https://vercel.com/farmerstail/farmerstail/settings/environment-variables 접속
  3. `TOSS_SECRET_KEY` 편집 → 운영 키로 변경 (test_ → live_)
  4. `NEXT_PUBLIC_TOSS_CLIENT_KEY` 편집 → 운영 키로 변경
  5. Webhook URL 등록: https://app.tosspayments.com → 개발자센터 → Webhook
     - URL: `https://www.farmerstail.kr/api/payments/webhook`
     - 이벤트: 모두 선택 (PAYMENT_STATUS_CHANGED, DEPOSIT_CALLBACK, CANCEL_STATUS_CHANGED)
  6. **정기결제(billing) 사용 신청** (자동결제 cron 동작에 필수)
  7. billingAuth URL 등록:
     - successUrl: `https://www.farmerstail.kr/subscribe/billing-success`
     - failUrl: `https://www.farmerstail.kr/subscribe/billing-fail`
  8. Vercel 재배포 (Deployments → 최근 ⋯ → Redeploy, Build Cache 해제)

### 4. 카카오 디벨로퍼 정리 (카페24 락 풀린 후)
- **선결 조건:** #1 카페24 호스팅 해지 + 카페24가 카카오 앱 unlink 처리 완료 (수일~1주 소요 가능)
- **현재 상태:** 카페24가 자동 생성한 카카오 앱이 락 상태 → 삭제/수정 불가
- **카페24 unlink 확인 방법:** https://developers.kakao.com 접속 → "내 애플리케이션" → 자동 생성된 앱이 더 이상 "카페24 호스팅사를 통해..." 안내가 안 뜨면 unlink 완료
- **단계 (unlink 완료 후):**
  1. 카카오 디벨로퍼 → 3개 앱 중 2개 (TEST, 카페24 자동 생성) 삭제
  2. 메인 production 앱 1개만 유지
  3. 그 앱에서 **플랫폼 → 웹** → 사이트 도메인 추가:
     - `https://www.farmerstail.kr`
     - `https://farmerstail.kr`
  4. **카카오 로그인 → Redirect URI 등록:**
     - `https://adynmnrzffidoilnxutg.supabase.co/auth/v1/callback`
  5. **앱 키 → REST API 키 / JavaScript 키** 복사
  6. Supabase 대시보드 → Authentication → Providers → Kakao
     - REST API 키 입력
     - "Save" 클릭
  7. 카카오 채널 생성 (있으면 스킵)
  8. 비즈 앱 인증 신청 (다음 항목 #5)

### 5. 카카오 비즈 앱 인증 신청 (#4 후)
- **무엇:** 일반 앱 → 비즈 앱 승격 (알림톡 / 친구톡 / 채널 활용에 필수)
- **준비물:**
  - 사업자등록증 PDF
  - 통신판매업 신고증 PDF
  - 대표자 신분증 사본
- **단계:**
  1. https://developers.kakao.com → 메인 production 앱 → **앱 설정 → 비즈 앱 전환**
  2. 사업자 정보 입력 (243-06-03606)
  3. 서류 업로드
  4. 신청 → 카카오 심사 (3~7 영업일)

### 6. 상품 이미지 5종 실 사진 교체 (Toss 심사 통과율 ↑)
- **무엇:** 현재 5종 상품 중 3종이 placeholder ("일러스트" 텍스트), 2종은 실사진이지만 품질 점검
- **placeholder 인 3종:**
  - 팜 프로틴 믹스
  - 글루코사민 콘드로이틴 츄어블
  - 오메가-3 EPA·DHA 프리미엄
- **실사진 2종 (점검만):**
  - 오션 오메가 믹스 — Supabase storage 에 이미 업로드됨
  - 하베스트 베지 믹스 — Supabase storage 에 이미 업로드됨
- **단계:**
  1. **실사진 촬영** (스마트폰 OK, 자연광 / 깨끗한 배경 / 정사각형 비율)
     - 권장 사양: 1080x1080 이상, PNG 또는 JPEG
  2. 사이트 admin 접속: https://www.farmerstail.kr/admin/products
  3. 각 상품 → 이미지 업로드
  4. **Toss 검수 가이드 충족:**
     - 이미지가 비어있지 않음 ✅
     - 동일 이미지 반복 X ✅
     - 이미지 오류 (broken) X ✅
- **선택지:** 진짜 제품이 아직 없으면 (시제품 단계) 임시로 **고품질 스톡 이미지** 사용 가능 (단, Toss 심사 통과율 약간 낮음)

### 7. 사업용 계좌 + 사업용 카드 (해외 결제 활성)
- **계좌:** 사업자등록증 + 도장 들고 가까운 은행 (신한/KB/우리 추천) 30분 작업
- **카드:** 사업용 카드 신청 시 **해외 결제 활성** 옵션 체크 (Anthropic / Sentry / Resend 카드 등록용)
- **시간:** 1~2시간 (은행 방문)

### 8. Supabase 가입 confirmation 이메일 한글 템플릿 (첫 사용자 경험)
- **현재:** Supabase 기본 영문 템플릿 발송 중
- **단계:**
  1. https://app.supabase.com → 우리 프로젝트 → **Authentication → Email Templates**
  2. **Confirm signup** 템플릿 클릭
  3. 다음 한글 템플릿으로 교체 (HTML):
     ```html
     <h2>파머스테일에 가입해 주셔서 감사해요</h2>
     <p>아래 버튼을 눌러 이메일 인증을 마치면 분석 시작하실 수 있어요.</p>
     <p><a href="{{ .ConfirmationURL }}">이메일 인증하기</a></p>
     <hr>
     <p>본인이 가입하신 게 아니라면 이 메일은 무시하셔도 돼요.</p>
     <p>— 파머스테일 드림</p>
     ```
  4. **Reset Password** 템플릿도 동일하게 한글화
  5. **Magic Link / Change Email Address** 도 한글화
  6. Save

---

## 📝 블로그 5편 적용 (SQL 1회 실행)

블로그 콘텐츠 5편이 미리 작성됨 (`supabase/seed/blog-posts.sql`). 한 번만 SQL 실행하면 `/blog` 인덱스에 등록됨.

### 5편 목록

| # | slug | 카테고리 | 주제 |
|---|---|---|---|
| 1 | `bcs-body-condition-score-5-stages` | 건강 | BCS 9단계 체형 점수 + 견종별 평가 팁 |
| 2 | `starting-fresh-cooked-food-faq` | 영양 | 화식 입문 FAQ 5가지 (AAFCO/FEDIAF 기반) |
| 3 | `protein-allergy-chicken-beef-salmon` | 영양 | 단백질 알러지 + 로테이션 전략 |
| 4 | `senior-dog-joint-care-glucosamine-evidence` | 건강 | 글루코사민 임상 근거 + 효과 조건 |
| 5 | `subscription-vs-single-purchase-guide` | 가이드 | 정기배송 vs 단품 비용 비교 |

전부 1700~2100자, 학술 출처 명시 (WSAVA / AAFCO / FEDIAF 등), voice guidelines 준수.

### 적용 방법 (1분)

**방법 A — Supabase SQL Editor (가장 쉬움)**
1. https://app.supabase.com/project/adynmnrzffidoilnxutg/sql 접속
2. 파일 열기: `C:\Users\A\Desktop\projects\farmerstail-app\supabase\seed\blog-posts.sql`
3. 전체 내용 복사 → SQL Editor에 붙여넣기 → **RUN**
4. 결과: `INSERT 0 5` 같은 메시지 = 5편 등록됨

**방법 B — migration 으로 영구 적용 (재배포 안전)**
```powershell
cd C:\Users\A\Desktop\projects\farmerstail-app
Copy-Item supabase\seed\blog-posts.sql supabase\migrations\20260526000004_seed_blog_posts.sql
# 그 다음 git commit + push (Vercel 배포 시 자동 적용 X — supabase db push 별도 필요)
```

### 적용 후 검증

```sql
SELECT COUNT(*) FROM public.blog_posts WHERE is_published = true;
-- 결과: 5 이상이면 성공
```

또는 직접 https://www.farmerstail.kr/blog 접속해서 5개 글 보이는지.

### 커버 이미지 교체 (선택)
- 현재 임시 Unsplash CC-0 이미지 사용
- `/admin/blog/{id}` 편집 화면에서 `blog-covers` 버킷에 자체 이미지 업로드 후 교체 권장

---

## 📧 뉴스레터 발송 (자동 + 수동)

### 자동 — 환영 메일 (사용자 액션 0)
- **트리거:** 가입자가 뉴스레터 구독 confirm 링크 클릭 직후 자동 발송
- **내용:** 환영 인사 + 첫 주문 5,000원 할인 쿠폰 안내 (`WELCOME5000`)
- **사용자 액션:** 없음 (이미 코드에 자동 wired)

⚠️ **단, 한 가지만 확인:** `WELCOME5000` 쿠폰이 admin/coupons 에 활성 상태로 존재하는지.
- https://www.farmerstail.kr/admin/coupons 접속
- 검색: `WELCOME5000`
- 없으면 새로 생성:
  - 코드: `WELCOME5000`
  - 할인 유형: 정액 5,000원
  - 사용 조건: 최소 주문 15,000원 (또는 본인 결정)
  - 사용 가능 횟수: 사용자당 1회
  - 만료일: 6개월 후 (또는 무제한)

### 수동 — 정기 뉴스레터 (Tail Letter Vol. 01)
- **첫 뉴스레터 준비 완료** — 내용: BCS 자가 체크 + 오션 오메가 믹스 + 화식 전환 Q&A
- **발송 방법:**
  1. 터미널에서:
     ```powershell
     cd C:\Users\A\Desktop\projects\farmerstail-app
     # 1) 발송 대상 수 확인 (실제 발송 X)
     npm run newsletter:vol-01:dry
     # 2) 본인 메일로 테스트 발송
     npm run newsletter:vol-01:test story@farmerstail.kr
     # 3) 미리보기 OK 면 실제 일괄 발송
     npm run newsletter:vol-01:send
     ```
  2. `SUPABASE_SERVICE_ROLE_KEY` 가 셸 환경변수로 잡혀있어야 함:
     ```powershell
     $env:SUPABASE_SERVICE_ROLE_KEY="eyJxxxxx..."
     $env:RESEND_API_KEY="re_xxxxx..."
     $env:EMAIL_FROM="파머스테일 <no-reply@farmerstail.kr>"
     ```
  3. 발송 후 `newsletter_subscribers.last_sent_at` 자동 업데이트 → 24h 안에 재실행 시 중복 발송 차단
- **언제 보낼지:** 베타 사용자 첫 20명 모이면 — 출시 D+7~10일 정도

### 향후 뉴스레터 (Vol. 02, 03 ...)
- 같은 패턴: `lib/email/templates/newsletter-vol-02.ts` 새로 만들기
- `scripts/send-newsletter-vol-02.ts` 복제
- `package.json` 에 npm scripts 추가
- **나중에 cron으로 자동화** (월/격주) 시: `app/api/cron/newsletter-broadcast/route.ts` 신설 + Vercel cron 등록

---

## 🟡 Tier 2 — 출시 직후 1주 안에

### 9. Anthropic API 카드 등록 재시도 (AI 분석 활성)
- **현재 상태:** 카드 결제 차단으로 막힘 (시도 다 실패)
- **재시도 방법 (가장 빠른 순):**
  1. **다른 신용카드** (신한 / 삼성 / 현대 추천, 카카오뱅크 X)
  2. **시크릿 창** + 광고 차단기 OFF
  3. **다른 브라우저** (Edge 추천)
  4. **다른 컴퓨터 / 다른 IP**
- **그래도 안 되면:**
  - **Anthropic 지원팀 영문 이메일:** support@anthropic.com  
    제목: `Cannot add payment method — button disabled despite all fields filled`  
    내용: 시도한 브라우저 / 환경 / 에러 메시지 정리
- **풀린 후:**
  1. Anthropic Console → API Keys → Create Key
  2. Vercel env 추가: `ANTHROPIC_API_KEY` = `sk-ant-xxx`
  3. Vercel 재배포

### 10. Microsoft Clarity 본인 IP 차단 (데이터 품질)
- **무엇:** 본인 테스트 트래픽 제거 → 실 사용자 행동만 깨끗하게 수집
- **단계:**
  1. https://whatismyip.com 접속 → 본인 IP 복사
  2. https://clarity.microsoft.com → farmerstail.kr 프로젝트 → **Settings → IP blocking**
  3. IP 추가 → 저장
- ⚠️ 카페 / 외부에서 일 보면 IP 또 추가 (LTE도 별도)

### 11. GSC 색인 요청 (메인 페이지 빠른 색인)
- **단계:**
  1. https://search.google.com/search-console → farmerstail.kr 속성
  2. **URL 검사** → `https://www.farmerstail.kr` 입력 → **색인 생성 요청**
  3. 핵심 페이지 4개 더 동일:
     - `https://www.farmerstail.kr/products`
     - `https://www.farmerstail.kr/blog`
     - `https://www.farmerstail.kr/brand`
     - `https://www.farmerstail.kr/about`
- **하루 한도:** 10개

### 12. 네이버 웹페이지 수집 요청
- **단계:**
  1. https://searchadvisor.naver.com → farmerstail.kr 사이트
  2. 좌측 **요청 → 웹페이지 수집**
  3. URL 4-5개 입력 (위 #11 와 동일)
- **한도:** 일 50건 (구글보다 후함)

### 13. UptimeRobot 무료 헬스체크 등록
- **무엇:** 사이트가 다운되면 즉시 메일/카톡 알림
- **단계:**
  1. https://uptimerobot.com 무료 가입
  2. **+ New Monitor** → Monitor Type: HTTP(s)
  3. URL: `https://www.farmerstail.kr/api/health`
  4. Friendly Name: `farmerstail.kr health`
  5. Interval: 5 minutes
  6. **Alert Contacts** → 본인 이메일 + (선택) 카톡 webhook
  7. Create Monitor
- **무료 plan:** 50 monitor / 5분 interval 충분

### 14. 첫 베타 사용자 10명 모집
- **타겟:** 강아지 키우는 친구 / 가족 / 지인
- **약속:**
  - 첫 박스 무료 또는 50% 할인
  - 솔직한 피드백 부탁 (좋은 점 / 안 좋은 점 다)
  - 7일 후 1:1 통화 30분 (Cohort 분석에 활용)
- **운영:** /admin/cohort 페이지에서 beta_user 태깅 가능

---

## 🟢 Tier 3 — PMF 검증 후 (베타 50명+)

### 15. 카카오 채널 1:1 URL 발급
- **단계:**
  1. 카카오 채널 만들기 (https://center-pf.kakao.com)
  2. 채널 운영자 등록
  3. 1:1 채팅 URL 복사 (예: `https://pf.kakao.com/_xxxxx/chat`)
  4. Vercel env 추가: `NEXT_PUBLIC_KAKAO_CHANNEL_URL` = 위 URL
  5. → 사이트 footer 에 카톡 1:1 문의 버튼 자동 노출

### 16. 카카오 알림톡 시작 (도달률 99%)
- **선결조건:** #5 비즈 앱 인증 완료
- **선택지:**
  - NHN 톡톡 (월 1만원~)
  - 알리고
  - Hugotalk
- **용도:** 주문 확인 / 배송 알림 등 거래 메시지 (마케팅 X — 광고법)

### 17. Apple Developer Program 가입 + iOS 앱 출시
- **비용:** $99/년
- **사이트:** https://developer.apple.com/programs/
- **준비물:** 본인 신분증 + 신용카드
- **후속 작업:** Capacitor iOS 빌드, App Store 심사 등 (별도 1~2주 작업)

### 18. Google Play Console 등록 + Android 앱 출시
- **비용:** $25 일회성
- **사이트:** https://play.google.com/console/signup
- **후속 작업:** Capacitor Android 빌드, Play Store 심사 등

### 19. Meta Pixel 셋업 (광고 시작 시)
- 광고 캠페인 시작 결정한 시점에 진행
- Facebook Business Manager → Pixel 생성 → ID 받음
- Vercel env: `NEXT_PUBLIC_META_PIXEL_ID`

### 20. 세무사 / 회계사 선임
- **시기:** 첫 매출 발생 후 또는 빠르면 가입 즉시
- **비용:** 월정액 7~15만원 (소규모 D2C 기준)
- **추천:** 자비스 / 삼쩜삼 (앱 기반, 솔로 사업자에 합리적)
- **업무:** 매월 매입/매출 정리 + 부가세 신고 (1년 2회) + 종합소득세 (5월)

---

## 📋 운영 루틴 (반복)

### 매일 (5분)
- [ ] Sentry → Issues 새 에러 확인
- [ ] /admin/orders → 신규 주문 확인 및 처리
- [ ] /mypage 이메일 / 1:1 문의 응답

### 매주 (30분)
- [ ] /admin/cohort → 신규 가입자 추세 점검
- [ ] /admin/finance → 매출 / 환불 정합성
- [ ] Microsoft Clarity → 세션 녹화 5개 정도 시청 (UX 인사이트)
- [ ] GSC / 네이버 서치어드바이저 → 색인 / 검색어 점검

### 매월 (2시간)
- [ ] 뉴스레터 발송 (lib/email/templates/newsletter-vol-XX.ts)
- [ ] 블로그 글 1~2개 추가 (SEO + 마케팅)
- [ ] 사용자 인터뷰 2~3건 (PMF 검증)
- [ ] 세무사에게 매입/매출 정리 자료 전달

### 분기별
- [ ] VAPID 키 회전 (보안 — 푸시 사용 결정 후)
- [ ] Resend 도메인 reputation 점검
- [ ] Supabase 사용량 / 비용 점검 → 필요 시 plan 업그레이드

---

## 🤔 사용자 결정 사항 (Audit 발견)

자고 일어났을 때 시간 날 때 결정하면 됨. 결정 후 알려주면 내가 반영.

### 1. 가격 표기: ₩ vs 원 통일 ✅ 완료
- **결정:** "원" 으로 통일
- **반영:** commit 으로 ₩ → 원 sweep (v3 PDP / Home / Catalog / Dashboard / Landing / Admin Finance·Insights·PaymentEventTimeline·Events placeholder 모두)
- **DB seed:** `supabase/migrations/20260527000000_events_currency_korean.sql` — events 테이블 row UPDATE
- **DB migration 적용 필요:** Supabase SQL Editor 에서 위 SQL 한 번 실행 (`supabase db push` 시 자동 적용)

### 2. 사용자 페이지 `confirm()` 4곳 → useConfirm Modal 마이그
- `EliminationDietClient.tsx:162` (8주 elimination diet 시작)
- `DogFamilyMembers.tsx:134, 150` (가족 멤버 내보내기 / 초대 취소)
- `VetShareButton.tsx:62` (수의사 공유 링크 취소)
- 브라우저 native `confirm()` 대신 v3 Modal 사용 — UX 일관성
- **결정:** 처리할까? (작은 작업, 1-2시간)

### 3. `any` 타입 잔존 (10 파일) ✅ 처리 진행
- **결정:** 사용자 요청으로 정리 진행 (background agent)
- 대상: cart, checkout, mypage/orders, admin/orders, admin/products, ProductReviews, lib/realtime, cron/push-lifecycle
- 제외: `src/types/global.d.ts` Daum SDK (외부 SDK)
- 검증: tsc + lint 통과

### 4. "오류" → 부드러운 표현 (30+ 파일) ✅ 처리 진행
- **결정:** 사용자 요청으로 sweep 진행 (background agent)
- 스코프: 사용자 노출 영역만 (app/(main), app/cart, app/checkout, app/products 등)
- 제외: admin (운영자 전용), api routes (개발자 카피), test
- 예: "오류가 발생했습니다" → "잠시 후 다시 시도해 주세요"

### 5. 큰 client component 분할 (500+ lines) ⚠️ 부분 처리
- **결정:** app-only 2개만 분할 (background agent)
  - ✅ `app/(main)/dogs/[id]/analysis/AnalysisView.tsx` 1161줄
  - ✅ `app/(main)/mypage/subscriptions/SubscriptionsClient.tsx` 1141줄
- **스킵 (회귀 risk):**
  - ⏭ `app/page.tsx` 2153줄 — server component, bundle 영향 X
  - ⏭ `app/(auth)/signup/page.tsx` 1241줄 — ⛔ web/app 공유, PMF 후 R-cycle
  - ⏭ `app/checkout/CheckoutForm.tsx` 1175줄 — ⛔ web/app 공유, PMF 후 R-cycle

### 6. next.config.ts Supabase 프로젝트 ID 하드코딩
- `adynmnrzffidoilnxutg.supabase.co` fallback에 박힘
- 코드 공개 시 정찰 정보 노출
- **결정:** dev fallback 의도라면 별도 dev project ID 분리하거나 throw 권장

### 7. 정기배송 cancel 시 Toss billing key 정리
- 사용자가 정기배송 해지 시 `status='cancelled'` 만 UPDATE
- `billing_key` / `billing_customer_key` 정리 + Toss billing 해지 호출 누락
- R71 이후 재발급 흐름 있어 큰 문제는 아님
- **결정:** PMF 후 정리 권장

### 8. `/about` 페이지 픽션 디테일 컨펌 ⚠️ 출시 전 검토
기존 `/about` 페이지 (R73 추가 점검 — EST 연도만 2024→2026, 송도로 수정).
**나머지 디테일이 실제와 일치하는지 사용자 컨펌 필요:**
- **창업 스토리:** "열세 살 된 노견 '보리'의 만성 소화 문제"
  - 실제 창업 동기와 일치? 다르면 텍스트 교체 필요
- **원료 출처 (No.02):** "강원 평창 한우 / 전남 완도 자연산 연어 / 제주 구좌 무농약 당근 / 충북 괴산 국내산 귀리"
  - 실제 공급망과 일치? 미정이면 "지역 단위 표기 추진 중" 으로 톤다운 필요
- **HACCP 주방 (No.04):** 인증 보유? 미보유 시 "위생 관리 수칙 준수" 등으로 변경
- **AAFCO/WSAVA 기준 (No.03):** 실제 채택? 사료관리법 표시기준 외 추가 인증 명시 시 근거 필요
- **결정:** 사용자 컨펌 후 내가 정확한 카피로 다듬음

---

## 🚨 비상 대응

### 사이트 다운
- Vercel Status: https://www.vercel-status.com
- `/api/health` ping 시도
- 마지막 배포 rollback: Vercel → Deployments → 직전 Ready 배포 → Promote to Production

### 결제 실패 폭증
- Toss 가맹점 콘솔: https://app.tosspayments.com → 가맹점 상태 확인
- Sentry → /api/payments/webhook 5xx 확인
- 일시적: orders.payment_status='failed' 행 수동 점검

### 메일 발송 실패
- Resend Dashboard → Logs → 도메인 정지 여부 확인
- DKIM/SPF 변동 여부 점검 (카페24 DNS)

### DB 연결 한도
- Supabase Dashboard → Performance → connection limit
- 임시: Pro plan upgrade ($25/월) 또는 connection pooling 설정

---

## 📝 메모 / 진행 추적

### 막혀있는 외부 작업 (대기 중)
- ⏳ Toss 입점 심사 (1~3일)
- ⏳ 카페24 호스팅 해지 (1:1 문의 답변 대기, 전화가 빠름)
- ⏳ 카카오 디벨로퍼 락 (카페24 해지 → unlink 자동 처리)
- ⏳ Anthropic API 카드 결제 (재시도 필요)

### 다음 검토 시점
- 자고 일어났을 때: Toss 결과 + 카페24 답변 확인
- 1주일 후: 검색엔진 색인 상태 점검
- 베타 사용자 10명 도달: 사용자 인터뷰 + 데이터 분석

---

## 🔗 자주 가는 링크

| 서비스 | 링크 |
|---|---|
| Vercel | https://vercel.com/farmerstail/farmerstail |
| Supabase | https://app.supabase.com |
| Resend | https://resend.com/emails |
| Sentry | https://sentry.io/organizations/farmerstail |
| Microsoft Clarity | https://clarity.microsoft.com |
| GSC | https://search.google.com/search-console |
| 네이버 서치어드바이저 | https://searchadvisor.naver.com |
| Bing Webmaster Tools | https://www.bing.com/webmasters |
| Google Analytics | https://analytics.google.com |
| Toss Payments | https://app.tosspayments.com |
| 카카오 디벨로퍼 | https://developers.kakao.com |
| 카페24 (호스팅) | https://hosting.cafe24.com |

---

## 📚 참고 문서 (이 repo 안)

- `LAUNCH_CHECKLIST.md` — 전체 출시 체크리스트 (SSOT)
- `docs/CHEATSHEET.md` — 운영 명령어 1페이지 ⭐
- `docs/CS_TEMPLATES.md` — 자주 받을 문의 응답 템플릿 (copy-paste용) ⭐
- `docs/BETA_OUTREACH.md` — 첫 베타 사용자 10명 모집 메시지 + 인터뷰 가이드 ⭐
- `docs/payment-flow.md` — 결제 시스템 (#9 trigger 검증 SQL 포함)
- `docs/RUNBOOK.md` — 운영 런북
- `docs/a11y-audit-2026-05-26.md` — 접근성 검증
- `AGENTS.md` — 코딩 컨벤션 + web/app 분리 규칙
