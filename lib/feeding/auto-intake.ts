/**
 * 자체 사료 배송 무게 자동 추적 — 발명 모듈 A 핵심 차별화.
 *
 * # 배경
 * 일반 견주의 급여량 자가 측정은 계량컵(±15%) 또는 눈대중(±25%) 오차가 있다.
 * 파머스테일은 자체 사료 D2C — 매 박스 정확한 그램수가 `products.net_weight_g`
 * 에 저장. 결제 완료된 주문의 `order_items.quantity × net_weight_g` 합산을
 * 기간(예: 30일)으로 나누면 견주가 별도 측정 없이도 평균 일일 급여량을
 * 자동 산출 가능. 신뢰도 1.0 (FEED_METHOD_SCORE.auto_delivery).
 *
 * # 본 모듈의 역할
 * `supabase/migrations/20260513000000_feed_intake_history.sql` 의 두 RPC
 * (`avg_daily_feed_grams`, `feed_intake_history`) 를 호출하는 type-safe
 * wrapper. 호출 실패 시 0 / [] 안전 fallback — UI 가 깨지지 않게.
 *
 * # 사용처
 * - `app/(main)/dashboard/page.tsx` — active 구독자에게 자동 측정 chip 노출
 * - `lib/personalization/reliability.ts` 의 feedReliability() — method
 *   'auto_delivery' 처리에 사용 (이미 통합됨, dashboard line 418-422)
 *
 * # voice-guidelines §1
 * "신뢰도" 단어 X. UI 노출 카피는 "자동 측정" / "정확 추적" 등 사용.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

type DbClient = SupabaseClient<Database>

/**
 * 지정 기간 평균 일일 사료 급여량 (g). 기본 30일 윈도우.
 *
 * RPC `avg_daily_feed_grams(p_user_id, p_window_days)` 호출. 결제 완료된
 * 주문 중 `paid_at >= NOW() - window_days` 범위의 사료 총 그램수를 일수로
 * 나눔. 활성 구독 없는 사용자(주문 없음)는 0 반환.
 *
 * @param supabase - server / route handler 의 supabase client
 * @param userId - auth.users.id (uuid)
 * @param windowDays - 평균 산출 기간 (1~365). 기본 30일.
 * @returns 평균 일일 g (소수 1자리 반올림). 실패 시 null.
 */
export async function getAvgDailyFeedG(
  supabase: DbClient,
  userId: string,
  windowDays = 30,
): Promise<number | null> {
  if (!userId) return null
  const days = Math.max(1, Math.min(windowDays, 365))
  try {
    const { data, error } = await supabase.rpc('avg_daily_feed_grams', {
      p_user_id: userId,
      p_window_days: days,
    })
    if (error) return null
    if (typeof data !== 'number' && typeof data !== 'string') return null
    const n = typeof data === 'string' ? Number.parseFloat(data) : data
    if (!Number.isFinite(n) || n <= 0) return null
    return Math.round(n * 10) / 10
  } catch {
    return null
  }
}

/**
 * 일자별 결제·배송 기반 사료 그램수 시계열. UI 의 sparkline / chart 용.
 *
 * RPC `feed_intake_history(p_user_id)` 호출. 결제 완료된 모든 주문을
 * paid_at (KST) 기준 일자별로 grouping. 최신 일자부터 desc 정렬.
 *
 * @returns [{date, totalGrams, productCount}]. 실패 시 [].
 */
export async function getFeedIntakeTimeline(
  supabase: DbClient,
  userId: string,
): Promise<
  Array<{ date: string; totalGrams: number; productCount: number }>
> {
  if (!userId) return []
  try {
    const { data, error } = await supabase.rpc('feed_intake_history', {
      p_user_id: userId,
    })
    if (error || !Array.isArray(data)) return []
    return data
      .map((row) => {
        const r = row as {
          paid_date?: string | null
          total_grams?: number | string | null
          product_count?: number | null
        }
        const date = r.paid_date ?? ''
        const totalGrams =
          typeof r.total_grams === 'string'
            ? Number.parseInt(r.total_grams, 10)
            : (r.total_grams ?? 0)
        const productCount = r.product_count ?? 0
        return {
          date,
          totalGrams: Number.isFinite(totalGrams) ? totalGrams : 0,
          productCount,
        }
      })
      .filter((r) => r.date && r.totalGrams > 0)
  } catch {
    return []
  }
}

/**
 * 자동 측정 사용자 노출 라벨 — voice-guidelines §1 ("신뢰도" 단어 금지) 준수.
 * "자동 측정 평균 185g/일" 같은 한 줄 카피 생성.
 *
 * @param avgG - getAvgDailyFeedG() 결과
 * @param windowDays - 기간 (라벨에 노출 — "최근 30일")
 */
export function formatAutoIntakeLabel(
  avgG: number | null,
  windowDays = 30,
): string | null {
  if (avgG == null || avgG <= 0) return null
  return `최근 ${windowDays}일 자동 측정 평균 ${avgG.toFixed(1)}g/일`
}
