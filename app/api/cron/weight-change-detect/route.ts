import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { recordOutcome } from '@/lib/feeding-outcomes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/weight-change-detect
 *
 * Round D1 (2026-05-20): F4-2 변·체중 피드백 cron.
 *
 * # 동작
 *   1. 활성 dog 의 weight_logs 4주 전 ~ 1주 전 1건 (baseline) + 최근 1건 (latest).
 *   2. |latest - baseline| / baseline >= 5% 이면 변화 감지.
 *   3. 감지 시:
 *      a) feeding_outcomes 자동 row insert
 *         source='self_log', weight_kg=latest, comment='4주 ±5% 변화 감지'.
 *      b) 14일 이내 같은 push 보낸 적 없으면 사용자 push 알람.
 *      c) push CTA — /dogs/{dogId}/analysis (재분석 권유).
 *   4. ±5% 미만이면 skip.
 *
 * # 일정
 *   매주 월 09:00 KST. weight-reminder 와 같은 슬롯이지만 다른 분기:
 *   reminder = 측정 안 하는 dog / detect = 측정한 dog.
 *
 * # 안전장치
 *   - 14일 spam 차단
 *   - baseline / latest 동일 measured_at 인 경우 skip
 *   - 신뢰도 위해 baseline 은 최소 3주 전 측정만 인정 (너무 가까운 비교 X)
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('weight-change-detect', () => runDetect())
}

async function runDetect(): Promise<Response> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any

  // 활성 dog 모두 — limit 500 (운영 초기 < 1k).
  const { data: dogs } = await admin
    .from('dogs')
    .select('id, user_id, name')
    .is('deleted_at', null)
    .limit(500)

  const dogList = (dogs ?? []) as Array<{
    id: string
    user_id: string
    name: string
  }>

  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString()
  const twentyOneDaysAgo = new Date(now - 21 * 86_400_000).toISOString()
  const thirtyFiveDaysAgo = new Date(now - 35 * 86_400_000).toISOString()
  const fourteenDaysAgo = new Date(now - 14 * 86_400_000).toISOString()

  let detected = 0
  let pushed = 0
  let skippedNoData = 0
  let skippedSmall = 0
  let skippedSpam = 0

  for (const dog of dogList) {
    // 최근 weight (지난 7일 이내 측정만 — 너무 오래되면 의미 없음)
    const { data: latestRow } = await admin
      .from('weight_logs')
      .select('weight, measured_at')
      .eq('dog_id', dog.id)
      .gte('measured_at', sevenDaysAgo)
      .order('measured_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const latest = latestRow as { weight: number; measured_at: string } | null
    if (!latest) {
      skippedNoData += 1
      continue
    }

    // baseline — 21~35일 전 측정 1건.
    const { data: baselineRow } = await admin
      .from('weight_logs')
      .select('weight, measured_at')
      .eq('dog_id', dog.id)
      .gte('measured_at', thirtyFiveDaysAgo)
      .lte('measured_at', twentyOneDaysAgo)
      .order('measured_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const baseline = baselineRow as { weight: number; measured_at: string } | null
    if (!baseline) {
      skippedNoData += 1
      continue
    }

    // 변화율 계산
    const pct = ((latest.weight - baseline.weight) / baseline.weight) * 100
    const absPct = Math.abs(pct)
    if (absPct < 5) {
      skippedSmall += 1
      continue
    }
    detected += 1

    // outcome row insert — silent fail
    try {
      await recordOutcome(supabase, {
        dog_id: dog.id,
        user_id: dog.user_id,
        source: 'self_log',
        weight_kg: latest.weight,
        comment: `4주 ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% 변화 감지 (${baseline.weight} → ${latest.weight}kg)`,
      })
    } catch {
      /* 기록 실패 silent */
    }

    // 14일 이내 같은 push 보낸 적 있으면 skip
    const { count: recentPush } = await admin
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', dog.user_id)
      .eq('category', 'reminder-weight-change')
      .gt('sent_at', fourteenDaysAgo)
    if ((recentPush ?? 0) > 0) {
      skippedSpam += 1
      continue
    }

    // push
    const direction = pct >= 0 ? '증가' : '감소'
    const sign = pct >= 0 ? '+' : ''
    try {
      await pushToUser(
        dog.user_id,
        {
          title: `${dog.name}이 체중 ${sign}${pct.toFixed(1)}% ${direction}`,
          body: `4주 만에 변화가 있었네요. 다음 박스 사이즈를 다시 추천드릴까요?`,
          url: `/dogs/${dog.id}/analysis`,
          tag: `weight-change-${dog.id}`,
        },
        { category: 'order' }, // PushCategory 'order' 재사용 (weight-reminder 와 동일 패턴)
      )
      pushed += 1
    } catch {
      /* push 실패 silent */
    }
  }

  return NextResponse.json({
    ok: true,
    total: dogList.length,
    detected,
    pushed,
    skipped: {
      no_data: skippedNoData,
      small_change: skippedSmall,
      spam_window: skippedSpam,
    },
  })
}
