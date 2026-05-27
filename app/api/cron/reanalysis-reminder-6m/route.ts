import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/reanalysis-reminder-6m
 *
 * R80-P2 (2026-05-27): 6개월 재진단 알림.
 *
 * # 배경
 *   비용 통제 위해 survey/page.tsx 에서 30일 이내 재분석 차단.
 *   "잊어버리고 영영 안 들어오는" 사용자 위해 6개월 (180일) 후 자동 푸시.
 *
 *   기존 reanalyze-trigger cron 은 invention_flag(counterfactual) 기반의
 *   더 정교한 5조건 (체중 drift / 스테이지 변화 / 12주 등) 로직.
 *   이 cron 은 단순한 "6개월 마다 1회" 알림으로 보호자 retention 목적.
 *
 * # 동작
 *   - 매일 1회 실행 (KST 09:00 / UTC 00:00 — "0 0 * * *")
 *   - 마지막 analysis +180일 ~ +210일 사이인 dog 의 user 에게 push
 *   - 30일 spam 차단 (같은 user 에게 이전 발송 ≤30일이면 skip)
 *   - 최대 500건/일 (안전 cap)
 *
 * # spam 차단
 *   push_log 에 동일 title 30일 내 발송 기록 있으면 skip.
 *   사용자가 푸시 받고 → 설문 들어가 → 분석 새로 됨 → 다음 알림은 +180일.
 */

const MAX_PER_RUN = 500

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('reanalysis-reminder-6m', () => runReminder())
}

async function runReminder(): Promise<Response> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any

  const now = Date.now()
  const oneEightyDaysAgo = new Date(now - 180 * 86_400_000).toISOString()
  const twoTenDaysAgo = new Date(now - 210 * 86_400_000).toISOString()
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString()

  // dog 별 *최신 분석* 이 180~210일 전인 케이스만 — N+1 회피.
  // 전략: 한 번에 dog 별 max(created_at) 을 가져온 뒤 정렬·필터.
  //
  // 1) 최근 210일 안에 분석 있는 dogs 들의 raw rows (max ~5k).
  // 2) 같은 dog 의 row 중 가장 최신 created_at 만 dedup.
  // 3) 그 최신 created_at 이 [210d ago, 180d ago] window 면 candidate.
  // 이렇게 하면 candidate 마다 추가 쿼리 없음 (1 round-trip).
  const { data: analyses } = await admin
    .from('analyses')
    .select('dog_id, user_id, created_at, dogs(name)')
    .gte('created_at', twoTenDaysAgo) // 210일 이전은 cutoff
    .order('created_at', { ascending: false })
    .limit(5000) // dog 마다 평균 2-3 row 가정 → ~1700 unique dogs cap

  type Row = {
    dog_id: string
    user_id: string
    created_at: string
    dogs?:
      | { name: string | null }
      | Array<{ name: string | null }>
      | null
  }
  const rows = (analyses ?? []) as Row[]

  // dog 별 최신 row 만 (created_at DESC 정렬이라 첫 출현 = 최신)
  const latestByDog = new Map<string, Row>()
  for (const r of rows) {
    if (!latestByDog.has(r.dog_id)) latestByDog.set(r.dog_id, r)
  }

  // window 필터: 최신 분석이 [210d, 180d] 사이 → 6개월 도달했지만 아직 7개월 X
  const eighteenZeroDaysMs = new Date(oneEightyDaysAgo).getTime()
  const candidates: Row[] = []
  for (const r of latestByDog.values()) {
    const t = new Date(r.created_at).getTime()
    if (t <= eighteenZeroDaysMs) {
      candidates.push(r)
      if (candidates.length >= MAX_PER_RUN) break
    }
  }

  let sent = 0
  let skippedSpam = 0
  let failed = 0

  for (const r of candidates) {
    // 30일 spam 차단 — 같은 user 에게 6m 리마인더 push 가 30일 내에 있으면 skip
    const { count: recent } = await admin
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', r.user_id)
      .ilike('title', '%다음 영양 진단%')
      .gt('sent_at', thirtyDaysAgo)
    if ((recent ?? 0) > 0) {
      skippedSpam += 1
      continue
    }

    const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs
    const dogName = dog?.name ?? '우리 아이'

    try {
      await pushToUser(
        r.user_id,
        {
          title: `${dogName}의 다음 영양 진단 시기예요`,
          body: '지난 분석 후 6개월이 지났어요. 체중·활동량 변화가 있을 수 있어 재진단을 추천드려요.',
          url: `/dogs/${r.dog_id}/survey`,
          tag: `reanalysis-6m-${r.dog_id}`,
        },
        { category: 'order' }, // 정보성 — quiet hours 무관 발송
      )
      sent += 1
    } catch {
      failed += 1
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    sent,
    skipped_spam: skippedSpam,
    failed,
  })
}
