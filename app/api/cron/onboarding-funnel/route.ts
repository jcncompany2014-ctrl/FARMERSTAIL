import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { pushToUser } from '@/lib/push'
import { petName } from '@/lib/korean'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/onboarding-funnel
 *
 * 솔로 D2C 의 retention funnel 핵심 단계별 정체 사용자 reminder.
 *
 * # 단계
 *  1) 가입 후 24h+ — 강아지 등록 안 함     → "강아지 등록하면 분석 무료"  ✅ 구현
 *  2) 강아지 등록 후 24h+ — 분석 안 받음   → "맞춤 분석 받아보세요"      ✅ 구현
 *  3) ~~분석 후 48h+ — 처방 미승인 → "처방 확인하기"~~ — **미구현**(코드는 1·2단계뿐).
 *     2026-07-17 확인: 이 줄은 **설계만 적히고 만들어진 적 없다.** 인접한
 *     `cron/personalization-approval-timeout` 은 5일 뒤 자동 declined 처리만 하고
 *     **"확인하세요" 알림은 보내지 않는다** → 처방 미승인 사용자는 아무 리마인드
 *     없이 5일 뒤 이전 비율로 되돌아간다. 구독 전환 직전 단계라 가치는 있으나
 *     **새 마케팅 발송을 늘리는 결정**이라 사장님 판단 대기(볼륨·카피).
 *
 * 각 단계마다 push 메시지 1회 (push_log 에 같은 메시지가 있으면 skip).
 * agree_email=true 인 사용자만 (마케팅 동의). push 카테고리 = marketing.
 *
 * # 운영
 * - 매일 1회 (KST 10:00) — vercel.json `0 1 * * *`
 * - 한 번에 100명/단계 까지 (트래픽 보호)
 *
 * # 2026-07-17 수정 — 위 "1회" 약속이 코드에 없었다
 * docstring 은 "같은 dedupe key 있으면 skip" 이라 적었지만 **dedup 조회 자체가
 * 없었다.** 윈도우가 6일(가입 1~7일 전)인데 크론은 매일 1회라 정체 사용자는
 * **6일 연속 대상**이 됐다. 실제 발송은 `nudge` 주 2건 상한에 막혀 2회였지만:
 *   · 같은 메시지를 **이틀 연속** 받고(약속 위반),
 *   · 그 2회가 **주간 nudge 예산을 통째로 소진**해 체중 리마인더 등 다른 넛지를
 *     그 주 내내 굶겼다(상한은 nudge 전역 공유).
 * → 약속대로 push_log dedup 을 실제 구현. 윈도우(6일)는 유지 — 크론이 하루
 *   실패해도 다음 날 잡아준다(타일링만 믿으면 그 코호트는 영구 유실).
 *
 * ⚠️ **dedup 키는 반드시 실제 발송 payload 와 같은 상수에서 나와야 한다.**
 * 문구를 손으로 두 번 적으면 한쪽만 고쳐져 dedup 이 조용히 무력화된다
 * (#77 weight-reminder 가 정확히 그렇게 죽었다 — category drift). 그래서
 * STAGE1/STAGE2 상수 하나를 발송·조회가 공유한다.
 *
 * # 보안
 * Bearer CRON_SECRET.
 */

const MAX_PER_STAGE = 100

/** 퍼널 윈도우 = 가입/등록 후 1~7일. dedup 조회도 같은 폭이면 충분(최대 6일 체류). */
const FUNNEL_WINDOW_DAYS = 7

/**
 * 단계별 메시지 — **발송과 dedup 조회가 공유하는 단일 출처.**
 * body 로 단계를 식별한다(title 은 marketing 이라 '[광고]' prefix 가 붙고 2단계는
 * 강아지 이름이 들어가 가변 — push_log 에 저장된 값과 안 맞는다).
 */
const STAGE1 = {
  title: '강아지 등록하시고 무료 분석 받아보세요 🐶',
  body: '체중·체형·식이 정보만 있으면 맞춤 분석을 무료로 보내드려요',
  url: '/dogs/new',
} as const

const STAGE2 = {
  body: '5분 설문으로 수의영양 가이드라인 기반 맞춤 분석 — 무료',
} as const

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * 이 사용자에게 같은 메시지를 이미 보냈나. body 는 고정 문구라 안전하고,
 * url 을 함께 보면 2단계를 **강아지별**로 구분할 수 있다
 * (1단계 url '/dogs/new' 는 D+1 환영 push 와 겹치므로 body 로 구분).
 */
async function alreadySent(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  body: string,
  url?: string,
): Promise<boolean> {
  let q = supabase
    .from('push_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('body', body)
    .gte('sent_at', isoDaysAgo(FUNNEL_WINDOW_DAYS))
  if (url) q = q.eq('url', url)
  const { count } = await q
  return (count ?? 0) > 0
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
    // 7일 이내만 — 너무 오래된 미사용 user 는 abandon
    .gt('created_at', isoDaysAgo(FUNNEL_WINDOW_DAYS))
    .limit(MAX_PER_STAGE * 2)

  let stage1Sent = 0
  let stage1Skipped = 0
  for (const p of (signupOnly ?? []) as Array<{ id: string }>) {
    const { count } = await supabase
      .from('dogs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', p.id)
    if ((count ?? 0) > 0) continue
    if (await alreadySent(supabase, p.id, STAGE1.body)) {
      stage1Skipped += 1
      continue
    }
    // await 필수 — fire-and-forget 이면 route 응답 후 Vercel 이 람다를 얼려
    // 발송·push_log 기록이 유실되고, dedup 도 무력화된다.
    const ok = await pushToUser(
      p.id,
      { ...STAGE1, tag: `onboarding-stage1-${p.id}` },
      { category: 'marketing', nudge: true },
    ).catch(() => null)
    // 실제 발송된 것만 센다 (카테고리 OFF·quiet hours·주2건 상한은 sent=0).
    if ((ok?.sent ?? 0) > 0) stage1Sent += 1
    else stage1Skipped += 1
    if (stage1Sent >= MAX_PER_STAGE) break
  }

  // 단계 2: 강아지 등록 24h+ + 분석 0
  const { data: dogsOnly } = await supabase
    .from('dogs')
    .select('id, user_id, name')
    .lte('created_at', isoDaysAgo(1))
    .gt('created_at', isoDaysAgo(FUNNEL_WINDOW_DAYS))
    .limit(MAX_PER_STAGE * 2)

  let stage2Sent = 0
  let stage2Skipped = 0
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
    // url 까지 보면 dedup 이 **강아지별** — 2마리가 각각 미분석이면 각각 1회.
    const url = `/dogs/${dog.id}/survey`
    if (await alreadySent(supabase, dog.user_id, STAGE2.body, url)) {
      stage2Skipped += 1
      continue
    }
    const ok = await pushToUser(
      dog.user_id,
      {
        title: `${petName(dog.name)}의 맞춤 분석 받아보세요 🌿`,
        body: STAGE2.body,
        url,
        tag: `onboarding-stage2-${dog.id}`,
      },
      { category: 'marketing', nudge: true },
    ).catch(() => null)
    if ((ok?.sent ?? 0) > 0) stage2Sent += 1
    else stage2Skipped += 1
    if (stage2Sent >= MAX_PER_STAGE) break
  }

    return NextResponse.json({
      ok: true,
      stage1Sent,
      stage1Skipped,
      stage2Sent,
      stage2Skipped,
    })
  })
}
