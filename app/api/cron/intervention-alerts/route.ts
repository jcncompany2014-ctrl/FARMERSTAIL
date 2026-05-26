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
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { evaluateInterventionWindow } from '@/lib/intervention-window'

export const runtime = 'nodejs'
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
  const { data: dogsRaw } = await admin
    .from('dogs')
    .select('id, user_id, name, weight')
    .limit(500)
  const dogs = (dogsRaw ?? []) as DogRow[]
  if (dogs.length === 0) {
    return NextResponse.json({ ok: true, message: 'no dogs' })
  }

  // 2) 최근 6개월 체중 — 한 번에 fetch
  const sinceIso = new Date(Date.now() - 180 * 86_400_000).toISOString()
  const dogIds = dogs.map((d) => d.id)
  const { data: weightsRaw } = await admin
    .from('weight_logs')
    .select('dog_id, measured_at, weight')
    .in('dog_id', dogIds)
    .gte('measured_at', sinceIso)
    .order('measured_at', { ascending: true })
  const weights = (weightsRaw ?? []) as WeightRow[]
  const weightsByDog = new Map<string, WeightRow[]>()
  for (const w of weights) {
    const arr = weightsByDog.get(w.dog_id) ?? []
    arr.push(w)
    weightsByDog.set(w.dog_id, arr)
  }

  // 3) 최근 survey — 한 번에 fetch (dog 별 최신 1건은 client 에서 reduce)
  const { data: surveysRaw } = await admin
    .from('surveys')
    .select('dog_id, answers, created_at')
    .in('dog_id', dogIds)
    .order('created_at', { ascending: false })
  const surveys = (surveysRaw ?? []) as SurveyRow[]
  const latestSurveyByDog = new Map<string, SurveyRow>()
  for (const s of surveys) {
    if (!latestSurveyByDog.has(s.dog_id)) latestSurveyByDog.set(s.dog_id, s)
  }

  // 4) 14일 dedupe — push_log.title pattern 으로 검색 (push_log.category 는
  //    PushCategory enum 제한이라 자체 dedupe key 못 쓰는 점 우회).
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()
  const { data: recentPushesRaw } = await admin
    .from('push_log')
    .select('user_id, title, sent_at')
    .ilike('title', '%체중 추세 경보%')
    .gte('sent_at', fourteenDaysAgo)
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
            title: `${dog.name} 체중 추세 경보`,
            body: window.userMessage,
            url: `/dogs/${dog.id}/simulate`,
            tag: `intervention-${dog.id}`,
          },
          { category: 'order' },
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
