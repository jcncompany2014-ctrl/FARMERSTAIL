// R16-F44/C25: lifecycle push 캠페인 cron.
//
// D+1: 환영 메시지 (가입 다음 날)
// D+7: 첫 분석 리마인드 (분석 미완료 시)
// D+30: 정기배송 권유 (구독 없는 사용자)
// medication.time 도달 시: 복약 알림
//
// vercel.json 에 hourly cron 등록 필요:
//   { "path": "/api/cron/push-lifecycle", "schedule": "0 * * * *" }
//
// cron-auth 헤더 검증으로 외부 호출 차단.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'

// dog_subscriptions / dog_medications 는 lib/supabase/types.ts 가 자동 재생성되지
// 않아 Database 제네릭에 미포함 (lib/dog-records.ts 의 정책과 같음). 그래서 admin
// client 를 untyped 제네릭으로 받고, 각 query 결과는 Array<...> 로 명시 캐스팅.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, 'public', any>

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface CampaignResult {
  campaign: string
  sent: number
  skipped: number
  errors: number
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('push-lifecycle', async () => {
    const supabase = createAdminClient()
    const now = new Date()
    const results: CampaignResult[] = []

    // D+1 환영 — profiles.created_at 24시간 ~ 25시간 사이
    results.push(await runWelcome(supabase, now))
    // D+7 분석 리마인드
    results.push(await runAnalysisReminder(supabase, now))
    // D+30 정기배송 권유
    results.push(await runSubscribeNudge(supabase, now))
    // 복약 시간 alert
    results.push(await runMedicationReminder(supabase, now))

    return NextResponse.json({ ok: true, results })
  })
}

async function runWelcome(
  supabase: AdminSupabase,
  now: Date,
): Promise<CampaignResult> {
  const since = new Date(now.getTime() - 25 * 3600 * 1000).toISOString()
  const until = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
  const { data: rows } = await supabase
    .from('profiles')
    .select('id, name')
    .gte('created_at', since)
    .lt('created_at', until)

  let sent = 0,
    errors = 0
  for (const p of (rows ?? []) as Array<{ id: string; name: string | null }>) {
    const ok = await pushToUser(
      p.id,
      {
        title: '파머스테일 — 어제 가입해주셨네요',
        body: `${p.name ?? '보호자'}님, 강아지 등록부터 시작해 보세요.`,
        url: '/dogs/new',
      },
      { category: 'marketing' },
    ).catch(() => null)
    if (ok?.ok) sent++
    else errors++
  }
  return { campaign: 'd1_welcome', sent, skipped: 0, errors }
}

async function runAnalysisReminder(
  supabase: AdminSupabase,
  now: Date,
): Promise<CampaignResult> {
  const since = new Date(now.getTime() - 8 * 24 * 3600 * 1000).toISOString()
  const until = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
  const { data: rows } = await supabase
    .from('profiles')
    .select('id')
    .gte('created_at', since)
    .lt('created_at', until)

  let sent = 0,
    skipped = 0,
    errors = 0
  for (const p of (rows ?? []) as Array<{ id: string }>) {
    const { data: analyses } = await supabase
      .from('analyses')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', p.id)
      .limit(1)
    if ((analyses as unknown[] | null)?.length ?? 0 > 0) {
      skipped++
      continue
    }
    const ok = await pushToUser(
      p.id,
      {
        title: '아직 강아지 분석을 못 보셨네요',
        body: '5분이면 충분해요. 무료 영양 분석을 받아보세요.',
        url: '/dogs',
      },
      { category: 'marketing' },
    ).catch(() => null)
    if (ok?.ok) sent++
    else errors++
  }
  return { campaign: 'd7_analysis', sent, skipped, errors }
}

async function runSubscribeNudge(
  supabase: AdminSupabase,
  now: Date,
): Promise<CampaignResult> {
  const since = new Date(now.getTime() - 31 * 24 * 3600 * 1000).toISOString()
  const until = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()
  const { data: rows } = await supabase
    .from('profiles')
    .select('id')
    .gte('created_at', since)
    .lt('created_at', until)

  let sent = 0,
    skipped = 0,
    errors = 0
  for (const p of (rows ?? []) as Array<{ id: string }>) {
    // R85-E3: 이전엔 존재하지 않는 `dog_subscriptions` 테이블 조회 → PostgREST
    // 404 → subs 항상 빈 배열 → 이미 구독중인 사용자도 D+30 마케팅 푸시 받음
    // (legal: 정통망법 §50 동의 + 광고성 표시 + UX 신뢰도). 실제 테이블 `subscriptions`.
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', p.id)
      .eq('status', 'active')
      .limit(1)
    if (((subs as unknown[] | null) ?? []).length > 0) {
      skipped++
      continue
    }
    const ok = await pushToUser(
      p.id,
      {
        title: '정기배송으로 더 편하게',
        body: '맞춤 식단을 자동으로 받아보세요. 10% 할인 적용.',
        url: '/products?subscribable=1',
      },
      { category: 'marketing' },
    ).catch(() => null)
    if (ok?.ok) sent++
    else errors++
  }
  return { campaign: 'd30_subscribe', sent, skipped, errors }
}

async function runMedicationReminder(
  supabase: AdminSupabase,
  now: Date,
): Promise<CampaignResult> {
  // medications.enabled = true + schedule = 'daily' + time 이 현재 ±30분 안.
  // R85-D1: Vercel 서버는 UTC. `now.getHours()` 가 UTC hour → 사용자 UI 가
  //   KST 기준 입력한 time 과 9시간 차이 → KST 19시 복약만 발화, 그 외 영원히
  //   미발송. KST hour 로 비교.
  const kstHour = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours()
  const hh = String(kstHour).padStart(2, '0')
  const { data: rows } = await supabase
    .from('dog_medications')
    .select('id, user_id, dog_id, name, time')
    .eq('enabled', true)
    .eq('schedule', 'daily')

  let sent = 0,
    skipped = 0,
    errors = 0
  for (const m of (rows ?? []) as Array<{
    id: string
    user_id: string
    dog_id: string
    name: string
    time: string | null
  }>) {
    if (!m.time) {
      skipped++
      continue
    }
    const mHh = m.time.slice(0, 2)
    if (mHh !== hh) {
      skipped++
      continue
    }
    const ok = await pushToUser(
      m.user_id,
      {
        title: `복약 시간 — ${m.name}`,
        body: '오늘 복용량을 챙겨주세요.',
        url: `/dogs/${m.dog_id}/medications`,
      },
      { category: 'order' },
    ).catch(() => null)
    if (ok?.ok) sent++
    else errors++
  }
  return { campaign: 'medication', sent, skipped, errors }
}
