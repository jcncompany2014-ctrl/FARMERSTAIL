/**
 * Marquee — 끊김 없는 무한 가로 흐름 (farm v4 Q9 콘텐츠3 제조 갤러리).
 * 아이템을 2배 복제 후 CSS 로 -50% 이동. 호버 시 일시정지(globals .fv-marquee).
 * reduced-motion 이면 정지. JS 없음(순수 CSS) — 서버 컴포넌트 OK.
 */

export type MarqueeItem = {
  /** 실제 사진 경로 (없으면 placeholder 타일). TODO: 제조 현장 실사로 교체. */
  src?: string | null
  label: string
}

export default function Marquee({
  items,
  reverse = false,
  speedSec = 32,
}: {
  items: MarqueeItem[]
  reverse?: boolean
  speedSec?: number
}) {
  const doubled = [...items, ...items]
  return (
    <div className="fv-marquee">
      <div
        className="fv-marquee-track"
        style={{
          animationDuration: `${speedSec}s`,
          animationDirection: reverse ? 'reverse' : 'normal',
        }}
      >
        {doubled.map((it, i) => (
          <div
            key={i}
            aria-hidden={i >= items.length}
            className="ft-sticker shrink-0"
            style={{
              width: 'clamp(180px, 52vw, 260px)',
              marginRight: 14,
              overflow: 'hidden',
              borderRadius: 16,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4 / 3',
                background:
                  'linear-gradient(135deg, #EDE3CD 0%, #DFE4C6 100%)',
                display: 'flex',
                alignItems: 'flex-end',
              }}
            >
              {it.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.src}
                  alt=""
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : null}
              <span
                style={{
                  position: 'relative',
                  margin: 10,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--walnut)',
                  background: 'rgba(255,255,255,0.86)',
                  borderRadius: 8,
                }}
              >
                {it.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
