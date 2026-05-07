import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { pushToUser } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/referral-milestones
 *
 * 친구 초대 milestone (5/10/20명) 도달자에게 보상 발급. RPC 가 멱등 — 같은
 * (user_id, milestone) 페어에 중복 발급 X.
 *
 * # 발급 후
 *  - 새로 보상 받은 사용자에게 push (marketing 카테고리, 동의자만).
 *  - point_ledger 에 자동 row 추가 (RPC 내부).
 *
 * # 운영
 *  - vercel.json schedule "0 18 * * *" (KST 03:00 daily)
 *  - 빈도 ↓ 가 핵심 — milestone 은 도달 시점 ±하루 OK.
 */

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  return trackCron('referral-milestones', () => runMilestones())
}

async function runMilestones(): Promise<Response> {
  const supabase = createAdminClient()
  // 발급 전 시점의 미발급 (user_id, milestone) 페어 캡쳐 — 발급 후 push 대상.
  const { data: beforeRewards } = await supabase
    .from('referral_milestone_rewards')
    .select('user_id, milestone')
  const beforeSet = new Set(
    (beforeRewards ?? []).map(
      (r: { user_id: string; milestone: number }) =>
        `${r.user_id}:${r.milestone}`,
    ),
  )

  const { data, error } = await supabase.rpc('issue_referral_milestones')
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    )
  }

  const granted = (data as { granted?: number } | null)?.granted ?? 0
  let pushed = 0

  if (granted > 0) {
    const { data: afterRewards } = await supabase
      .from('referral_milestone_rewards')
      .select('user_id, milestone, reward_value')
      .order('granted_at', { ascending: false })
      .limit(100)

    for (const r of (afterRewards ??
      []) as Array<{
      user_id: string
      milestone: number
      reward_value: string
    }>) {
      const key = `${r.user_id}:${r.milestone}`
      if (beforeSet.has(key)) continue
      // 새로 발급된 milestone — push.
      const amount = Number(r.reward_value)
      pushToUser(
        r.user_id,
        {
          title: `친구 ${r.milestone}명 초대 달성 🎉`,
          body: `${amount.toLocaleString()}P 보상이 적립되었어요`,
          url: '/mypage/referral',
          tag: `referral-milestone-${r.milestone}`,
          requireInteraction: false,
        },
        { category: 'order' }, // 거래 보상이라 order 카테고리 (marketing X)
      ).catch(() => {})
      pushed += 1
    }
  }

  return NextResponse.json({ ok: true, granted, pushed })
}
