/**
 * ActiveDogCard — 홈의 "지금 보고 있는 아이" 카드.
 *
 * ★2026-10-09 앱 새 디자인('A 포스터', 캔버스 AppHome·T02~T04·AppHomeMultiTabs):
 *   옅은 주황(#FCEFD9) 카드 — 위 줄(머리말 + 정기배송 상태 점), 동그란 사진 76 + 이름(제목 글꼴 32) + 한 줄 정보,
 *   아래 수치 띠(#FFF7EA) 4칸 = 체중 · 연속 · 오늘 화식 · 배송(큰 숫자 Anton).
 *   · `core` = 화면의 핵심 카드일 때(위에 박스 카드가 없을 때) 먹색 2px 테두리 + 도장 그림자. 한 화면에 한 곳.
 *   · `variant='multi'` = 강아지 여러 마리 — 위 탭이 고르기를 맡아 머리말 줄을 빼고, 상태는 이름 아래로.
 * 상태 점 색: 정기배송 중 = 머스타드 / 정기배송 전·일시정지 = 회색 / 배송 멈춤 = 빨강.
 */

import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { V3, V3Shadow } from '@/lib/design/tokens'
import DogPawMark from '@/components/DogPawMark'

export interface DogMetric {
  /** 라벨 — 체중 / 연속 / 오늘 화식 / 배송. */
  key: string
  /** 큰 수치. */
  value: string
  /** 단위 — kg / 일 / g / 일 후 / 예정. */
  sub: string
}

export type DogStatusTone = 'active' | 'idle' | 'stopped'

interface ActiveDogCardProps {
  dogName: string
  /** "셸티 · 11.2kg · 247일 함께" */
  metaLine: string
  photoUrl?: string | null
  /** "정기배송 중" / "정기배송 전" / "배송 멈춤" / "일시정지" */
  statusLabel: string
  statusTone?: DogStatusTone
  metrics: DogMetric[]
  href?: string
  /** LCP 후보 — 홈 첫 카드면 true. */
  priority?: boolean
  /** 화면의 핵심 카드(도장 그림자). */
  core?: boolean
  /** 머리말 — "지금 보고 있는 아이"(박스 카드가 위에 있을 때) / "우리 아이"(핵심 카드일 때). */
  kicker?: string
  variant?: 'single' | 'multi'
}

const TONE_DOT: Record<DogStatusTone, string> = {
  active: V3.mustard,
  idle: '#9A9A9A',
  stopped: V3.sale,
}

function StatusBadge({ label, tone }: { label: string; tone: DogStatusTone }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: V3.ink }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: TONE_DOT[tone], flexShrink: 0 }} />
      {label}
    </span>
  )
}

export default function ActiveDogCard({
  dogName,
  metaLine,
  photoUrl,
  statusLabel,
  statusTone = 'active',
  metrics,
  href,
  priority = false,
  core = false,
  kicker = '지금 보고 있는 아이',
  variant = 'single',
}: ActiveDogCardProps) {
  const multi = variant === 'multi'
  const body = (
    <>
      {!multi && (
        <span
          style={{
            padding: '16px 16px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: V3.cream,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>{kicker}</span>
          <StatusBadge label={statusLabel} tone={statusTone} />
        </span>
      )}
      <span
        style={{
          padding: multi ? 16 : '12px 16px 16px',
          display: 'grid',
          gridTemplateColumns: '76px 1fr',
          columnGap: 14,
          alignItems: 'center',
          background: V3.cream,
        }}
      >
        <span
          style={{
            position: 'relative',
            width: 76,
            height: 76,
            borderRadius: 38,
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
            <Image
              src={photoUrl}
              alt={`${dogName} 사진`}
              fill
              sizes="76px"
              className="object-cover"
              priority={priority}
              fetchPriority={priority ? 'high' : 'auto'}
            />
          ) : (
            <DogPawMark size={28} color={V3.inkMute} />
          )}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span className="ft-poster" style={{ fontSize: 32, lineHeight: 1, wordBreak: 'keep-all' }}>
            {dogName}
          </span>
          <span className="ft-clamp-1" style={{ fontSize: 15, color: V3.inkSoft }}>
            {metaLine}
          </span>
          {multi && (
            <span style={{ marginTop: 2 }}>
              <StatusBadge label={statusLabel} tone={statusTone} />
            </span>
          )}
        </span>
      </span>
      <span data-tour="stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', background: V3.creamSoft }}>
        {metrics.map((m, i) => (
          <span
            key={m.key}
            style={{
              padding: i === 0 ? '12px 6px 14px 14px' : '12px 6px 14px 12px',
              borderLeft: i > 0 ? '1px solid #F0DDBD' : 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: 13, color: V3.inkMute, whiteSpace: 'nowrap' }}>{m.key}</span>
            <span style={{ whiteSpace: 'nowrap' }}>
              <span className="ft-num" style={{ fontSize: 26, color: V3.ink }}>
                {m.value}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700 }}> {m.sub}</span>
            </span>
          </span>
        ))}
      </span>
    </>
  )

  const frame: CSSProperties = {
    margin: multi ? '12px 20px 0' : '22px 20px 0',
    border: core ? `2px solid ${V3.ink}` : 0,
    boxShadow: core ? V3Shadow.stamp : 'none',
    borderRadius: 4,
    overflow: 'hidden',
    color: V3.ink,
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
  }

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${dogName} 자세히 보기`}
        className="transition active:scale-[0.99]"
        style={frame}
      >
        {body}
      </Link>
    )
  }
  return <div style={frame}>{body}</div>
}
