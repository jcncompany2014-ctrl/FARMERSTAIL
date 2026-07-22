import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/stamps-expire
 *
 * 스탬프 1년 만료를 **실제로 반영**한다 (사장님 모델 2026-07-22).
 *
 * # 왜 크론이 필요한가
 * stamps 트리거는 stamp insert/delete(적립·환불) 때만 stamp_count 를 갱신한다.
 * 만료는 시간이 지나 expires_at 이 지나가는 것 — 테이블 변화가 없어 트리거가 안 돈다.
 * 그래서 매일 fn_expire_stamps() 가 **살아있는(잠금 포함) 개수**로 stamp_count 를
 * 다시 계산해, 현재 판(느슨한 스탬프)이 만료된 만큼 카드에서 빠지게 한다.
 *
 * # 안전
 * - 등급을 만든 스탬프는 expires_at='infinity'(잠금)라 항상 카운트 → 만료로 등급이
 *   내려가지 않는다. fn_expire_stamps 는 드리프트 난 프로필만 UPDATE(멱등).
 * - service_role(admin) 로 RPC. fn_expire_stamps 는 SECURITY DEFINER.
 *
 * 스케줄: 매일 1회면 충분(만료는 분 단위로 급하지 않다). vercel.json "0 15 * * *".
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('stamps-expire', () => runExpire())
}

async function runExpire(): Promise<Response> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any
  const { data, error } = await admin.rpc('fn_expire_stamps')
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    )
  }
  // fn_expire_stamps 는 갱신한(드리프트 났던) 프로필 수를 돌려준다.
  const refreshed = typeof data === 'number' ? data : 0
  return NextResponse.json({ ok: true, refreshed })
}
