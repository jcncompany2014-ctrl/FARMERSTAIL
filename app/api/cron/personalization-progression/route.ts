import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { decideNextBox } from '@/lib/personalization/nextBox'
import type { AlgorithmInput, Checkin, Formula } from '@/lib/personalization/types'
import { mainLineOf } from '@/lib/personalization/format'
import { diffFormulas } from '@/lib/personalization/diff'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { pushToUser } from '@/lib/push'
import { notifyPersonalizationCycle } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/personalization-progression
 *
 * 매일 새벽 (KST 04:00 권장) 실행. cycle 만료된 강아지의 다음 처방 생성.
 *
 * # 실행 조건
 * 강아지의 가장 최신 dog_formulas row 가:
 *   - applied_until IS NULL AND created_at < now() - 28일, 또는
 *   - applied_until <= today
 * → 다음 cycle (cycle_number + 1) 처방 자동 생성.
 *
 * # 흐름
 * 1) 만료된 cycle 식별 (배치 100건 / run)
 * 2) 각 강아지에 대해:
 *    - 가장 최신 survey + analysis (영양 input)
 *    - 현재 cycle 의 checkins (week_2 / week_4)
 *    - decideNextBox 호출
 *    - 새 dog_formulas row insert (cycle_number + 1)
 * 3) 푸시 알림 / 이메일 발송은 별개 cron 이 dog_formulas 새 row 감지해 처리.
 *
 * # 가드레일
 * - MAX_PER_RUN = 100 (대량 큐 폭주 방지, 다음 cron 에서 계속)
 * - 각 강아지 처리 사이 50ms (DB 부하 분산)
 * - 한 강아지 실패해도 나머지 진행 (best-effort)
 *
 * # 보안
 * CRON_SECRET bearer.
 */

const MAX_PER_RUN = 100
const CYCLE_DAYS = 28

function todayKstIsoDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const supabase = createAdminClient()
  const today = todayKstIsoDate()
  const cycleAgo = addDaysIso(today, -CYCLE_DAYS)

  // 1) 만료된 cycle 의 가장 최신 처방 식별. dog 별 max(cycle_number) 만 봐야
  //    같은 강아지의 옛 cycle 까지 진행시키지 않음. window function 으로
  //    rank=1 만 추리는 게 정석이지만, supabase JS client 에선 raw SQL 보다
  //    application 측 dedup 이 명확. 일단 모든 후보 가져와서 dog 별 최신 1개.
  type FormulaRow = {
    id: string
    dog_id: string
    user_id: string
    cycle_number: number
    formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
    transition_strategy: Formula['transitionStrategy']
    daily_kcal: number
    daily_grams: number
    algorithm_version: string
    user_adjusted: boolean
    reasoning: Formula['reasoning']
    applied_until: string | null
    created_at: string
  }

  const { data: candidates, error: fetchErr } = await supabase
    .from('dog_formulas')
    .select(
      'id, dog_id, user_id, cycle_number, formula, transition_strategy, ' +
        'daily_kcal, daily_grams, algorithm_version, user_adjusted, reasoning, ' +
        'applied_until, created_at',
    )
    // applied_until 이 today 이전이거나 NULL + created_at 28일 이전
    .or(`applied_until.lte.${today},and(applied_until.is.null,created_at.lt.${cycleAgo}T00:00:00Z)`)
    .order('cycle_number', { ascending: false })
    .limit(MAX_PER_RUN * 3) // dedup 위해 여유롭게

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: fetchErr.message },
      { status: 500 },
    )
  }

  // dog 별 max cycle 만 남김.
  const latestByDog = new Map<string, FormulaRow>()
  for (const row of (candidates ?? []) as unknown as FormulaRow[]) {
    const existing = latestByDog.get(row.dog_id)
    if (!existing || row.cycle_number > existing.cycle_number) {
      latestByDog.set(row.dog_id, row)
    }
  }

  // 다음 cycle 이 이미 존재하는 강아지 제외 — race / 수동 진행 방지.
  const dogIds = Array.from(latestByDog.keys()).slice(0, MAX_PER_RUN)
  const targets: FormulaRow[] = []
  for (const dogId of dogIds) {
    const cur = latestByDog.get(dogId)!
    const { data: nextExists } = await supabase
      .from('dog_formulas')
      .select('id')
      .eq('dog_id', dogId)
      .eq('cycle_number', cur.cycle_number + 1)
      .maybeSingle()
    if (!nextExists) targets.push(cur)
  }

  let succeeded = 0
  let failed = 0
  let skipped = 0

  for (const cur of targets) {
    try {
      // 강아지 + 최신 survey + analysis + 현재 cycle checkins 조회.
      const [
        { data: dog },
        { data: survey },
        { data: analysis },
        { data: checkinsRaw },
      ] = await Promise.all([
        supabase
          .from('dogs')
          .select(
            'id, name, weight, age_value, age_unit, neutered, activity_level',
          )
          .eq('id', cur.dog_id)
          .maybeSingle(),
        supabase
          .from('surveys')
          .select(
            'answers, chronic_conditions, pregnancy_status, care_goal, ' +
              'home_cooking_experience, current_diet_satisfaction, weight_trend_6mo, ' +
              'gi_sensitivity, preferred_proteins, indoor_activity, daily_walk_minutes',
          )
          .eq('dog_id', cur.dog_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('analyses')
          .select('mer, feed_g')
          .eq('dog_id', cur.dog_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('dog_checkins')
          .select(
            'cycle_number, checkpoint, stool_score, coat_score, ' +
              'appetite_score, overall_satisfaction, responded_at',
          )
          .eq('dog_id', cur.dog_id)
          .eq('cycle_number', cur.cycle_number),
      ])

      if (!dog || !survey || !analysis) {
        skipped += 1
        continue
      }

      const dogTyped = dog as unknown as {
        id: string
        name: string
        weight: number
        age_value: number
        age_unit: 'years' | 'months'
        neutered: boolean
        activity_level: 'low' | 'medium' | 'high'
      }
      const surveyTyped = survey as unknown as {
        answers: { bcsExact?: number; allergies?: string[] }
        chronic_conditions: string[] | null
        pregnancy_status: string | null
        care_goal: string | null
        home_cooking_experience: string | null
        current_diet_satisfaction: number | null
        weight_trend_6mo: string | null
        gi_sensitivity: string | null
        preferred_proteins: string[] | null
        indoor_activity: string | null
        daily_walk_minutes: number | null
      }
      const analysisTyped = analysis as unknown as {
        mer: number
        feed_g: number
      }

      const ageMonths =
        dogTyped.age_unit === 'years'
          ? dogTyped.age_value * 12
          : dogTyped.age_value

      const surveyInput: AlgorithmInput = {
        dogId: dogTyped.id,
        dogName: dogTyped.name,
        ageMonths,
        weightKg: dogTyped.weight,
        neutered: dogTyped.neutered,
        activityLevel: dogTyped.activity_level,
        bcs:
          typeof surveyTyped.answers?.bcsExact === 'number' &&
          surveyTyped.answers.bcsExact >= 1 &&
          surveyTyped.answers.bcsExact <= 9
            ? (surveyTyped.answers.bcsExact as AlgorithmInput['bcs'])
            : null,
        allergies: Array.isArray(surveyTyped.answers?.allergies)
          ? surveyTyped.answers.allergies
          : [],
        chronicConditions: Array.isArray(surveyTyped.chronic_conditions)
          ? surveyTyped.chronic_conditions
          : [],
        pregnancy:
          (surveyTyped.pregnancy_status as AlgorithmInput['pregnancy']) ?? null,
        careGoal: (surveyTyped.care_goal as AlgorithmInput['careGoal']) ?? null,
        homeCookingExperience:
          (surveyTyped.home_cooking_experience as AlgorithmInput['homeCookingExperience']) ??
          null,
        currentDietSatisfaction:
          (surveyTyped.current_diet_satisfaction as AlgorithmInput['currentDietSatisfaction']) ??
          null,
        weightTrend6mo:
          (surveyTyped.weight_trend_6mo as AlgorithmInput['weightTrend6mo']) ??
          null,
        giSensitivity:
          (surveyTyped.gi_sensitivity as AlgorithmInput['giSensitivity']) ??
          null,
        preferredProteins: Array.isArray(surveyTyped.preferred_proteins)
          ? surveyTyped.preferred_proteins
          : [],
        indoorActivity:
          (surveyTyped.indoor_activity as AlgorithmInput['indoorActivity']) ??
          null,
        dailyWalkMinutes: surveyTyped.daily_walk_minutes ?? null,
        dailyKcal: analysisTyped.mer,
        dailyGrams: analysisTyped.feed_g,
      }

      const checkins: Checkin[] = ((checkinsRaw ?? []) as unknown as Array<{
        cycle_number: number
        checkpoint: 'week_2' | 'week_4'
        stool_score: number | null
        coat_score: number | null
        appetite_score: number | null
        overall_satisfaction: number | null
        responded_at: string
      }>).map((c) => ({
        cycleNumber: c.cycle_number,
        checkpoint: c.checkpoint,
        stoolScore: c.stool_score as Checkin['stoolScore'],
        coatScore: c.coat_score as Checkin['coatScore'],
        appetiteScore: c.appetite_score as Checkin['appetiteScore'],
        overallSatisfaction:
          c.overall_satisfaction as Checkin['overallSatisfaction'],
        respondedAt: c.responded_at,
      }))

      const previousFormula: Formula = {
        lineRatios: cur.formula.lineRatios,
        toppers: cur.formula.toppers,
        reasoning: cur.reasoning,
        transitionStrategy: cur.transition_strategy,
        dailyKcal: cur.daily_kcal,
        dailyGrams: cur.daily_grams,
        cycleNumber: cur.cycle_number,
        algorithmVersion: cur.algorithm_version,
        userAdjusted: cur.user_adjusted,
      }

      const next = decideNextBox({
        previousFormula,
        checkins,
        surveyInput,
        cycleNumber: cur.cycle_number + 1,
      })

      // Option A — 의미 있는 변화 vs 미세 조정 판정.
      // 미세 조정 → auto_applied 즉시 적용 (기존 동작).
      // 의미 있는 변화 → pending_approval, push 별도 카피, 결제 안 됨.
      // 강제 변화 (알레르기 / 만성질환 추가) → auto_applied 강제, "변경됨" push.
      const diff = diffFormulas(previousFormula, next)
      const requiresApproval = diff.meaningful && !diff.forced

      const appliedFrom = requiresApproval ? null : today
      const appliedUntil = requiresApproval ? null : addDaysIso(today, CYCLE_DAYS)
      const approvalStatus = requiresApproval ? 'pending_approval' : 'auto_applied'
      const proposedAt = requiresApproval ? new Date().toISOString() : null
      const approvedAt = requiresApproval ? null : new Date().toISOString()

      const { error: insErr } = await supabase.from('dog_formulas').insert({
        dog_id: cur.dog_id,
        user_id: cur.user_id,
        cycle_number: next.cycleNumber,
        formula: { lineRatios: next.lineRatios, toppers: next.toppers },
        reasoning: next.reasoning,
        transition_strategy: next.transitionStrategy,
        algorithm_version: next.algorithmVersion,
        user_adjusted: false,
        daily_kcal: next.dailyKcal,
        daily_grams: next.dailyGrams,
        applied_from: appliedFrom,
        applied_until: appliedUntil,
        approval_status: approvalStatus,
        proposed_at: proposedAt,
        approved_at: approvedAt,
      })

      if (insErr) {
        // UNIQUE 충돌 = race (다른 trigger 가 먼저). 정상 skip.
        if ((insErr as unknown as { code?: string }).code === '23505') {
          skipped += 1
        } else {
          failed += 1
          captureBusinessEvent('warning', 'personalization.progression.failed', {
            dogId: cur.dog_id,
            cycleNumber: next.cycleNumber,
            error: insErr.message,
          })
        }
        continue
      }

      succeeded += 1
      captureBusinessEvent('info', 'personalization.progression.succeeded', {
        dogId: cur.dog_id,
        cycleNumber: next.cycleNumber,
      })

      // 보호자에게 푸시 알림 — 흐름 분기:
      //   pending_approval → "확인이 필요해요" + approval URL
      //   auto_applied (강제 포함)  → "준비됐어요" + analysis URL
      const main = mainLineOf(next)
      const pushTitle = requiresApproval
        ? `${dogTyped.name} 다음 박스 확인이 필요해요`
        : `${dogTyped.name} 다음 박스 준비됐어요 🐾`
      const pushBody = requiresApproval
        ? `이번 달 비율이 바뀔 수 있어요 — ${main.name} ${main.pct}% 제안. 5일 안에 확인해주세요.`
        : `이번 달은 ${main.name} ${main.pct}% 메인. 자세한 비율 보기 →`
      const pushUrl = requiresApproval
        ? `/dogs/${cur.dog_id}/approve?cycle=${next.cycleNumber}`
        : `/dogs/${cur.dog_id}/analysis`

      pushToUser(
        cur.user_id,
        {
          title: pushTitle,
          body: pushBody,
          url: pushUrl,
          tag: `formula-cycle-${cur.dog_id}-${next.cycleNumber}`,
        },
        // 'order' 카테고리 — 정기배송 박스 안내라 order 흐름과 연동.
        { category: 'order' },
      ).catch(() => {
        /* 푸시 실패는 무시 — Sentry 가 push 자체에서 잡음 */
      })

      // 이메일 발송 — push OFF 사용자도 받게. profile 의 email + name 조회.
      // best-effort. agree_email=false 인 사용자는 sendEmail 이 알아서 차단.
      void (async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('id', cur.user_id)
            .maybeSingle()
          if (!profile?.email) return
          await notifyPersonalizationCycle({
            email: profile.email,
            recipientName: profile.name ?? '',
            dogName: dogTyped.name,
            dogId: cur.dog_id,
            cycleNumber: next.cycleNumber,
            mainLineName: main.name,
            mainLineSubtitle: main.subtitle,
            mainLinePct: main.pct,
            reasoningLabels: next.reasoning
              .slice(0, 4)
              .map((r) => r.chipLabel),
          })
        } catch {
          /* 이메일 실패는 cron 흐름 안 막음 */
        }
      })()

      // DB 부하 분산.
      await new Promise((r) => setTimeout(r, 50))
    } catch (err) {
      failed += 1
      captureBusinessEvent('warning', 'personalization.progression.failed', {
        dogId: cur.dog_id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    today,
    candidates: targets.length,
    succeeded,
    failed,
    skipped,
  })
}
