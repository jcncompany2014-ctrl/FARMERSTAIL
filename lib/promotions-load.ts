/**
 * 이벤트 화면(/p/코드)이 '지금 열려 있나'를 서버에서 판정한다(2026-10-19 약국 봉투 QR).
 *
 * 예전 웹 설문(/start?p=)은 코드 **모양**만 봐서, 꺼진 코드·끝난 코드·인원이 찬 코드로도 화면이 열리고 가입 뒤 혜택이
 * 조용히 안 붙었다(손님은 할인을 기대했는데 정가). 이 함수는 행사표를 읽어 promotionGate(같은 순서의 순수 함수)로 판정한다.
 * 행사표는 손님이 못 읽게 잠겨 있어(규칙127) 관리자 권한으로 읽되, 돌려주는 값은 화면에 쓸 것뿐이다
 * (할인율·끝나는 날·선착순 인원 — 다른 코드나 남은 인원은 내보내지 않는다).
 * 조회 실패는 'error' — 열려 있다고 넘겨짚지 않는다(규칙1).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { promotionGate, promotionRate, type PromotionGate, type PromotionLike } from '@/lib/promotions'

export type EventPromo =
  | { state: 'open'; code: string; ratePct: number; maxDiscount: number | null; endsAt: string; maxSignups: number | null }
  | { state: 'closed'; code: string; reason: Exclude<PromotionGate, { open: true }>['reason'] }
  | { state: 'missing' }
  | { state: 'error' }

export async function loadEventPromo(code: string, now: Date = new Date()): Promise<EventPromo> {
  try {
    const admin = createAdminClient()
    const { data: p, error } = await admin
      .from('promotions')
      .select('id, code, discount_rate, max_discount_amount, starts_at, ends_at, max_signups, active')
      .eq('code', code)
      .maybeSingle()
    if (error) return { state: 'error' }
    if (!p) return { state: 'missing' }
    const { count, error: countErr } = await admin
      .from('promotion_claims')
      .select('user_id', { count: 'exact', head: true })
      .eq('promotion_id', p.id)
    if (countErr) return { state: 'error' }
    const like: PromotionLike = {
      code: String(p.code),
      discount_rate: Number(p.discount_rate),
      starts_at: String(p.starts_at),
      ends_at: String(p.ends_at),
      max_signups: p.max_signups == null ? null : Number(p.max_signups),
      active: !!p.active,
      max_discount_amount: p.max_discount_amount == null ? null : Number(p.max_discount_amount),
    }
    const gate = promotionGate(like, now, count ?? 0)
    if (!gate.open) return { state: 'closed', code: like.code, reason: gate.reason }
    const ratePct = Math.round(promotionRate(like) * 100)
    if (!(ratePct > 0)) return { state: 'closed', code: like.code, reason: 'inactive' }
    return { state: 'open', code: like.code, ratePct, maxDiscount: like.max_discount_amount ?? null, endsAt: like.ends_at, maxSignups: like.max_signups }
  } catch {
    return { state: 'error' }
  }
}

/**
 * 이 사람 계정에 저장된(아직 안 쓴) 이벤트 혜택 — 할인율 %와 최대 할인 금액(원, 없으면 null). 없거나 이미 썼거나 조회 실패면 null.
 * /start/done 의 loadPendingPromo 와 같은 판정(관리자 권한으로 읽되 범위는 호출부가 넘긴 본인 userId 로 묶는다, 규칙8).
 */
export type PendingPromo = { pct: number; maxDiscount: number | null }

export async function loadPendingPromo(userId: string): Promise<PendingPromo | null> {
  try {
    const admin = createAdminClient()
    const { data: claim, error: claimErr } = await admin
      .from('promotion_claims')
      .select('promotion_id, redeemed_order_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (claimErr || !claim || claim.redeemed_order_id) return null
    const { data: promo, error: promoErr } = await admin
      .from('promotions')
      .select('discount_rate, max_discount_amount')
      .eq('id', claim.promotion_id)
      .maybeSingle()
    if (promoErr || !promo) return null
    const pct = Math.round(Number(promo.discount_rate) * 100)
    if (!(pct > 0)) return null
    return { pct, maxDiscount: promo.max_discount_amount == null ? null : Number(promo.max_discount_amount) }
  } catch {
    return null
  }
}
