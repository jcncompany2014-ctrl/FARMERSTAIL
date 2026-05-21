'use client'

/**
 * Magazine SupplementsCard — 올리브 톤 보충제 추천 카드.
 */

import { Pill, Droplet, Leaf, Plus } from 'lucide-react'
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
          eyebrow="SUPPLEMENT"
          title={`${dogName}이 맞춤 보충제`}
          tail={`${items.length}가지 추천`}
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
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
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
                <Plus size={18} color={p.accentOlive} strokeWidth={2.2} />
              </div>
            )
          })}
        </div>
      </ReportCard>
    </Reveal>
  )
}
