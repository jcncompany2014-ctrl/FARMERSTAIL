'use client'

/**
 * FTPhotoSlot — 사진 placeholder slot + upload affordance (item 86).
 *
 * 핸드오프 패턴:
 *   - 사진 없을 때: tone-matched bg + 작은 dashed border + "사진 추가" hover overlay
 *   - 사진 있을 때: cover render + 호버 시 어둡게 + edit pen icon
 *
 * 강아지별 tone (toneBg) 매칭 — 무지개색 placeholder 대신 종이/사진과 어울리는 톤.
 */

import { useState } from 'react'
import Image from 'next/image'
import { Camera, ImagePlus } from 'lucide-react'
import { V3 } from '@/lib/design/tokens'

interface FTPhotoSlotProps {
  /** 가로 — number 또는 '100%'. */
  w?: number | string
  /** 세로 — number 또는 '100%'. */
  h?: number | string
  /** placeholder bg tint — 강아지 toneBg 와 매칭. */
  bg?: string
  /** stroke (inset border) — 자연스러운 paper 톤. */
  stroke?: string
  /** radius. 기본 var(--r-xs) = 2. */
  radius?: number
  /** label (사진 없을 때 표시되는 작은 라벨). */
  label?: string
  /** text color for label/placeholder. */
  textColor?: string
  /** 사진 URL. 있으면 cover render. */
  src?: string | null
  /** alt — accessibility. */
  alt?: string
  /** 클릭 — 사진 추가/변경 sheet 트리거. */
  onPick?: () => void
  /** 호버 affordance 표시 여부 (true = 사진 변경 UI 노출). */
  editable?: boolean
}

export default function FTPhotoSlot({
  w = 100,
  h = 100,
  bg = '#d6c9aa',
  stroke = 'rgba(0,0,0,0.16)',
  radius = 2,
  label,
  textColor = V3.inkMute,
  src,
  alt = '',
  onPick,
  editable = false,
}: FTPhotoSlotProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onPick}
      className="relative overflow-hidden"
      style={{
        width: w,
        height: h,
        background: bg,
        borderRadius: radius,
        boxShadow: `inset 0 0 0 1px ${stroke}`,
        cursor: onPick ? 'pointer' : 'default',
      }}
    >
      {src ? (
        <>
          <Image
            src={src}
            alt={alt}
            fill
            sizes={typeof w === 'number' ? `${w}px` : '50vw'}
            className="object-cover"
          />
          {editable && (hovered || onPick) && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: hovered ? 'rgba(22,20,15,0.42)' : 'rgba(22,20,15,0)',
                color: V3.paper,
                transition: 'background 200ms',
              }}
            >
              {hovered && (
                <Camera size={20} color={V3.paper} strokeWidth={1.8} />
              )}
            </div>
          )}
        </>
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            gap: 4,
            color: textColor,
            fontFamily: 'var(--font-sans)',
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {onPick ? (
            <ImagePlus size={20} color={textColor} strokeWidth={1.6} />
          ) : null}
          {label && <span>{label}</span>}
        </div>
      )}
    </div>
  )
}
