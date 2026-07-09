/**
 * Polaroid — 흰 프레임 + 손글씨(Gaegu) 캡션의 폴라로이드 사진 (de-AI, 2026-07-09).
 *
 * 완벽 정렬 그리드를 살짝 기울여 깨는 "의도적 불완전함" 장치. 실사 한 장이
 * 완벽한 AI 이미지 열 장보다 사람 티를 낸다는 원칙의 시각화.
 *
 * ⚠️ 사진은 **스왑 슬롯** — 지금은 기존 이미지를 placeholder 로 쓰고, 사장님
 * 실사가 도착하면 src/alt/caption 만 교체한다. 웹 전용(--font-hand=Gaegu 는
 * 웹 컨텍스트에서 로드).
 */
import Image from 'next/image'

export function Polaroid({
  src,
  alt,
  caption,
  rotate = -2.5,
  ratio = '4 / 5',
  width = 240,
  className,
}: {
  src: string
  alt: string
  /** 손글씨 캡션(한두 마디). */
  caption: string
  /** 기울기(deg). ±3 이내 권장. */
  rotate?: number
  /** 사진 종횡비. */
  ratio?: string
  /** 프레임 폭(px). 모바일에선 maxWidth:100% 로 자동 축소. */
  width?: number
  className?: string
}) {
  return (
    <figure
      className={className}
      style={{
        transform: `rotate(${rotate}deg)`,
        background: '#FFFFFF',
        padding: '12px 12px 42px',
        borderRadius: 2,
        border: '1px solid var(--fd-line)',
        boxShadow: '0 12px 30px rgba(22,20,15,0.15), 0 1px 0 rgba(22,20,15,0.04)',
        width,
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: ratio,
          borderRadius: 1,
          overflow: 'hidden',
          background: 'var(--fd-cream)',
        }}
      >
        <Image src={src} alt={alt} fill sizes={`${width}px`} className="object-cover" />
      </div>
      <figcaption
        style={{
          fontFamily: 'var(--font-hand), cursive',
          color: 'var(--fd-muted)',
          fontSize: 17,
          textAlign: 'center',
          marginTop: 12,
          lineHeight: 1.2,
        }}
      >
        {caption}
      </figcaption>
    </figure>
  )
}
