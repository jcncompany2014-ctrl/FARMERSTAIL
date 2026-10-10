/**
 * MultiBoxCard — 강아지 여러 마리의 박스가 동시에 움직일 때 한 카드로 묶는다 (앱 새 디자인 2026-10-09, 캔버스 AppHomeMultiTabs).
 *
 * "이번 박스 2개 · 강아지마다 따로 와요" — 아이마다 한 줄(사진·"땅콩이 박스"·레시피·단계 칩·막대·한 줄 설명).
 * 여러 마리를 한 카드에 묶을 때는 파우치 색이 아니라 머스타드 + 먹색 도장 그림자(lib/design/pouch 빈 목록).
 * 단계·문구는 서버(dashboard)가 정한다 — BoxProgressCard 와 같은 정본(lib/commerce/box-progress).
 */

import Link from 'next/link'
import Image from 'next/image'
import { V3 } from '@/lib/design/tokens'
import { BOX_STAGES, type BoxStage } from '@/lib/commerce/box-progress'
import { boxCardColors, boxCardFrame } from '@/lib/design/pouch'
import DogPawMark from '@/components/DogPawMark'

export interface MultiBoxRow {
  key: string
  /** "땅콩이" */
  dogLabel: string
  photoUrl?: string | null
  stage: BoxStage
  detail: string
  itemLabel?: string | null
  href: string
}

export default function MultiBoxCard({ rows }: { rows: MultiBoxRow[] }) {
  const colors = boxCardColors([])
  return (
    <section
      aria-label="이번 박스"
      style={{ margin: '22px 20px 0', borderRadius: 4, display: 'flex', flexDirection: 'column', ...boxCardFrame(colors) }}
    >
      <div style={{ padding: '16px 18px 4px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span className="ft-poster" style={{ fontSize: 23 }}>
          이번 박스 {rows.length}개
        </span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>강아지마다 따로 와요</span>
      </div>
      {rows.map((r, i) => {
        const idx = BOX_STAGES.findIndex((s) => s.key === r.stage)
        return (
          <Link
            key={r.key}
            href={r.href}
            className="active:opacity-80"
            style={{
              padding: '12px 18px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              color: 'inherit',
              textDecoration: 'none',
              borderBottom: i < rows.length - 1 ? `1px solid ${colors.divider}` : 0,
            }}
          >
            <span style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', columnGap: 10, alignItems: 'center' }}>
              <span
                aria-hidden
                style={{
                  position: 'relative',
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {r.photoUrl ? (
                  <Image src={r.photoUrl} alt="" fill sizes="32px" className="object-cover" />
                ) : (
                  <DogPawMark size={16} color={V3.ink} />
                )}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>{r.dogLabel} 박스</span>
                {r.itemLabel && <span style={{ fontSize: 14, wordBreak: 'keep-all' }}>{r.itemLabel}</span>}
              </span>
              <span
                style={{
                  height: 28,
                  padding: '0 9px',
                  borderRadius: 4,
                  background: V3.ink,
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {BOX_STAGES[idx]?.label}
              </span>
            </span>
            <span aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4 }}>
              {BOX_STAGES.map((s, si) => (
                <span key={s.key} style={{ height: 6, background: si <= idx ? colors.barOn : colors.barOff }} />
              ))}
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.45, wordBreak: 'keep-all' }}>{r.detail}</span>
          </Link>
        )
      })}
    </section>
  )
}
