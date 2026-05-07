'use client'

import { useState, useMemo } from 'react'
import {
  Coins,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ShoppingBag,
  Gift,
  RotateCcw,
  Star,
  UserPlus,
  Cake,
} from 'lucide-react'

/**
 * PointsBrowser — ledger filter 탭 + 월별 그룹.
 *
 * 사용자가 보고 싶은 카테고리 (전체 / 적립 / 사용) 만 분리하고, 같은 월의
 * 항목들을 하나의 group 으로 묶어 시각적 위계를 더한다.
 *
 * 카드 디자인 (vs 이전 단조로운 list):
 *  - 좌측 32px 원형 아이콘 (reference_type 별 다른 모양)
 *  - 가운데 reason / 시각
 *  - 우측 +/- 큰 숫자 (적립=moss / 사용=terracotta)
 */

type Entry = {
  id: string
  delta: number
  balance_after: number
  reason: string
  reference_type: string | null
  created_at: string
}

const FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'earn', label: '적립' },
  { key: 'use', label: '사용' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

/**
 * reference_type 별 적절한 아이콘. unknown 은 Coins 폴백.
 */
function iconFor(refType: string | null, isEarn: boolean) {
  if (!refType) return isEarn ? Coins : RotateCcw
  if (refType === 'order') return ShoppingBag
  if (refType === 'order_refund') return RotateCcw
  if (refType === 'order_expire') return RotateCcw
  if (refType === 'review') return Star
  if (refType === 'referral') return UserPlus
  if (refType === 'birthday') return Cake
  if (refType.startsWith('coupon')) return Gift
  return Coins
}

export default function PointsBrowser({
  entries,
}: {
  entries: Entry[]
}) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return entries
    if (filter === 'earn') return entries.filter((e) => e.delta > 0)
    return entries.filter((e) => e.delta < 0)
  }, [entries, filter])

  // 월별 그룹화 — "2026.05" 같은 키.
  const groups = useMemo(() => {
    const m = new Map<string, Entry[]>()
    for (const e of filtered) {
      const d = new Date(e.created_at)
      const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
      const arr = m.get(key) ?? []
      arr.push(e)
      m.set(key, arr)
    }
    return Array.from(m.entries())
  }, [filtered])

  return (
    <>
      {/* filter 탭 */}
      <section className="px-5 mt-4">
        <div
          className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
          style={{ background: 'var(--rule)' }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className="py-2.5 text-[11.5px] font-bold transition"
                style={{
                  background: active ? 'var(--ink)' : 'white',
                  color: active ? 'white' : 'var(--text)',
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* 월별 그룹 */}
      <section className="px-5 mt-3">
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl border px-5 py-12 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <Coins
                className="w-6 h-6 text-muted"
                strokeWidth={1.3}
              />
            </div>
            <span className="kicker kicker-muted">Empty</span>
            <h3
              className="font-serif mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              {filter === 'earn'
                ? '적립 내역이 없어요'
                : filter === 'use'
                  ? '사용 내역이 없어요'
                  : '아직 포인트 내역이 없어요'}
            </h3>
            <p className="text-[11px] text-muted mt-1.5">
              리뷰·주문·친구 초대로 포인트를 적립해보세요
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([month, items]) => {
              const groupEarn = items.reduce(
                (s, e) => s + (e.delta > 0 ? e.delta : 0),
                0,
              )
              const groupUse = items.reduce(
                (s, e) => s + (e.delta < 0 ? -e.delta : 0),
                0,
              )
              return (
                <div key={month}>
                  {/* 월 헤더 */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar
                        className="w-3 h-3 text-muted"
                        strokeWidth={2}
                      />
                      <span className="text-[11px] font-bold text-text">
                        {month.replace('.', '년 ')}월
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold tabular-nums">
                      {groupEarn > 0 && (
                        <span style={{ color: 'var(--moss)' }}>
                          +{groupEarn.toLocaleString()}
                        </span>
                      )}
                      {groupUse > 0 && (
                        <span style={{ color: 'var(--terracotta)' }}>
                          −{groupUse.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 카드 list */}
                  <ul className="bg-white rounded-2xl border border-rule overflow-hidden">
                    {items.map((e, i) => {
                      const isEarn = e.delta > 0
                      const Icon = iconFor(e.reference_type, isEarn)
                      const accent = isEarn
                        ? 'var(--moss)'
                        : 'var(--terracotta)'
                      return (
                        <li
                          key={e.id}
                          className={`flex items-center gap-3 px-4 py-3 ${
                            i < items.length - 1 ? 'border-b border-rule' : ''
                          }`}
                        >
                          <div
                            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                            style={{
                              background: `color-mix(in srgb, ${accent} 12%, white)`,
                            }}
                          >
                            <Icon
                              className="w-3.5 h-3.5"
                              style={{ color: accent }}
                              strokeWidth={2}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-bold text-text truncate">
                              {e.reason}
                            </p>
                            <p className="text-[10.5px] text-muted mt-0.5">
                              {formatDateTime(e.created_at)}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div
                              className="font-serif tabular-nums leading-none flex items-center gap-0.5"
                              style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: accent,
                                letterSpacing: '-0.015em',
                              }}
                            >
                              {isEarn ? (
                                <ArrowUpRight
                                  className="w-3 h-3"
                                  strokeWidth={2.5}
                                />
                              ) : (
                                <ArrowDownRight
                                  className="w-3 h-3"
                                  strokeWidth={2.5}
                                />
                              )}
                              {isEarn ? '+' : ''}
                              {e.delta.toLocaleString()}P
                            </div>
                            <div className="text-[10px] text-muted mt-0.5 tabular-nums">
                              잔 {e.balance_after.toLocaleString()}P
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`
}
