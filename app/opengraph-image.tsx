import { ImageResponse } from 'next/og'

export const alt = '파머스테일 | Farmer\'s Tail — 프리미엄 반려견 식품'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5F0E6 0%, #EDE6D8 100%)',
          padding: '80px',
          position: 'relative',
        }}
      >
        {/* 상단 뱃지 */}
        <div
          style={{
            display: 'flex',
            fontSize: 20,
            fontWeight: 700,
            color: '#A0452E',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '32px',
          }}
        >
          FARM TO TAIL
        </div>

        {/* 메인 타이틀 */}
        <div
          style={{
            display: 'flex',
            fontSize: 120,
            fontWeight: 900,
            color: '#3D2B1F',
            letterSpacing: '-0.04em',
            lineHeight: 1,
            marginBottom: '24px',
          }}
        >
          파머스테일
        </div>

        {/* 영문 로고 */}
        <div
          style={{
            display: 'flex',
            fontSize: 44,
            fontWeight: 700,
            color: '#A0452E',
            letterSpacing: '-0.02em',
            marginBottom: '40px',
          }}
        >
          Farmer&apos;s Tail
        </div>

        {/* 태그라인 */}
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            color: '#5C4A3A',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          우리 아이를 위한 프리미엄 반려견 식품
        </div>

        {/* 하단 장식 바 */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '14px',
            background:
              'linear-gradient(90deg, #A0452E 0%, #A0452E 33%, #6B7F3A 33%, #6B7F3A 66%, #D4B872 66%, #D4B872 100%)',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
