/**
 * 챙길 손님 신호 조회 — 서버 전용(service_role). 판정은 순수 함수 lib/admin/customer-flags.
 *
 * service_role 인 이유(AGENTS 규칙8): native_push_tokens·push_subscriptions 는 본인만 읽는 RLS 라 관리자 쿠키로 읽으면
 * 0행 — '알림 못 받음'이 전원에게 거짓으로 뜬다. 호출부(어드민 화면)가 관리자 확인을 먼저 하고, 범위는 코드가
 * `.in('user_id', 받은 id)` 로 묶는다. 200명씩 나눠 묻는다(규칙190 — 주소 머리 16KB).
 *
 * 조회가 하나라도 실패하면 ok:false — 실패를 '신호 없음'(=챙길 손님 아님)으로 접지 않는다(규칙1).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { selectInChunks } from '@/lib/supabase/in-chunks'
import type { SubLike } from '@/lib/subscription-state'
import { PAID_STATUSES } from '@/lib/commerce/paid-status'
import {
  customerFlags,
  RECENT_PURCHASE_DAYS,
  type CustomerFlags,
  type NativeTokenLite,
} from '@/lib/admin/customer-flags'

// 읽기만 한다 — 타입 없는 클라이언트도 받는다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, 'public', any>

export type CustomerFlagLookup =
  | { ok: true; byUser: Map<string, CustomerFlags> }
  | { ok: false; error: string }

type SubFlagRow = SubLike & { user_id: string }

export async function loadCustomerFlags(
  admin: AnyClient,
  users: ReadonlyArray<{ id: string; email: string | null; deleted_at?: string | null }>,
  now: Date = new Date(),
): Promise<CustomerFlagLookup> {
  const ids = [...new Set(users.map((u) => u.id).filter(Boolean))]
  const byUser = new Map<string, CustomerFlags>()
  if (ids.length === 0) return { ok: true, byUser }
  const emails = [
    ...new Set(
      users
        .map((u) => (u.email ?? '').trim().toLowerCase())
        .filter((e) => e.length > 0),
    ),
  ]

  const recentSince = new Date(now.getTime() - RECENT_PURCHASE_DAYS * 86_400_000).toISOString()
  const [supRes, tokRes, webRes, subRes, recentRes] = await Promise.all([
    selectInChunks(emails, (chunk) =>
      admin.from('email_suppressions').select('email').in('email', chunk),
    ),
    selectInChunks(ids, (chunk) =>
      admin
        .from('native_push_tokens')
        .select('user_id, platform, app_version, updated_at')
        .in('user_id', chunk),
    ),
    selectInChunks(ids, (chunk) =>
      admin.from('push_subscriptions').select('user_id').in('user_id', chunk),
    ),
    selectInChunks(ids, (chunk) =>
      admin
        .from('subscriptions')
        .select(
          'user_id, status, has_billing_key, next_delivery_date, failed_charge_count, requires_billing_key_renewal',
        )
        .in('user_id', chunk)
        .neq('status', 'cancelled'),
    ),
    // 최근 결제(웹 가게 단품 포함) — '거래 중인 손님' 판정(규칙279).
    selectInChunks(ids, (chunk) =>
      admin
        .from('orders')
        .select('user_id')
        .in('user_id', chunk)
        .in('payment_status', [...PAID_STATUSES])
        .gte('created_at', recentSince),
    ),
  ])
  for (const [label, res] of [
    ['메일 반송 목록', supRes],
    ['앱 알림 기기', tokRes],
    ['웹 알림 구독', webRes],
    ['정기배송', subRes],
    ['최근 결제', recentRes],
  ] as const) {
    if (res.error) return { ok: false, error: `${label} 조회 실패: ${res.error.message}` }
  }

  const suppressed = new Set(
    ((supRes.data ?? []) as Array<{ email: string | null }>)
      .map((r) => (r.email ?? '').toLowerCase())
      .filter(Boolean),
  )
  const tokensByUser = new Map<string, NativeTokenLite[]>()
  for (const t of (tokRes.data ?? []) as Array<NativeTokenLite & { user_id: string }>) {
    const list = tokensByUser.get(t.user_id) ?? []
    list.push({ platform: t.platform, app_version: t.app_version, updated_at: t.updated_at })
    tokensByUser.set(t.user_id, list)
  }
  const webByUser = new Map<string, number>()
  for (const w of (webRes.data ?? []) as Array<{ user_id: string }>) {
    webByUser.set(w.user_id, (webByUser.get(w.user_id) ?? 0) + 1)
  }
  const subsByUser = new Map<string, SubFlagRow[]>()
  for (const s of (subRes.data ?? []) as unknown as SubFlagRow[]) {
    const list = subsByUser.get(s.user_id) ?? []
    list.push({
      ...s,
      failed_charge_count: s.failed_charge_count ?? 0,
      requires_billing_key_renewal: !!s.requires_billing_key_renewal,
    })
    subsByUser.set(s.user_id, list)
  }

  const recentByUser = new Map<string, number>()
  for (const o of (recentRes.data ?? []) as Array<{ user_id: string }>) {
    recentByUser.set(o.user_id, (recentByUser.get(o.user_id) ?? 0) + 1)
  }

  for (const u of users) {
    byUser.set(
      u.id,
      customerFlags({
        email: u.email,
        suppressedEmails: suppressed,
        nativeTokens: tokensByUser.get(u.id) ?? [],
        webPushCount: webByUser.get(u.id) ?? 0,
        subscriptions: subsByUser.get(u.id) ?? [],
        recentPaidOrders: recentByUser.get(u.id) ?? 0,
        deleted: !!u.deleted_at,
      }),
    )
  }
  return { ok: true, byUser }
}

/**
 * 전체 회원의 신호 — 회원 목록 '챙길 손님' 필터용. 회원을 1000명씩 끝까지 읽고(정렬: 가입 최신순) 위 함수로 판정한다.
 * 회원 수천 명까지는 한 번에 돈다. 실패면 ok:false.
 */
export type FlagUser = { id: string; email: string | null; name: string | null; phone: string | null; deleted_at: string | null }

export async function loadAllCustomerFlags(
  admin: AnyClient,
): Promise<
  | { ok: true; users: FlagUser[]; byUser: Map<string, CustomerFlags> }
  | { ok: false; error: string }
> {
  const users: FlagUser[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, email, name, phone, deleted_at')
      // 탈퇴 회원은 챙길 손님이 아니다(연락처를 지웠다) — 목록·집계에서 뺀다(규칙279).
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return { ok: false, error: `회원 조회 실패: ${error.message}` }
    const rows = (data ?? []) as FlagUser[]
    users.push(...rows)
    if (rows.length < PAGE) break
  }
  const flags = await loadCustomerFlags(admin, users)
  if (!flags.ok) return flags
  return { ok: true, users, byUser: flags.byUser }
}
