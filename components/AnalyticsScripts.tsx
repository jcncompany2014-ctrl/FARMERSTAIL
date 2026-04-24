/**
 * GA4 + Meta Pixel 스크립트 로더.
 *
 * `afterInteractive` 전략 — 첫 페인트 이후 비동기 로드. 앱 JS 번들
 * 바깥에서 로드되므로 TBT(Total Blocking Time)에 영향 없음.
 *
 * ID가 비어있으면 해당 스크립트만 선택적으로 생략. 둘 중 하나만
 * 켜두고 나머지는 비워두는 운영이 가능.
 *
 * Consent gating
 * ──────────────
 * GA4 는 Consent Mode v2, Meta Pixel 은 consent API 를 사용해 사용자가
 * 동의하기 전까지 쿠키 저장·식별자 전송을 막는다. 스크립트 자체는 로드해
 * 가볍게 동작시키되, CookieConsent 배너에서 동의가 들어오면 `gtag('consent',
 * 'update', ...)` 로 상태를 풀어준다. (lib/cookies.ts 참고.)
 */
import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

// Consent 기본값 — 모든 tracker 호출보다 먼저 실행되도록 같은 Script 안에서
// 순차 실행. afterInteractive 로도 순서는 보장되며 (GA4 init 자체가
// afterInteractive), `wait_for_update: 500` 옵션이 ConsentBootstrap 이 저장된
// 값을 쏠 때까지 이벤트 전송을 잠깐 대기시키므로 실질적으로는 문제가 없다.
const CONSENT_DEFAULT = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
`

export default function AnalyticsScripts() {
  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            // consent default 를 먼저, 그 뒤에 config. send_page_view: false 로
            // App Router 자동 감지를 꺼둔다 (instrumentation-client.ts 에서 수동).
            dangerouslySetInnerHTML={{
              __html: `
                ${CONSENT_DEFAULT}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { send_page_view: false });
              `,
            }}
          />
        </>
      )}
      {!GA_ID && (
        // GA_ID 가 없어도 window.gtag stub 을 띄워야 ConsentBootstrap 이 안전.
        <Script
          id="consent-stub"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: CONSENT_DEFAULT }}
        />
      )}
      {PIXEL_ID && (
        <>
          <Script
            id="meta-pixel-init"
            strategy="afterInteractive"
            // fbq 로드 직후 consent 를 revoke 로 잡아 둔다. 이후 동의 시
            // `fbq('consent', 'grant')` 로 풀어준다 (lib/cookies.ts).
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
                fbq('consent', 'revoke');
                fbq('init', '${PIXEL_ID}');
                fbq('track', 'PageView');
              `,
            }}
          />
          {/* noscript 픽셀 — JS 미지원 브라우저용 catch-all */}
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height={1}
              width={1}
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}
    </>
  )
}
