/**
 * FunnelSteps — 결제 퍼널 단계 막대 (앱 새 디자인 'A 포스터', 2026-10-09, 캔버스 S29·S31).
 *
 * 1 레시피(/dogs/[id]/plan) · 2 배송(/dogs/[id]/order) · 3 결제(카드 등록). 끝난 단계는 ✓ + 머스타드 막대,
 * 지금 단계는 굵은 글자 + 머스타드 막대, 남은 단계는 회색. 레시피 고르기와 주문하기가 같은 모양을 쓴다.
 * 앱 화면 전용(components/v3) — 웹 주문 화면(/account/subscribe)은 예전 표시 그대로다.
 */

import { V3 } from '@/lib/design/tokens'

const STEPS = ['레시피', '배송', '결제'] as const

export default function FunnelSteps({
  current,
  flush = false,
}: {
  current: 1 | 2 | 3
  /** 부모가 이미 좌우 20 여백을 가질 때(주문하기) — 막대 바깥 여백을 위쪽만. */
  flush?: boolean
}) {
  return (
    <ol
      aria-label="진행 단계"
      style={{
        margin: flush ? '18px 0 0' : '18px 20px 0',
        padding: 0,
        listStyle: 'none',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 4,
      }}
    >
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < current
        const now = n === current
        return (
          <li key={label} aria-current={now ? 'step' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span aria-hidden style={{ height: 6, background: done || now ? V3.mustard : '#EFEDEE' }} />
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 14,
                fontWeight: now ? 800 : 700,
                color: now ? V3.ink : V3.inkMute,
              }}
            >
              {done ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="끝남">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                `${n} `
              )}
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
