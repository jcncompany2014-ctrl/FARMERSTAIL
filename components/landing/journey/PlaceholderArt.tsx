/**
 * PlaceholderArt — 트럭 여정용 SVG 크레용 placeholder + 그림 교체 디스패처.
 *
 * SlotArt({slot}): journeyConfig 의 ASSET_SLOTS[slot].src 가
 *   - null 이면 → 아래 SVG placeholder (지금)
 *   - '/landing/xxx.webp' 면 → 그 <img> (나중에 사장님이 그림 꽂으면 자동 전환)
 *
 * 모든 placeholder 는 동일 팔레트 + 좌상단 광원 가정 (스펙 공통 규칙)으로,
 * 실제 색연필 그림이 들어오기 전에도 톤이 어긋나지 않게 했다.
 * 코드를 다시 짤 필요 없이 journeyConfig 의 src 만 바꾸면 된다.
 */

import { ASSET_SLOTS } from '@/lib/landing/journeyConfig'

// 공유 크레용 질감 필터 — page.tsx 에서 1회 렌더, 모든 SVG 가 url(#jr-rough) 참조.
export function JourneyDefs() {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      style={{ position: 'absolute', pointerEvents: 'none' }}
    >
      <defs>
        <filter id="jr-rough" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012"
            numOctaves="2"
            seed="7"
            result="n"
          />
          {/* Q10: 크레용 질감 완화 (scale 4→1.6) — 카툰 느낌 줄이고 종이결만. */}
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" />
        </filter>
      </defs>
    </svg>
  )
}

type ArtProps = { className?: string; style?: React.CSSProperties }

const ROUGH = 'url(#jr-rough)'

// ── 배경 레이어 ─────────────────────────────────────────────────────────

function FarMountainArt({ className, style }: ArtProps) {
  return (
    <svg
      viewBox="0 0 1440 360"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      style={style}
      aria-hidden
    >
      <g filter={ROUGH}>
        <path d="M0 360 V210 Q 240 110 480 190 Q 700 250 920 170 Q 1180 80 1440 180 V360 Z" fill="#A6BCAE" />
        <path d="M0 360 V250 Q 300 180 560 240 Q 860 300 1140 230 Q 1320 190 1440 240 V360 Z" fill="#8FA89A" />
      </g>
    </svg>
  )
}

function MidHillArt({ className, style }: ArtProps) {
  return (
    <svg
      viewBox="0 0 1440 440"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      style={style}
      aria-hidden
    >
      <g filter={ROUGH}>
        <path d="M0 440 V230 Q 360 120 760 220 Q 1100 300 1440 200 V440 Z" fill="#7E9450" />
        <path d="M0 440 V300 Q 420 230 820 300 Q 1160 360 1440 300 V440 Z" fill="#6B7F3A" />
        <g stroke="#5C6E37" strokeWidth="3" opacity="0.5" fill="none">
          <path d="M120 360 Q 360 330 600 360" />
          <path d="M760 380 Q 1000 350 1240 380" />
        </g>
      </g>
    </svg>
  )
}

function WindmillArt({ className, style }: ArtProps) {
  return (
    <svg
      viewBox="0 0 200 320"
      preserveAspectRatio="xMidYMax meet"
      className={className}
      style={style}
      aria-hidden
    >
      <g filter={ROUGH} stroke="rgba(61,43,31,0.22)" strokeWidth="1.4" strokeLinejoin="round">
        <rect x="78" y="150" width="44" height="150" rx="8" fill="#F3EEE2" />
        <path d="M70 150 L100 96 L130 150 Z" fill="#B0573C" />
        {/* 날개 */}
        <g stroke="#8A7B62" strokeWidth="3.4" strokeLinecap="round">
          <line x1="100" y1="128" x2="100" y2="60" />
          <line x1="100" y1="128" x2="158" y2="150" />
          <line x1="100" y1="128" x2="42" y2="150" />
          <line x1="100" y1="128" x2="100" y2="196" />
        </g>
        <circle cx="100" cy="128" r="9" fill="#D4B872" />
      </g>
    </svg>
  )
}

function FrontHillRoadArt({ className, style }: ArtProps) {
  return (
    <svg
      viewBox="0 0 1440 700"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      style={style}
      aria-hidden
    >
      <g filter={ROUGH}>
        {/* 밝은 풀밭 언덕 */}
        <path d="M0 700 V300 Q 400 200 760 290 Q 1120 370 1440 270 V700 Z" fill="#8FA64E" />
        <path d="M0 700 V420 Q 460 340 900 420 Q 1200 470 1440 420 V700 Z" fill="#7C9442" />
        {/* 지그재그 흙길 (멀리 좁게 → 가까이 넓게) — 실제 A4 그림 오면 이 곡선에 맞춤 */}
        <path
          d="M712 286 C 760 360, 560 410, 640 480 C 720 545, 470 590, 600 700"
          stroke="#EAE1CF"
          strokeWidth="40"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M712 286 C 760 360, 560 410, 640 480 C 720 545, 470 590, 600 700"
          stroke="#D8CBA8"
          strokeWidth="3"
          strokeDasharray="2 26"
          fill="none"
          strokeLinecap="round"
        />
        {/* 풀 터프트 */}
        <g stroke="#5C6E37" strokeWidth="4" strokeLinecap="round">
          <path d="M120 640 q -6 -26 0 -40 M132 640 q 8 -24 2 -42" />
          <path d="M1300 600 q -6 -24 0 -38 M1312 600 q 8 -22 2 -40" />
        </g>
      </g>
    </svg>
  )
}

// ── 오브젝트 ────────────────────────────────────────────────────────────

function SunArt({ className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={style} aria-hidden>
      <circle cx="60" cy="60" r="34" fill="#E9C46A" opacity="0.22" />
      <g filter={ROUGH}>
        <circle cx="60" cy="60" r="26" fill="#E9C46A" />
      </g>
    </svg>
  )
}

/** T1 측면 트럭 — 기본은 좌향(캡이 왼쪽). flip 은 호출부에서 scaleX 로 처리. */
function TruckSideArt({ className, style }: ArtProps) {
  return (
    <svg
      viewBox="0 0 360 210"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={style}
      aria-hidden
    >
      <g filter={ROUGH} stroke="rgba(61,43,31,0.24)" strokeWidth="1.4" strokeLinejoin="round">
        {/* 적재함 */}
        <rect x="128" y="92" width="206" height="64" rx="6" fill="#B98A4E" />
        {/* 원물 빼꼼 */}
        <g strokeWidth="3">
          <ellipse cx="170" cy="84" rx="22" ry="18" fill="#E08A3C" />
          <path d="M170 66 q 6 -10 14 -8" fill="none" stroke="#6B7F3A" strokeWidth="4" />
          <ellipse cx="214" cy="86" rx="14" ry="13" fill="#6B7F3A" />
          <path d="M250 92 l 10 -26 l 10 26 Z" fill="#D86A2E" />
          <path d="M260 66 q 4 -10 10 -8" fill="none" stroke="#6B7F3A" strokeWidth="4" />
          <ellipse cx="300" cy="86" rx="16" ry="14" fill="#E0B84C" />
        </g>
        {/* 캡 */}
        <path d="M30 156 V96 q 0 -10 10 -10 H120 q 8 0 8 8 V156 Z" fill="#A0452E" />
        <rect x="44" y="100" width="52" height="36" rx="5" fill="#CFE3EA" />
        {/* 바퀴 */}
        <circle cx="92" cy="166" r="26" fill="#3D2B1F" />
        <circle cx="92" cy="166" r="10" fill="#8A7B62" />
        <circle cx="270" cy="166" r="26" fill="#3D2B1F" />
        <circle cx="270" cy="166" r="10" fill="#8A7B62" />
      </g>
    </svg>
  )
}

/** T3 정면 도착 트럭 — 연출 클라이맥스. */
function TruckFrontArt({ className, style }: ArtProps) {
  return (
    <svg
      viewBox="0 0 400 340"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={style}
      aria-hidden
    >
      <g filter={ROUGH} stroke="rgba(61,43,31,0.24)" strokeWidth="1.4" strokeLinejoin="round">
        {/* 적재함 (뒤로 넓게) + 원물 */}
        <rect x="46" y="28" width="308" height="96" rx="8" fill="#B98A4E" />
        <g strokeWidth="3">
          <ellipse cx="110" cy="34" rx="26" ry="20" fill="#E08A3C" />
          <ellipse cx="170" cy="34" rx="18" ry="16" fill="#6B7F3A" />
          <path d="M214 50 l 12 -30 l 12 30 Z" fill="#D86A2E" />
          <ellipse cx="288" cy="36" rx="22" ry="18" fill="#E0B84C" />
          {/* 원물 상자 (TODO: 라벨 글씨 — 사장님 확정) */}
          <rect x="150" y="40" width="74" height="40" rx="4" fill="#C99A5E" />
          <line x1="160" y1="58" x2="214" y2="58" stroke="#3D2B1F" strokeWidth="2.5" />
        </g>
        {/* 캡 정면 */}
        <rect x="92" y="118" width="216" height="166" rx="16" fill="#A0452E" />
        <rect x="112" y="132" width="176" height="58" rx="8" fill="#CFE3EA" />
        {/* 그릴 */}
        <rect x="150" y="206" width="100" height="34" rx="5" fill="#8A2E15" />
        {/* 헤드라이트 */}
        <circle cx="128" cy="206" r="15" fill="#E9C46A" />
        <circle cx="272" cy="206" r="15" fill="#E9C46A" />
        {/* 범퍼 + 번호판 */}
        <rect x="96" y="252" width="208" height="24" rx="6" fill="#7A6A4F" />
        <rect x="172" y="256" width="56" height="16" rx="3" fill="#F3EEE2" />
        {/* 바퀴 빼꼼 */}
        <circle cx="118" cy="288" r="24" fill="#3D2B1F" />
        <circle cx="282" cy="288" r="24" fill="#3D2B1F" />
      </g>
    </svg>
  )
}

/** B1 달리는 강아지 — 좌향. */
function DogArt({ className, style }: ArtProps) {
  return (
    <svg
      viewBox="0 0 240 160"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={style}
      aria-hidden
    >
      <g filter={ROUGH} stroke="rgba(61,43,31,0.24)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        {/* 꼬리 (살랑) */}
        <path d="M176 78 q 34 -8 44 -34" fill="none" strokeWidth="9" stroke="#F0E7D6" />
        {/* 몸통 */}
        <ellipse cx="120" cy="86" rx="62" ry="34" fill="#F3EEE2" />
        {/* 다리 (달리는 자세) */}
        <g strokeWidth="9" stroke="#F0E7D6">
          <path d="M84 112 l -14 26" />
          <path d="M104 116 l 10 24" />
          <path d="M150 116 l -10 24" />
          <path d="M168 112 l 16 24" />
        </g>
        {/* 머리 */}
        <ellipse cx="56" cy="70" rx="30" ry="26" fill="#F3EEE2" />
        <path d="M40 50 q -10 -4 -16 8 q 10 6 18 0 Z" fill="#D8B98A" />
        <ellipse cx="34" cy="74" rx="6" ry="7" fill="#3D2B1F" stroke="none" />
        <circle cx="44" cy="64" r="3.5" fill="#3D2B1F" stroke="none" />
        {/* 목줄 */}
        <path d="M70 86 q 10 8 22 4" stroke="#D4B872" strokeWidth="7" fill="none" />
      </g>
    </svg>
  )
}

// ── 디스패처 ────────────────────────────────────────────────────────────

const PLACEHOLDER: Record<string, (p: ArtProps) => React.ReactElement> = {
  A1_1_sun: SunArt,
  A2_farMountain: FarMountainArt,
  A3_midHill: MidHillArt,
  A4_frontHillRoad: FrontHillRoadArt,
  A5_windmill: WindmillArt,
  T1_truckSide: TruckSideArt,
  T3_truckFront: TruckFrontArt,
  B1_dog: DogArt,
}

/**
 * SlotArt — 슬롯의 실제 그림(src) 또는 placeholder 를 채운다.
 * imgFit: 배경 레이어는 'cover'(기본, 바닥 정렬), 트럭/강아지는 'contain'.
 */
export function SlotArt({
  slot,
  className,
  style,
  imgFit = 'cover',
}: {
  slot: string
  className?: string
  style?: React.CSSProperties
  imgFit?: 'cover' | 'contain'
}) {
  const asset = ASSET_SLOTS[slot]
  if (asset?.src) {
    // 그림 교체됨 — 실제 파일 사용. (asset-swap 단계에서 next/image 전환 검토)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.src}
        alt=""
        aria-hidden
        className={className}
        style={{
          width: '100%',
          height: '100%',
          objectFit: imgFit,
          objectPosition: imgFit === 'cover' ? 'center bottom' : 'center',
          ...style,
        }}
      />
    )
  }
  const Art = PLACEHOLDER[slot]
  if (!Art) return null
  return <Art className={className} style={{ width: '100%', height: '100%', ...style }} />
}
