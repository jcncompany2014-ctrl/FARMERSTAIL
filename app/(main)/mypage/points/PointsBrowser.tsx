'use client'

/**
 * PointsBrowser — v3 reskin (2026-05-22 R9-4).
 *
 * 필터 탭 (전체/적립/사용) + 월별 그룹 ledger.
 * v3 톤: paperHi 카드 + ink rule + Mono kicker + sage/accent 정/부호.
 */

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
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'
import { Mono, Tabs } from '@/components/v3'

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
 * reference_type 별 적절한 아이콘.
 */
function iconFor(refType: string | null, isEarn: boolean) {
  if (!refType) return isEarn ? Coins : RotateCcw
  if (refType === 'order') return ShoppingBag
  if (refType === 'order_refund') return RotateCcw
  if (refType === 'order_refund_credit') return RotateCcw
  if (refType === 'order_refund_revoke') return RotateCcw
  if (refType === 'order_expire') return RotateCcw
  if (refType === 'review') return Star
  if (refType === 'referral') return UserPlus
  if (refType === 'birthday') return Cake
  if (refType.startsWith('coupon')) return Gift
  return Coins
}

export default function PointsBrowser({ entries }: { entries: Entry[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return entries
    if (filter === 'earn') return entries.filter((e) => e.delta > 0)
    return entries.filter((e) => e.delta < 0)
  }, [entries, filter])

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
      {/* filter 탭 — v3 Tabs primitive */}
      <section style={{ padding: '16px 20px 0' }}>
        <Tabs
          value={filter}
          onChange={(k) => setFilter(k as FilterKey)}
          options={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        />
      </section>

      {/* 월별 그룹 */}
      <section style={{ padding: '12px 20px 0' }}>
        {filtered.length === 0 ? (
          <div
            className="text-center"
            style={{
              borderRadius: V3Radius.sm,
              border: `1.5px dashed ${V3.rule}`,
              padding: '48px 20px',
              background: V3.paperHi,
            }}
          >
            <div
              className="mx-auto flex items-center justify-center"
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                marginBottom: 12,
              }}
            >
              <Coins size={24} color={V3.inkMute} strokeWidth={1.3} />
            </div>
            <Mono color="inkMute" size="xxs" weight={600}>
              Empty
            </Mono>
            <h3
              style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.black,
                fontSize: 16,
                color: V3.ink,
                letterSpacing: '-0.02em',
              }}
            >
              {filter === 'earn'
                ? '적립 내역이 없어요'
                : filter === 'use'
                  ? '사용 내역이 없어요'
                  : '아직 포인트 내역이 없어요'}
            </h3>
            <p
              style={{
                fontSize: 10.5,
                color: V3.inkMute,
                marginTop: 6,
              }}
            >
              리뷰·주문·친구 초대로 포인트를 적립해보세요
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: 8, paddingLeft: 4, paddingRight: 4 }}
                  >
                    <div className="flex items-center" style={{ gap: 6 }}>
                      <Calendar size={11} color={V3.inkMute} strokeWidth={2} />
                      <Mono color="ink" size="xxs" weight={700}>
                        {month.replace('.', '년 ')}월
                      </Mono>
                    </div>
                    <div
                      className="flex items-center tabular-nums"
                      style={{ gap: 8, fontSize: 10.5, fontWeight: V3FontWeight.bold }}
                    >
                      {groupEarn > 0 && (
                        <span style={{ color: V3.sage }}>
                          +{groupEarn.toLocaleString()}
                        </span>
                      )}
                      {groupUse > 0 && (
                        <span style={{ color: V3.accent }}>
                          −{groupUse.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 카드 list */}
                  <ul
                    className="overflow-hidden"
                    style={{
                      background: V3.paperHi,
                      border: `1px solid ${V3.rule}`,
                      borderRadius: V3Radius.sm,
                      margin: 0,
                      padding: 0,
                      listStyle: 'none',
                    }}
                  >
                    {items.map((e, i) => {
                      const isEarn = e.delta > 0
                      const Icon = iconFor(e.reference_type, isEarn)
                      const accent = isEarn ? V3.sage : V3.accent
                      return (
                        <li
                          key={e.id}
                          className="flex items-center"
                          style={{
                            gap: 12,
                            padding: '12px 14px',
                            borderBottom:
                              i < items.length - 1
                                ? `1px solid ${V3.rule}`
                                : 'none',
                          }}
                        >
                          <div
                            className="shrink-0 flex items-center justify-center"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              background: `color-mix(in srgb, ${accent} 14%, ${V3.paperHi})`,
                              border: `1px solid ${V3.rule}`,
                            }}
                          >
                            <Icon size={14} color={accent} strokeWidth={2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="truncate"
                              style={{
                                margin: 0,
                                fontFamily: 'var(--font-sans)',
                                fontSize: 12,
                                fontWeight: V3FontWeight.bold,
                                color: V3.ink,
                                letterSpacing: '-0.01em',
                              }}
                            >
                              {e.reason}
                            </p>
                            <Mono
                              color="inkMute"
                              size="xxs"
                              weight={500}
                              letterSpacing="0.06em"
                              style={{ marginTop: 3, display: 'inline-block' }}
                            >
                              {formatDateTime(e.created_at)}
                            </Mono>
                          </div>
                          <div className="text-right shrink-0">
                            <div
                              className="tabular-nums flex items-center"
                              style={{
                                gap: 2,
                                fontFamily: 'var(--font-sans)',
                                fontSize: 13.5,
                                fontWeight: V3FontWeight.black,
                                color: accent,
                                letterSpacing: '-0.02em',
                                lineHeight: 1,
                              }}
                            >
                              {isEarn ? (
                                <ArrowUpRight size={12} strokeWidth={2.5} />
                              ) : (
                                <ArrowDownRight size={12} strokeWidth={2.5} />
                              )}
                              {isEarn ? '+' : ''}
                              {e.delta.toLocaleString()}P
                            </div>
                            <Mono
                              color="inkMute"
                              size="xxs"
                              weight={500}
                              letterSpacing="0.04em"
                              style={{ marginTop: 4, display: 'inline-block' }}
                            >
                              잔 {e.balance_after.toLocaleString()}P
                            </Mono>
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
