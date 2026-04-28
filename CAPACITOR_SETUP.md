# Capacitor 네이티브 앱 셋업 가이드

웹 PWA 와 동일한 코드베이스로 iOS / Android 네이티브 앱을 빌드하기 위한
단계별 가이드. 이 파일은 한 번만 읽고 실행하면 됨.

---

## 1. 사전 준비물

| OS / 도구 | 용도 |
|---|---|
| **macOS + Xcode 16+** | iOS 빌드 / 시뮬레이터 / App Store 제출 (필수) |
| **Android Studio Hedgehog+** | Android 빌드 / 에뮬레이터 / Play Store 제출 |
| **JDK 17+** | Android 빌드 |
| **Apple Developer Program** ($99/년) | 실 디바이스 / TestFlight / App Store |
| **Google Play Console** ($25 1회) | 실 디바이스 / 내부 테스트 / Play Store |
| **CocoaPods** (`sudo gem install cocoapods`) | iOS dependency manager |

Windows 환경에선 **Android 만 가능**, iOS 는 macOS / GitHub Actions macOS
runner / Codemagic / EAS Build 같은 클라우드 빌드로 우회.

---

## 2. 프로젝트에 네이티브 폴더 추가 (한 번만)

```bash
# 의존성은 이미 설치 완료 (@capacitor/core, /ios, /android, plugins).
# webDir placeholder 만 만들어 cap CLI 가 통과하도록.
npm run cap:add:android   # ./android/ 생성
npm run cap:add:ios       # macOS 에서만. Windows 면 skip 후 macOS 에서 실행.
```

생성 결과:
- `android/` — Android Studio 가 열 수 있는 Gradle 프로젝트
- `ios/` — Xcode 가 열 수 있는 워크스페이스

이 폴더들은 **commit 함** (네이티브 설정 / plugin 등록 / 서명 인증서 메타가 포함).

---

## 3. 앱 아이콘 / 스플래시 생성

`resources/README.md` 참고하여 source 이미지를 둔 뒤:

```bash
npm run cap:assets
```

`ios/.../Assets.xcassets/AppIcon.appiconset` 와 `android/.../res/mipmap-*` 에
38개 사이즈 자동 생성.

---

## 4. 개발 빌드 (실 디바이스 / 시뮬레이터)

### Android (Windows 가능)

```bash
# 1) Next.js dev 서버 실행 (별도 터미널)
npm run dev

# 2) Android 에뮬레이터에서 cap dev 실행 — 10.0.2.2 가 호스트의 localhost.
npm run cap:dev:android
```

Android Studio 가 자동으로 열리며 에뮬레이터에 설치.

### iOS (macOS 만)

```bash
# 1) Next.js dev 서버 실행
npm run dev

# 2) iOS 시뮬레이터 / 실 기기 빌드.
npm run cap:dev:ios
```

Xcode 가 열림. 처음엔 Team 선택 (Apple Developer 계정) + Bundle ID 충돌 없는지
확인.

---

## 5. 운영 환경 빌드

`server.url` 이 자동으로 `https://farmerstail.com` 으로 잡힘 (또는 `CAPACITOR_SERVER_URL`
env 로 오버라이드).

```bash
# 1) Vercel 배포 먼저 (앱이 가리킬 origin 이 살아있어야 함)
git push origin main

# 2) Capacitor 동기화 — 네이티브 plugin 변경 / config 변경을 반영
npm run cap:sync

# 3) Android Studio / Xcode 에서 release 빌드
npm run cap:open:android  # → Build → Generate Signed Bundle/APK
npm run cap:open:ios      # → Product → Archive
```

---

## 6. iOS 추가 설정 (Xcode 에서)

### 6.1 Bundle / Team
- Signing & Capabilities → Team 선택 (Apple Developer)
- Bundle Identifier: `com.farmerstail.app` (capacitor.config.ts 와 일치)

### 6.2 Push Notifications 활성
- Signing & Capabilities → `+ Capability` → Push Notifications 추가
- Background Modes → Remote notifications 체크

### 6.3 Info.plist 권한 설명 (한국어, 심사 거절 자주 사유)

`ios/App/App/Info.plist` 에 다음 키 추가:

```xml
<key>NSCameraUsageDescription</key>
<string>강아지 사진을 등록하려면 카메라 접근이 필요합니다.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>강아지 사진을 가져오려면 사진 라이브러리 접근이 필요합니다.</string>
<key>NSUserTrackingUsageDescription</key>
<string>맞춤 제품 추천과 광고를 위해 활동 정보를 수집합니다.</string>
```

### 6.4 Universal Links (이메일/카톡 링크 → 앱 자동 진입)

- Apple Developer Portal → Identifiers → 본 앱 ID → "Associated Domains" 활성
- Xcode → Capabilities → Associated Domains → `applinks:farmerstail.com`
- Vercel 에 `/.well-known/apple-app-site-association` 호스팅 (별도 작업)

### 6.5 ATS (App Transport Security)
운영 빌드는 https 만 쓰므로 추가 설정 불필요. 개발 시 localhost 사용하려면
임시로 NSAllowsArbitraryLoads 허용:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoadsForMedia</key>
  <true/>
  <key>NSExceptionDomains</key>
  <dict>
    <key>localhost</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
    </dict>
  </dict>
</dict>
```

---

## 7. Android 추가 설정

### 7.1 키스토어 (서명)

```bash
keytool -genkey -v -keystore farmerstail.keystore -alias farmerstail \
  -keyalg RSA -keysize 2048 -validity 10000
```

생성된 `.keystore` 와 비밀번호는 **절대 분실 금지** — Play Store 업데이트 시
같은 키로 서명해야 함. 1Password / GitHub Secrets / Vercel Encrypted Env 에 백업.

### 7.2 권한 (`android/app/src/main/AndroidManifest.xml`)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.CAMERA" />
```

### 7.3 App Links (Android Universal Links 대응)
- `AndroidManifest.xml` 의 main `<activity>` 에 intent-filter 추가
- Vercel 에 `/.well-known/assetlinks.json` 호스팅

### 7.4 FCM (Firebase Cloud Messaging) — 푸시
- Firebase 콘솔 → 프로젝트 생성 → Android 앱 등록
- `google-services.json` 다운로드 → `android/app/` 에 배치
- `android/app/build.gradle` 에 `apply plugin: 'com.google.gms.google-services'`

---

## 8. 스토어 제출 자료

### 공통
- 앱 이름: 파머스테일
- 카테고리: 쇼핑 / 라이프스타일
- 연령: 4+ (4세 이상)
- 개인정보처리방침 URL: `https://farmerstail.com/legal/privacy`
- 이용약관 URL: `https://farmerstail.com/legal/terms`

### iOS App Store Connect
- 스크린샷 6.7" (iPhone 16 Pro Max), 6.5" (iPhone 14 Plus), 5.5" (iPhone 8 Plus)
  각 3-10장
- 앱 아이콘 1024×1024 (이미 cap:assets 가 생성)
- 프로모션 텍스트 (170자), 설명 (4000자), 키워드 (100자)
- 심사 정보 — 테스트 계정 (이메일/비밀번호) 제공
- IDFA 사용 여부: "예, 광고 측정" (Meta Pixel 사용 중)

### Google Play Console
- 스크린샷 폰 (16:9 또는 9:16) 2-8장
- 피처 그래픽 1024×500
- 앱 아이콘 512×512
- 짧은 설명 (80자), 전체 설명 (4000자)
- 데이터 안전 섹션 — 수집/공유 항목 체크 (이메일, 위치는 X)
- 콘텐츠 등급 설문

### 자주 거절되는 사유 (대응)

| 사유 | 대응 |
|---|---|
| "Just a website wrapper" (Apple 4.2) | Push 알림 / Splash / 카메라 권한 등 native 기능 강조 |
| "Account deletion" (Apple 5.1.1) | `/mypage/delete` 이미 구현됨. 심사자에게 경로 명시 |
| "Privacy policy 누락" | `https://farmerstail.com/legal/privacy` 링크 명확히 |
| "Permission rationale 누락" | Info.plist 의 NS*UsageDescription 한국어 명확히 |

---

## 9. 업데이트 흐름

| 변경 종류 | 재심사 필요? | 절차 |
|---|---|---|
| 웹 UI / 텍스트 / 카피 | **아니오** | `git push` → Vercel 배포 → 앱 cold start 시 자동 반영 |
| 새 페이지 / API route | **아니오** | 동일 |
| 결제 로직 / 주문 플로우 | **아니오** | 동일 |
| Capacitor plugin 추가 / 권한 변경 | **예** | `cap sync` → 새 빌드 → 스토어 재제출 |
| 앱 아이콘 / 스플래시 | **예** | 자산 재생성 → 빌드 → 재제출 |
| Bundle 버전 / 정책 변경 | **예** | 동일 |

이 architecture 의 큰 장점: 운영 중 발생하는 90% 의 변경은 **재심사 없이** 즉시
반영. App Store 의 "긴급 수정 요청" 같은 1-2주 지연이 거의 없음.

---

## 10. 디버깅

### iOS WKWebView 콘솔 보기
- Mac Safari → 개발 메뉴 → 시뮬레이터/실기기 이름 → 페이지 선택
- DevTools 가 열림 (Sentry / console.log 다 보임)

### Android Chrome inspect
- Chrome 에서 `chrome://inspect` → Devices 에 연결된 기기/에뮬 표시
- "inspect" 클릭하면 DevTools

### Sentry
- 모든 native crash 와 web JS 에러가 같은 프로젝트로 집계됨 (이미 통합 완료).
- release 태그가 `VERCEL_GIT_COMMIT_SHA` 라 어느 배포에서 났는지 추적 가능.

---

## 다음 작업 (이 가이드 외)

- [ ] Universal Links / App Links 의 `/.well-known/` 호스팅
- [ ] 푸시 알림 native 통합 — `lib/capacitor.ts` 의 `registerNativePush()` 와
      서버 측 `push_subscriptions` 테이블 연결 (APNs/FCM 토큰을 별도 컬럼에 저장)
- [ ] In-app review 모달 (Apple StoreKit / Google In-App Review API)
- [ ] 앱 종료 / 백그라운드 진입 시 cart 자동 sync (`onAppResume` 헬퍼)
