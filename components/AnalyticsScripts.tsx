/**
 * GA4 + Meta Pixel 스크립트 로더.
 *
 * `afterInteractive` 전략 — 첫 페인트 이후 비동기 로드. 앱 JS 번들
 * 바깥에서 로드되므로 TBT(Total Blocking Time)에 영향 없음.
 *
 * ID가 비어있으면 해당 스크립트만 선택적으로 생략. 둘 중 하나만
 * 켜두고 나머지는 비워두는 운영이 가능.
 */
import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

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
            // send_page_view: false — App Router는 클라이언트 내비게이션을
            // GA가 자동 감지하지 못한다. instrumentation-client.ts에서
            // onRouterTransitionStart로 수동 전송하므로 초기 자동 전송은 꺼둔다.
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { send_page_view: false });
              `,
            }}
          />
        </>
      )}
      {PIXEL_ID && (
        <>
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
