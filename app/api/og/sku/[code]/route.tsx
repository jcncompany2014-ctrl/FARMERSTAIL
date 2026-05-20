import { ImageResponse } from 'next/og'
import { SKU_META, type SkuKey } from '@/lib/allergy-sku-matrix'
import { SKU_NUTRITION } from '@/lib/sku-nutrition-matrix'

export const runtime = 'edge'

/**
 * GET /api/og/sku/[code]
 *
 * Round C3 (2026-05-20): 5종 SKU 별 동적 OG 카드.
 *
 * # 사용
 *   <meta property="og:image" content="/api/og/sku/C01" />
 *   카카오톡 / 페이스북 / 트위터 등 공유 시 SKU 별 차별화된 카드 노출.
 *
 * # path 정합성
 *   /api/og/sku/{code} 의 code 는 SKU key (C01 / D02 / S03 / P04 / B05).
 *   잘못된 code 면 default OG (브랜드 라벨만) 으로 fallback.
 *
 * # 캐싱
 *   결정론적 결과 — Cache-Control 24h.
 */

// Brand palette (기존 /api/og 와 동일)
const CREAM = '#F5F0E6'
const CREAM_DEEP = '#EDE6D8'
const INK = '#3D2B1F'
const MUTE = '#8A7668'

// 5종 SKU 색상 — /compare 와 동일
const SKU_COLOR: Record<SkuKey, string> = {
  C01: '#C76A4E',
  D02: '#8BA05A',
  S03: '#7A99B3',
  P04: '#A87BA0',
  B05: '#E0B341',
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params
  const normalized = code.toUpperCase() as SkuKey

  // 유효성 검사 — 모르는 코드는 default 카드
  const meta = SKU_META[normalized]
  const nutrition = SKU_NUTRITION[normalized]
  if (!meta || !nutrition) {
    return new ImageResponse(<DefaultCard />, {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control':
          'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  }

  const accent = SKU_COLOR[normalized]

  // 5축 영양 chip 데이터
  const chips = [
    { label: '단백', value: `${nutrition.protein_pct}%` },
    { label: '지방', value: `${nutrition.fat_pct}%` },
    { label: 'Ca:P', value: `${nutrition.ca_p_ratio}` },
    { label: 'EPA+DHA', value: `${nutrition.epa_dha_pct}%` },
    { label: 'Se', value: `${nutrition.selenium_mcg_per_kg}` },
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          backgroundColor: CREAM,
          backgroundImage: `radial-gradient(circle at 88% 14%, ${CREAM_DEEP} 0%, ${CREAM} 50%)`,
          position: 'relative',
        }}
      >
        {/* 상단 accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 10,
            backgroundColor: accent,
            display: 'flex',
          }}
        />

        {/* 헤더 — SKU 코드 + novel 칩 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                backgroundColor: accent,
                color: CREAM,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: -1,
              }}
            >
              {meta.code.slice(-3)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                  fontSize: 22,
                  fontWeight: 800,
                  color: INK,
                  marginTop: 2,
                  letterSpacing: -0.5,
                }}
              >
                {meta.code} · {meta.name_ko}
              </div>
            </div>
          </div>

          {meta.novel && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                borderRadius: 999,
                backgroundColor: '#8BA05A',
                color: CREAM,
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Novel Protein
            </div>
          )}
        </div>

        {/* 메인 카피 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: INK,
              lineHeight: 1.05,
              letterSpacing: -2,
              display: 'flex',
              flexWrap: 'wrap',
              maxWidth: 1040,
            }}
          >
            {nutrition.highlight_ko}
          </div>
        </div>

        {/* 영양 chip 5종 */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {chips.map((c) => (
            <div
              key={c.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '14px 22px',
                borderRadius: 18,
                backgroundColor: '#FFFFFF',
                border: `1.5px solid ${INK}`,
                minWidth: 140,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: MUTE,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                {c.label}
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  color: INK,
                  letterSpacing: -0.5,
                  marginTop: 2,
                }}
              >
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
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
            FEDIAF 2024 · DM 기준 · 5종 라인 중 하나
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
            farmerstail.kr
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control':
          'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}

// ───────────────────────────────────────────────────────────
// Fallback — 모르는 SKU 코드 시 brand-only 카드
// ───────────────────────────────────────────────────────────

function DefaultCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        backgroundColor: CREAM,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#C76A4E',
          letterSpacing: 6,
          textTransform: 'uppercase',
        }}
      >
        Farmer&apos;s Tail
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 900,
          color: INK,
          letterSpacing: -2,
          marginTop: 12,
        }}
      >
        파머스테일 5종 라인
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
          color: MUTE,
          letterSpacing: -0.5,
          marginTop: 16,
          maxWidth: 900,
          textAlign: 'center',
          display: 'flex',
        }}
      >
        닭·오리·연어·돼지·한우. FEDIAF 권장 기반 정밀 화식.
      </div>
    </div>
  )
}
