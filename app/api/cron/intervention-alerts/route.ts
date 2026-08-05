/**
 * XL-4 (#13) — /api/cron/intervention-alerts
 *
 * 출원서 모듈 G 의 cron 구현. 활성 강아지의 체중 추세를 linear regression
 * 으로 분석, 위험 BCS (≥7 / ≤3) 도달 ETA ≤ 30일이면 사용자에게 push.
 *
 * # 차이점 (vs weight-change-detect)
 *   weight-change-detect: 4주 ±5% 단기 spike → 즉시 알림.
 *   intervention-alerts: 6개월 추세 → 30일 이내 위험 도달 예측.
 *
 *   둘 다 weekly 로 돌리되 시그널이 보완적. 같은 사용자에게 동시에 두 push
 *   가지 않도록 14일 dedupe.
 *
 * # 일정 — 매주 화 09:00 KST (weight-change-detect 가 월 09:00)
 *
 * # 보안 — isAuthorizedCronRequest (Bearer CRON_SECRET)
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { petName } from '@/lib/korean'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { evaluateInterventionWindow } from '@/lib/intervention-window'

export const runtime = 'nodejs'
/**
 * 제목의 고정부 = dedup 앵커. 둘이 갈라지면 14일 가드가 죽는다(2026-08-05).
 * 문구를 바꿀 땐 여기만 바꾼다 — 발송과 조회가 같은 문자열을 쓴다.
 */
const ALERT_TITLE_ANCHOR = '체중 흐름을 살펴봤어요'

export const dynamic = 'force-dynamic'

interface DogRow {
  id: string
  user_id: string
  name: string
  weight: number | null
}

interface WeightRow {
  dog_id: string
  measured_at: string
  weight: number
}

interface SurveyRow {
  dog_id: string
  answers: unknown
  created_at: string
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('intervention-alerts', () => runAlerts())
}

async function runAlerts(): Promise<Response> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any

  // 1) 활성 dog (지난 30일 active dog — sub 또는 weight log 존재)
  const { data: dogsRaw, error: dogsRawErr } = await admin
    .from('dogs')
    .select('id, user_id, name, weight')
    .limit(500)
  // ★조회 실패를 0건으로 접지 않는다(2026-08-05 · 규칙1). 여기서 접히면
  //   "경보 대상이 없었다"가 되어 크론은 초록인데 체중 이상이 방치된다.
  if (dogsRawErr) {
    console.error('[intervention-alerts] 강아지 조회 실패:', dogsRawErr.message)
    return NextResponse.json(
      { ok: false, reason: 'lookup_failed', at: 'dogsRaw', error: dogsRawErr.message },
      { status: 500 },
    )
  }
  const dogs = (dogsRaw ?? []) as DogRow[]
  if (dogs.length === 0) {
    return NextResponse.json({ ok: true, message: 'no dogs' })
  }

  // 2) 최근 6개월 체중 — 한 번에 fetch
  const sinceIso = new Date(Date.now() - 180 * 86_400_000).toISOString()
  const dogIds = dogs.map((d) => d.id)
  const { data: weightsRaw, error: weightsRawErr } = await admin
    .from('weight_logs')
    .select('dog_id, measured_at, weight')
    .in('dog_id', dogIds)
    .gte('measured_at', sinceIso)
    .order('measured_at', { ascending: true })
  // ★조회 실패를 0건으로 접지 않는다(2026-08-05 · 규칙1). 여기서 접히면
  //   "경보 대상이 없었다"가 되어 크론은 초록인데 체중 이상이 방치된다.
  if (weightsRawErr) {
    console.error('[intervention-alerts] 체중 기록 조회 실패:', weightsRawErr.message)
    return NextResponse.json(
      { ok: false, reason: 'lookup_failed', at: 'weightsRaw', error: weightsRawErr.message },
      { status: 500 },
    )
  }
  const weights = (weightsRaw ?? []) as WeightRow[]
  const weightsByDog = new Map<string, WeightRow[]>()
  for (const w of weights) {
    const arr = weightsByDog.get(w.dog_id) ?? []
    arr.push(w)
    weightsByDog.set(w.dog_id, arr)
  }

  // 3) 최근 survey — 한 번에 fetch (dog 별 최신 1건은 client 에서 reduce)
  const { data: surveysRaw, error: surveysRawErr } = await admin
    .from('surveys')
    .select('dog_id, answers, created_at')
    .in('dog_id', dogIds)
    .order('created_at', { ascending: false })
  // ★조회 실패를 0건으로 접지 않는다(2026-08-05 · 규칙1). 여기서 접히면
  //   "경보 대상이 없었다"가 되어 크론은 초록인데 체중 이상이 방치된다.
  if (surveysRawErr) {
    console.error('[intervention-alerts] 설문 조회 실패:', surveysRawErr.message)
    return NextResponse.json(
      { ok: false, reason: 'lookup_failed', at: 'surveysRaw', error: surveysRawErr.message },
      { status: 500 },
    )
  }
  const surveys = (surveysRaw ?? []) as SurveyRow[]
  const latestSurveyByDog = new Map<string, SurveyRow>()
  for (const s of surveys) {
    if (!latestSurveyByDog.has(s.dog_id)) latestSurveyByDog.set(s.dog_id, s)
  }

  // 4) 14일 dedupe — push_log.title pattern 으로 검색 (push_log.category 는
  //    PushCategory enum 제한이라 자체 dedupe key 못 쓰는 점 우회).
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data: recentPushesRaw, error: recentPushesRawErr } = await admin
    .from('push_log')
    .select('user_id, title, sent_at')
    // ★dedup 앵커는 **발송 제목과 같은 상수**에서 나와야 한다(2026-08-05).
    //   브랜드 보이스 스윕으로 제목을 바꿀 때 이 필터를 같이 안 바꿔서
    //   14일 가드가 통째로 죽어 있었다(ilike 가 영원히 0건 → 매주 재발송).
    //   여기 경보는 nudge 상한도 안 걸려서 매주 화요일마다 반복됐다.
    .ilike('title', `%${ALERT_TITLE_ANCHOR}%`)
    .gte('sent_at', fourteenDaysAgo)
  // ★조회 실패를 0건으로 접지 않는다(2026-08-05 · 규칙1). 여기서 접히면
  //   "경보 대상이 없었다"가 되어 크론은 초록인데 체중 이상이 방치된다.
  if (recentPushesRawErr) {
    console.error('[intervention-alerts] 최근 발송 이력 조회 실패:', recentPushesRawErr.message)
    return NextResponse.json(
      { ok: false, reason: 'lookup_failed', at: 'recentPushesRaw', error: recentPushesRawErr.message },
      { status: 500 },
    )
  }
  const recentPushes = (recentPushesRaw ?? []) as Array<{ user_id: string }>
  const recentlyPushed = new Set(recentPushes.map((p) => p.user_id))

  // 5) 각 dog 평가
  let urgentCount = 0
  let watchCount = 0
  let pushedCount = 0
  const sample: Array<{
    dogId: string
    name: string
    verdict: string
    eta: number | null
  }> = []

  for (const dog of dogs) {
    if (!dog.weight) continue
    const logs = weightsByDog.get(dog.id) ?? []
    if (logs.length < 3) continue
    const survey = latestSurveyByDog.get(dog.id)
    const answers =
      ((survey?.answers as unknown) ?? {}) as { bcsExact?: number }

    const window = evaluateInterventionWindow({
      weightLogs: logs.map((l) => ({
        date: l.measured_at,
        weightKg: l.weight,
      })),
      currentBcs: answers.bcsExact ?? 5,
      currentWeightKg: dog.weight,
    })

    if (window.verdict === 'urgent') urgentCount++
    else if (window.verdict === 'watch') watchCount++

    if (sample.length < 10 && window.verdict !== 'safe') {
      sample.push({
        dogId: dog.id,
        name: dog.name,
        verdict: window.verdict,
        eta: window.obesityEtaDays ?? window.underweightEtaDays,
      })
    }

    // urgent + 14일 내 미알림 → push. PushCategory 는 'order' 재사용
    // (weight-change-detect 와 동일 패턴 — 사용자 push_preferences gating).
    if (window.verdict === 'urgent' && !recentlyPushed.has(dog.user_id)) {
      try {
        await pushToUser(
          dog.user_id,
          {
            title: `${petName(dog.name)} ${ALERT_TITLE_ANCHOR}`,
            body: window.userMessage,
            // 사용자용 /simulate 페이지는 미구현(시뮬레이터는 admin 전용)이라
            // 탭 시 404 였음. 자매 cron weight-change-detect 과 동일하게 실존
            // /analysis(체중 기반 식단·박스 재추천)로 라우팅 — 딥링크 정합.
            url: `/dogs/${dog.id}/analysis`,
            tag: `intervention-${dog.id}`,
          },
          { category: 'health' },
        )
        pushedCount++
        // 같은 user 가 다견을 가진 경우 한 cron 에서 1회만 push (sapm 방지).
        recentlyPushed.add(dog.user_id)
      } catch {
        // push fail 시 silent — 다음 cron 에서 재시도.
      }
    }
  }

  return NextResponse.json({
    ok: true,
    dogsProcessed: dogs.length,
    urgentCount,
    watchCount,
    pushedCount,
    sample,
  })
}
