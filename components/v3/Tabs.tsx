'use client'

/**
 * Tabs — v3 segment 탭 (2026-05-22 R10-2).
 *
 * **앱 컨텍스트 전용.** CouponBrowser / PointsBrowser / NotificationsClient 가
 * 모두 같은 grid-cols-N + active swap 패턴을 manual 재구현하던 것을 추출.
 *
 * 디자인 핸드오프:
 *   - 컨테이너: 1px rule border + V3.rule gap (1px hairline 분리)
 *   - segment: paperHi bg / 활성 시 V3.ink + paperHi 텍스트
 *   - count badge: 활성이면 반투명 paperHi, 비활성이면 paper bg + inkMute
 *
 * @example
 *   <Tabs
 *     value={tab}
 *     onChange={setTab}
 *     options={[
 *       { key: 'all', label: '전체', count: 10 },
 *       { key: 'available', label: '사용 가능', count: 5 },
 *       { key: 'used', label: '사용 완료' },
 *     ]}
 *   />
 *
 * value/onChange 가 모두 string 으로 정렬 — generic 으로 받으려면 type assertion
 * 필요. 대부분의 호출처가 string union 이므로 generic 까지 가지 않고 string
 * 으로 둠 (sales call: 단순함 > 타입 정밀도).
 */

import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

export interface TabOption {
  key: string
  label: string
  /** 활성/비활성 양쪽에서 노출되는 카운트 배지. 0/undefined 면 숨김. */
  count?: number
}

interface TabsProps {
  /** 현재 활성 key. options 의 key 중 하나. */
  value: string
  /** 사용자가 다른 탭을 누를 때 호출. */
  onChange: (key: string) => void
  /** 탭 목록. 2~5 권장 (그 이상이면 scroll tab 으로 다른 컴포넌트 필요). */
  options: TabOption[]
  /** 컨테이너에 추가 className — 호출처에서 margin 등 조정. */
  className?: string
}

export default function Tabs({
  value,
  onChange,
  options,
  className,
}: TabsProps) {
  return (
    <div
      role="tablist"
      className={`grid overflow-hidden ${className ?? ''}`}
      style={{
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 1,
        background: V3.rule,
        borderRadius: V3Radius.sm,
        border: `1px solid ${V3.rule}`,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className="transition"
            style={{
              padding: '10px 0',
              fontSize: 11.5,
              fontWeight: V3FontWeight.bold,
              background: active ? V3.ink : V3.paperHi,
              color: active ? V3.paperHi : V3.ink,
              border: 'none',
            }}
          >
            {opt.label}
            {typeof opt.count === 'number' && opt.count > 0 && (
              <span
                className="tabular-nums"
                style={{
                  marginLeft: 4,
                  display: 'inline-block',
                  padding: '0 6px',
                  borderRadius: V3Radius.pill,
                  fontSize: 10,
                  fontWeight: V3FontWeight.bold,
                  background: active ? 'rgba(244,237,224,0.2)' : V3.paper,
                  color: active ? V3.paperHi : V3.inkMute,
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
