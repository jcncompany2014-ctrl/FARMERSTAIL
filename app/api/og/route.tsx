import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// Brand palette
const CREAM = '#F5F0E6'
const CREAM_DEEP = '#EDE6D8'
const INK = '#3D2B1F'
const TERRA = '#A0452E'
const OLIVE = '#6B7F3A'
const GOLD = '#D4B872'
const MUTE = '#8A7668'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const title = (searchParams.get('title') ?? '파머스테일').slice(0, 80)
  const subtitle =
    (searchParams.get('subtitle') ??
      '우리 아이를 위한 프리미엄 반려견 식품').slice(0, 120)
  const tag = (searchParams.get('tag') ?? 'Farm to Tail').slice(0, 40)
  // Variants let callers pick a different accent treatment later.
  // 'default' | 'product' | 'editorial'
  const variant = searchParams.get('variant') ?? 'default'

  const accent =
    variant === 'product' ? OLIVE : variant === 'editorial' ? GOLD : TERRA

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          backgroundColor: CREAM,
          backgroundImage: `radial-gradient(circle at 92% 12%, ${CREAM_DEEP} 0%, ${CREAM} 55%)`,
          position: 'relative',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 8,
            backgroundColor: accent,
            display: 'flex',
          }}
        />

        {/* Top row: brand mark + tag chip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {/* Logo dot */}
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                backgroundColor: INK,
                color: CREAM,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: -1,
              }}
            >
              F
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: accent,
                  letterSpacing: 6,
                  textTransform: 'uppercase',
                }}
              >
                Farmer&apos;s Tail
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: INK,
                  marginTop: 2,
                  letterSpacing: -0.5,
                }}
              >
                파머스테일
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 18px',
              borderRadius: 999,
              border: `1.5px solid ${INK}`,
              fontSize: 16,
              fontWeight: 700,
              color: INK,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: accent,
                display: 'flex',
              }}
            />
            {tag}
          </div>
        </div>

        {/* Main copy */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 24,
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 900,
              color: INK,
              lineHeight: 1.05,
              letterSpacing: -2,
              display: 'flex',
              flexWrap: 'wrap',
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              fontWeight: 500,
              color: MUTE,
              lineHeight: 1.35,
              letterSpacing: -0.5,
              display: 'flex',
              flexWrap: 'wrap',
              maxWidth: 960,
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 20,
              fontWeight: 700,
              color: INK,
              letterSpacing: -0.2,
            }}
          >
            <div
              style={{
                width: 36,
                height: 2,
                backgroundColor: accent,
                display: 'flex',
              }}
            />
            수의영양학 기반 레시피 · 정기배송
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: MUTE,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {(() => {
              const url =
                process.env.NEXT_PUBLIC_SITE_URL ?? 'https://farmerstail.com'
              try {
                return new URL(url).hostname
              } catch {
                return 'farmerstail.com'
              }
            })()}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Cache OG cards aggressively — they are deterministic per URL.
        'Cache-Control':
          'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
