'use client'

/**
 * PlanClient — 상품(플랜) 페이지 본체 (2026-07-13 사장님, 목업 2회 확정).
 *
 * TFD "Build a Plan" 구조 + 우리 차별점(알고리즘 임상 안전성):
 *  - 알고리즘 추천 레시피 "★ 추천" + 미리 담김, 사용자는 최대 2종까지 자유 선택.
 *  - 알레르기 차단 라인은 잠금(선택 불가) — "안전한 것만 추천" 가시화.
 *  - 화식 비율(곁들임 30 / 반반 60 / 완전 100) + 첫박스 할인 결제 바.
 *
 * # Phase 1 (현재)
 *  - 실제 데이터 렌더 + 선택(최대 2·잠금) + 화식 비율 + 대표 가격 계산.
 *  - CTA → /order (주소·결제). 선택 레시피 handoff(formula 저장)는 후속 Phase.
 *  - 카드 재료줄은 benefit 로 대체 — 전체 재료 목록 데이터는 후속.
 */

import { useState, type CSSProperties } from 'react'
import { ArrowRight, Check, Plus, Lock, AlertTriangle } from 'lucide-react'
import { petName } from '@/lib/korean'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import { LINE_TO_SLUG } from '@/lib/personalization/skuMap'
import { snapBoxLines } from '@/lib/personalization/boxComposition'
import type { Formula, FoodLine } from '@/lib/personalization/types'

export type PlanProduct = {
  slug: string
  price: number
  sale_price: number | null
  stock: number
  is_subscribable: boolean | null
}

const FRESH_TIERS = [
  { value: 30 as const, label: '곁들임', sub: '화식 30% · 건사료 70%' },
  { value: 60 as const, label: '반반', sub: '화식 60% · 건사료 40%' },
  { value: 100 as const, label: '완전 화식', sub: '화식 100%' },
]
type FreshRatio = (typeof FRESH_TIERS)[number]['value']

const MAX_RECIPES = 2

export default function PlanClient({
  dogId,
  dogName,
  formula,
  products,
  initialFresh,
}: {
  dogId: string
  dogName: string
  formula: Formula | null
  products: Record<string, PlanProduct>
  initialFresh: number
}) {
  const [freshRatio, setFreshRatio] = useState<FreshRatio>(
    initialFresh === 60 ? 60 : initialFresh === 100 ? 100 : 30,
  )

  // 추천 = snapBoxLines(임상 비율) 상위 ≤2종. 잠금 = 알레르기 차단 라인.
  const recommended = new Set<FoodLine>(
    formula ? snapBoxLines(formula.lineRatios).map((x) => x.line) : [],
  )
  const blocked = new Set<FoodLine>()
  if (formula) {
    for (const r of formula.reasoning) {
      const m = r.ruleId.match(
        /^(?:next-)?allergy-(basic|weight|skin|premium|joint)$/,
      )
      if (m) blocked.add(m[1] as FoodLine)
    }
  }

  const [selected, setSelected] = useState<Set<FoodLine>>(
    () => new Set(recommended),
  )

  function toggle(line: FoodLine) {
    if (blocked.has(line)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(line)) {
        if (next.size > 1) next.delete(line) // 최소 1종 유지
      } else if (next.size < MAX_RECIPES) {
        next.add(line)
      }
      return next
    })
  }

  // 대표 일일 가격 — 선택 라인 50:50(2종)/100%(1종) × 화식 비율. 첫 박스 50% 할인.
  const freshFactor = freshRatio / 100
  const perLineRatio = selected.size === 2 ? 0.5 : 1
  let dailyRegular = 0
  if (formula) {
    for (const line of selected) {
      const slug = LINE_TO_SLUG[line]
      const product = slug ? products[slug] : undefined
      if (!product) continue
      const kcalPer100g = FOOD_LINE_META[line].kcalPer100g
      const dailyG =
        ((perLineRatio * formula.dailyKcal) / kcalPer100g) * 100 * freshFactor
      const unitPrice = product.sale_price ?? product.price // 100g 단가
      dailyRegular += (dailyG / 100) * unitPrice
    }
  }
  const dailyRegularR = Math.round(dailyRegular / 10) * 10
  const dailyFirst = Math.round((dailyRegular * 0.5) / 10) * 10

  if (!formula) {
    return (
      <div className="px-5 py-16 text-center">
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
          아직 맞춤 결과가 없어요
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 16px' }}>
          분석을 먼저 받으면 {petName(dogName)}에게 맞는 레시피를 추천해 드려요.
        </p>
        <a
          href={`/dogs/${dogId}/analysis`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '10px 18px',
            background: 'var(--terracotta)',
            color: '#fff',
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          분석 보러가기 <ArrowRight size={13} strokeWidth={2.4} />
        </a>
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 14px 96px', position: 'relative' }}>
      {/* 스텝 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--muted)',
        }}
      >
        <span style={{ color: 'var(--terracotta)' }}>① 레시피</span>
        <span style={{ width: 14, height: 1, background: 'var(--rule)' }} />
        <span>② 배송</span>
        <span style={{ width: 14, height: 1, background: 'var(--rule)' }} />
        <span>③ 결제</span>
      </div>

      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '.2em',
            color: 'var(--terracotta)',
          }}
        >
          MADE FOR {dogName.toUpperCase()}
        </div>
        <h1
          style={{
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginTop: 3,
            color: 'var(--ink)',
          }}
        >
          이 레시피로 시작해요
        </h1>
      </div>

      {/* 신뢰 칩 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 5,
          marginTop: 11,
          flexWrap: 'wrap',
        }}
      >
        {['수의영양학', 'AAFCO 충족', '사람도 먹는 등급'].map((t) => (
          <span
            key={t}
            style={{
              fontSize: 9.5,
              color: 'var(--moss, #4f6a48)',
              background: 'color-mix(in srgb, var(--moss, #4f6a48) 9%, transparent)',
              padding: '3px 8px',
              borderRadius: 99,
              fontWeight: 600,
            }}
          >
            {t}
          </span>
        ))}
      </div>

      {/* 레시피 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 18,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
          레시피 고르기
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
          담김{' '}
          <b style={{ color: 'var(--terracotta)' }}>{selected.size}</b> / 최대{' '}
          {MAX_RECIPES}
        </span>
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--muted)',
          marginTop: 3,
          lineHeight: 1.45,
        }}
      >
        추천은 미리 담아뒀어요. 아래는 모두 안전하게 급여할 수 있어요.
      </div>

      {/* 레시피 카드 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 11 }}>
        {ALL_LINES.map((line) => {
          const meta = FOOD_LINE_META[line]
          const isBlocked = blocked.has(line)
          const isRec = recommended.has(line)
          const isSel = selected.has(line)
          const color = meta.color

          if (isBlocked) {
            return (
              <div
                key={line}
                style={{
                  background: 'var(--bg-2)',
                  border: '1px dashed var(--rule)',
                  borderRadius: 14,
                  padding: 12,
                  opacity: 0.85,
                }}
              >
                <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                  <div style={circle('rgba(120,120,120,.1)', undefined)}>
                    <Lock size={22} strokeWidth={2} color="var(--muted)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>
                      {meta.name}
                    </div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 10,
                        color: 'var(--terracotta)',
                        fontWeight: 700,
                        marginTop: 5,
                        background:
                          'color-mix(in srgb, var(--terracotta) 8%, transparent)',
                        padding: '3px 8px',
                        borderRadius: 99,
                      }}
                    >
                      <AlertTriangle size={12} strokeWidth={2.2} />
                      알레르기로 제외했어요
                    </span>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <button
              key={line}
              type="button"
              onClick={() => toggle(line)}
              style={{
                appearance: 'none',
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: 'var(--surface-card-elevated, #fff)',
                border: isRec
                  ? '2px solid var(--terracotta)'
                  : '1px solid var(--rule)',
                borderRadius: 14,
                padding: isRec ? 11 : 12,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {isRec && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#fff',
                    background: 'var(--moss, #4f6a48)',
                    padding: '3px 10px',
                    borderBottomLeftRadius: 10,
                  }}
                >
                  ★ 추천
                </span>
              )}
              <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                <div style={circle(`color-mix(in srgb, ${color} 13%, transparent)`, color)}>
                  <span style={{ fontSize: 24 }} aria-hidden>
                    🍲
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                    {meta.name} · {meta.subtitle}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--muted)',
                      marginTop: 3,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {meta.benefit}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--rule)',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--terracotta)', fontWeight: 600 }}>
                  재료 전체 · 영양성분
                </span>
                {isSel ? (
                  <span style={pill(true)}>
                    <Check size={15} strokeWidth={2.4} />
                    담김
                  </span>
                ) : (
                  <span style={pill(false)}>
                    <Plus size={14} strokeWidth={2.4} />
                    담기
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* 화식 비율 */}
      <div
        style={{
          marginTop: 16,
          background: 'var(--surface-card-elevated, #fff)',
          border: '1px solid var(--rule)',
          borderRadius: 14,
          padding: 13,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
          얼마나 화식으로 드릴까요?
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
          {FRESH_TIERS.map((t) => {
            const on = freshRatio === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setFreshRatio(t.value)}
                style={{
                  flex: 1,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'center',
                  border: on
                    ? '2px solid var(--terracotta)'
                    : '1px solid var(--rule)',
                  background: on
                    ? 'color-mix(in srgb, var(--terracotta) 5%, transparent)'
                    : 'transparent',
                  borderRadius: 11,
                  padding: on ? '8px 4px' : '9px 4px',
                }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
                  {t.label}
                </div>
                <div
                  style={{
                    fontSize: 8.5,
                    color: on ? 'var(--terracotta)' : 'var(--muted)',
                    fontWeight: 600,
                    marginTop: 3,
                    lineHeight: 1.3,
                  }}
                >
                  {t.sub}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 결제 바 (다크) */}
      <div
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 12,
          maxWidth: 412,
          margin: '0 auto',
          background: 'var(--ink)',
          borderRadius: 16,
          padding: '12px 15px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          zIndex: 40,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            첫 박스 · 2주마다 배송 · 언제든 해지
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            {dailyRegularR > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  textDecoration: 'line-through',
                }}
              >
                {dailyRegularR.toLocaleString()}원
              </span>
            )}
            <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>
              {dailyFirst.toLocaleString()}원
              <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
                /일
              </span>
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--ink)',
                background: '#E8B84B',
                padding: '2px 6px',
                borderRadius: 99,
              }}
            >
              50% OFF
            </span>
          </div>
        </div>
        <a
          href={`/dogs/${dogId}/order?fresh=${freshRatio}&recipes=${[...selected].join(',')}`}
          style={{
            border: 'none',
            background: 'var(--terracotta)',
            color: '#fff',
            borderRadius: 99,
            padding: '12px 18px',
            fontSize: 13.5,
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          플랜 담기 <ArrowRight size={15} strokeWidth={2.4} color="#fff" />
        </a>
      </div>
    </div>
  )
}

function circle(bg: string, ring?: string): React.CSSProperties {
  return {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: bg,
    boxShadow: ring
      ? `0 0 0 1px color-mix(in srgb, ${ring} 22%, transparent)`
      : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  }
}

function pill(selected: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12.5,
    fontWeight: 700,
    color: selected ? 'var(--terracotta)' : 'var(--ink)',
    background: selected
      ? 'color-mix(in srgb, var(--terracotta) 9%, transparent)'
      : 'transparent',
    border: selected ? 'none' : '1px solid var(--rule)',
    padding: '6px 14px',
    borderRadius: 99,
  }
}
