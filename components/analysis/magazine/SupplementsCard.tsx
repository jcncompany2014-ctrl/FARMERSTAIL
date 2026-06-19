'use client'

/**
 * Magazine SupplementsCard — 올리브 톤 보충제 추천 카드.
 */

import { Pill, Droplet, Leaf, Check } from 'lucide-react'
import { petName } from '@/lib/korean'
import type { MagazinePalette } from './palette'
import { Reveal } from './primitives'
import { ReportCard, SectionHeader } from './ReportCard'

export interface SupplementItem {
  name: string
  tag: string
  reason: string
  icon: 'pill' | 'drop' | 'leaf'
}

export function SupplementsCard({
  p,
  dogName,
  items,
}: {
  p: MagazinePalette
  dogName: string
  items: SupplementItem[]
}) {
  if (items.length === 0) return null
  return (
    <Reveal delay={80}>
      <ReportCard p={p} tint={`${p.accentOlive}14`}>
        <SectionHeader
          p={p}
          eyebrow="맞춤 영양"
          title={`${petName(dogName)}에게 더 챙겨주는 영양`}
          tail="우리 소스·화식으로"
        />
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((s) => {
            const IconComp = s.icon === 'drop' ? Droplet : s.icon === 'leaf' ? Leaf : Pill
            return (
              <div
                key={s.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: p.card,
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    background: `${p.accentOlive}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconComp size={18} color={p.accentOlive} strokeWidth={1.9} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: p.ink }}>
                      {s.name}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: p.muted, marginTop: 2 }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        color: p.accentOlive,
                        letterSpacing: '0.1em',
                        background: `${p.accentOlive}1c`,
                        padding: '2px 6px',
                        borderRadius: 999,
                        marginRight: 6,
                      }}
                    >
                      {s.tag.toUpperCase()}
                    </span>
                    {s.reason}
                  </div>
                </div>
                <Check size={18} color={p.accentOlive} strokeWidth={2.4} />
              </div>
            )
          })}
        </div>
        {/* reframe(사장님 2026-06-19): 알약 추천 X → 우리 제품이 챙긴다. */}
        <p style={{ marginTop: 12, fontSize: 11, lineHeight: 1.55, color: p.muted }}>
          {petName(dogName)} 화식 박스와 맞춤 데일리 소스로 한 끼에 자연스럽게
          더해드려요. 따로 영양제를 챙기실 필요 없어요.
        </p>
      </ReportCard>
    </Reveal>
  )
}
