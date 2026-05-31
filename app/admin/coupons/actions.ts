'use server'

/**
 * R101-J (D7): admin 쿠폰 CRUD server action.
 *
 * 이전엔 AdminCouponsClient 가 브라우저 anon 클라이언트로 coupons 를 직접
 * insert/update/delete 했다. coupons RLS 가 is_admin() 게이트라 권한은 막혔지만,
 * `/api/admin/` 을 거치지 않아 recordAdminAction 이 한 번도 호출되지 않아 매출
 * 직결 액션(쿠폰 발급/삭제)의 감사 로그가 통째로 비어 있었다.
 *
 * 이 server action 들은 동일 로직(같은 RLS 통과)에 isAdmin() 명시 가드 +
 * recordAdminAction 을 더한다. 회귀 위험 최소 — DML 자체는 그대로.
 */

import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { recordAdminAction } from '@/lib/admin-audit'

type ActionResult = { ok: boolean; error?: string }

export type CouponCreateInput = {
  code: string
  name: string
  description: string | null
  discountType: 'percent' | 'fixed'
  discountValue: number
  minOrderAmount: number
  maxDiscount: number | null
  expiresAt: string | null
  usageLimit: number | null
  perUserLimit: number | null
  audienceType: string
}

export async function createCouponAction(
  input: CouponCreateInput,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user))) {
    return { ok: false, error: '관리자 권한이 필요합니다' }
  }

  const { error } = await supabase.from('coupons').insert({
    code: input.code,
    name: input.name,
    description: input.description,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    min_order_amount: input.minOrderAmount,
    max_discount: input.maxDiscount,
    expires_at: input.expiresAt,
    usage_limit: input.usageLimit,
    per_user_limit: input.perUserLimit,
    is_active: true,
    audience_type: input.audienceType,
  })
  if (error) return { ok: false, error: error.message }

  await recordAdminAction(supabase, {
    action: 'coupon_create',
    entityType: 'coupon',
    entityId: input.code,
    diff: {
      after: {
        code: input.code,
        name: input.name,
        discountType: input.discountType,
        discountValue: input.discountValue,
        audienceType: input.audienceType,
      },
    },
  })
  return { ok: true }
}

export async function toggleCouponActiveAction(
  id: string,
  nextActive: boolean,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user))) {
    return { ok: false, error: '관리자 권한이 필요합니다' }
  }

  const { error } = await supabase
    .from('coupons')
    .update({ is_active: nextActive })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  await recordAdminAction(supabase, {
    action: 'coupon_update',
    entityType: 'coupon',
    entityId: id,
    diff: { after: { is_active: nextActive } },
  })
  return { ok: true }
}

export async function deleteCouponAction(
  id: string,
  name: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await isAdmin(supabase, user))) {
    return { ok: false, error: '관리자 권한이 필요합니다' }
  }

  const { error } = await supabase.from('coupons').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  await recordAdminAction(supabase, {
    action: 'coupon_revoke',
    entityType: 'coupon',
    entityId: id,
    diff: { meta: { name, deleted: true } },
  })
  return { ok: true }
}
