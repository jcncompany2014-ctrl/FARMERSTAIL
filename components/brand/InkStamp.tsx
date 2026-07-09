/**
 * InkStamp — 실물 검수 도장 SVG. 웹/앱 공용, 서버 컴포넌트 안전(hook 없음).
 *
 * 원형 이중 테두리 + 중앙 텍스트(1~2줄) + 선택 날짜 줄. feTurbulence +
 * feDisplacementMap 으로 가장자리를 거칠게 만들어 "고르게 안 찍힌 도장" 질감을
 * 낸다. 색은 기본 var(--stamp) (= V3.stamp #694036, 실물 아이콘 샘플) —
 * accent(테라코타)와 절대 혼용하지 않는다. 이게 시그니처의 정체성.
 *
 * @example
 *   <InkStamp lines={['파머스테일 주방', '직접 조리 · 검수']} sub="SINCE 2026" label="파머스테일 검수 도장" />
 *   <InkStamp lines={['기록 완료']} sub="7.9" size={128} label="기록 완료 도장" />
 */

interface InkStampProps {
  /** 중앙 텍스트 1~2줄. */
  lines: [string] | [string, string]
  /** 하단 작은 줄(날짜·SINCE 등). 선택. */
  sub?: string
  /** 전체 지름(px). 기본 96. */
  size?: number
  /** 회전(deg). 기본 -4. */
  rotate?: number
  /** 잉크색 override. 기본 var(--stamp). 어두운 배경 위에서만 밝은 값으로 교체. */
  color?: string
  /**
   * 의미 전달용이면 label 전달 → role="img" + aria-label.
   * 생략 시 순수 장식으로 간주 → aria-hidden.
   */
  label?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * 내용 기반 결정적 해시 — SVG filter id 충돌 + SSR/hydration mismatch 방지.
 * Date.now/Math.random 미사용 → 서버·클라이언트에서 동일 id 를 낸다.
 */
function seedId(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  return 'inkstamp-' + (h >>> 0).toString(36)
}

const STAMP_FONT =
  "var(--font-sans), 'Pretendard Variable', 'Noto Sans KR', system-ui, sans-serif"

export default function InkStamp({
  lines,
  sub,
  size = 96,
  rotate = -4,
  color = 'var(--stamp)',
  label,
  className,
  style,
}: InkStampProps) {
  const filterId = seedId(lines.join('|') + '|' + (sub ?? '') + '|' + size) + '-rough'
  const hasTwo = lines.length === 2

  // 세로 레이아웃 — viewBox 100 기준. sub 유무에 따라 본문 줄을 위로 당긴다.
  const mainSize = hasTwo ? 9.6 : 12.5
  const y1 = hasTwo ? (sub ? 40 : 44) : sub ? 46 : 52.5
  const y2 = sub ? 53 : 57
  const subY = hasTwo ? 66 : 61

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ transform: `rotate(${rotate}deg)`, display: 'block', ...style }}
    >
      <defs>
        {/* 잉크 번짐 — 가장자리를 미세하게 흔들어 러버 스탬프 질감. seed 고정(결정적). */}
        <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="7"
            result="n"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="1.8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      <g filter={`url(#${filterId})`} opacity="0.9">
        {/* 이중 테두리 */}
        <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="2.4" />
        <circle cx="50" cy="50" r="41.5" fill="none" stroke={color} strokeWidth="1" />

        {/* 본문 1~2줄 */}
        <text
          x="50"
          y={y1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          style={{
            fontFamily: STAMP_FONT,
            fontSize: mainSize,
            fontWeight: 800,
            letterSpacing: hasTwo ? '0.01em' : '0.02em',
          }}
        >
          {lines[0]}
        </text>
        {hasTwo && (
          <text
            x="50"
            y={y2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color}
            style={{
              fontFamily: STAMP_FONT,
              fontSize: mainSize,
              fontWeight: 800,
              letterSpacing: '0.01em',
            }}
          >
            {lines[1]}
          </text>
        )}

        {/* 날짜/서브 줄 */}
        {sub && (
          <text
            x="50"
            y={subY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={color}
            style={{
              fontFamily: STAMP_FONT,
              fontSize: 6.6,
              fontWeight: 700,
              letterSpacing: '0.16em',
            }}
          >
            {sub}
          </text>
        )}
      </g>
    </svg>
  )
}
