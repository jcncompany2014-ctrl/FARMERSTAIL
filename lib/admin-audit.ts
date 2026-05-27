/**
 * admin_audit_log 기록 helper.
 *
 * 호출 패턴:
 *
 *   await recordAdminAction(supabase, {
 *     action: 'product_update',
 *     entityType: 'product',
 *     entityId: product.id,
 *     diff: { before: { price: 30000 }, after: { price: 28000 } },
 *     req, // optional — IP / UA 자동 추출
 *   })
 *
 * 실패 정책: insert 실패해도 caller 의 본 로직은 막지 않음. console.warn 으로
 * 만 기록. audit 누락보다 사용자 액션 실패가 더 큰 문제 (예: 환불 진행 중에
 * audit insert 실패로 전체 막히면 안 됨).
 *
 * 호출 위치는 항상 admin 인증 검증 *직후* — `requireAdmin()` 같은 가드 통과
 * 후에. RLS 가 actor_user_id = auth.uid() 강제하지만 service_role 클라이언트
 * 에선 우회 가능하므로 application 측 검증이 1차 방어선.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminAuditAction =
  // Product
  | 'product_create'
  | 'product_update'
  | 'product_delete'
  | 'product_publish'
  | 'product_unpublish'
  | 'product_price_adjust'
  | 'product_stock_adjust'
  // Order
  | 'order_status_change'
  | 'order_cancel'
  | 'order_refund'
  | 'order_partial_refund'
  | 'order_address_change'
  // User
  | 'user_suspend'
  | 'user_unsuspend'
  | 'user_role_change'
  | 'user_delete'
  | 'user_points_adjust'
  | 'user_coupon_grant'
  // Subscription
  | 'subscription_pause'
  | 'subscription_resume'
  | 'subscription_cancel'
  | 'subscription_address_change'
  // Coupon
  | 'coupon_create'
  | 'coupon_update'
  | 'coupon_revoke'
  // Cohort
  | 'cohort_add'
  | 'cohort_remove'
  // CMS
  | 'blog_post_publish'
  | 'blog_post_unpublish'
  | 'faq_publish'
  | 'event_publish'
  // System
  | 'admin_login'
  | 'admin_password_change'
  | 'admin_data_export'
  // Catch-all
  | (string & {})

export type AdminAuditEntityType =
  | 'product'
  | 'order'
  | 'user'
  | 'subscription'
  | 'coupon'
  | 'cohort'
  | 'blog_post'
  | 'faq'
  | 'event'
  | 'system'
  | (string & {})

export interface AdminAuditInput {
  action: AdminAuditAction
  entityType: AdminAuditEntityType
  /** entity의 PK. uuid, slug, id 다 OK. null 가능 (시스템 액션). */
  entityId?: string | null
  /**
   * 변경 내용. { before: {...}, after: {...}, meta: {...} } 권장.
   * 전체 row 저장 금지 — 변경된 필드만 추출 (PII 최소화).
   */
  diff?: Record<string, unknown>
  /** 선택 — Request 객체. IP / UA 자동 추출. */
  req?: Request
}

/**
 * admin 액션 기록. caller 는 미리 admin 권한을 검증해야 함.
 */
export async function recordAdminAction(
  supabase: SupabaseClient,
  input: AdminAuditInput,
): Promise<void> {
  try {
    const { data: userRes } = await supabase.auth.getUser()
    const actorUserId = userRes.user?.id
    if (!actorUserId) {
      // 로그인 안 된 상태에서 호출 — caller 책임. fail silently 로 본 흐름 보존.
      console.warn(
        `[admin-audit] no actor — action=${input.action} entity=${input.entityType}/${input.entityId ?? 'null'}`,
      )
      return
    }

    const ip = input.req ? extractIp(input.req) : null
    const userAgent = input.req?.headers.get('user-agent') ?? null

    const { error } = await supabase.from('admin_audit_log').insert({
      actor_user_id: actorUserId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      diff: input.diff ?? null,
      ip,
      user_agent: userAgent?.slice(0, 500) ?? null,
    })
    if (error) {
      console.warn(
        `[admin-audit] insert failed — action=${input.action}: ${error.message}`,
      )
    }
  } catch (e) {
    console.warn(
      `[admin-audit] exception — action=${input.action}:`,
      e instanceof Error ? e.message : 'unknown',
    )
  }
}

/**
 * Request → IP 추출. Vercel `x-forwarded-for` 또는 Cloudflare `cf-connecting-ip`.
 * lib/rate-limit.ts 의 ipFromRequest 와 동일 로직 — 의존성 순환 피하려고 inline.
 */
function extractIp(req: Request): string | null {
  const h = req.headers
  const cf = h.get('cf-connecting-ip')
  if (cf) return cf
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  const real = h.get('x-real-ip')
  if (real) return real
  return null
}
