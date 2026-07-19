import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import {
  Archivo_Black,
  Bungee,
  Cormorant_Garamond,
  Gaegu,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
// Side-effect import — zod의 기본 에러 메시지를 ko locale로 교체.
// layout이 모든 요청 진입점에서 평가되므로 이 한 줄이면 서버/클라이언트 양쪽에
// 적용된다 (같은 모듈 그래프).
import "@/lib/forms/zod-ko";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AppSplash from "@/components/AppSplash";
import DevContextToggle from "@/components/DevContextToggle";
import SentryUserSync from "@/components/SentryUserSync";
import UtmCapture from "@/components/UtmCapture";
import FocusNavFlag from "@/components/FocusNavFlag";
import AnalyticsScripts from "@/components/AnalyticsScripts";
import { KakaoInitScript } from "@/components/ShareButton";
import OnboardingGate from "@/components/OnboardingGate";
import CookieConsent from "@/components/CookieConsent";
import ConsentBootstrap from "@/components/ConsentBootstrap";
import JsonLd from "@/components/JsonLd";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import AppContextCookieSync from "@/components/AppContextCookieSync";
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "@/lib/seo/jsonld";
import { ToastProvider } from "@/components/ui/Toast";

// Pretendard Variable — 본문 / UI 전체 (웹+앱 공통).
// 앱 컨텍스트 (v3) 에서는 헤드라인/디스플레이도 Pretendard 만 사용 — Serif
// 폐기. 웹 (랜딩/blog/events) 에서는 아래 Noto Serif KR / Cormorant 사용 유지.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-sans",
  preload: true,
});

// 마루부리 (MaruBuri) — 웹 farm v4 의 국문 헤드라인 서체 (Phase Q, 2026-06-12).
// 네이버 마루 프로젝트 무료 글꼴 (https://hangeul.naver.com/maru) — self-host
// (CSP font-src 'self' 준수). 동화책/붓느낌 명조 — 농장 세계관의 감성 축.
// 기존 Noto Serif KR 을 같은 변수(--font-serif)로 대체 → 웹의 모든 serif
// 헤드라인이 자동 전환. 800/900 weight 사용처는 700 에서 synthetic bold 렌더.
// 앱 (data-ft-chrome="app") 에서는 여전히 사용 X — Pretendard 만.
const maruBuri = localFont({
  src: [
    { path: "./fonts/MaruBuri-Regular.woff2", weight: "400" },
    { path: "./fonts/MaruBuri-SemiBold.woff2", weight: "600" },
    { path: "./fonts/MaruBuri-Bold.woff2", weight: "700" },
  ],
  display: "swap",
  variable: "--font-serif",
});

// Cormorant Garamond — 웹의 에디토리얼 이탤릭 디스플레이 (No. 01, 까지, 중간).
// 앱에서는 사용 X.
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["italic", "normal"],
  display: "swap",
  variable: "--font-display",
});

// Archivo Black — farm v4 영문 넘버링(001~005)·로고 전용 (Q9, 기획서 스펙).
// 절제 사용: SKU 넘버링 등 포인트에만. 한글엔 미사용.
const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-archivo",
});

// Bungee — farm v5 영문/숫자 디스플레이 (2026-06-13, Monchies 레퍼런스 채택).
// 통통하고 각진 대문자 디스플레이 — 제목 영문·숫자·로고에만. 한글 글리프 없음
// → 한글 헤드라인은 Pretendard 900 이 담당 (.font-chunky 가 자동 폴백).
// 절제 사용: 전면 도배 금지 (전단지化 방지). 앱(data-ft-chrome="app")엔 미사용.
const bungee = Bungee({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-chunky",
});

// 개구체 (Gaegu) — farm v4 포인트 손글씨 (Q6, 사장님 결정 B).
// 제목은 Pretendard 헤비, 손글씨는 "통고기가 먼저!" 류 강조 한두 단어와
// 섹션 라벨에만. 전면 사용 금지 — 전단지化 방지.
const gaegu = Gaegu({
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
  variable: "--font-hand",
});

// JetBrains Mono — kicker / 메타데이터 / 통계 숫자 (웹+앱 공통).
// v3 핸드오프는 IBM Plex Mono 를 지정하지만 시각적으로 매우 유사 + 추가
// 폰트 다운로드 비용 회피.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

// R72 — fallback www. (Vercel primary). NEXT_PUBLIC_SITE_URL env 우선.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.farmerstail.kr";

// Supabase Storage 도메인 — preconnect / dns-prefetch 힌트용. NEXT_PUBLIC_
// SUPABASE_URL 에서 origin 추출 (next.config.ts 의 supabaseHostname() 와 동일
// 패턴). 환경변수 누락 시에만 fallback URL 사용.
const supabaseOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return "https://adynmnrzffidoilnxutg.supabase.co";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://adynmnrzffidoilnxutg.supabase.co";
  }
})();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "파머스테일 | Farmer's Tail",
    template: "%s | 파머스테일",
  },
  description:
    "우리 아이를 위한 프리미엄 반려견 식품. 수의영양학 기반 맞춤 화식 정기배송 — Farm to Tail.",
  applicationName: "파머스테일",
  keywords: [
    "파머스테일",
    "Farmer's Tail",
    "반려견 식품",
    "반려견 화식",
    "프리미엄 강아지 사료",
    "강아지 간식",
    "수의영양학",
    "정기배송",
    "D2C 펫푸드",
    "Farm to Tail",
  ],
  authors: [{ name: "Farmer's Tail" }],
  creator: "Farmer's Tail",
  publisher: "Farmer's Tail",
  manifest: "/manifest.json",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "파머스테일",
    title: "파머스테일 | Farmer's Tail",
    description:
      "우리 아이를 위한 프리미엄 반려견 식품 — 수의영양학 기반 레시피, Farm to Tail",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "파머스테일 — 우리 아이를 위한 프리미엄 반려견 식품",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "파머스테일 | Farmer's Tail",
    description:
      "우리 아이를 위한 프리미엄 반려견 식품 — 수의영양학 기반 레시피, Farm to Tail",
    images: ["/api/og"],
  },
  other: {
    // Kakao in-app browser reads this specifically for rich share cards.
    "og:image:width": "1200",
    "og:image:height": "630",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // 검색엔진 소유권 인증 — Google 은 DNS TXT (카페24 DNS) 로 인증되어 있으므로
  // 여기에는 메타 태그 방식 인증만 추가. 네이버 서치어드바이저는 DNS TXT 옵션이
  // 없어서 meta 태그 필수. 추후 Bing / Yandex 등 추가 시 같은 패턴으로.
  verification: {
    other: {
      "naver-site-verification": "07c56c3989f7a5031e8658da749c47bb7f731819",
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "파머스테일",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS Safari pins this as the home-screen icon when users install.
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  // audit #110: theme-color media 분기 — 다크모드 OS 사용자의 status bar 아이콘
  // (흰색) 과 terracotta 배경 충돌 방지. 라이트는 시그니처 terracotta 유지,
  // 다크는 --bg 다크 값으로 연속.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#171310" },
    { media: "(prefers-color-scheme: light)", color: "#A0452E" },
  ],
  width: "device-width",
  initialScale: 1,
  // 확대/축소 차단 (2026-07-12 사장님 지시 — "앱 전체 확대 축소 절대 안되게").
  //   · maximumScale=1 + userScalable=false → 핀치 줌 + iOS 인풋 포커스 자동 줌
  //     (숫자 입력 시 화면 확대) 모두 차단.
  //   · ⚠️ 옛 audit #41 은 이를 WCAG 1.4.4(Resize Text) 위반이라 일부러 뺐었음
  //     (저시력 사용자 핀치 줌). 사장님이 네이티브 앱 느낌 위해 명시 오버라이드.
  //   · 플랫폼 실제 동작: 설치형 PWA(iOS standalone)·Android/데스크톱 = 잠김.
  //     iOS Safari 브라우저는 Apple 이 접근성 위해 이 값을 무시 → 웹 방문자는
  //     iOS 에서 여전히 확대 가능(웹 접근성은 iOS 에서 보존됨).
  maximumScale: 1,
  userScalable: false,
  // R-feel: 노치/홈인디케이터 아래 안전영역까지 화면을 펼친다. AppChrome 헤더가
  // 이미 env(safe-area-inset-*) 패딩으로 노치를 피하므로, 이 값이 있어야 그
  // 패딩이 실제 값으로 작동하고 standalone 에서 위아래 띠가 사라진다.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      // data-scroll-behavior="smooth" — Next 16 requirement. globals.css 의
      // `html { scroll-behavior: smooth }` (앵커 이동용) 은 라우트 전환 시
      // 이전 스크롤 위치에서 새 페이지 top 까지 부드럽게 스크롤되는 어색한
      // 애니메이션을 유발한다. 이 속성을 달면 Next 가 route transition 동안만
      // 일시적으로 smooth 를 끄고, 같은 페이지 내 앵커 이동에서는 유지해 준다.
      data-scroll-behavior="smooth"
      className={`h-full antialiased ${pretendard.variable} ${maruBuri.variable} ${gaegu.variable} ${archivoBlack.variable} ${bungee.variable} ${cormorantGaramond.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/*
          Preconnect / dns-prefetch — TCP/TLS 핸드셰이크를 HTML 파싱 단계와
          병렬화. 처음 이미지/스크립트 fetch 까지 걸리는 시간을 ~100-200ms
          단축. 브라우저별 동시 preconnect 한도가 있으니 핵심 도메인만:

          1) Supabase Storage — 모든 상품/블로그/이벤트 이미지 호스팅. PDP 와
             /products 의 LCP 직격이라 1순위.
          2) Google Tag Manager — GA4 스크립트 진입점. Consent default=denied
             지만 스크립트 자체는 일찍 받아야 동의 시 즉시 fire 가능.
          3) Meta Pixel - 동일 이유.

          dns-prefetch 는 preconnect 의 fallback (Safari 일부 버전).
        */}
        <link
          rel="preconnect"
          href={supabaseOrigin}
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href={supabaseOrigin} />
        <link
          rel="preconnect"
          href="https://www.googletagmanager.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://connect.facebook.net"
          crossOrigin="anonymous"
        />
        {/*
          다크모드 깜빡임 방지 — SSR 직후 hydration 전에 inline 동기 스크립트로
          html[data-theme] 을 박아둔다. 과거 저장된 ft_theme(다크/라이트) 이 있으면
          첫 페인트부터 그 변수로 그려져 flash 가 없음. (수동 테마 토글은 2026-07 폐지
          — 이제 OS 설정을 CSS prefers-color-scheme 로 자동 추종. 이 스크립트는 옛
          저장값이 남은 사용자를 위한 호환 게이트로만 유지.)
          localStorage 차단(Safari private)은 try/catch 로 흡수.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem('ft_theme');if(c==='dark'||c==='light'){document.documentElement.setAttribute('data-theme',c);}}catch(e){}})();`,
          }}
        />
        {/*
          검은 화면 방지 — 앱 아이콘 탭 후 globals.css 가 로드되기 전 첫 페인트가
          기본 검정으로 잠깐 뜨는 FOUC 를 막는다(사장님 리포트 2026-07-13). html
          배경을 인라인으로 미리 크림/다크로 박아 스플래시(var(--bg)) 와 이음새 없이
          이어짐. iOS 네이티브 런치 스크린(웹 로드 前)은 manifest background_color
          (#F5F0E6) 담당 — 그건 별개.
        */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html{background:#FAF9F5}html[data-theme="dark"]{background:#15110D}',
          }}
        />
        {/*
          iOS 레거시 standalone 감지 — display-mode media query 를 아직 반영 못 하는
          iOS PWA 도 navigator.standalone 으로 잡아 html.ft-standalone 부여 →
          AppSplash 가 첫 페인트부터 노출된다(globals.css .ft-splash 게이트).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.navigator&&window.navigator.standalone===true){document.documentElement.classList.add('ft-standalone');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/*
          Skip to main — 키보드/스크린리더 사용자 첫 Tab 시 노출. WCAG 2.4.1.
          기본은 화면 밖, focus 받으면 좌상단으로 즉시 이동. 페이지마다
          <main id="main"> 가 존재한다 가정 — 없으면 자연스럽게 noop.
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--fd-pine)] focus:text-white focus:rounded-md focus:font-bold focus:text-sm"
        >
          본문 바로가기
        </a>
        {/* Toast provider — 앱 전체에서 useToast() 가능. viewport는 하단 중앙.
            Confirm provider 는 web 컨텍스트엔 mount 되지 않게 (main) layout
            안쪽에서만 wrap (AGENTS.md "web 시각 변경 금지" 정책). */}
        <ToastProvider>
          {children}
        </ToastProvider>
        <ServiceWorkerRegister />
        {/* 설치형 PWA 첫 실행 로고 모션 스플래시(웹 브라우저는 스킵). */}
        <AppSplash />
        {/* audit #107: Supabase auth → Sentry.setUser({ id }) 동기화 */}
        <SentryUserSync />
        {/* R39c (#29): URL 의 utm_* 파라미터 → sessionStorage. conversion 시 함께 보냄. */}
        <UtmCapture />
        {/* 키보드 네비게이션 중에만 포커스 링(터치/프로그램 포커스의 뜬금 주황
            링 제거, 사장님 2026-07-19). globals.css html:not([data-kbnav]) 과 짝. */}
        <FocusNavFlag />
        <AnalyticsScripts />
        {/* 카카오톡 공유 SDK — NEXT_PUBLIC_KAKAO_JS_KEY 가 있을 때만 활성화 */}
        <KakaoInitScript />
        {/* App / Web context 쿠키 동기화 — middleware 가 ft_app 쿠키로 앱 전용
            라우트 (/dashboard, /dogs/* 등) 진입을 분기. PWA standalone /
            Capacitor 네이티브 감지 시 쿠키 자동 set, 웹 사용자에겐 unset. */}
        <AppContextCookieSync />
        {/* Core Web Vitals beacon — Sentry 로 poor LCP/INP/CLS 알림 전송 */}
        <WebVitalsReporter />
        {/* 이미 저장된 쿠키 동의를 마운트 즉시 tracker 에 반영 */}
        <ConsentBootstrap />
        {/* 첫 방문 시 쿠키 동의 배너 */}
        <CookieConsent />
        {/* First-launch intercept for installed PWAs — see components/OnboardingGate.tsx */}
        <OnboardingGate />
        {/* 사이트 전역 JSON-LD — Organization / WebSite. 페이지별 스키마는 각
            라우트에서 추가로 주입. Google 이 @id 로 엔티티를 병합해준다. */}
        <JsonLd id="ld-organization" data={buildOrganizationJsonLd()} />
        <JsonLd id="ld-website" data={buildWebSiteJsonLd()} />
        {/* 🛠️ 개발 전용 웹↔앱 토글 (우하단). production 엔 렌더 안 됨. 삭제: 이 줄 + components/DevContextToggle.tsx */}
        {process.env.NODE_ENV !== 'production' && <DevContextToggle />}
      </body>
    </html>
  );
}
