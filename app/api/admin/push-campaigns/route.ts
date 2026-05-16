import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/admin'
import { parseRequest } from '@/lib/api/parseRequest'
import { pushToUser } from '@/lib/push'
import { dbError } from '@/lib/api/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/push-campaigns — 일괄 푸시 발송 + 캠페인 기록.
 *
 * Body: { title, body, url?, segment }
 * segment:
 *   - all                : 모든 push_subscriptions 보유 사용자
 *   - inactive_30d       : 마지막 paid order 30일+ 전 (이탈 win-back)
 *   - active_subscribers : status='active' subscription 1개 이상 보유
 *
 * 흐름:
 *   1) admin 권한 검증
 *   2) segment 별 user_id list 추출 (admin client — RLS bypass)
 *   3) push_campaigns row insert (recipient_count = list.length)
 *   4) 각 user 에 pushToUser fan-out (category 'marketing')
 *   5) 결과 집계 — campaigns row update (sent_count / failed_count)
 *
 * # 가드레일
 * - 한 캠페인 당 최대 5,000명 (운영 한도). 초과 시 400.
 * - Toss 같은 결제 게이트웨이 없으니 quota 만 검토.
 */

const zCampaign = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(240),
  url: z.string().trim().max(240).optional(),
  segment: z.enum(['all', 'inactive_30d', 'active_subscribers']),
})

const MAX_RECIPIENTS = 5_000

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const parsed = await parseRequest(req, zCampaign)
  if (!parsed.ok) return parsed.response

  const { title, body, url, segment } = parsed.data

  // url 동일 origin path 만 허용 — 외부 link 차단.
  const safeUrl = url && url.startsWith('/') ? url : undefined
  if (url && !safeUrl) {
    return NextResponse.json(
      { ok: false, error: 'url_must_be_relative_path' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // 1) Segment 별 user_id 목록.
  const userIds = await collectSegmentUserIds(admin, segment)
  if (userIds.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      {
        ok: false,
        error: 'too_many_recipients',
        count: userIds.length,
        limit: MAX_RECIPIENTS,
      },
      { status: 400 },
    )
  }

  // 2) campaign row insert (recipient_count 만 우선 기록).
  const { data: campaign, error: insErr } = await admin
    .from('push_campaigns')
    .insert({
      title,
      body,
      url: safeUrl ?? null,
      segment,
      recipient_count: userIds.length,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (insErr || !campaign) {
    // audit #69: 원본 DB error message client 노출 제거.
    return dbError(insErr ?? new Error('insert_failed'), 'push_campaign_create', '캠페인 등록에 실패했어요')
  }

  // 3) fan-out — 동시 5건씩 chunk. quiet hours / preference gating 안 함
  //    (admin 의도된 marketing 발송이지만, push.ts 가 marketing category 일 때
  //    "[광고]" prefix 자동 + push_preferences.notify_marketing 게이트 적용).
  let sent = 0
  let failed = 0
  const CHUNK = 5
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const slice = userIds.slice(i, i + CHUNK)
    const results = await Promise.all(
      slice.map((uid) =>
        pushToUser(
          uid,
          { title, body, url: safeUrl },
          { category: 'marketing' },
        ).catch(() => ({ ok: false, sent: 0, dead: 0 })),
      ),
    )
    for (const r of results) {
      if (r.ok && r.sent > 0) sent += 1
      else if (!r.ok) failed += 1
    }
  }

  // 4) campaign 결과 update.
  await admin
    .from('push_campaigns')
    .update({ sent_count: sent, failed_count: failed })
    .eq('id', campaign.id)

  return NextResponse.json({
    ok: true,
    campaignId: campaign.id,
    recipientCount: userIds.length,
    sent,
    failed,
  })
}

/**
 * Segment 별 push_subscriptions 보유 user_id 목록.
 * 모든 segment 가 push_subscriptions 1개 이상 보유 사용자 기준 (안 받는
 * 사람에겐 보낼 곳 없음). 그 위에 segment 별 추가 필터.
 */
async function collectSegmentUserIds(
  admin: ReturnType<typeof createAdminClient>,
  segment: 'all' | 'inactive_30d' | 'active_subscribers',
): Promise<string[]> {
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('user_id')
  const subscribedSet = new Set(
    ((subs ?? []) as Array<{ user_id: string }>).map((s) => s.user_id),
  )

  if (segment === 'all') {
    return [...subscribedSet]
  }

  if (segment === 'inactive_30d') {
    // 마지막 paid order 가 30일+ 전인 사용자 = 이탈 win-back.
    // paid orders 없는 사용자 (가입만 함) 도 포함 — push_subscriptions 가 있다면 첫 구매 유도.
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
    const { data: recentBuyers } = await admin
      .from('orders')
      .select('user_id')
      .eq('payment_status', 'paid')
      .gte('created_at', cutoff)
    const recentSet = new Set(
      ((recentBuyers ?? []) as Array<{ user_id: string }>).map((b) => b.user_id),
    )
    return [...subscribedSet].filter((u) => !recentSet.has(u))
  }

  // active_subscribers
  const { data: activeSubs } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('status', 'active')
  const activeSet = new Set(
    ((activeSubs ?? []) as Array<{ user_id: string }>).map((s) => s.user_id),
  )
  return [...subscribedSet].filter((u) => activeSet.has(u))
}
