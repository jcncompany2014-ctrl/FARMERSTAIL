import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor — 네이티브 셸 설정.
 *
 * # 아키텍처
 *
 * 우리 앱은 Next.js 16 + Server Components + Supabase Auth 라 정적 export
 * 가 불가능 (SSR / RSC payload 가 핵심). 따라서 Capacitor 는 **WebView 가
 * 운영 도메인을 직접 로드** 하는 "remote URL 패턴" 으로 동작한다.
 *
 *   ┌─ iOS / Android 네이티브 쉘 ────────────┐
 *   │  WKWebView / WebView                    │
 *   │  └─→ https://farmerstail.com (Vercel)   │
 *   │                                          │
 *   │  네이티브 plugins:                       │
 *   │   • Splash Screen                        │
 *   │   • Status Bar                           │
 *   │   • Push Notifications (APNs / FCM)      │
 *   │   • App lifecycle / back button          │
 *   │   • Browser (in-app browser)             │
 *   │   • Share / Preferences                  │
 *   └──────────────────────────────────────────┘
 *
 * # 왜 정적 export 가 아닌가
 *
 * - Server Components 가 Supabase 쿼리를 서버에서 실행 (RLS, 세션 쿠키)
 * - Toss Payments webhook, Resend, Sentry tunnel 등 server route 다수
 * - 정적 export 로 가면 모든 동적 라우트를 client-side 재구현해야 함 — 6주 작업
 *
 * # App Store 심사 대응
 *
 * Apple "Guideline 4.2 — Minimum Functionality" 는 "그냥 웹사이트 wrapper"
 * 를 거부한다. 우리는 다음 네이티브 기능을 추가해 통과 명분 확보:
 *   • Native push (APNs) — Web Push 와 별개의 진짜 시스템 알림
 *   • Native splash + status bar
 *   • Universal Links / App Links — 이메일 링크에서 앱으로 deep-link
 *   • App lifecycle 처리 (backgrounded / foreground 진입 시 토큰 refresh 등)
 *
 * # 업데이트 흐름
 *
 * Vercel 에 배포 → WebView 가 다음 cold start 에서 자동으로 새 버전 로드.
 * 스토어 재심사 불필요 — UI / business logic 변경은 즉시 반영.
 * 단, 네이티브 plugin 변경 (push 권한 텍스트, 새 plugin 추가 등) 은 재심사.
 */
const config: CapacitorConfig = {
  // 번들 식별자 — 한 번 정하면 절대 바꾸면 안 됨 (스토어 등록 키).
  // 역도메인 표기: tail.farmers.app — `app` suffix 로 web 도메인과 충돌 방지.
  appId: 'com.farmerstail.app',
  appName: '파머스테일',
  // webDir 은 정적 export 모드에서만 의미 있음. remote URL 모드라 placeholder.
  // (현재 디렉토리에 빈 out 폴더가 있어야 cap CLI 가 통과 — npm script 가 생성)
  webDir: 'capacitor-web',

  server: {
    // 운영: Vercel 도메인을 그대로 로드. NEXT_PUBLIC_SITE_URL 와 일치.
    // 빈 값이면 webDir 의 정적 파일을 로드 (정적 export 모드 — 미사용).
    url: process.env.CAPACITOR_SERVER_URL ?? 'https://farmerstail.com',
    // androidScheme=https 로 두면 service worker / Storage API 가 origin
    // 일관성 검사를 통과해 PWA 와 동일한 동작 (push subscription, IndexedDB 등).
    androidScheme: 'https',
    // 개발 시 capacitor.config.dev.ts 로 오버라이드해서 localhost 사용.
    cleartext: false,
    // iOS 에서 ATS (App Transport Security) 가 https 만 허용 — http localhost
    // 는 Info.plist 에서 NSAppTransportSecurity > NSAllowsArbitraryLoads 로
    // 별도 풀어야 함 (개발 빌드만).
    allowNavigation: ['farmerstail.com', '*.farmerstail.com'],
  },

  ios: {
    // SF Pro / 시스템 폰트는 WebView 자동 적용 (Pretendard 는 web 측에서).
    // 콘텐츠 인셋 자동 — 노치 / 다이내믹 아일랜드 안전.
    contentInset: 'always',
    // iOS 백그라운드 진입 시 webview 일시정지 — 배터리 보호.
    // 정기배송 카운트다운 같은 timer 는 foreground 시 재계산 (이미 처리됨).
    backgroundColor: '#F5F0E6',
  },

  android: {
    // 안드로이드 광고용 Webview 는 디버그 모드에서 chrome://inspect 가능.
    // 운영 빌드는 자동 false.
    backgroundColor: '#F5F0E6',
  },

  plugins: {
    SplashScreen: {
      // 너무 길게 띄우면 사용자가 "앱 깨졌나?" 의심. 1.5초 기준.
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#F5F0E6',
      // logo 이미지는 generators 가 채워줌. 둥근 코너는 OS 자동 (iOS 26+, Android 12+).
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // light/dark — globals.css 의 theme-color 와 합류해 chrome 톤 통일.
      // overlaysWebView=false 로 두면 WebView 가 status bar 아래에서 시작 —
      // 노치/다이내믹 아일랜드 영역에 컨텐츠 안 들어감.
      overlaysWebView: false,
      backgroundColor: '#F5F0E6',
      style: 'DEFAULT',
    },
    PushNotifications: {
      // iOS APNs 권한은 사용자가 처음 알림 토글 (예: /mypage/notifications)
      // 누를 때 요청. 앱 시작 즉시 묻지 않음 — opt-in UX.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Preferences: {
      // 그룹 식별자 — iOS 라면 App Group 으로 위젯/확장과 공유 가능 (미래).
      group: 'NativeStorage',
    },
  },
}

export default config
