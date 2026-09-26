import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * 링크 미리보기 카드(카톡·인스타·문자·검색의 og:image) — **로고만** (사장님 2026-09-26).
 *
 * 예전엔 글자 카드(「파머스테일 / 우리 아이를 위한…」)였는데, 메신저가 정사각형으로
 * 가운데를 자르면 ':테일' 같은 글자 조각만 남아 어색했다. 원형 도장 로고 하나를
 * 가운데 두면 넓게 보이든(1200×630) 정사각형으로 잘리든(가운데 630×630) 온전하다.
 *
 * 사이트의 모든 미리보기가 이 한 장을 쓴다 — 루트 opengraph-image 와 /og(ogImageUrl 호출부
 * 전부)가 여기로 온다. 페이지별 제목 파라미터는 일부러 무시한다.
 *
 * 로고는 Next 문서의 "Node.js runtime with local assets" 방식(process.cwd() 기준 읽기).
 * 못 읽으면 미리보기가 통째로 깨지지 않게 워드마크 글자로 대신한다.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const

const BG = '#FAF9F5' // /link 페이지 배경과 같은 크림
const LOGO_PX = 440 // 정사각형 가운데 자르기(630)에서도 위아래 여백 95px

let logoSrc: Promise<string | null> | null = null
function loadLogo(): Promise<string | null> {
  logoSrc ??= readFile(join(process.cwd(), 'public', 'logo-stamp.png'), 'base64')
    .then((b64) => `data:image/png;base64,${b64}`)
    .catch(() => null)
  return logoSrc
}

export async function logoOgImage(): Promise<ImageResponse> {
  const src = await loadLogo()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BG,
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} width={LOGO_PX} height={LOGO_PX} alt="" />
        ) : (
          <div
            style={{
              display: 'flex',
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: '#6B3A2E',
            }}
          >
            FARMER&apos;S TAIL
          </div>
        )}
      </div>
    ),
    {
      ...OG_SIZE,
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
