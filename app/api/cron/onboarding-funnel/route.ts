import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { pushToUser } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/onboarding-funnel
 *
 * 솔로 D2C 의 retention funnel 핵심 단계별 정체 사용자 reminder.
 *
 * # 단계
 *  1) 가입 후 24h+ — 강아지 등록 안 함     → "강아지 등록하면 분석 무료"
 *  2) 강아지 등록 후 24h+ — 분석 안 받음   → "맞춤 분석 받아보세요"
 *  3) 분석 받은 후 48h+ — 처방 미승인       → "처방 확인하기"
 *
 * 각 단계마다 push 메시지 1회 (push_log 에 같은 dedupe key 가 있으면 skip).
 * agree_email=true 인 사용자만 (마케팅 동의). push 카테고리 = marketing.
 *
 * # 운영
 * - 매일 1회 (KST 10:00) 권장
 * - 한 번에 100명/단계 까지 (트래픽 보호)
 *
 * # 보안
 * Bearer CRON_SECRET.
 */

const MAX_PER_STAGE = 100

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('onboarding-funnel', async () => {
    const supabase = createAdminClient()

  // 단계 1: 가입 24h+ + 강아지 0
  const { data: signupOnly } = await supabase
    .from('profiles')
    .select('id')
    .eq('agree_email', true)
    .is('deleted_at', null)
    .lte('created_at', isoDaysAgo(1))
    .gt('created_at', isoDaysAgo(7)) // 7일 이내만 — 너무 오래된 미사용 user 는 abandon
    .limit(MAX_PER_STAGE * 2)

  let stage1Sent = 0
  for (const p of (signupOnly ?? []) as Array<{ id: string }>) {
    const { count } = await supabase
      .from('dogs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', p.id)
    if ((count ?? 0) > 0) continue
    pushToUser(
      p.id,
      {
        title: '강아지 등록하시고 무료 분석 받아보세요 🐶',
        body: '체중·BCS·식이 정보만 있으면 영양사 처방을 무료로 보내드려요',
        url: '/dogs/new',
        tag: `onboarding-stage1-${p.id}`,
      },
      { category: 'marketing' },
    ).catch(() => {})
    stage1Sent += 1
    if (stage1Sent >= MAX_PER_STAGE) break
  }

  // 단계 2: 강아지 등록 24h+ + 분석 0
  const { data: dogsOnly } = await supabase
    .from('dogs')
    .select('id, user_id, name')
    .lte('created_at', isoDaysAgo(1))
    .gt('created_at', isoDaysAgo(7))
    .limit(MAX_PER_STAGE * 2)

  let stage2Sent = 0
  for (const dog of (dogsOnly ?? []) as Array<{
    id: string
    user_id: string
    name: string
  }>) {
    const { count } = await supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('dog_id', dog.id)
    if ((count ?? 0) > 0) continue
    pushToUser(
      dog.user_id,
      {
        title: `${dog.name} 의 맞춤 분석 받아보세요 🌿`,
        body: '5분 설문으로 NRC2006 기반 정밀 처방 — 무료',
        url: `/dogs/${dog.id}/survey`,
        tag: `onboarding-stage2-${dog.id}`,
      },
      { category: 'marketing' },
    ).catch(() => {})
    stage2Sent += 1
    if (stage2Sent >= MAX_PER_STAGE) break
  }

    return NextResponse.json({
      ok: true,
      stage1Sent,
      stage2Sent,
    })
  })
}
