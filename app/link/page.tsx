import type { Metadata } from 'next'
import Image from 'next/image'
import InAppBrowserNotice from '@/components/web/InAppBrowserNotice'
import { APP_STORE_LINKS, BIO_LINKS } from '@/lib/links'

/**
 * /link — 인스타 프로필용 링크인바이오 (litt.ly 대체, 2026-09-24).
 *
 * 웹 마케팅 라우트(/start·/brand 와 같은 부류) — 크롬 없이 한 장짜리.
 * 버튼 목록은 lib/links.ts(config-as-code). 인앱 브라우저 안내 배너 포함.
 * 클릭 추적은 UTM → 자사 퍼널의 기존 수집(lib/utm.ts)이 이어받는다.
 */
export const metadata: Metadata = {
  title: '파머스테일 링크',
  description: '파머스테일 — 신선 화식, 맞춤 식단, 이벤트 바로가기',
}

export default function LinkInBioPage() {
  return (
    <main style={{ minHeight: '100dvh', background: '#FAF9F5' }}>
      <InAppBrowserNotice />
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '48px 20px 60px', textAlign: 'center' }}>
        <Image
          src="/logo-stamp.png"
          alt="파머스테일"
          width={72}
          height={72}
          style={{ margin: '0 auto', borderRadius: 999 }}
        />
        <h1 style={{ marginTop: 14, fontSize: 20, fontWeight: 800, color: '#1E1A14', letterSpacing: '-0.02em' }}>
          파머스테일
        </h1>
        <p style={{ marginTop: 6, fontSize: 13.5, color: '#6B6353', lineHeight: 1.55 }}>
          사료 대신, 진짜 음식 한 끼 🐾
        </p>

        <div style={{ marginTop: 28, display: 'grid', gap: 12 }}>
          {BIO_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target={l.href.startsWith('/') ? undefined : '_blank'}
              rel={l.href.startsWith('/') ? undefined : 'noreferrer'}
              style={{
                display: 'block',
                padding: '15px 18px',
                borderRadius: 999,
                background: l.primary ? '#1E1A14' : '#FFFFFF',
                color: l.primary ? '#FAF9F5' : '#1E1A14',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                textDecoration: 'none',
              }}
            >
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{l.label}</span>
              {l.sub && (
                <span
                  style={{
                    display: 'block',
                    marginTop: 2,
                    fontSize: 12,
                    color: l.primary ? 'rgba(250,249,245,0.75)' : '#9A9282',
                  }}
                >
                  {l.sub}
                </span>
              )}
            </a>
          ))}
        </div>

        {(APP_STORE_LINKS.android || APP_STORE_LINKS.ios) && (
          <div style={{ marginTop: 22 }}>
            <p style={{ fontSize: 12, color: '#9A9282', marginBottom: 8 }}>파머스테일 앱</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {APP_STORE_LINKS.android && (
                <a
                  href={APP_STORE_LINKS.android}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#1E1A14',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 999,
                    padding: '8px 14px',
                    background: '#FFFFFF',
                    textDecoration: 'none',
                  }}
                >
                  Google Play
                </a>
              )}
              {APP_STORE_LINKS.ios && (
                <a
                  href={APP_STORE_LINKS.ios}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#1E1A14',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 999,
                    padding: '8px 14px',
                    background: '#FFFFFF',
                    textDecoration: 'none',
                  }}
                >
                  App Store
                </a>
              )}
            </div>
          </div>
        )}

        <p style={{ marginTop: 30, fontSize: 11.5, color: '#B6AB93' }}>www.farmerstail.kr</p>
      </div>
    </main>
  )
}
