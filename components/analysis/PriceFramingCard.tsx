'use client'

/**
 * PriceFramingCard — 분석 결과 직후, 주문 CTA 바로 위 "가격 안심" 카드.
 *
 * 표시: "💚 한 끼 약 X원 (스타벅스 1잔보다 적어요)" + 하루/월 컨텍스트 +
 * 첫 박스 50% → 한 끼 Y원. 구매 의향이 가장 높은 순간(개인화 분석 직후)에
 * 가격 reassurance 를 주는 전환 레버.
 *
 * # 가격 출처
 * 모든 숫자는 lib/feeding-plan.ts 의 buildFeedingPlan 에서 나온다. 실제
 * 편집 지점은 그 파일의 HWASIK_KRW_PER_100G 하나(거기 주석 참고). 급여량(g)
 * 은 강아지 MER 에서 정확히 계산되므로 그 상수만 바꾸면 전부 맞춰진다.
 *
 * # 설계 (왜 슬림한가)
 * founder 가 2026-05-21 에 정리한 FeedingPlanCard(전체 식단 카드)의 SKU 사이즈·
 * 비율 슬라이더는 Magazine BoxMix 와 중복이라 제외하고, 가격 framing 만
 * 슬림하게 surface. (사용자 요청 2026-06-06: "가격 framing 만 켜기")
 */

import { useEffect, useState } from 'react'
import { Heart, Gift } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buildFeedingPlan } from '@/lib/feeding-plan'
import type { BudgetTier } from '@/lib/copy-strings'

type Props = {
  dogId: string
  dogName: string
  /** calculateNutrition.mer (일일 권장 kcal). */
  dailyMerKcal: number
}

export default function PriceFramingCard({
  dogId,
  dogName,
  dailyMerKcal,
}: Props) {
  const supabase = createClient()
  const [budgetTier, setBudgetTier] = useState<BudgetTier | null>(null)
  const [loading, setLoading] = useState(true)

  // 최신 survey 의 budget_tier 조회 (비교 anchor + 기본 mix 비율 결정).
  // budget_tier 는 generated types 에 아직 없어 cast (FeedingPlanCard 와 동일).
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
        /* null → 기본(5000_10000) 시나리오로 fallback */
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
    customRatio: null,
  })

  return (
    <section className="px-5 mt-5">
      <div className="rounded border border-rule bg-bg-3 p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted">
          Price · 한 끼 가격
        </p>

        {/* 한 끼 단가 + 비교 anchor — 💚 이모지 → lucide Heart(moss)로 교체
            (사장님 지시 2026-06-19: 나머지 lucide 아이콘과 통일). */}
        <p
          className="text-[16px] font-black text-ink mt-2 leading-snug flex items-start gap-1.5"
          style={{ letterSpacing: '-0.02em' }}
        >
          <Heart
            className="w-4 h-4 mt-0.5 shrink-0 text-moss"
            strokeWidth={2.2}
            fill="currentColor"
          />
          <span>{plan.copy.price_framing}</span>
        </p>
        <p className="text-[12px] text-muted mt-1">{plan.copy.daily_total}</p>

        {/* 첫 박스 50% — 🎁 이모지 → lucide Gift(terracotta)로 교체. */}
        <div className="mt-3 rounded border border-terracotta/30 bg-terracotta/10 p-3">
          <p
            className="text-[12px] text-ink leading-relaxed flex items-start gap-1.5"
            style={{ whiteSpace: 'pre-line' }}
          >
            <Gift
              className="w-3.5 h-3.5 mt-0.5 shrink-0 text-terracotta"
              strokeWidth={2.2}
            />
            <span>{plan.copy.first_box_offer}</span>
          </p>
        </div>
      </div>
    </section>
  )
}
