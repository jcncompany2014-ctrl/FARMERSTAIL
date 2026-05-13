'use client'

import { useRef } from 'react'
import { X, Camera, CreditCard, Sun, Ruler } from 'lucide-react'
import { useModalA11y } from '@/lib/ui/useModalA11y'

/**
 * PhotoFrameGuide — 강아지 사진 촬영 가이드 모달.
 *
 * # 발명 모듈 B 보조 UI
 * 신분증 촬영 화면처럼 "이 자리에 견을 두세요" 라는 시각적 frame.
 * 강아지 측면 silhouette SVG 와 신용카드 위치 자리를 제시해
 * 발명 명세서 모듈 B (참조 객체 함께 촬영) 의 W_image / 절대 크기 보정을
 * 사용자가 직관적으로 따라할 수 있게 한다.
 *
 * # voice-guidelines §11
 * 사진은 옵션. 가이드 모달도 강요 X — "이대로 촬영" / "그냥 갤러리" 두
 * CTA 를 모두 제공해 자율성 유지.
 *
 * # 접근성
 *  - role=dialog, aria-modal
 *  - useModalA11y: Esc 닫기 + focus trap + body scroll lock
 *  - 첫 focus 는 닫기 버튼
 */
export default function PhotoFrameGuide({
  open,
  onClose,
  onTakePhoto,
}: {
  open: boolean
  onClose: () => void
  /** "이대로 카메라 열기" 클릭 시 — 호출처가 file input 트리거. */
  onTakePhoto: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useModalA11y({ open, onClose, containerRef: dialogRef })

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: 'rgba(0, 0, 0, 0.55)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-guide-title"
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
        style={{ maxHeight: '90dvh', overflowY: 'auto' }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h2
            id="photo-guide-title"
            className="font-serif"
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            촬영 가이드
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-full hover:bg-bg/60 transition"
          >
            <X className="w-5 h-5 text-muted" strokeWidth={2} />
          </button>
        </div>

        <p className="px-5 text-[12px] leading-relaxed text-text/70">
          신분증 촬영처럼 자리만 맞춰주면 맞춤도가 올라가요. 옵션이라
          어렵게 생각하지 않아도 돼요.
        </p>

        {/* 프레임 illustration */}
        <div className="mx-5 mt-4 rounded-2xl border border-rule bg-bg/40 px-4 py-5">
          <FrameIllustration />
        </div>

        {/* 3 가이드 bullet */}
        <ul className="px-5 mt-4 space-y-3" aria-label="촬영 팁">
          <GuideBullet icon={<Ruler className="w-3.5 h-3.5" strokeWidth={2} />}>
            <strong>측면 전체</strong>가 들어오게 — 정수리부터 발끝까지
            가로로 길게 잡아주세요
          </GuideBullet>
          <GuideBullet icon={<CreditCard className="w-3.5 h-3.5" strokeWidth={2} />}>
            <strong>신용카드</strong>를 발 옆 같은 바닥 평면에 두면 크기
            보정이 더 정확해요 <span className="text-muted">(옵션)</span>
          </GuideBullet>
          <GuideBullet icon={<Sun className="w-3.5 h-3.5" strokeWidth={2} />}>
            <strong>밝은 자연광</strong> + 깔끔한 배경 — 그림자 적은 곳이
            좋아요
          </GuideBullet>
        </ul>

        {/* CTA 영역 */}
        <div className="px-5 pt-5 pb-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onClose()
              onTakePhoto()
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl text-[13px] font-bold text-white transition active:scale-[0.99]"
            style={{ background: 'var(--terracotta)' }}
          >
            <Camera className="w-4 h-4" strokeWidth={2.2} />
            이대로 사진 선택
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-[12px] font-bold text-muted hover:text-text transition"
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 강아지 측면 silhouette + 신용카드 자리 illustration.
 * inline SVG — 외부 자산 의존 X, 토큰 색상 사용.
 */
function FrameIllustration() {
  return (
    <svg
      viewBox="0 0 240 140"
      width="100%"
      height="auto"
      aria-hidden
      style={{ display: 'block' }}
    >
      {/* dashed frame 외곽 — "여기 안에 들어오세요" */}
      <rect
        x={6}
        y={6}
        width={228}
        height={128}
        rx={10}
        fill="none"
        stroke="var(--terracotta)"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      {/* 강아지 측면 추상 — 머리, 등, 꼬리, 다리 4개 */}
      <g
        fill="none"
        stroke="var(--ink)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 몸통 + 등 (가로 타원) */}
        <path d="M58 76 Q90 60 130 64 Q160 66 175 78" />
        {/* 머리 + 귀 */}
        <path d="M175 78 Q186 70 188 60 Q186 52 180 50 Q172 50 168 56" />
        {/* 코 */}
        <circle cx={189} cy={62} r={1.6} fill="var(--ink)" />
        {/* 입선 */}
        <path d="M186 64 Q184 67 180 67" />
        {/* 꼬리 */}
        <path d="M58 76 Q48 70 46 62" />
        {/* 앞다리 2개 */}
        <path d="M155 78 L153 100" />
        <path d="M165 78 L167 100" />
        {/* 뒷다리 2개 */}
        <path d="M70 80 L68 100" />
        <path d="M82 80 L84 100" />
        {/* 바닥 */}
        <path
          d="M40 102 L200 102"
          stroke="var(--rule)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </g>

      {/* 신용카드 자리 — 발 옆 (점선) */}
      <g>
        <rect
          x={100}
          y={108}
          width={36}
          height={22}
          rx={3}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={1.2}
          strokeDasharray="2 2"
        />
        <text
          x={118}
          y={123}
          textAnchor="middle"
          fontSize={8}
          fill="var(--gold)"
          fontWeight={600}
          fontFamily="system-ui, sans-serif"
        >
          카드
        </text>
      </g>
    </svg>
  )
}

function GuideBullet({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-2.5 text-[12px] leading-relaxed text-text/85">
      <span
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
        style={{
          background: 'color-mix(in srgb, var(--terracotta) 12%, white)',
          color: 'var(--terracotta)',
        }}
      >
        {icon}
      </span>
      <span>{children}</span>
    </li>
  )
}
