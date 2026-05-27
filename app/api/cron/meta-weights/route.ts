import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { isInventionEnabled } from '@/lib/invention-flags'
import { dbError } from '@/lib/api/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/meta-weights — 월 1회 메타학습 가중치 갱신 skeleton.
 *
 * 발명 모듈 H (B-53, B-88). 1차 구현:
 *  · sensitivity_snapshots 최근 30일 집계
 *  · medical_records source='vet' 가 있으면 calibration 신호
 *  · 결과 algorithm_meta_weights 에 jsonb 적재 (version=yyyymm)
 *
 * 실 학습 알고리즘은 placeholder — top_variable 분포 통계만 기록.
 * 추후 실 calibration 로직으로 교체. row 가 쌓이면 admin 페이지
 * (P16) 에서 monitoring.
 */

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  // 발명 핵심 — meta_learning flag OFF 면 skip.
  if (!isInventionEnabled('meta_learning')) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'INVENTION_META_LEARNING_DISABLED',
    })
  }
  // R83-E3 (D3): trackCron wrap.
  return trackCron('meta-weights', async () => {
    const supabase = createAdminClient()

  // 최근 30일 sensitivity_snapshots
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: snapshots } = await supabase
    .from('dog_sensitivity_snapshots')
    .select('top_variable, top_delta')
    .gte('snapshot_at', since)
    .limit(10_000)

  const histogram: Record<string, { count: number; avgDelta: number }> = {}
  const rows = (snapshots ?? []) as Array<{
    top_variable: string
    top_delta: number
  }>
  for (const r of rows) {
    const h = histogram[r.top_variable] ?? { count: 0, avgDelta: 0 }
    h.count += 1
    h.avgDelta = h.avgDelta + (r.top_delta - h.avgDelta) / h.count // running avg
    histogram[r.top_variable] = h
  }

  // 수의사 데이터 비율 — calibration 신호
  const { count: vetRecords } = await supabase
    .from('medical_records')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'vet')
    .gte('created_at', since)

  // version yyyymm
  const d = new Date()
  const version = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`

  const weights = {
    snapshotCount: rows.length,
    topVariableHistogram: histogram,
    vetRecordsLast30d: vetRecords ?? 0,
    note: 'placeholder skeleton — 실 calibration 알고리즘은 PCT 후',
  }

  const { error } = await supabase.from('algorithm_meta_weights').insert({
    version,
    weights,
    source: 'cron',
    notes: `monthly skeleton run @ ${d.toISOString()}`,
  })

    if (error) {
      return dbError(error, 'cron_meta_weights', '메타 학습 가중치 갱신 실패')
    }
    return NextResponse.json({ ok: true, version, weights })
  })
}
