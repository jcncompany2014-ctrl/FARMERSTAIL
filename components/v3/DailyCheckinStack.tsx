'use client'

/**
 * DailyCheckinStack — B14. 홈 메인의 daily check-in 카드 스택.
 *
 * 사용자가 하루 한 번 swipe 또는 tap 으로 빠르게 체크인 — 체중·기분·사진.
 * 완료된 카드는 자동으로 사라지고 다음 카드 노출.
 *
 * # 디자인
 *
 *  - 3장 stack — 2장 뒤에 살짝 보임 (perspective shadow)
 *  - 상단 카드 tap → 빠른 입력 모달
 *  - 모두 완료 시 "오늘은 끝! 잘했어요" 한 문장 + 다음 cycle 으로
 *
 * # API (controlled)
 *
 *   <DailyCheckinStack
 *     items={[
 *       { id: 'weight', title: '체중 기록', subtitle: '오늘의 무게', tone: 'terracotta' },
 *       { id: 'mood', title: '기분 체크', subtitle: '오늘의 컨디션', tone: 'moss' },
 *       { id: 'photo', title: '오늘의 사진', subtitle: '한 컷 추가', tone: 'gold' },
 *     ]}
 *     onTap={(id) => router.push(...)}
 *     completedIds={['weight']} // 이미 한 항목들
 *   />
 */

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

export interface CheckinCard {
  id: string
  title: string
  subtitle: string
  tone: 'terracotta' | 'moss' | 'gold' | 'sage' | 'blue'
}

const TONE_COLOR: Record<CheckinCard['tone'], string> = {
  terracotta: V3.accent,
  moss: '#5a6e2a',
  gold: V3.yellow,
  sage: V3.sage,
  blue: V3.blue,
}

interface DailyCheckinStackProps {
  items: CheckinCard[]
  completedIds?: string[]
  onTap?: (id: string) => void
}

export default function DailyCheckinStack({
  items,
  completedIds = [],
  onTap,
}: DailyCheckinStackProps) {
  const pending = useMemo(
    () => items.filter((c) => !completedIds.includes(c.id)),
    [items, completedIds],
  )

  if (pending.length === 0) {
    return (
      <section
        // R19: v3 home section spacing 통일 — `padding: '0 20px 30px'`
        // (다른 ActiveDogCard / TodayCard / ThisWeekSection 등과 동일)
        style={{ padding: '0 20px 30px' }}
        role="status"
      >
        <div
          style={{
            background: `color-mix(in srgb, ${V3.sage} 10%, ${V3.paperHi})`,
            border: `1px solid color-mix(in srgb, ${V3.sage} 32%, transparent)`,
            borderRadius: V3Radius.sm,
            padding: '16px 18px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              fontWeight: V3FontWeight.black,
              color: V3.ink,
              letterSpacing: '-0.01em',
            }}
          >
            오늘은 끝! 잘했어요
          </p>
          <p
            style={{
              marginTop: 4,
              fontSize: 11.5,
              color: V3.inkMute,
            }}
          >
            내일 다시 만나요
          </p>
        </div>
      </section>
    )
  }

  const top = pending[0]
  if (!top) return null

  return (
    <section style={{ padding: '0 20px 30px' }}>
      <div className="relative" style={{ minHeight: 92 }}>
        {/* stack underlayers — 살짝 보이는 배경 카드 */}
        {pending.slice(1, 3).map((c, idx) => {
          const offset = (idx + 1) * 6
          const scale = 1 - (idx + 1) * 0.03
          return (
            <div
              key={c.id}
              aria-hidden
              className="absolute inset-x-0"
              style={{
                top: offset,
                background: V3.paperHi,
                border: `1px solid ${V3.rule}`,
                borderRadius: V3Radius.sm,
                height: 92 - offset,
                transform: `scale(${scale})`,
                opacity: 0.6,
                zIndex: 1 - idx,
              }}
            />
          )
        })}
        {/* top card */}
        <button
          type="button"
          onClick={() => onTap?.(top.id)}
          className="relative w-full text-left active:scale-[0.99] transition"
          style={{
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderLeft: `4px solid ${TONE_COLOR[top.tone]}`,
            borderRadius: V3Radius.sm,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: V3FontWeight.bold,
                color: TONE_COLOR[top.tone],
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              오늘의 체크인 · {pending.length}장 남음
            </span>
            <p
              style={{
                marginTop: 6,
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                fontWeight: V3FontWeight.black,
                color: V3.ink,
                letterSpacing: '-0.015em',
                lineHeight: 1.25,
              }}
            >
              {top.title}
            </p>
            <p
              style={{
                marginTop: 2,
                fontSize: 11.5,
                color: V3.inkMute,
              }}
            >
              {top.subtitle}
            </p>
          </div>
          <ArrowRight size={16} color={V3.inkMute} strokeWidth={2.5} />
        </button>
      </div>
    </section>
  )
}
