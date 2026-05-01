import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import {
  Noto_Serif_KR,
  Cormorant_Garamond,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
// Side-effect import — zod의 기본 에러 메시지를 ko locale로 교체.
// layout이 모든 요청 진입점에서 평가되므로 이 한 줄이면 서버/클라이언트 양쪽에
// 적용된다 (같은 모듈 그래프).
import "@/lib/forms/zod-ko";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
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

// Pretendard Variable — 본문 / UI 전체
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920", // variable font weight range
  variable: "--font-sans",
  preload: true,
});

// Noto Serif KR — 국문 에디토리얼 헤드라인 (primary serif).
// The Claude Design handoff spec'd Nanum Myeongjo, but Nanum's build-time
// subset surface (many Korean unicode-range slices) reliably breaks Next 16's
// Turbopack font pipeline on spotty connections. Noto Serif KR is visually
// close enough (both are classical Korean serifs) and its bundled weights
// build consistently.
const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-serif",
});

// Cormorant Garamond — 에디토리얼 이탤릭 디스플레이 (No. 01, 까지, 중간 등)
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["italic", "normal"],
  display: "swap",
  variable: "--font-display",
});

// JetBrains Mono — 잡지 캡션 · 메타데이터 · 크레딧
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://farmerstail.vercel.app";

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
    "우리 아이를 위한 프리미엄 반려견 식품. 수의영양학 기반 레시피로 만든 화식, 간식, 체험팩 — Farm to Tail.",
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
  // theme-color 는 모바일 브라우저의 주소바/PWA 헤더 배경에 쓰인다. 라이트에선
  // 시그니처 terracotta, 다크에선 iOS 상태바 아이콘(흰색)과 겹치지 않도록
  // --bg 다크 값(#171310)로 연속시킨다.
  // 다크 자동 트리거 비활성 — 라이트 톤 단일.
  themeColor: "#A0452E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      className={`h-full antialiased ${pretendard.variable} ${notoSerifKR.variable} ${cormorantGaramond.variable} ${jetbrainsMono.variable}`}
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
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/*
          Skip to main — 키보드/스크린리더 사용자 첫 Tab 시 노출. WCAG 2.4.1.
          기본은 화면 밖, focus 받으면 좌상단으로 즉시 이동. 페이지마다
          <main id="main"> 가 존재한다 가정 — 없으면 자연스럽게 noop.
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-ink focus:text-bg focus:rounded-md focus:font-bold focus:text-sm"
        >
          본문 바로가기
        </a>
        {/* Toast provider — 앱 전체에서 useToast() 가능. viewport는 하단 중앙 */}
        <ToastProvider>
          {children}
        </ToastProvider>
        <ServiceWorkerRegister />
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
      </body>
    </html>
  );
}
