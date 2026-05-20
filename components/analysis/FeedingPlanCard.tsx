'use client'

/**
 * Farmer's Tail — Feeding Plan Card (Tier S F3-4 + F3-7, 2026-05-20)
 *
 * 분석 페이지의 핵심 카드. 가격 framing + SKU 매핑 + 비율 슬라이더 통합.
 *
 * # 표시 흐름 (4단계)
 *  1. 기본 추천 (default 시나리오 — 설문 예산 응답 기반)
 *  2. 한 끼 가격 + 비교 anchor (스타벅스/김밥)
 *  3. 1팩 SKU 사이즈 + 매 끼 분량
 *  4. 비율 슬라이더 (30/50/70/100%) — 사용자 직접 조정
 *  + 첫 박스 50% off CTA
 *  + 대형견 콤보 안내 (자동)
 *  + Bexley 경고·만성질환 가이드 (props로 받음)
 *
 * # 디자인 원칙
 *  - 총 가격 절대 X (월 30만원 같은 표기 금지)
 *  - 한 끼 단가 + 일상 비교 (스타벅스 1잔)
 *  - 슬라이더는 30-100% (사용자 보호 — 30% 미만 영양 균형 깨짐)
 *  - 모든 카피는 lib/copy-strings.ts
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildFeedingPlan } from '@/lib/feeding-plan'
import { SCENARIO_HWASIK_RATIO } from '@/lib/mix-feeding'
import { ANALYSIS_COPY } from '@/lib/copy-strings'
import type { BudgetTier } from '@/lib/copy-strings'

type Props = {
  dogId: string
  dogName: string
  dailyMerKcal: number
}

export default function FeedingPlanCard({ dogId, dogName, dailyMerKcal }: Props) {
  const supabase = createClient()
  const [budgetTier, setBudgetTier] = useState<BudgetTier | null>(null)
  const [customRatio, setCustomRatio] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // 최신 survey의 budget_tier 조회
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await (
          supabase.from('surveys') as unknown as {
            select: (cols: string) => {
              eq: (c: string, v: string) => {
                order: (c: string, o: { ascending: boolean }) => {
                  limit: (n: number) => {
                    maybeSingle: () => Promise<{
                      data: { budget_tier: BudgetTier | null } | null
                    }>
                  }
                }
              }
            }
          }
        )
          .select('budget_tier')
          .eq('dog_id', dogId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (!cancelled) setBudgetTier(data?.budget_tier ?? null)
      } catch {
        /* fallback to null → mix50 default */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, supabase])

  if (loading) return null

  const plan = buildFeedingPlan({
    dogName,
    dailyMerKcal,
    budgetTier,
    customRatio,
  })

  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--rule)',
        borderRadius: 16,
        padding: '20px 18px',
        marginTop: 16,
      }}
    >
      {/* Header — Mix default 카피 */}
      <div style={{ marginBottom: 16 }}>
        <div
          className="kicker"
          style={{ marginBottom: 8, color: 'var(--terracotta)' }}
        >
          MEAL PLAN · 맞춤 식단
        </div>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            whiteSpace: 'pre-line',
            color: 'var(--ink)',
            margin: 0,
          }}
        >
          {plan.copy.mix_default}
        </p>
      </div>

      {/* Price framing — 한 끼 + 비교 anchor */}
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--bg)',
          borderRadius: 12,
          marginBottom: 12,
          border: '1px solid var(--rule)',
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            marginBottom: 4,
          }}
        >
          {plan.copy.price_framing}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          {plan.copy.daily_total}
        </div>
      </div>

      {/* SKU 매핑 */}
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--bg)',
          borderRadius: 12,
          marginBottom: 12,
          border: '1px solid var(--rule)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          📦 1팩 사이즈
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-line' }}>
          {plan.copy.sku_recommendation}
        </div>
        {plan.copy.combo_note && (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px dashed var(--rule)',
              fontSize: 12,
              color: 'var(--muted)',
              whiteSpace: 'pre-line',
            }}
          >
            {plan.copy.combo_note}
          </div>
        )}
      </div>

      {/* Over-budget hint (예산 응답이 권장량 대비 너무 큼) */}
      {plan.copy.over_budget_hint && (
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(212, 169, 74, 0.1)',
            borderRadius: 10,
            marginBottom: 12,
            fontSize: 12,
            color: 'var(--ink)',
            whiteSpace: 'pre-line',
            border: '1px solid rgba(212, 169, 74, 0.3)',
          }}
        >
          {plan.copy.over_budget_hint}
        </div>
      )}

      {/* First box 50% off CTA */}
      <div
        style={{
          padding: '14px 16px',
          background: 'var(--terracotta)',
          color: 'white',
          borderRadius: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {plan.copy.first_box_offer}
        </div>
      </div>

      {/* 비율 슬라이더 — 4 option */}
      <details style={{ marginTop: 8 }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--muted)',
            padding: '8px 0',
            listStyle: 'none',
            userSelect: 'none',
          }}
        >
          {ANALYSIS_COPY.slider_label}
        </summary>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            marginTop: 10,
          }}
        >
          {(
            [
              ['topper', 30, ANALYSIS_COPY.slider_options[30]],
              ['mix50', 50, ANALYSIS_COPY.slider_options[50]],
              ['mix70', 70, ANALYSIS_COPY.slider_options[70]],
              ['full', 100, ANALYSIS_COPY.slider_options[100]],
            ] as const
          ).map(([key, pct, label]) => {
            const ratio = SCENARIO_HWASIK_RATIO[key]
            const isSelected =
              customRatio !== null
                ? Math.abs(customRatio - ratio) < 0.01
                : key === plan.scenario
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCustomRatio(ratio)}
                style={{
                  padding: '10px 12px',
                  background: isSelected ? 'var(--ink)' : 'var(--bg)',
                  color: isSelected ? 'var(--bg)' : 'var(--ink)',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--ink)' : 'var(--rule)',
                  borderRadius: 10,
                  fontSize: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontWeight: 700 }}>{pct}%</span> · {label}
              </button>
            )
          })}
        </div>
      </details>
    </div>
  )
}
