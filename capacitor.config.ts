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
 *   │  └─→ https://farmerstail.kr (Vercel)    │
 *   │                                          │
 *   │  네이티브 plugins:                       │
 *   │   • Splash Screen                        │
 *   │   • Status Bar                           │
 *   │   • Push Notifications (APNs / FCM)      │
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
 * 를 거부한다. 통과 명분으로 쓸 네이티브 기능 — **실제 구현 상태 기준**
 * (2026-07-16 전수 확인. 계획이 아니라 코드가 있는 것만 적는다):
 *   • Native push (APNs) — ✅ `registerAndSyncNativePush`,
 *     /mypage/notifications 토글에서 호출. Web Push 와 별개의 진짜 시스템 알림.
 *   • Native splash + status bar — ✅ 아래 plugins 설정.
 *   • Native share sheet — ✅ `nativeShare` (@capacitor/share),
 *     수의사 보고서 공유에서 사용.
 *   • Universal Links / App Links — 🟨 라우트는 준비됨
 *     (/.well-known/apple-app-site-association · assetlinks.json). 다만
 *     `APPLE_APP_SITE_TEAM_ID` 가 비면 빈 응답이라 **사실상 비활성**.
 *     심사 전에 Team ID 를 넣어야 명분이 산다.
 *   • ~~App lifecycle 처리 (foreground 진입 시 토큰 refresh)~~ — ❌ **미구현.**
 *     `onAppResume` 헬퍼가 있었지만 **호출처가 0** 이었고(목적도 죽은
 *     '장바구니 재동기화'), 2026-07-16 제거했다. 이 항목을 심사 명분으로 쓰려면
 *     먼저 구현해야 한다.
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

  /**
   * ★2026-08-22 — WebView User-Agent 끝에 표식을 붙인다.
   *
   * # 왜 (사장님: "지금 그냥 웹으로 들어가지는데?")
   * 앱을 켜면 WebView 가 우리 사이트를 **쿠키 하나 없이** 요청한다. 서버는
   * `ft_app` 쿠키로만 앱/웹을 갈랐기 때문에 **첫 화면을 웹으로 렌더**했고,
   * 그 뒤 클라이언트가 쿠키를 심어도 이미 그려진 화면은 그대로였다.
   * UA 표식은 **첫 요청의 헤더에 이미 들어 있어** 서버가 왕복 없이 안다.
   *
   * ⚠️ `lib/app-context-request.ts` 의 `APP_USER_AGENT_MARKER` 와 **같은
   * 문자열이어야 한다.** 이 파일은 Capacitor CLI 가 따로 로드해서 `@/` 별칭을
   * 못 쓰므로 값을 복제한다 — 대신 규칙58(lib/audit-rules.test.ts)이 두 값의
   * 일치를 강제한다.
   *
   * `overrideUserAgent` 가 아니라 `append` 인 것이 중요하다. UA 를 통째로
   * 바꾸면 토스 결제창·카카오 로그인이 브라우저 판정을 못 해 깨질 수 있다.
   * 뒤에 토큰 하나만 덧붙이는 건 표준 관행이다.
   */
  /*
   * 뒤의 `FtShell/2` = 이 네이티브 셸의 세대. 웹 배포는 모든 설치 버전에 닿지만 네이티브 색
   * (폰 화면·상태바·홈바 구간)은 스토어 업데이트로만 바뀌어서, 웹이 "이 셸은 어느 색인가"를 알아야
   * 한다(2026-10-08 — 네이티브 바탕을 크림 #F5F0E6 → 앱 종이색 #F7F5F0 로 맞춘 첫 셸이 2).
   * 첫 요청부터 헤더에 실리고 head 인라인 스크립트가 동기로 읽는다(app/layout.tsx). 표식 판정은
   * 앞 토큰(FarmerstailApp)만 본다 — 규칙58.
   */
  appendUserAgent: 'FarmerstailApp FtShell/2',

  server: {
    // 운영: Vercel 도메인을 그대로 로드. NEXT_PUBLIC_SITE_URL 와 일치.
    // 빈 값이면 webDir 의 정적 파일을 로드 (정적 export 모드 — 미사용).
    url: process.env.CAPACITOR_SERVER_URL ?? 'https://www.farmerstail.kr',
    // androidScheme=https 로 두면 service worker / Storage API 가 origin
    // 일관성 검사를 통과해 PWA 와 동일한 동작 (push subscription, IndexedDB 등).
    androidScheme: 'https',
    // 개발 시 capacitor.config.dev.ts 로 오버라이드해서 localhost 사용.
    cleartext: false,
    // ★서버를 못 불러오면(오프라인·서버 장애) webDir 의 한국어 안내 화면(2026-09-26 점검 7차).
    //   예전엔 iOS 에서 베이지 빈 화면만 남고 다시 시도할 길이 없었다. 다음 앱 빌드부터 적용.
    errorPath: 'error.html',
    // iOS 에서 ATS (App Transport Security) 가 https 만 허용 — http localhost
    // 는 Info.plist 에서 NSAppTransportSecurity > NSAllowsArbitraryLoads 로
    // 별도 풀어야 함 (개발 빌드만).
    /**
     * WebView 안에서 **이동을 허용**할 도메인. 여기 없는 곳으로 이동하면
     * Capacitor 가 막거나 외부 브라우저로 튕겨 흐름이 끊긴다.
     *
     * ★2026-08-20 6라운드 감사 유예분 처리 — 예전엔 우리 도메인만 있어서
     *   **네이티브 앱에서 결제와 소셜 로그인이 통째로 막혔다**:
     *    · 토스 결제창(카드 등록)은 js.tosspayments.com → 카드사 인증 페이지로
     *      이동한다. 우리 도메인이 아니라 첫 화면부터 안 열린다.
     *    · 카카오/애플 로그인은 Supabase(*.supabase.co) → kauth.kakao.com /
     *      appleid.apple.com 을 거쳐 우리 /auth/callback 으로 돌아온다.
     *      중간 한 곳만 막혀도 로그인이 끝나지 않는다.
     *   웹/PWA 에서는 이 제약이 없어 지금까지 드러나지 않았다 — 앱 스토어
     *   빌드에서 처음 발현되는 종류라 **실기기 테스트 전에 반드시** 필요하다.
     *
     * ⚠️ 넓히기만 하면 안 된다 — 여기 적힌 도메인은 앱 안에서 우리 세션 쿠키와
     *   같은 WebView 를 쓴다. 결제·인증에 **실제로 필요한 곳만** 적고,
     *   마케팅·분석 도메인은 넣지 않는다.
     */
    allowNavigation: [
      'farmerstail.kr',
      '*.farmerstail.kr',
      // 결제 — 토스 SDK·결제창·카드사 인증 리다이렉트
      '*.tosspayments.com',
      // 인증 — Supabase OAuth 중계
      '*.supabase.co',
      // 인증 — 카카오 로그인(동의 화면·계정)
      '*.kakao.com',
      '*.kakaocdn.net',
      // 인증 — Apple 로그인
      'appleid.apple.com',
      // 주소 검색 — Daum 우편번호 embed iframe (2026-08-22).
      // Capacitor 는 iframe 네비게이션도 이 목록으로 검사한다
      // (BridgeWebViewClient.shouldOverrideUrlLoading 이 isForMainFrame 을
      // 안 본다 — 실측). 여기 없으면 postcode.map.daum.net iframe 이
      // **외부 앱 선택 팝업으로 튕기고 iframe 은 빈 채로 남는다**
      // (사장님 재현: "연결프로그램 팝업이 뜨는데 선택도 안 되고").
      //
      // ⚠️ `*` 는 **한 단계만** 대응한다(HostMask.java: 단계 수 정확 일치 요구).
      //    `*.daum.net`(3단계)은 postcode.map.daum.net(4단계)을 **못** 잡는다 —
      //    이걸 몰라서 같은 증상이 한 번 더 반복됐다. 필수 호스트의 실제 통과는
      //    lib/native-allow-navigation.test.ts 가 자바 알고리즘 복제로 고정한다.
      'postcode.map.daum.net',
      '*.map.daum.net',
      '*.daum.net',
      '*.daumcdn.net',
    ],
  },

  ios: {
    // SF Pro / 시스템 폰트는 WebView 자동 적용 (Pretendard 는 web 측에서).
    // 콘텐츠 인셋 자동 — 노치 / 다이내믹 아일랜드 안전.
    contentInset: 'always',
    // iOS 백그라운드 진입 시 webview 일시정지 — 배터리 보호.
    // 정기배송 카운트다운 같은 timer 는 foreground 시 재계산 (이미 처리됨).
    backgroundColor: '#F7F5F0',
  },

  android: {
    // 안드로이드 광고용 Webview 는 디버그 모드에서 chrome://inspect 가능.
    // 운영 빌드는 자동 false.
    backgroundColor: '#F7F5F0',
  },

  plugins: {
    SplashScreen: {
      /**
       * ★2026-10-08 — 폰 화면은 **웹 로딩 화면이 걷는다**(사장님 "앱 들어가면 로딩이 두 번 뜬다").
       *
       * 예전엔 1.5초 타이머로 걷혔고, 웹 로딩(AppSplash)은 따로 1.8초 타이머를 돌렸다. 그림도 달라
       * (안드로이드 12+ = 도장 아이콘, 웹 = 글자 로고) 로딩이 두 번처럼 보였고, 페이지가 늦으면 둘 사이에
       * 빈 화면이 끼었다. 이제 웹이 같은 도장을 같은 자리에 그릴 준비가 되면 SplashScreen.hide() 를
       * 부른다(components/AppSplash.tsx). 이 시간은 **웹이 못 부를 때(서버 장애 → error.html)의 안전망**이다.
       */
      launchShowDuration: 4000,
      launchAutoHide: true,
      // 페이드 끔 — 웹 화면이 같은 그림이라 바로 바꿔도 티가 안 난다. 페이드를 켜 두면 안드로이드 12+ 는
      // 아이콘만 페이드를 안 따라가 도장이 한 번 더 겹쳐 보였다(에뮬레이터 녹화 실측).
      launchFadeOutDuration: 0,
      backgroundColor: '#F7F5F0',
      // 옛 방식 스플래시(안드로이드 12 API 가 실패할 때만)에서 그림(drawable/splash = 크림 + 도장 132dp)을
      // 늘리지 않고 제 크기로 가운데에.
      androidScaleType: 'CENTER',
      showSpinner: false,
      // 옛 방식 스플래시 전용 — 켜 두면 걷힐 때 시스템 막대가 다시 그려지며 아래 검은 띠가 깜빡인다.
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      // light/dark — globals.css 의 theme-color 와 합류해 chrome 톤 통일.
      // overlaysWebView=false 로 두면 WebView 가 status bar 아래에서 시작 —
      // 노치/다이내믹 아일랜드 영역에 컨텐츠 안 들어감.
      overlaysWebView: false,
      backgroundColor: '#F7F5F0',
      /**
       * ★2026-08-20 — 'DEFAULT' 에서 'LIGHT' 로.
       *
       * Capacitor 의 이름이 헷갈린다(패키지 정의 실측):
       *   Dark    = 어두운 배경용 **밝은 글자**
       *   Light   = 밝은 배경용 **어두운 글자**   ← 우리가 원하는 것
       *   Default = **기기 테마를 따라간다** — 다크모드면 글자가 밝아진다
       *
       * 우리 앱은 항상 라이트 톤이다(globals.css 에서 다크 자동전환을 사장님
       * 요청으로 꺼 뒀다). 배경은 종이색(#F7F5F0) 고정인데 'DEFAULT' 로 두면
       * **폰을 다크모드로 쓰는 사용자 전원에게 흰 글자 + 크림 배경**이 되어
       * 시계·배터리가 안 보인다. 배경이 고정이므로 글자도 고정해야 한다.
       */
      style: 'LIGHT',
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
    /**
     * ★2026-08-25 — 카카오톡 앱 전환 로그인 (iOS).
     *
     * # 왜 네이티브가 필요한가
     * 웹 방식(Supabase OAuth → kauth.kakao.com)은 **iOS 에서 카카오톡 앱을 절대
     * 못 연다.** 카카오가 로그인 페이지에 `showWebTalkLogin:false` 를 내려보내고,
     * 문서상 모바일 웹의 카카오톡 간편로그인은 **안드로이드 전용**이다(실측 확인:
     * UA 를 사파리로 바꿔도 동일). 한국 사용자는 카카오 비밀번호를 기억 못 해
     * 이탈하므로 전환율 문제다.
     *
     * # app_key 는 비밀이 아니다
     * 네이티브 앱 키는 앱 바이너리에 embed 되는 공개 식별자다(웹의 JS 키와 같은
     * 성격). REST API 키·Admin 키와 **다른 키**이며 그 둘은 절대 여기 넣지 않는다.
     */
    CapacitorKakaoLogin: {
      app_key: '1deb4a646cc4d0b442842d29efd26b2c',
    },
  },
}

export default config
