// R16-E45: 견별 동적 OG 이미지 — 강아지 이름 + breed + photo.
//
// GET /api/og/dog?id=<uuid>
//   또는
// GET /api/og/dog?name=초롱&breed=포메라니안&photo=<url>
//
// id 가 있으면 Supabase 에서 견 정보 fetch (RLS — 본인 견만 보임).
// 외부 share 용도일 경우 query string 으로 직접 — 데이터 노출 X.

import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs' // Supabase 사용 → edge X

// FD 브랜드 팔레트 inline mirror — ImageResponse 는 var(--fd-*) 못 씀.
// globals.css 바뀌면 수동 동기화(회차172: 옛 v4 → FD. /api/og 와 통일).
const CREAM = '#F7F5F0' // --fd-offwhite
const INK = '#173B33' // --fd-pine
const TERRA = '#B63619' // --fd-coral-text (AA)
const MUTE = '#5A6C61' // --fd-muted

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  let name = searchParams.get('name') ?? '우리 강아지'
  let breed = searchParams.get('breed') ?? ''
  let photo = searchParams.get('photo') ?? ''

  if (id) {
    try {
      const supabase = await createClient()
      const { data: dog } = await supabase
        .from('dogs')
        .select('name, breed, photo_url')
        .eq('id', id)
        .maybeSingle()
      if (dog) {
        name = (dog.name as string | null) ?? name
        breed = (dog.breed as string | null) ?? breed
        photo = (dog.photo_url as string | null) ?? photo
      }
    } catch {
      /* fallback to defaults */
    }
  }

  name = name.slice(0, 24)
  breed = breed.slice(0, 30)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: CREAM,
          padding: '60px 72px',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 좌측: 텍스트 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontSize: 20,
                fontWeight: 700,
                color: TERRA,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginBottom: 24,
              }}
            >
              FARMER&apos;S TAIL · OUR DOG
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 96,
                fontWeight: 900,
                color: INK,
                letterSpacing: '-0.04em',
                lineHeight: 0.95,
              }}
            >
              {name}
            </div>
            {breed && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 32,
                  fontWeight: 500,
                  color: MUTE,
                  marginTop: 16,
                  letterSpacing: '-0.01em',
                }}
              >
                {breed}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              fontWeight: 600,
              color: MUTE,
              letterSpacing: '-0.005em',
            }}
          >
            수의영양학 기반 정성스러운 한 끼
          </div>
        </div>

        {/* 우측: 사진 (있으면) */}
        {photo && (
          <div
            style={{
              width: 380,
              height: 380,
              borderRadius: '50%',
              overflow: 'hidden',
              border: `8px solid ${TERRA}`,
              alignSelf: 'center',
              marginLeft: 48,
              display: 'flex',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={name}
              width={380}
              height={380}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
