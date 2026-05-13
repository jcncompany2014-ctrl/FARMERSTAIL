/**
 * DogSilhouette — 카메라 overlay 용 강아지 silhouette SVG (B-17/18/19).
 *
 * 3가지 view 지원:
 *  · side  — 측면 (PhotoFrameGuide 와 같은 패턴, 발명 명세 권장)
 *  · front — 정면
 *  · top   — 위에서
 *
 * Reference object 모드:
 *  · card — 신용카드 (85.6 × 54 mm)
 *  · a4   — A4 종이 (210 × 297 mm)
 *  · none
 *
 * 모두 inline SVG — 외부 자산 X. 카메라 overlay 로 위에 absolute 표시.
 */

export type SilhouetteView = 'side' | 'front' | 'top'
export type ReferenceMode = 'card' | 'a4' | 'none'

export default function DogSilhouette({
  view,
  reference = 'card',
  stroke = 'rgba(255,255,255,0.9)',
}: {
  view: SilhouetteView
  reference?: ReferenceMode
  stroke?: string
}) {
  return (
    <svg
      viewBox="0 0 240 320"
      width="100%"
      height="100%"
      aria-hidden
      style={{ display: 'block' }}
    >
      {/* dashed outer frame */}
      <rect
        x={8}
        y={8}
        width={224}
        height={304}
        rx={12}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        strokeDasharray="6 4"
      />

      <g
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {view === 'side' && <SideDog />}
        {view === 'front' && <FrontDog />}
        {view === 'top' && <TopDog />}
      </g>

      {reference === 'card' && <CardSlot stroke={stroke} />}
      {reference === 'a4' && <A4Slot stroke={stroke} />}
    </svg>
  )
}

function SideDog() {
  return (
    <>
      {/* 몸통 + 등 */}
      <path d="M50 180 Q90 150 140 156 Q180 160 195 188" />
      {/* 머리 */}
      <path d="M195 188 Q210 175 210 158 Q205 145 195 145 Q183 145 178 155" />
      {/* 코 */}
      <circle cx={213} cy={163} r={2} fill="#fff" />
      <path d="M210 167 Q207 172 200 172" />
      {/* 꼬리 */}
      <path d="M50 180 Q38 168 36 152" />
      {/* 다리 4 */}
      <path d="M165 188 L162 240" />
      <path d="M178 188 L181 240" />
      <path d="M70 188 L66 240" />
      <path d="M85 188 L88 240" />
    </>
  )
}

function FrontDog() {
  return (
    <>
      {/* 얼굴 (둥근 사다리꼴) */}
      <path d="M90 110 Q120 90 150 110 Q160 145 150 195 Q120 215 90 195 Q80 145 90 110 Z" />
      {/* 귀 2 */}
      <path d="M95 110 L75 70 L110 95" />
      <path d="M145 110 L165 70 L130 95" />
      {/* 눈 2 */}
      <circle cx={108} cy={140} r={3.5} fill="#fff" />
      <circle cx={132} cy={140} r={3.5} fill="#fff" />
      {/* 코 */}
      <ellipse cx={120} cy={172} rx={7} ry={4.5} fill="#fff" />
      {/* 입선 */}
      <path d="M120 178 Q120 195 110 198" />
      <path d="M120 178 Q120 195 130 198" />
      {/* 몸통 (작게, 정면이라 가려진 윤곽) */}
      <path d="M85 215 Q120 250 155 215" />
      {/* 앞다리 */}
      <path d="M95 225 L92 270" />
      <path d="M145 225 L148 270" />
    </>
  )
}

function TopDog() {
  return (
    <>
      {/* 몸통 (타원) */}
      <ellipse cx={120} cy={170} rx={50} ry={90} />
      {/* 머리 (위쪽 원) */}
      <circle cx={120} cy={90} r={32} />
      {/* 귀 */}
      <path d="M100 75 L92 55" />
      <path d="M140 75 L148 55" />
      {/* 코 */}
      <circle cx={120} cy={75} r={2} fill="#fff" />
      {/* 꼬리 (아래) */}
      <path d="M120 258 Q120 280 125 290" />
      {/* 다리 4 */}
      <path d="M75 130 L55 125" />
      <path d="M165 130 L185 125" />
      <path d="M75 215 L55 222" />
      <path d="M165 215 L185 222" />
    </>
  )
}

function CardSlot({ stroke }: { stroke: string }) {
  return (
    <g>
      <rect
        x={150}
        y={262}
        width={50}
        height={32}
        rx={4}
        fill="none"
        stroke="rgba(245, 200, 90, 0.95)"
        strokeWidth={1.4}
        strokeDasharray="3 3"
      />
      <text
        x={175}
        y={282}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill="rgba(245, 200, 90, 0.95)"
        fontFamily="system-ui, sans-serif"
      >
        카드
      </text>
    </g>
  )
}

function A4Slot({ stroke }: { stroke: string }) {
  return (
    <g>
      <rect
        x={140}
        y={250}
        width={60}
        height={45}
        rx={2}
        fill="none"
        stroke="rgba(245, 200, 90, 0.95)"
        strokeWidth={1.4}
        strokeDasharray="3 3"
      />
      <text
        x={170}
        y={278}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill="rgba(245, 200, 90, 0.95)"
        fontFamily="system-ui, sans-serif"
      >
        A4
      </text>
    </g>
  )
}
