import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import {
  feedGramsModel,
  sensitivityAnalysis,
  type DogState,
  type LifeStage,
} from '@/lib/counterfactual'
import { isInventionEnabled } from '@/lib/invention-flags'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/sensitivity-snapshots
 *
 * 주간 cron — 활성 dog 들의 sensitivity analysis snapshot 저장.
 * 메타학습 (모듈 H) 의 시계열 ground-truth.
 *
 * # 활성 dog 정의
 *  - 분석 1건 이상 보유
 *  - 가입 후 28일+ (보호 phase 통과)
 *  - 최근 90일 내 활동 (analyses.created_at 기준)
 *
 * # 멱등성
 * uq_sensitivity_dog_day unique index 로 같은 날 중복 차단. cron 이 재실행
 * 돼도 안전.
 *
 * # 보안
 * CRON_SECRET bearer (다른 cron 과 동일).
 */

const MAX_PER_RUN = 500

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  // 발명 핵심 — counterfactual flag OFF 면 skip. cron 동작 자체를 차단.
  if (!isInventionEnabled('counterfactual')) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'INVENTION_COUNTERFACTUAL_DISABLED',
    })
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('sensitivity-snapshots', async () => {
    const supabase = createAdminClient()

  // 활성 dog 의 최신 analysis + dog 메타 join
  // 1) 최근 90일 분석 있는 dog_id distinct
  const sinceIso = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const { data: recent, error: recentErr } = await supabase
    .from('analyses')
    .select(
      'dog_id, user_id, bcs_score, factor, stage, created_at, dogs(weight, neutered, created_at)',
    )
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(MAX_PER_RUN * 2)

  if (recentErr) {
    return NextResponse.json(
      { ok: false, error: recentErr.message },
      { status: 500 },
    )
  }

  // PostgREST embed 가 dogs 를 array 로 표현 — FK 1:1 이라 [0] 만 사용.
  type RawRow = {
    dog_id: string
    user_id: string
    bcs_score: number
    factor: number
    stage: string
    created_at: string
    dogs:
      | {
          weight: number | null
          neutered: boolean | null
          created_at: string | null
        }
      | Array<{
          weight: number | null
          neutered: boolean | null
          created_at: string | null
        }>
      | null
  }
  type Row = Omit<RawRow, 'dogs'> & {
    dogs: {
      weight: number | null
      neutered: boolean | null
      created_at: string | null
    } | null
  }
  const rows: Row[] = ((recent ?? []) as RawRow[]).map((r) => ({
    ...r,
    dogs: Array.isArray(r.dogs) ? (r.dogs[0] ?? null) : r.dogs,
  }))

  // dog_id 별 최신 analysis 1건만 유지 (이미 created_at desc 정렬됨)
  const seenDogs = new Set<string>()
  const latestPerDog: Row[] = []
  for (const r of rows) {
    if (seenDogs.has(r.dog_id)) continue
    seenDogs.add(r.dog_id)
    latestPerDog.push(r)
    if (latestPerDog.length >= MAX_PER_RUN) break
  }

  let inserted = 0
  let skipped = 0

  for (const r of latestPerDog) {
    if (!r.dogs?.weight) {
      skipped += 1
      continue
    }
    const dogCreatedAt = r.dogs.created_at
    if (dogCreatedAt) {
      const days =
        (Date.now() - new Date(dogCreatedAt).getTime()) / 86_400_000
      if (days < 28) {
        skipped += 1
        continue
      }
    }

    const lifeStage: LifeStage =
      r.stage.includes('성장') || r.stage.toLowerCase().includes('puppy')
        ? 'puppy'
        : r.stage.includes('노령') || r.stage.toLowerCase().includes('senior')
          ? 'senior'
          : 'adult'

    const baseline: DogState = {
      weightKg: r.dogs.weight,
      bcs: r.bcs_score ?? 5,
      activityFactor: r.factor ?? 1.2,
      lifeStage,
      neutered: !!r.dogs.neutered,
    }

    // 빈 weight 등 모델 0 결과면 skip
    if (feedGramsModel(baseline) <= 0) {
      skipped += 1
      continue
    }

    const results = sensitivityAnalysis(baseline)
    const top = results[0]
    if (!top) {
      skipped += 1
      continue
    }

    const { error: insErr } = await supabase
      .from('dog_sensitivity_snapshots')
      .insert({
        dog_id: r.dog_id,
        user_id: r.user_id,
        baseline_state: baseline,
        results,
        top_variable: top.variable,
        top_delta: top.delta,
      })

    if (insErr) {
      // unique violation = 오늘 이미 insert 됨 → 멱등 skip
      if (insErr.code === '23505') {
        skipped += 1
        continue
      }
      // 기타 에러는 무시 + 다음 dog 진행 (한 dog 실패가 전체를 막지 않게)
      skipped += 1
      continue
    }
    inserted += 1
  }

    return NextResponse.json({
      ok: true,
      inserted,
      skipped,
      totalCandidates: latestPerDog.length,
    })
  })
}
