'use client'

/**
 * GA4 · Meta Pixel · Microsoft Clarity 스크립트 로더 — **동의한 뒤에만 불러온다**.
 *
 * # 2026-09-26 출시 전 점검 5차 — Advanced → Basic Consent Mode
 * 예전엔 gtag.js 를 늘 불러 두고 consent default=denied 만 걸었다(Advanced Consent Mode).
 * 그러면 GA 는 **쿠키 없는 집계 신호(page_view, gcs=G100)를 계속 보낸다** — 실측으로
 * 동의 전과 '필수만' 선택 뒤에도 방문 URL(쿼리 포함: /start?p=코드, /vet/공유토큰)이
 * Google 로 갔다. 개인정보처리방침·배너는 "분석은 동의 후에만"이라고 약속한다.
 * 그래서 스크립트 자체를 동의 뒤에 넣는다:
 *   · GA4·Clarity — 분석(analytics) 동의가 있을 때만
 *   · Meta Pixel — 광고(marketing) 동의가 있을 때만
 * 동의하지 않으면 제3자에게 아무 요청도 가지 않는다(외부 요청 0).
 *
 * 앱(ft_app)은 CookieConsent 가 자동으로 '필수만'을 기록하므로 앱에서도 로드되지 않는다.
 * iOS 는 그와 별도로 ATT 게이트(lib/analytics isTrackingAllowed)가 있다.
 */
import Script from 'next/script'
import { useSyncExternalStore } from 'react'
import { COOKIE_STORAGE_KEY, readConsent, type CookieConsent } from '@/lib/cookies'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

// 외부 요청이 없는 로컬 스텁 — ConsentBootstrap·applyConsentToTrackers 가 window.gtag 를
// 안전하게 부를 수 있게. dataLayer 에만 쌓이고, gtag.js 는 동의 전엔 로드되지 않는다.
const GTAG_STUB = `
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied'
  });
`

function subscribe(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('ft-consent-change', cb)
  window.addEventListener('ft-consent-reset', cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener('ft-consent-change', cb)
    window.removeEventListener('ft-consent-reset', cb)
    window.removeEventListener('storage', cb)
  }
}

// useSyncExternalStore 는 스냅샷 참조가 같아야 한다 — 원문 문자열 기준으로 캐시(CookieConsent 와 같은 방식).
let cachedRaw: string | null | undefined
let cachedValue: CookieConsent | null = null
function getSnapshot(): CookieConsent | null {
  if (typeof window === 'undefined') return null
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(COOKIE_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw === cachedRaw) return cachedValue
  cachedRaw = raw
  cachedValue = readConsent()
  return cachedValue
}
function getServerSnapshot(): CookieConsent | null {
  return null
}

export default function AnalyticsScripts() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const analytics = consent?.analytics === true
  const marketing = consent?.marketing === true

  return (
    <>
      <Script id="gtag-stub" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: GTAG_STUB }} />
      {GA_ID && analytics && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            // 동의가 있을 때만 여기 온다 — 저장된 선택을 그대로 반영한 뒤 config.
            // send_page_view: false — 페이지뷰는 instrumentation-client 가 수동으로 보낸다.
            dangerouslySetInnerHTML={{
              __html: `
                window.gtag('consent', 'update', {
                  analytics_storage: 'granted',
                  ad_storage: '${marketing ? 'granted' : 'denied'}',
                  ad_user_data: '${marketing ? 'granted' : 'denied'}',
                  ad_personalization: '${marketing ? 'granted' : 'denied'}'
                });
                window.gtag('js', new Date());
                window.gtag('config', '${GA_ID}', { send_page_view: false });
              `,
            }}
          />
        </>
      )}
      {PIXEL_ID && marketing && (
        <Script
          id="meta-pixel-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('consent', 'grant');
              fbq('init', '${PIXEL_ID}');
              fbq('track', 'PageView');
            `,
          }}
        />
      )}
      {CLARITY_ID && analytics && (
        <Script
          id="ms-clarity-init"
          strategy="afterInteractive"
          // ?ref=bwt 는 Bing Webmaster Tools 셋업 식별자(분석에는 영향 없음).
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i+"?ref=bwt";
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${CLARITY_ID}");
              window.clarity('consent');
            `,
          }}
        />
      )}
    </>
  )
}
