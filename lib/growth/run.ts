import type { SupabaseClient } from '@supabase/supabase-js'
import { pushToUser } from '@/lib/push'
import { captureBusinessEvent } from '@/lib/sentry/trace'
import { ageWeeksFromBirth } from '@/lib/growth-curve'
import {
  growthAnalysisRow,
  growthPushCopy,
  planMonthlyGrowth,
  type GrowthDog,
  type GrowthLastAnalysis,
  type GrowthWeightLog,
} from '@/lib/growth/monthly'

/**
 * 자견 월간 성장 재계산 실행 — dog-age-update 크론(매일 KST 09:30, 조용 시간 밖)이 부른다.
 * 판단·계산·문구는 lib/growth/monthly(순수). 여기는 조회·저장·알림만.
 *
 * service_role 클라이언트를 받는다(크론 — 로그인 쿠키 없음, 규칙8). 범위는 코드가 dog_id 로 책임진다.
 * 조회 실패는 "대상 없음"으로 읽지 않고 그대로 보고하고 이번 회차를 건너뛴다(규칙1·39) — 다음 날 다시 돈다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export type MonthlyGrowthSummary = {
  candidates: number
  recomputed: number
  pushed: number
  failed: number
  skipped: Record<string, number>
  error?: string
}

/** 성장기 최대 24개월(초대형견) + 여유 — 그보다 나이 많은 강아지는 조회조차 하지 않는다. */
const MAX_GROWTH_WEEKS = 110

export async function runMonthlyGrowth(
  admin: AnyClient,
  dogs: Array<GrowthDog & { user_id: string }>,
  nowMs: number,
): Promise<MonthlyGrowthSummary> {
  const out: MonthlyGrowthSummary = { candidates: 0, recomputed: 0, pushed: 0, failed: 0, skipped: {} }
  const young = dogs.filter((d) => {
    const w = ageWeeksFromBirth(d.birth_date, nowMs)
    return w !== null && w < MAX_GROWTH_WEEKS
  })
  out.candidates = young.length
  if (young.length === 0) return out
  const ids = young.map((d) => d.id)

  const [anRes, svRes, wlRes] = await Promise.all([
    admin
      .from('analyses')
      .select('dog_id, created_at, stage, weight_kg, supplements, next_review_date')
      .in('dog_id', ids)
      .order('created_at', { ascending: false }),
    admin.from('surveys').select('id, dog_id, answers, created_at').in('dog_id', ids).order('created_at', { ascending: false }),
    admin
      .from('weight_logs')
      .select('dog_id, weight, measured_at, created_at')
      .in('dog_id', ids)
      .order('measured_at', { ascending: false })
      .order('created_at', { ascending: false }),
  ])
  const failedLookup = anRes.error ?? svRes.error ?? wlRes.error
  if (failedLookup) {
    captureBusinessEvent('error', 'cron.growth_monthly.lookup_failed', { dbError: failedLookup.message })
    out.error = failedLookup.message
    return out
  }

  // 강아지별 최신 1건 (정렬된 결과의 첫 행).
  const firstBy = <T extends { dog_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T>()
    for (const r of rows ?? []) if (!m.has(r.dog_id)) m.set(r.dog_id, r)
    return m
  }
  type AnRow = GrowthLastAnalysis & { dog_id: string; supplements: string[] | null; next_review_date: string | null }
  const lastAn = firstBy((anRes.data ?? []) as AnRow[])
  const lastSv = firstBy((svRes.data ?? []) as Array<{ id: string; dog_id: string; answers: unknown }>)
  const lastWl = firstBy((wlRes.data ?? []) as Array<GrowthWeightLog & { dog_id: string }>)

  for (const dog of young) {
    const an = lastAn.get(dog.id) ?? null
    const sv = lastSv.get(dog.id) ?? null
    const wl = lastWl.get(dog.id) ?? null
    const plan = planMonthlyGrowth({
      dog,
      lastAnalysis: an,
      surveyAnswers: sv?.answers ?? null,
      latestWeightLog: wl ? { weight: Number(wl.weight), measured_at: wl.measured_at } : null,
      nowMs,
    })
    if (!plan.due) {
      out.skipped[plan.reason] = (out.skipped[plan.reason] ?? 0) + 1
      continue
    }
    // 새 분석 행 = "이번 달 처리함" 표식. 저장이 실패하면 알림도 보내지 않는다(내일 다시 시도).
    const { error: insErr } = await admin.from('analyses').insert(
      growthAnalysisRow({
        dogId: dog.id,
        userId: dog.user_id,
        surveyId: sv!.id,
        plan,
        supplements: an?.supplements ?? null,
        nextReviewDate: an?.next_review_date ?? null,
      }),
    )
    if (insErr) {
      out.failed += 1
      captureBusinessEvent('error', 'cron.growth_monthly.insert_failed', { dogId: dog.id, dbError: insErr.message })
      continue
    }
    out.recomputed += 1
    const copy = growthPushCopy(dog, plan)
    // await 필수 — fire-and-forget 이면 람다가 얼어 발송·push_log 가 유실된다(2026-08-08 크론 감사).
    // 정보성 건강 알림(category health) — 알림 설정·조용 시간을 지킨다. 잔소리 상한(nudge)과는 무관한 월 1회.
    const res = await pushToUser(
      dog.user_id,
      { title: copy.title, body: copy.body, url: copy.url, tag: `growth-${dog.id}` },
      { category: 'health' },
    ).catch(() => null)
    if ((res?.sent ?? 0) > 0) out.pushed += 1
  }
  return out
}
