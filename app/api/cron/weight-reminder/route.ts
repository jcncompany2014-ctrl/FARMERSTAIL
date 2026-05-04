import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/weight-reminder
 *
 * 매주 1회 — 마지막 weight_log 가 30일 이상 지난 강아지의 보호자에게 push:
 *   "체중 측정 한 지 N일 됐어요. 알고리즘이 정확한 처방을 위해 4주마다 권장."
 *
 * # 흐름
 *  1. 모든 active dog (deleted_at IS NULL) 의 마지막 weight_log 조회
 *  2. last weighed_at <= now() - 30d 인 강아지 추출 (max 200 per run)
 *  3. user_id 별 묶어서 push (강아지 여러 마리면 합쳐서)
 *  4. 14일 이내 같은 알림 보낸 적 있으면 skip (push_log 의 metadata
 *     reminder_sent_at 활용)
 *
 * # 일정
 *  매주 월요일 09:00 KST.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const supabase = createAdminClient()
  const cutoff = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10) // YYYY-MM-DD

  type DogRow = {
    id: string
    user_id: string
    name: string
    last_weighed: string | null
  }

  // dogs + 각 dog 의 max(measured_at). subquery 로 단일 round-trip.
  const { data: rows, error } = await supabase.rpc('weight_reminder_targets', {
    cutoff_date: cutoff,
    max_rows: 200,
  })

  // RPC 미구현 환경 — fallback inline query (느림, 200 dog 까진 OK).
  let targets: DogRow[] = []
  if (error || !rows) {
    const { data: dogs } = await supabase
      .from('dogs')
      .select('id, user_id, name')
      .is('deleted_at', null)
      .limit(500)
    const dogList = ((dogs ?? []) as unknown) as Array<{
      id: string
      user_id: string
      name: string
    }>
    for (const dog of dogList) {
      const { data: last } = await supabase
        .from('weight_logs')
        .select('measured_at')
        .eq('dog_id', dog.id)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const lastDate =
        (last as { measured_at?: string } | null)?.measured_at ?? null
      if (!lastDate || lastDate <= cutoff) {
        targets.push({ ...dog, last_weighed: lastDate })
        if (targets.length >= 200) break
      }
    }
  } else {
    targets = ((rows as unknown) as DogRow[]).slice(0, 200)
  }

  // user_id 별 강아지 묶기 (중복 user 합침).
  const byUser = new Map<string, DogRow[]>()
  for (const t of targets) {
    const list = byUser.get(t.user_id) ?? []
    list.push(t)
    byUser.set(t.user_id, list)
  }

  let sent = 0
  let skipped = 0
  for (const [userId, dogs] of byUser.entries()) {
    // 14일 이내 같은 reminder 보낸 적 있으면 skip — spam 방지.
    const recent = await supabase
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('category', 'reminder-weight')
      .gt(
        'sent_at',
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      )
    if ((recent.count ?? 0) > 0) {
      skipped += 1
      continue
    }

    const dogNames = dogs
      .slice(0, 3)
      .map((d) => d.name)
      .join(', ')
    const more = dogs.length > 3 ? ` 외 ${dogs.length - 3}` : ''
    const title =
      dogs.length === 1
        ? `${dogNames}이 체중 측정해보세요`
        : `${dogNames}${more} 체중 측정해보세요`
    const body =
      '4주마다 측정하면 알고리즘이 더 정확한 처방을 만들어요.'

    try {
      await pushToUser(
        userId,
        {
          title,
          body,
          url:
            dogs.length === 1
              ? `/dogs/${dogs[0].id}`
              : '/dogs',
        },
        { category: 'order' }, // PushCategory 'order' 재사용 (기존 카테고리 유지)
      )
      sent += 1
    } catch {
      // 발송 실패 — 다음 cron 에 재시도.
    }
  }

  return NextResponse.json({
    ok: true,
    targets: targets.length,
    users: byUser.size,
    sent,
    skipped,
  })
}
