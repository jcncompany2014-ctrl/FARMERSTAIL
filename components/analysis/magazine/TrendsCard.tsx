'use client'

/**
 * Magazine TrendsCard — 설문 1회 (empty state) 또는 N회 표시.
 */

import type { MagazinePalette } from './palette'
import { Reveal } from './primitives'
import { ReportCard, SectionHeader } from './ReportCard'

export function TrendsCard({
  p,
  dogName,
  totalCount,
  latestDateLabel,
}: {
  p: MagazinePalette
  dogName: string
  totalCount: number
  latestDateLabel: string
}) {
  return (
    <Reveal delay={80}>
      <ReportCard p={p}>
        <SectionHeader
          p={p}
          eyebrow="HISTORY"
          title="최근 추이"
          tail={`설문 ${totalCount}회 · 최신 ${latestDateLabel}`}
        />
        <div
          style={{
            marginTop: 14,
            padding: '18px 16px',
            background: p.cardSoft,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ width: 60, height: 30, position: 'relative' }}>
            <svg width="60" height="30" viewBox="0 0 60 30">
              <circle cx="2" cy="22" r="4" fill={p.brand} />
              {totalCount >= 2 && (
                <>
                  <circle cx="30" cy="14" r="4" fill={p.brand} />
                  <line x1="2" y1="22" x2="30" y2="14" stroke={p.brand} strokeWidth="1.5" />
                </>
              )}
              {totalCount >= 3 && (
                <>
                  <circle cx="58" cy="6" r="4" fill={p.brand} />
                  <line x1="30" y1="14" x2="58" y2="6" stroke={p.brand} strokeWidth="1.5" />
                </>
              )}
            </svg>
          </div>
          <div style={{ flex: 1, fontSize: 12.5, color: p.muted, lineHeight: 1.5 }}>
            {totalCount < 2 ? (
              <>
                설문을 <span style={{ fontWeight: 700, color: p.ink2 }}>2회 이상</span>{' '}
                완료하면
                <br />
                {dogName}이의 체형·체중 변화가 여기 표시돼요.
              </>
            ) : (
              <>
                {dogName}이의 체형·체중이{' '}
                <span style={{ fontWeight: 700, color: p.ink2 }}>{totalCount}회</span>{' '}
                기록됐어요.
                <br />
                상세 히스토리는 아래 카드에서 확인하세요.
              </>
            )}
          </div>
        </div>
      </ReportCard>
    </Reveal>
  )
}
