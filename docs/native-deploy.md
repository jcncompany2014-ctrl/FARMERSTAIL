# Capacitor 네이티브 앱 배포 가이드

## 아키텍처

PWA + Capacitor remote URL 모드. 네이티브 셸이 `https://farmerstail.kr` 을
WebView 로 직접 로드. 자세한 배경은 `capacitor.config.ts` 주석 참고.

## iOS

### 1. 사전 작업 (Mac 필요)

```bash
npm run cap:add:ios   # 최초 1회 — ios/ 폴더 생성
npm run cap:sync      # web 변경사항 sync
npm run cap:open:ios  # Xcode 열기
```

### 2. Xcode 설정

- **Bundle Identifier**: `com.farmerstail.app` (capacitor.config.ts 와 일치)
- **Display Name**: 파머스테일
- **Deployment Target**: iOS 14+ (WKWebView 최신 기능)
- **Capabilities** 추가:
  - Push Notifications (APNs)
  - Background Modes → Remote notifications
  - Associated Domains: `applinks:farmerstail.kr` (universal links)

### 3. 권한 텍스트 (Info.plist)

App Store 심사에서 권한 요청 사유 필수:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>강아지 사진을 일기에 추가하기 위해 사진첩에 접근합니다.</string>
<key>NSCameraUsageDescription</key>
<string>강아지 사진을 일기에 직접 촬영하기 위해 카메라를 사용합니다.</string>
<key>NSUserNotificationsUsageDescription</key>
<string>주문/배송 상태와 정기배송 알림을 받기 위해 알림을 사용합니다.</string>
```

### 4. App Icon / Splash

`@capacitor/assets` 가 한 번에 생성:
```bash
# 1024x1024 source 이미지를 resources/ 에 두고
npm run cap:assets
npm run cap:sync
```

icon background: `#F5F0E6` (라이트), `#171310` (다크) — `capacitor.config.ts` 와 일치.

### 5. App Store 메타 (App Store Connect)

| 필드 | 값 |
|---|---|
| 이름 | 파머스테일 |
| 부제 | 우리 아이를 위한 맞춤 화식 |
| 카테고리 (1차) | 라이프스타일 |
| 카테고리 (2차) | 쇼핑 |
| 연령 등급 | 4+ |
| 키워드 | 강아지,반려견,화식,수의영양,정기배송,펫푸드 |

#### 설명 (한국어)

```
파머스테일은 수의영양학 기반의 맞춤 화식 펫푸드 D2C 서비스예요.

· 우리 아이의 체중·BCS·식이 정보로 NRC2006 기준 정밀 영양 처방
· AI 영양사 코멘터리로 매주 변화에 맞춰 처방 조정
· 정기배송으로 매주 또는 매월 자동 도착, 언제든 일시정지 가능
· 사진 일기로 매일의 강아지 일상을 기록

진짜 사람 등급 재료로 정성껏 준비합니다. Farm to Tail.
```

#### What's New (업데이트 노트)

배포마다 1-2줄. 정기적으로 변경 권장 (미변경 시 Apple 이 listing 우선순위 ↓).

#### 스크린샷 (5장 권장)

1. Dashboard "오늘의 한 가지" 카드 + 인사
2. 강아지 detail 5탭 nav (개요/기록/분석/처방/구독)
3. 사진 일기 list
4. 분석 결과 hero (영양 처방)
5. 정기배송 카드 (D-day + quick 일시정지)

#### 개인정보 처리방침 / 지원 URL

- Privacy Policy URL: `https://farmerstail.kr/legal/privacy`
- Support URL: `https://farmerstail.kr/business`
- Marketing URL: `https://farmerstail.kr`

## Android

### 1. 사전 작업

```bash
npm run cap:add:android
npm run cap:sync
npm run cap:open:android  # Android Studio 열기
```

### 2. Android Studio 설정

- **applicationId**: `com.farmerstail.app`
- **minSdk**: 24 (Android 7.0+)
- **targetSdk**: 최신 (Play Store 정책상 매년 갱신 필요)
- **buildTypes.release.signingConfig**: 릴리즈 keystore 별도 생성
- AndroidManifest.xml 에 권한:
  - `android.permission.INTERNET`
  - `android.permission.POST_NOTIFICATIONS` (Android 13+)

### 3. Firebase 연결 (push)

- Firebase Console → 프로젝트 추가 → Android 앱 등록
- `google-services.json` 다운로드 → `android/app/` 에 위치
- Capacitor PushNotifications plugin 자동 사용

### 4. Play Console 메타

| 필드 | 값 |
|---|---|
| 앱 이름 | 파머스테일 |
| 짧은 설명 | 우리 아이를 위한 맞춤 화식 펫푸드 |
| 카테고리 | 쇼핑 |
| 콘텐츠 등급 | 모든 사용자 |

상세 설명 / 스크린샷 / 정책 링크는 위 iOS 섹션과 동일.

## 권한 / 리뷰 가이드

### Apple Guideline 4.2 (Minimum Functionality)
"그냥 웹사이트 wrapper" 거부 방지를 위해 다음 네이티브 기능 활용 필수 (이미 구현됨):
- Native push (APNs) — `lib/push/native.ts`
- Native splash + status bar
- Universal Links (`applinks:farmerstail.kr`)
- App lifecycle (foreground / background)

### 결제 (In-App Purchase)
정기배송은 **물리 상품 (펫푸드 배송)** 이라 IAP 의무 없음 (Apple Guideline 3.1.5(a)).
Toss Payments 외부 결제 그대로 사용. 심사 시 reviewer 에게 "physical goods
delivery" 명시.

## 배포 흐름 (운영)

```
1) PWA 코드 변경                  → vercel push (Vercel 자동 배포)
2) WebView 가 다음 cold start 에   → 자동으로 새 버전 로드 (스토어 재심사 X)
3) 네이티브 plugin 변경 / 권한 추가  → 스토어 재심사 필요
```

## 환경 변수

native build 시 별도 env 없음 — webview 가 prod 도메인 로드. 개발 빌드는
`CAPACITOR_SERVER_URL=http://10.0.2.2:3000` (Android emulator) 또는
`http://localhost:3000` (iOS simulator) 로 override.

```bash
npm run cap:dev:android  # Android emulator + dev server
npm run cap:dev:ios      # iOS simulator + dev server
```
