'use client'

/**
 * Magazine BoxMixCard — segmented 기간 switcher + stacked bar + 5종 row.
 * 1주분 / 2주분 / 4주분 토글은 표시 단위 (kcal·g) 만 바뀜.
 */

import { useState } from 'react'
import { Bone, Droplet, Sparkles, Leaf } from 'lucide-react'
import type { MagazinePalette, BoxLineKey } from './palette'
import { lineColors } from './palette'
import { Reveal, useReveal } from './primitives'
import { ReportCard, SectionHeader } from './ReportCard'

export interface BoxMixItem {
  key: BoxLineKey
  /** 영문 라벨 (스텐실). ex: 'Basic' */
  name: string
  /** 한국어 이름 + 단백. ex: '닭 · 균형식' */
  ko: string
  /** 부제. ex: '단일 단백원 · 소화 부담 낮음' */
  sub: string
  /** 비율 % */
  pct: number
  /** 1주분 일일 평균 kcal */
  kcal: number
  /** 1주분 일일 평균 g */
  g: number
}

type PeriodKey = '1주분' | '2주분' | '4주분'
const PERIOD_MULT: Record<PeriodKey, number> = {
  '1주분': 7,
  '2주분': 14,
  '4주분': 28,
}

export function BoxMixCard({
  p,
  dogName,
  items,
}: {
  p: MagazinePalette
  dogName: string
  items: BoxMixItem[]
}) {
  const [period, setPeriod] = useState<PeriodKey>('1주분')
  const colors = lineColors(p)
  const days = PERIOD_MULT[period]

  return (
    <Reveal delay={80}>
      <ReportCard p={p}>
        <SectionHeader
          p={p}
          eyebrow="RECOMMENDED"
          title={`${dogName}이의 첫 박스`}
          tail="화식 5종 믹스"
        />

        <div
          style={{
            display: 'flex',
            marginTop: 12,
            padding: 4,
            background: p.cardSoft,
            borderRadius: 999,
            gap: 4,
          }}
        >
          {(['1주분', '2주분', '4주분'] as PeriodKey[]).map((t) => {
            const active = t === period
            return (
              <button
                key={t}
                onClick={() => setPeriod(t)}
                type="button"
                style={{
                  flex: 1,
                  background: active ? '#fff' : 'transparent',
                  color: active ? p.ink : p.muted,
                  border: 'none',
                  borderRadius: 999,
                  padding: '8px 0',
                  fontSize: 13,
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  boxShadow: active ? `0 2px 8px ${p.ink}1a` : 'none',
                  transition: 'all 200ms',
                }}
              >
                {t}
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 16 }}>
          <StackedBar items={items} colors={colors} />
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => (
            <BoxRow
              key={it.key}
              p={p}
              idx={i + 1}
              total={items.length}
              item={it}
              color={colors[it.key]}
              periodDays={days}
            />
          ))}
        </div>
      </ReportCard>
    </Reveal>
  )
}

function StackedBar({
  items,
  colors,
}: {
  items: BoxMixItem[]
  colors: ReturnType<typeof lineColors>
}) {
  const [ref, shown] = useReveal({ threshold: 0.3 })
  return (
    <div
      ref={ref}
      style={{
        height: 16,
        borderRadius: 999,
        overflow: 'hidden',
        display: 'flex',
        background: 'rgba(0,0,0,0.04)',
      }}
    >
      {items.map((it, i) => (
        <div
          key={it.key}
          style={{
            width: shown ? `${it.pct}%` : '0%',
            background: colors[it.key],
            transition: `width 900ms cubic-bezier(.2,.7,.2,1) ${100 + i * 90}ms`,
            borderRight: i < items.length - 1 ? '1px solid rgba(255,255,255,0.35)' : 'none',
          }}
        />
      ))}
    </div>
  )
}

function BoxRow({
  p,
  idx,
  total,
  item,
  color,
  periodDays,
}: {
  p: MagazinePalette
  idx: number
  total: number
  item: BoxMixItem
  color: string
  periodDays: number
}) {
  const totalG = Math.round((item.g * periodDays) / 7)
  const totalKcal = Math.round((item.kcal * periodDays) / 7)
  const IconComp =
    item.key === 'skin'
      ? Droplet
      : item.key === 'joint'
        ? Sparkles
        : item.key === 'weight'
          ? Leaf
          : Bone
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: p.cardSoft,
        borderRadius: 14,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${color}22`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconComp size={18} color={color} strokeWidth={1.9} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontFamily: 'var(--font-stencil, "Stardos Stencil", serif)',
              fontSize: 11,
              color,
              letterSpacing: '0.16em',
              fontWeight: 700,
            }}
          >
            {item.name.toUpperCase()}
          </span>
          <span style={{ fontSize: 10, color: p.muted, fontWeight: 600 }}>
            0{idx}/0{total}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: p.ink, marginTop: 1 }}>
          {item.ko}
        </div>
        <div style={{ fontSize: 11, color: p.muted, marginTop: 1 }}>{item.sub}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {item.pct}
          <span style={{ fontSize: 12, fontWeight: 700, color: p.muted, marginLeft: 1 }}>
            %
          </span>
        </div>
        <div style={{ fontSize: 10, color: p.muted, fontWeight: 600, marginTop: 3 }}>
          {totalG}g · {totalKcal}kcal
        </div>
      </div>
    </div>
  )
}
