# 사장님 출시 계획표 (2026-08-18 기준)

> 상태: Vercel Pro ✅ · 토스 PG 심사 통과 ✅ · 카카오 로그인 ✅ · 4라운드 감사 종결 ✅
> · 맥 보유 ✅ · Apple Developer 가입 검토 중 · **Google 용 DUNS 발급 완료** ✅
>
> 표기: [사장님] = 사장님만 할 수 있는 일, [Claude] = 제가 하는 일(맥에서 이어서).
> 순서 원칙: **웹 출시(2단계)가 앱보다 먼저다** — 앱 심사를 기다리는 동안
> 웹으로 이미 판매할 수 있다.

---

## 0단계 — 오늘, 컴퓨터 앞 1시간 (전부 병렬 가능)

### 0-1. Supabase Pro 업그레이드 (5분, $25/월) — 최우선
- supabase.com 로그인 → 조직 선택 → **Billing → Upgrade to Pro**
- 왜 오늘: 백업은 소급 생성이 안 된다. 업그레이드 **다음 날** 첫 자동 백업이
  생기므로, 실결제 시작 전날까지가 아니라 **지금** 눌러야 결제 시작일에
  복구 지점이 존재한다.

### 0-2. DB 수동 덤프 1회 (10분)
- Supabase 대시보드 → Settings → Database → **Database password** (모르면 Reset)
- 맥/윈도우 아무 데서나:
  ```bash
  npx supabase db dump --db-url "postgresql://postgres:[비밀번호]@db.adynmnrzffidoilnxutg.supabase.co:5432/postgres" -f backup-$(date +%Y%m%d).sql
  ```
- 파일을 구글드라이브 등 **PC 밖 한 곳**에 보관. (DISASTER_RECOVERY.md §3 에
  보관 위치를 적어두면 사고 때 헤매지 않는다)

### 0-3. 비밀번호 재설정 메일 템플릿 붙여넣기 (5분)
- Supabase 대시보드 → Authentication → **Email Templates → Reset Password**
- 저장소의 `supabase/email-templates/reset-password.html` 내용 전체 복붙 + 저장
- 왜: 코드 쪽 수정은 배포됐지만, "앱에서 요청 → 다른 브라우저에서 링크 열기"
  경로는 이 템플릿을 붙여야 완성된다.

### 0-4. Apple Developer Program 가입 시작 (15분 + 승인 대기 1~2일)
- developer.apple.com/programs → **Enroll**
- **가입 유형 결정** (제일 중요한 갈림길):
  - **개인사업자라면 → Individual(개인)로 가입.** Apple 의 Organization 은
    법인격 있는 회사만 받는다. DUNS 가 있어도 개인사업자는 조직 가입이
    거절된다. ⚠️ 단점 하나: App Store 판매자 이름이 "파머스테일"이 아니라
    **사장님 개인 이름**으로 표시된다. (많은 1인 사업자가 이렇게 시작하고,
    나중에 법인 전환 시 계정 이전 가능)
  - **법인이라면 → Organization** + DUNS 번호 입력.
- 연 129,000원 결제. 신분 확인 요구가 오면 바로 응답(승인이 보통 1~2일,
  길면 일주일 — **그래서 오늘 시작**).

### 0-5. Google Play Console 조직 계정 생성 시작 (20분 + 검증 수일)
- play.google.com/console → 시작 → **조직(Organization) 계정** 선택
- DUNS 번호 입력 (✅ 발급 완료), 사업자 정보, 결제 $25(일회성)
- 웹사이트 소유 확인·이메일 검증 요구가 오면 응답
- 조직 계정의 큰 이점: 개인 계정에 붙는 **"테스터 12명 × 14일" 비공개 테스트
  의무가 면제**된다 — 심사만 통과하면 바로 프로덕션 출시 가능.

---

## 1단계 — 맥 셋업 (반나절, 이번 주 중)

정본 절차 = `docs/MAC_MIGRATION.md`. 요약:

1. [사장님] App Store 에서 **Xcode 설치**(다운로드 1~2시간 — 먼저 걸어두기),
   실행해 라이선스 동의
2. [사장님] 터미널에서: Command Line Tools → fnm/Node 24 → `git clone` →
   `npm install` → `npm run install:hooks` → `npx vercel env pull .env.local`
3. [사장님] **이사 완료 판정**: `npm run verify` 와 `npx next build` 둘 다 초록
4. [사장님] 제 메모리 폴더 복사(MAC_MIGRATION.md 0절 — 이걸 안 하면 맥의
   저는 두 달치 맥락 없이 시작한다)
5. [Claude] 맥 첫 세션에서 환경 점검 + `npx cap add ios` + allowNavigation
   (토스·Supabase 도메인) 수정 + 커밋

---

## 2단계 — 토스 라이브 키 + 실결제 리허설 = **웹 출시일**

정본 절차 = `TOSS_GO_LIVE.md`. 사장님 액션만 추리면:

1. [사장님] 토스 개발자센터 → **API 개별 연동 키**(`live_ck_`/`live_sk_`,
   위젯 키 `live_gck_` 아님!) 복사
2. [사장님] Vercel → 프로젝트 → Settings → Environment Variables →
   `NEXT_PUBLIC_TOSS_CLIENT_KEY` / `TOSS_SECRET_KEY` 를 Production 에만 교체
3. [사장님] Redeploy 후 **본인 카드로 실결제 리허설** (약 30분):
   - 설문 → 구독 신청 → 카드 등록 → 첫 결제 확인 (토스 대시보드 + 어드민 양쪽)
   - 어드민에서 **부분 환불** 1회 → 토스 대시보드 금액 확인
   - **전액 환불** → 구독 해지까지
   - 어드민 → cron 대시보드에 빨간불 없는지 확인
4. 리허설 통과 = **웹 판매 시작 가능 상태.** 첫 1~2주는 지인·소수 주문으로
   시작(문제 조기 발견의 마지막 안전망).
5. [사장님] 사진 촬영분 교체(플랜 페이지 실사 — 기존 결정 사항)

---

## 3단계 — iOS 출시 (Apple 승인 후 · 맥에서 · 약 1주)

1. [사장님] Xcode → Settings → Accounts 에 Apple ID 로그인
2. [Claude] ios/ 프로젝트 구성(아이콘·스플래시 — logo-ink 자산 리사이즈),
   번들 ID `com.farmerstail.app`
3. [사장님] Xcode 프로젝트에서 **"Automatically manage signing"** 체크 +
   팀 선택 (인증서는 Xcode 가 알아서 만든다)
4. [사장님] developer.apple.com → Certificates, Identifiers & Profiles →
   **Keys → APNs Auth Key(.p8) 생성** → 다운로드는 1회만 되니 안전 보관 →
   Vercel 환경변수 4개 입력: `APNS_TEAM_ID` `APNS_KEY_ID` `APNS_PRIVATE_KEY`
   (.p8 파일 내용 전체) `APNS_BUNDLE_ID`
5. [사장님] 실기기(본인 아이폰) 연결 테스트 — 여기서 **카드 등록 흐름** 반드시
   1회 (allowNavigation 검증 지점)
6. [사장님] App Store Connect (appstoreconnect.apple.com):
   - 새 앱 등록 → 이름 "파머스테일" · 카테고리(라이프스타일 또는 음식)
   - 스크린샷: 아이폰 실기기/시뮬레이터에서 핵심 화면 5~6장
     (홈·기록·분석·구독 관리 — [Claude] 가 시뮬레이터로 뽑는 것 도와드림)
   - 개인정보처리방침 URL: `https://farmerstail.kr/legal/privacy` ✅ 이미 있음
   - 심사용 **데모 계정** 하나 만들기(이메일 가입, 강아지 1마리 + 구독 없이) →
     심사 노트에 아이디/비번 기입
   - 심사 노트에 한 줄: "실물 상품(반려견 신선식 정기배송) 판매 앱으로 외부
     PG(토스페이먼츠)를 사용합니다" — 실물 상품은 인앱결제 의무가 **없다**
     (오히려 IAP 를 쓰면 안 되는 카테고리)
7. TestFlight 내부 테스트 1~2일 → **심사 제출** (심사 평균 1~2일, 첫 제출은
   리젝 1회가 흔하다 — 리젝 사유는 [Claude] 와 같이 대응)
8. 승인 후: [사장님] 수동 출시 버튼 → [Claude] Vercel 에
   `NEXT_PUBLIC_IOS_APP_URL` 채움 → /app-required 에 App Store 버튼 자동 노출

## 4단계 — Android 출시 (iOS 와 병렬 가능 · 약 1주)

1. [Claude] AAB 릴리스 빌드 구성 + 업로드 키(keystore) 생성 절차 안내
2. [사장님] keystore 비밀번호 정하고 **2곳에 백업**(Play App Signing 이
   기본이라 분실해도 복구는 되지만, 백업이 시간을 아낀다)
3. [사장님] Play Console → 앱 만들기 → 스토어 등록정보(설명·스크린샷·그래픽) →
   **데이터 보안 설문**(수집 항목: 이메일·이름·건강기록 등 — [Claude] 가
   항목표 뽑아드림) → 콘텐츠 등급 설문 → 프로덕션 트랙에 AAB 업로드 → 심사
4. 승인 후: `NEXT_PUBLIC_ANDROID_APP_URL` 채움

## 5단계 — 출시 후 2주 루틴 (매일 5분)

- 아침: 어드민 대시보드 — 크론 빨간불 · 신규 주문 · 결제 실패 확인
- 일요일 밤: 주문 마감 확인 / 화요일: 발송(운송장 필수 — 시스템이 강제함)
- 이상 징후는 스크린샷 찍어 저에게 — 원인 추적은 제 일

---

## 비용 요약

| 항목 | 금액 | 주기 |
|---|---|---|
| Supabase Pro | $25 | 월 |
| Vercel Pro | $20 | 월 (✅ 가입됨) |
| Apple Developer | 129,000원 | 년 |
| Google Play Console | $25 | 일회 |

## 지금 이 순간의 병목 = 0-4 (Apple 승인 대기)

오늘 0단계 다섯 개를 걸어두면, 승인 기다리는 동안 1·2단계(맥 셋업 + 웹 출시)를
끝낼 수 있다. 이상적 타임라인: 이번 주 웹 출시 → 다음 주 앱 심사 제출.
