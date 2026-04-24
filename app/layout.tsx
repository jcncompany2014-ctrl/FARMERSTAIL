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
import OnboardingGate from "@/components/OnboardingGate";
import CookieConsent from "@/components/CookieConsent";
import ConsentBootstrap from "@/components/ConsentBootstrap";
import JsonLd from "@/components/JsonLd";
import WebVitalsReporter from "@/components/WebVitalsReporter";
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
      className={`h-full antialiased ${pretendard.variable} ${notoSerifKR.variable} ${cormorantGaramond.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/* Toast provider — 앱 전체에서 useToast() 가능. viewport는 하단 중앙 */}
        <ToastProvider>
          {children}
        </ToastProvider>
        <ServiceWorkerRegister />
        <AnalyticsScripts />
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
