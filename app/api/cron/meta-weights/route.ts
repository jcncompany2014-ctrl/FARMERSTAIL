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
  // R83-E3 (D3): trackCron wrap.
  return trackCron('meta-weights', async () => {
    // ★최종감사 #20 (2026-07-29): 플래그 스킵을 trackCron **안**에서 — 예전엔
    //   trackCron 진입 전에 return 해서 cron_health 에 아무것도 안 남았고,
    //   화면에서 '한 번도 안 돈 크론'(고장)과 구분이 불가능했다. progression 의
    //   kill switch 와 같은 패턴: skipped 도 실행 기록이다.
    if (!isInventionEnabled('meta_learning')) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'INVENTION_FLAG_OFF' })
    }
    const supabase = createAdminClient()

  // 최근 30일 sensitivity_snapshots
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: snapshots, error: snapshotsErr } = await supabase
    .from('dog_sensitivity_snapshots')
    .select('top_variable, top_delta')
    .gte('snapshot_at', since)
    .limit(10_000)

  // 조회 실패를 0건으로 접지 않는다(2026-08-05 · 규칙1) — 접히면 "대상 없음"이
  // 되어 크론은 초록인데 아무 일도 안 한 것이 정상으로 기록된다.
  if (snapshotsErr) {
    console.error('[meta-weights] 민감도 스냅샷 조회 실패:', snapshotsErr.message)
    return NextResponse.json(
      { ok: false, reason: 'lookup_failed', at: 'snapshots', error: snapshotsErr.message },
      { status: 500 },
    )
  }
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
  // 실패를 0 으로 접으면 "수의사 데이터 0%" 라는 **틀린 보정 신호**가 저장된다.
  const { count: vetRecords, error: vetRecordsErr } = await supabase
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
    // 못 셌으면 0 이 아니라 null — "수의사 데이터가 없다"와 "못 셌다"는 다르다.
    vetRecordsLast30d: vetRecordsErr ? null : (vetRecords ?? 0),
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
