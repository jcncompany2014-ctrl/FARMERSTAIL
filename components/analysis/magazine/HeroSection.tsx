/**
 * 분석 결과 머리 — 옅은 주황 띠 + 가운데 동그란 사진 + 큰 이름("땅콩이의 식단").
 * Claude Design 'SURVEY TIME' handoff 포팅(2026-05-21)에서 시작.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 D08): 방사형 그라데이션·점선 고리·떠오르기 움직임을 걷고
 *   옅은 주황(#FCEFD9) 면에 사진 140(흰 테 3px) + 제목 글꼴 36 + 한 줄 정보. 사진이 없으면 회색 원 + 발바닥.
 */

import Image from 'next/image'
import { petName } from '@/lib/korean'
import { V3 } from '@/lib/design/tokens'
import DogPawMark from '@/components/DogPawMark'

interface HeroSectionProps {
  dogName: string
  ageLabel: string
  breedLabel?: string | null
  weightKg?: number | null
  photoUrl?: string | null
}

export function HeroSection({ dogName, ageLabel, breedLabel, weightKg, photoUrl }: HeroSectionProps) {
  const metaParts = [ageLabel]
  if (breedLabel) metaParts.push(breedLabel)
  if (weightKg) metaParts.push(`${weightKg}kg`)

  return (
    <section
      aria-label="오늘의 영양 분석"
      style={{
        padding: '26px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        background: V3.cream,
        color: V3.ink,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>오늘의 영양 분석</span>
      <span
        style={{
          position: 'relative',
          marginTop: 16,
          width: 140,
          height: 140,
          borderRadius: 70,
          overflow: 'hidden',
          border: '3px solid #FFFFFF',
          boxSizing: 'border-box',
          background: V3.soft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {photoUrl ? (
          <Image src={photoUrl} alt={`${dogName} 사진`} fill sizes="140px" style={{ objectFit: 'cover' }} />
        ) : (
          <DogPawMark size={44} color={V3.inkMute} />
        )}
      </span>
      {/* 제목 글꼴은 앱 틀의 h1 규칙이 준다 — fontFamily·fontWeight 를 여기서 주지 않는다. */}
      <h1 style={{ margin: '18px 0 0', fontSize: 36, lineHeight: 1.1, wordBreak: 'keep-all' }}>
        {petName(dogName)}의 식단
      </h1>
      <span style={{ marginTop: 8, fontSize: 16, color: V3.inkSoft }}>{metaParts.join(' · ')}</span>
    </section>
  )
}
