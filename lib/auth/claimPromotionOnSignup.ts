/**
 * 가입 직후 프로모션을 계정에 박는다 (2026-07-16).
 *
 * `/start?p=busan1102` 로 들어온 사람은 초안(lib/autosignup-draft)에 코드가 실려 있다.
 * 첫 로그인 시 이 함수가 그 코드를 `claim_promotion` RPC 로 계정에 박는다.
 * **여기서부터는 브라우저를 지워도, 앱을 깔아도 따라온다** — 권리가 계정에 있으니까.
 *
 * # ⚠️ 초안 이관과 **분리**한다
 * applyAutosignupDraft 안에 넣으면, 설문을 덜 채운 사람(isDogDraftComplete=false)은
 * **프로모션까지 같이 잃는다.** 부스에서 QR 찍고 설문을 반만 하다 가입한 사람이
 * 정확히 그 경우다 — 할인은 약속했는데 못 받는다. 그래서 초안 완성 여부와 무관하게
 * **가입했으면 무조건** 시도한다.
 *
 * # 실패해도 로그인을 막지 않는다
 * 프로모션은 부가 혜택이다. RPC 가 실패하거나 이미 받았거나 마감이어도 조용히
 * 넘어간다 — 여기서 throw 하면 **가입이 통째로 깨진다.**
 *
 * # 계정당 1회
 * DB(promotion_claims.user_id unique)가 강제한다. 여러 링크를 타고 와도 먼저 박힌 것 하나.
 */
import { createClient } from '@/lib/supabase/client'
import { loadAutosignupDraft } from '@/lib/autosignup-draft'
import { normalizePromoCode } from '@/lib/promotions'

export type ClaimResult =
  | { claimed: true; rate: number; name: string }
  | { claimed: false }

/**
 * 초안에 실린 프로모션 코드를 계정에 박는다.
 * @returns 성공 시 할인율·이벤트명 (환영 문구에 쓸 수 있게). 그 외 { claimed: false }.
 */
export async function claimPromotionOnSignup(): Promise<ClaimResult> {
  const code = normalizePromoCode(loadAutosignupDraft()?.promo)
  if (!code) return { claimed: false }

  try {
    const supabase = createClient()
    const { data, error } = await (
      supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{
          data: Array<{ ok: boolean; rate: number; promo_name: string }> | null
          error: unknown
        }>
      }
    ).rpc('claim_promotion', { p_code: code })

    if (error) return { claimed: false }
    const row = data?.[0]
    if (!row?.ok) return { claimed: false }
    return { claimed: true, rate: Number(row.rate), name: row.promo_name }
  } catch {
    // 네트워크·권한 등 — 로그인을 막지 않는다.
    return { claimed: false }
  }
}
