import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { notifyAbandonedCart } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/cart-recovery
 *
 * 매 시간 실행을 권장. 아래 대상을 스캔해 재결제 유도 메일을 보낸다:
 *   - cart_items 에 하나 이상 담김
 *   - 해당 유저의 cart_items 최신 created_at 이 NOW() - 24h 보다 오래됨
 *     (즉 24시간 동안 새로 담지 않음)
 *   - cart_items 최신 created_at 이 NOW() - 7일 보다는 새로움 (너무 오래된
 *     카트는 버림 — 의사결정 끝났다고 봄)
 *   - 최근 7일 내 cart_recovery_log 발송 기록 없음 (쿨다운)
 *
 * 응답: { checked, sent }
 *
 * 보안: `CRON_SECRET` bearer. 값이 안 맞으면 401.
 */

const RECOVERY_WINDOW_START_H = 24  // 최소 경과 시간
const RECOVERY_WINDOW_END_D = 7     // 최대 경과 기간 (이상은 버림)
const COOLDOWN_D = 7                 // 같은 유저에게 몇 일 내 재발송 금지

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const admin = createAdminClient()
  const now = Date.now()
  const windowStart = new Date(now - RECOVERY_WINDOW_START_H * 3600 * 1000).toISOString()
  const windowEnd = new Date(now - RECOVERY_WINDOW_END_D * 24 * 3600 * 1000).toISOString()
  const cooldown = new Date(now - COOLDOWN_D * 24 * 3600 * 1000).toISOString()

  // 1) 24h+ 카트 변화 없는 유저 후보 리스트.
  //    `user_id` DISTINCT 를 위해 단순 select → 서버에서 그룹핑.
  //    대량 트래픽이 되면 RPC/view 로 옮길 것.
  const { data: rows } = await admin
    .from('cart_items')
    .select('user_id, created_at')
    .gte('created_at', windowEnd)
    .lte('created_at', windowStart)

  type Row = { user_id: string; created_at: string }
  const latest = new Map<string, string>()
  for (const r of (rows ?? []) as Row[]) {
    const prev = latest.get(r.user_id)
    if (!prev || r.created_at > prev) latest.set(r.user_id, r.created_at)
  }

  // 2) 쿨다운 필터 — 최근 7일 내 발송된 유저 제외.
  const candidateIds = [...latest.keys()]
  if (candidateIds.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, sent: 0 })
  }

  const { data: recentSends } = await admin
    .from('cart_recovery_log')
    .select('user_id')
    .in('user_id', candidateIds)
    .gte('sent_at', cooldown)

  const cooled = new Set((recentSends ?? []).map((r) => r.user_id as string))
  const eligible = candidateIds.filter((id) => !cooled.has(id))

  // 3) 순차 발송 — 한 유저가 여러 상품을 담은 경우도 notifyAbandonedCart 내부에서
  //    일괄 하나의 메일로 처리됨. 동시성은 5개씩 배치로 — Resend rate limit 안전선.
  let sent = 0
  for (let i = 0; i < eligible.length; i += 5) {
    const batch = eligible.slice(i, i + 5)
    const results = await Promise.all(
      batch.map((userId) =>
        notifyAbandonedCart(admin, { userId }).catch(() => ({ sent: false })),
      ),
    )
    sent += results.filter((r) => r.sent).length
  }

  return NextResponse.json({
    ok: true,
    checked: candidateIds.length,
    eligible: eligible.length,
    sent,
  })
}
