// R16-F44/C25: lifecycle push 캠페인 cron.
//
// D+1: 환영 메시지 (가입 다음 날)
// D+7: 첫 분석 리마인드 (분석 미완료 시)
// D+30: 정기배송 권유 (구독 없는 사용자)
// medication.time 도달 시: 복약 알림
//
// ⏰ **hourly cron 필수** — vercel.json: { "schedule": "0 * * * *" }
//    복약 알림이 "사용자가 정한 시각(KST)"에 발화해야 하므로 매시간 돌아야 한다.
//
// # 2026-07-17 수정 — 스케줄↔코드 drift 로 2개 캠페인이 죽어 있었다
//
// 위 헤더는 hourly 를 요구했는데 vercel.json 에는 **daily(`0 23 * * *` = KST 08시)**
// 로 등록돼 있었다(등록 시 헤더 주석 미반영). 그 결과:
//   · **복약 알림**: `kstHour` 가 항상 8 → **08시 복약만 발송, 그 외 전 시각 영원히
//     미발송**. (바로 위 R85-D1 주석이 같은 종류 버그[UTC/KST 시차]를 고친 기록인데,
//     스케줄이 daily 로 바뀌며 **같은 버그가 다른 얼굴로 부활**했다.) — 복약은
//     건강 인접이라 피해가 가장 컸다.
//   · **D+1 환영**: 윈도우가 1시간(25h~24h)인데 하루 1회만 돌아 **신규가입 ~96% 미발송**.
//   · D+7·D+30 은 윈도우가 24시간이라 daily 와 우연히 맞아 정상이었다.
//
// 그래서 **크론을 hourly 로 되돌리되**, D+7·D+30 이 24× 과발송되지 않도록
// 마케팅 3종은 **KST 10시 1회만** 실행하도록 게이트했다(아래 MARKETING_KST_HOUR).
//
// # 발송 1회 보장 방식 (dedup 테이블 없음 — 윈도우 타일링에 의존)
// 마케팅 3종은 push_log dedup 이 없다. 대신 **"실행 시각 게이트 × 윈도우 폭"** 이
// 정확히 맞물려 각 사용자가 정확히 1개 실행에만 걸리게 한다:
//   · 하루 1회 실행(10시) × 24시간 윈도우 = 1회 발송.
// ⚠️ 윈도우 폭이나 실행 빈도를 바꿀 땐 **반드시 둘을 같이** 봐야 한다 —
//    한쪽만 바꾸면 침묵 미발송(이번 D+1) 또는 24× 스팸(정통망법 §50)이 된다.
//
// cron-auth 헤더 검증으로 외부 호출 차단.

import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { addDaysKst, currentKstHour, todayKstIsoDate } from '@/lib/datetime-kst'
import { getAutomationSettings } from '@/lib/automation-settings'

// 마케팅 3종(D+1·D+7·D+30)이 나가는 KST 시각은 admin 조절값
// (automation_settings.marketing_push_hour, 기본 10). hourly cron 중 그 시각 1회만
// 실행돼 D+7·D+30 의 24시간 윈도우가 24× 과발송되지 않는다.
// (복약 알림은 사용자가 정한 시각이라 이 게이트를 받지 않는다.)
//
// # ★2026-07-19 — Hobby 플랜 제약으로 daily 강등 (배포 전면 중단의 범인)
// Vercel Hobby 는 "하루 1회" 크론만 허용한다. 2026-07-17 hourly 복원 커밋 이후
// **모든 배포가 이 검증에서 거부**되며 38시간 동안 프로덕션이 얼어 있었다.
// 그래서 스케줄을 daily(`0 1 * * *` = KST 10:00)로 강등하고 아래 CRON_IS_HOURLY
// 상수로 게이트를 결합했다. 결과:
//   · 마케팅 3종 — 게이트 없이 매 실행 발송(daily×24h·달력일 윈도우 = 정확히 1회).
//     admin 의 발송 시각 조절(marketing_push_hour)은 **임시 무력**(발송 = 크론
//     시각 KST 10시 고정).
//   · 복약 알림 — KST 10시 복약만 발송됨(사용자 지정 시각 미지원). 출시 전이라
//     실사용 0. **Pro 업그레이드(월 $20) 시**: vercel.json 을 hourly 로 되돌리고
//     CRON_IS_HOURLY=true 로 바꾸면 전부 원복 — 사장님 결정 대기.
// ⚠️ 크론을 hourly 로 되돌릴 땐 반드시 CRON_IS_HOURLY 도 true 로 — 안 그러면
//    마케팅 3종이 24× 과발송(정통망법 §50)된다.
const CRON_IS_HOURLY = false

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

    // 복약 alert — 매시간 (사용자가 정한 시각에 발화해야 하므로 게이트 없음).
    results.push(await runMedicationReminder(supabase, now))

    // 마케팅 3종 — hourly 모드에선 설정된 KST 시각 실행분에서만(나머지 23개
    // 실행 skip — 게이트 없이 hourly 로 돌리면 24시간 윈도우인 D+7·D+30 이
    // 24× 과발송된다). daily 강등 모드(현재)에선 매 실행 = 하루 1회라 게이트
    // 불필요 — 게이트를 걸면 크론 시각≠설정 시각일 때 침묵 미발송된다.
    const settings = await getAutomationSettings(supabase)
    if (!CRON_IS_HOURLY || currentKstHour() === settings.marketingPushHour) {
      results.push(await runWelcome(supabase, now)) // D+1 환영 (어제 가입자)
      results.push(await runAnalysisReminder(supabase, now)) // D+7 분석 리마인드
      results.push(await runSubscribeNudge(supabase, now)) // D+30 정기배송 권유
    }

    return NextResponse.json({ ok: true, results })
  })
}

/**
 * D+1 환영 — **KST 달력 기준 '어제' 가입자 전원**.
 *
 * 카피가 "어제 가입해주셨네요"라 롤링 24h(가입 24~48시간 전)로 잡으면 그저께
 * 가입자에게 "어제"라 말하게 된다. KST 달력일로 끊어야 문구가 참이 된다.
 * 10시 실행 × 어제 00:00~오늘 00:00 윈도우 = 각 가입자가 정확히 1회.
 *
 * (이전: 25h~24h 롤링 1시간 윈도우. hourly cron 전제였는데 daily 로 등록돼
 *  그 1시간 슬롯 가입자만 받고 ~96% 가 침묵 미발송이었다.)
 */
async function runWelcome(
  supabase: AdminSupabase,
  _now: Date,
): Promise<CampaignResult> {
  const todayKst = todayKstIsoDate()
  const yesterdayKst = addDaysKst(todayKst, -1)
  // KST 자정 경계를 +09:00 오프셋으로 명시 → UTC 로 변환해 timestamptz 와 비교.
  const since = new Date(`${yesterdayKst}T00:00:00+09:00`).toISOString()
  const until = new Date(`${todayKst}T00:00:00+09:00`).toISOString()
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
        body: '맞춤 식단을 자동으로 받아보세요. 구독 시 15% 할인.',
        // 구독전환: 낱개 카탈로그(/products?subscribable=1) 폐지 → 설문 퍼널(/start)로.
        // 푸시 카피('맞춤 식단을 자동으로')와 정합하는 구독 시작 동선.
        url: '/start',
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
      // 2026-07-17: 'order'(배송) → 'health'. 건강 알림 category 분리 스윕에서
      // 이것만 누락돼 **배송 알림을 끄면 복약 알림도 같이 꺼졌다**(다른 건강 cron
      // 5종 — 체중리마인더·급변경보·DCM·개입·첫박스체크인 — 은 전부 'health').
      // nudge 는 붙이지 않는다: 복약은 권유가 아니라 사용자가 스스로 시각을 정한
      // 약속이라 주 2건 상한에 밀려선 안 된다.
      { category: 'health' },
    ).catch(() => null)
    if (ok?.ok) sent++
    else errors++
  }
  return { campaign: 'medication', sent, skipped, errors }
}
