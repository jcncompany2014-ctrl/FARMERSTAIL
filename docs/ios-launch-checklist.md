# iOS 출시 체크리스트 (App Store)

> 2026-08-09 작성. 코드는 RC 상태(감사 완료). 이 문서는 **사장님이 하는 일**과
> **코드가 받아야 하는 값**을 순서대로 적은 것이다. 상세 배경은
> `docs/native-deploy.md`, 심사 근거는 그 문서의 "권한 / 리뷰 가이드" 참고.
>
> 표기: 🙋 사장님이 직접 / 🤖 값을 주면 코드 쪽에서 처리 / ⏳ 대기·심사

---

## 0단계 — 시작 전 확인 (5분)

- [ ] 🙋 **Mac + Xcode 최신 버전 설치** (App Store 에서 Xcode, 15GB+)
- [ ] 🙋 이 저장소를 Mac 에 clone (`git clone` 후 `npm install`)
- [ ] 🙋 결제수단(해외결제 가능 카드) 준비 — Apple Developer 연회비 USD 99

---

## 1단계 — Apple Developer Program 가입 (🙋, 승인까지 1~2일)

- [ ] https://developer.apple.com/programs/ → Enroll
- [ ] **개인 vs 조직 — Google Play 와 기준이 다르다** (2026-08-09 정리)
      | | Google Play | Apple |
      |---|---|---|
      | 개인 계정 출시 제약 | 클로즈드 테스트 강제(12명대×14일) | **없음** |
      | 개인 vs 조직 차이 | 출시 속도 | **판매자명 표시** |
      → 애플은 개인이어도 **출시가 늦어지지 않는다.** 다만 App Store 앱 페이지에
      판매자명이 **실명으로 노출**된다(조직은 상호·법인명).
- [ ] **그래도 조직 권장** — ① D-U-N-S 는 Play 때문에 어차피 신청하므로 대기가
      겹쳐 시간 손해가 없고 ② 나중에 개인→조직 전환은 계정 재생성 + **앱 이전
      (App Transfer)** 에 가까워 훨씬 번거롭다. 브랜드로 파는 서비스라 판매자명도
      중요하다.
- [ ] 이미 **개인으로 신청해 검토 중**이라면: Apple 지원(Contact Us → Membership
      and Account)에 **유형 변경**을 요청. 안 되면 D-U-N-S 수령 후 조직으로 재신청.
      급하면 개인 그대로 진행해도 출시 자체엔 문제 없다.
- [ ] 결제 완료 → 승인 메일 대기 ⏳
- [ ] 승인되면 **Team ID 10자리** 확인 (Membership 페이지) → 3단계에서 사용

---

## 2단계 — 계정 승인 대기 중 병행할 것

### 2-1. 앱 아이콘·스플래시 정식 디자인 (🙋 또는 함께)
- [ ] `resources/icon.png` **1024×1024** (현재 임시 placeholder — 512 업스케일본)
- [ ] `resources/splash.png` 2732×2732 (중앙 로고, 배경 `#F5F0E6`)
- [ ] `resources/splash-dark.png` (배경 `#171310`)
- 교체 후 🤖 `npm run cap:assets && npm run cap:sync`
- 💡 Higgsfield 로 시안 뽑는 것도 가능 — 요청하면 진행

### 2-2. 스크린샷 5장 (🙋, 실기기 빌드 후에 찍어도 됨)
필요 사이즈: **6.9"(1320×2868)** 1세트면 대부분 커버. 목록:
1. 홈 "오늘의 한 가지" 카드
2. 강아지 상세 5탭
3. 사진 일기
4. 분석 결과(영양 처방)
5. 정기배송 카드
- ⚠️ 스크린샷에 **실제 고객 정보가 보이면 안 됨** — 테스트 계정으로 촬영

### 2-3. 심사용 자료 (🙋)
- [ ] **데모 계정** (심사자용 이메일/비밀번호) — 로그인 없이 앱을 볼 수 없으므로 필수
- [ ] 심사 메모에 적을 문장(그대로 복붙):
      `정기배송은 실물 펫푸드 배송 상품이라 IAP 대상이 아닙니다(Guideline 3.1.5(a) physical goods). 결제는 국내 PG(토스페이먼츠)를 사용합니다.`
- [ ] 개인정보 처리방침 URL: `https://www.farmerstail.kr/legal/privacy` (이미 있음)
- [ ] 지원 URL: `https://www.farmerstail.kr/business` (이미 있음)

---

## 3단계 — 계정 승인 후, 키·식별자 발급 (🙋 → 값 주면 🤖)

- [ ] **App ID(Bundle ID) 등록**: `com.farmerstail.app`
      - Capabilities 체크: **Push Notifications**, **Sign in with Apple**,
        **Associated Domains**
- [ ] **APNs Auth Key (.p8) 생성** — Certificates → Keys → `Apple Push Notifications service`
      - ⚠️ **.p8 파일은 최초 1회만 다운로드 가능** — 잃으면 재발급해야 함. 백업 필수.
      - 얻는 값: `.p8` 파일 내용, **Key ID**(10자), **Team ID**(10자)
- [ ] **Sign in with Apple 용 Service ID + Key** (웹 로그인이 이미 구현돼 있어 필요)
      - Supabase 대시보드 → Authentication → Providers → Apple 에 입력
- [ ] 🤖 **Vercel 환경변수에 넣을 값 4개** (사장님이 값을 주면 내가 위치·형식 안내):
      | 변수 | 출처 |
      |---|---|
      | `APNS_TEAM_ID` | Membership 페이지 Team ID |
      | `APNS_KEY_ID` | APNs 키 생성 시 나온 Key ID |
      | `APNS_PRIVATE_KEY` | .p8 파일 내용 (줄바꿈 포함) |
      | `APPLE_APP_SITE_TEAM_ID` | Team ID (Universal Links AASA 활성화용) |
      - ⚠️ 이 값들을 **채팅에 붙여넣지 말고** Vercel 대시보드에 직접 입력할 것.
        입력 후 "넣었다"고만 알려주면 내가 동작을 확인한다.

---

## 4단계 — iOS 셸 생성·빌드 (Mac에서, 🙋 명령 실행)

```bash
npm run cap:add:ios     # ios/ 폴더 생성 (최초 1회)
npm run cap:sync
npm run cap:open:ios    # Xcode 열림
```

Xcode 에서 (docs/native-deploy.md 2~3절 참고):
- [ ] Signing & Capabilities → Team 선택 (자동 서명)
- [ ] Bundle Identifier = `com.farmerstail.app` 확인
- [ ] Capabilities 추가: **Push Notifications**, **Sign in with Apple**,
      **Background Modes → Remote notifications**,
      **Associated Domains → `applinks:www.farmerstail.kr`, `applinks:farmerstail.kr`**
- [ ] Display Name: `파머스테일`
- [ ] Info.plist 권한 문구 3종 추가 (문서에 원문 있음 — 사진첩·카메라·알림)
- [ ] Deployment Target: iOS 14 이상

---

## 5단계 — 실기기 테스트 (🙋, 체크리스트대로)

아이폰 연결 후 Xcode 에서 Run. 아래를 **하나씩 눌러보고** 결과를 알려주면
문제 있는 항목은 내가 고친다.

- [ ] 앱 실행 → 스플래시 → 홈까지 진입
- [ ] **카카오 로그인** 완료 (앱 안에서 카카오톡 앱 전환·복귀)
- [ ] **Apple 로그인** 완료 (심사 필수 항목이라 특히 중요)
- [ ] 알림 설정 → **알림 켜기** → 권한 팝업 허용 → **"테스트 알림"** 수신 확인
- [ ] 알림 **끄기** 눌렀다가 화면 재진입 → 꺼짐으로 표시되는지
- [ ] 로그아웃 → 재로그인 → 알림 상태 정상인지
- [ ] 결제수단 등록에서 **토스 결제창**이 앱 안에서 뜨는지 (실결제는 PG 승인 후)
- [ ] 사진 일기에서 **카메라·사진첩** 업로드
- [ ] 뒤로가기 제스처(스와이프)로 화면 계층 이동
- [ ] 앱 종료 후 재실행 시 로그인 유지
- [ ] 알림을 눌렀을 때 해당 화면으로 이동(딥링크)

---

## 6단계 — App Store Connect 등록·제출 (🙋)

- [ ] https://appstoreconnect.apple.com → 앱 추가
- [ ] 메타 입력 — 이름/부제/설명/키워드는 `docs/native-deploy.md` "App Store 메타"에
      **작성돼 있으니 복붙**
- [ ] 카테고리: 라이프스타일(1차) / 쇼핑(2차), 연령 4+
- [ ] **개인정보 수집 항목 설문**(App Privacy) — 우리가 수집하는 것:
      이메일·이름·전화번호·주소(주문 처리), 사진(사용자 생성 콘텐츠),
      기기 식별자(푸시). "추적(Tracking)에는 사용 안 함" 선택.
- [ ] 스크린샷 업로드
- [ ] 데모 계정 + 심사 메모(3.1.5(a) 문장) 입력
- [ ] Xcode → Product → Archive → Distribute App → App Store Connect 업로드
- [ ] TestFlight 로 본인 폰에 설치해 최종 확인
- [ ] 심사 제출 ⏳ (보통 1~3일, 첫 앱은 더 걸릴 수 있음)

---

## 7단계 — 심사 반려 시 (자주 나오는 것)

| 반려 사유 | 대응 |
|---|---|
| 4.2 Minimum Functionality (웹 래퍼) | 네이티브 푸시·스플래시·Universal Links·앱 라이프사이클 사용 중임을 회신. 근거는 native-deploy.md |
| 4.8 Sign in with Apple 누락 | 이미 구현됨 — 위치(로그인 화면)를 스크린샷으로 회신 |
| 3.1.1 IAP 미사용 | 실물 배송 상품임을 3.1.5(a) 문장으로 회신 |
| 5.1.1 계정 삭제 경로 없음 | 마이페이지에 회원탈퇴 구현돼 있음 — 경로를 회신 |
| 데모 계정 로그인 불가 | 계정 상태 확인 후 재제출 |

---

## 지금 당장 할 수 있는 것 (요약)

1. 🙋 **Apple Developer 가입 시작** ← 승인에 시간이 걸리니 제일 먼저
2. 🙋 Mac 에 저장소 clone + Xcode 설치 (다운로드 오래 걸림, 병행)
3. 🙋 (병행) 토스 PG 심사 문의 — 실결제 블로커
4. 🙋 (병행) 아이콘 1024 정식 디자인

## 코드 쪽 남은 작업 (🤖 — 값 받으면 진행)

- `APPLE_APP_SITE_TEAM_ID` 세팅 후 AASA 응답 실측 검증
- APNs 키 입력 후 실기기 푸시 도달 확인
- 실기기 테스트에서 나온 이슈 수정
