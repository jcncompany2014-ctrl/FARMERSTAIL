'use client'

/**
 * Magazine HeroSection — 라디얼 그라데이션 3방향 + 원형 사진 슬롯 + 큰 이름.
 * Claude Design 'SURVEY TIME' handoff 포팅 (2026-05-21).
 */

import Image from 'next/image'
import { petName } from '@/lib/korean'
import type { MagazinePalette } from './palette'
import { Reveal } from './primitives'

interface HeroSectionProps {
  p: MagazinePalette
  dogName: string
  ageLabel: string
  breedLabel?: string | null
  weightKg?: number | null
  photoUrl?: string | null
}

export function HeroSection({
  p,
  dogName,
  ageLabel,
  breedLabel,
  weightKg,
  photoUrl,
}: HeroSectionProps) {
  const metaParts = [ageLabel]
  if (breedLabel) metaParts.push(breedLabel)
  if (weightKg) metaParts.push(`${weightKg}kg`)

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: `
          radial-gradient(circle at 50% 40%, ${p.brand}1f 0%, transparent 60%),
          radial-gradient(circle at 0% 100%, ${p.accentOchre}1a 0%, transparent 48%),
          radial-gradient(circle at 100% 100%, ${p.accentOlive}18 0%, transparent 48%),
          ${p.bg}
        `,
        paddingTop: 18,
        paddingBottom: 24,
      }}
    >
      {/* Top label */}
      <Reveal>
        <div
          style={{
            textAlign: 'center',
            fontSize: 11.5,
            color: p.brand,
            fontWeight: 700,
            letterSpacing: '0.22em',
          }}
        >
          오늘의 영양 진단
        </div>
      </Reveal>

      {/* Dog photo — large circle */}
      <Reveal delay={140}>
        <div style={{ width: 168, height: 168, margin: '18px auto 0', position: 'relative' }}>
          {/* Dashed ring decoration */}
          <div
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              border: `1px dashed ${p.brand}66`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              overflow: 'hidden',
              background: p.cardSoft,
              boxShadow: `0 14px 36px ${p.ink}22, 0 0 0 4px ${p.bg}`,
            }}
          >
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={`${dogName} 프로필 사진`}
                fill
                sizes="168px"
                style={{ objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: p.muted,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                {petName(dogName)}
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {/* Name + meta */}
      <Reveal delay={280}>
        <div style={{ textAlign: 'center', marginTop: 22, padding: '0 24px' }}>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: p.ink,
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
            }}
          >
            {petName(dogName)}의 식단
          </div>
          <div
            style={{
              fontSize: 13,
              color: p.muted,
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            {metaParts.join(' · ')}
          </div>
        </div>
      </Reveal>
    </div>
  )
}
