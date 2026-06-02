/**
 * Stepper — v3 진행 단계 표시 (2026-05-22 R12).
 *
 * **앱 컨텍스트 전용.** survey / onboarding / 결제 step 흐름에서 사용자가 현재
 * 어디쯤 인지 시각화. 상단 progress + 점선 connecter.
 *
 * # 디자인
 *  - completed: ink dot + paperHi check
 *  - current: 1.5px ink ring + paper 안쪽 + 작은 ink dot
 *  - upcoming: 1px rule dashed circle
 *  - connector: 진행 완료 = ink 1px / 미완료 = rule dashed 1px
 *
 * @example
 *   <Stepper current={2} total={5} labels={['이름','체중','BCS','식이','완료']} />
 */

import { Check } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'

interface StepperProps {
  /** 0-indexed 현재 step. */
  current: number
  /** 전체 step 수. */
  total: number
  /** 각 step 라벨. length === total. 옵션 (없으면 dot만). */
  labels?: string[]
  /** 작은 카드 라벨 (라벨 위 mono kicker — 옵션). */
  kickers?: string[]
}

export default function Stepper({ current, total, labels }: StepperProps) {
  const items = Array.from({ length: total }, (_, i) => i)
  return (
    <div className="flex items-center w-full" style={{ gap: 0 }}>
      {items.map((i) => {
        const isCompleted = i < current
        const isCurrent = i === current
        const dotSize = 18

        return (
          <div
            key={i}
            className="flex items-center"
            style={{
              flex: i === total - 1 ? '0 0 auto' : '1 1 auto',
              minWidth: 0,
            }}
          >
            {/* Dot */}
            <div
              className="flex flex-col items-center"
              style={{ flexShrink: 0 }}
            >
              <span
                aria-current={isCurrent ? 'step' : undefined}
                className="flex items-center justify-center"
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: 9,
                  background: isCompleted
                    ? V3.ink
                    : isCurrent
                      ? V3.paper
                      : 'transparent',
                  border: isCompleted
                    ? 'none'
                    : isCurrent
                      ? `1.5px solid ${V3.ink}`
                      : `1px dashed ${V3.rule}`,
                  color: V3.paperHi,
                  transition: 'all 160ms',
                }}
              >
                {isCompleted && <Check size={11} strokeWidth={3} />}
                {isCurrent && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      background: V3.ink,
                    }}
                  />
                )}
              </span>
              {labels?.[i] && (
                <span
                  className="truncate text-center"
                  style={{
                    marginTop: 6,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 10.5,
                    fontWeight: isCurrent
                      ? V3FontWeight.bold
                      : V3FontWeight.medium,
                    color: isCompleted || isCurrent ? V3.ink : V3.inkMute,
                    maxWidth: 56,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {labels[i]}
                </span>
              )}
            </div>
            {/* Connector */}
            {i < total - 1 && (
              <span
                aria-hidden
                className="flex-1"
                style={{
                  height: 1,
                  marginInline: 4,
                  borderTop:
                    i < current ? `1px solid ${V3.ink}` : `1px dashed ${V3.rule}`,
                  // dot 중앙 정렬 위해 위쪽 padding 맞춤 (label 있을 땐 위로 보정).
                  marginTop: labels?.[i] ? -18 : 0,
                  minWidth: 8,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
