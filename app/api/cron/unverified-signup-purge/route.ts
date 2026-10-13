import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { selectInChunks } from '@/lib/supabase/in-chunks'
import { isUnverifiedPurgeCandidate } from '@/lib/auth/unverified-signup'
import { captureBusinessEvent } from '@/lib/sentry/trace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/unverified-signup-purge — 이메일 인증을 30일 안에 안 한 가입 정리 (2026-10-13 사장님 결정, 규칙196).
 *
 * # 왜
 * 이메일로 가입하고 인증 메일을 누르지 않은 계정은 로그인할 수 없는데, 이메일·이름 같은 가입 정보는
 * 남아 있다. 쓰지 못하는 계정의 개인정보를 계속 들고 있을 이유가 없다(개인정보처리방침 3절에 고지).
 *
 * # 대상 (전부 만족해야 지운다 — 판정은 lib/auth/unverified-signup)
 *  · 이메일 가입 · 인증 안 함 · 한 번도 로그인 안 함 · 가입 30일 지남
 *  · 강아지·주문·정기배송이 **하나도 없음** — 조회가 실패하면 아무도 지우지 않는다(모르면 안 지운다).
 *
 * # 실행
 * 실제 스케줄: `"20 17 * * *"` = 매일 KST 02:20. 알림을 보내지 않는다(조용시간 규칙9 대상 아님).
 * 한 번에 최대 MAX_PER_RUN 명 — 밀리면 다음 날 이어서 지운다.
 * 결과(지운 수·남긴 수·실패 수)는 cron_health 요약에 남는다(lib/cron-tracking 허용 키).
 */

const MAX_PER_RUN = 50
const PER_PAGE = 1000
/** auth 사용자 목록을 몇 쪽까지 볼지 — 무한 반복 방지(1000명 × 50쪽). */
const MAX_PAGES = 50

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }
  return trackCron('unverified-signup-purge', () => run())
}

async function run(): Promise<Response> {
  const admin = createAdminClient()
  const nowMs = Date.now()

  // 1) 인증 안 한 오래된 이메일 가입 — auth 사용자 목록을 쪽마다 읽는다.
  const candidates: string[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) {
      return NextResponse.json({ ok: false, reason: `auth 사용자 목록 조회 실패: ${error.message}` }, { status: 500 })
    }
    const users = data?.users ?? []
    for (const u of users) {
      if (isUnverifiedPurgeCandidate(u, nowMs)) candidates.push(u.id)
    }
    if (users.length < PER_PAGE) break
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, purged: 0, keptWithData: 0, failed: 0 })
  }

  // 2) 강아지·주문·정기배송이 있는 계정은 남긴다. 한 조회라도 실패하면 오늘은 아무도 지우지 않는다.
  const [dogs, orders, subs] = await Promise.all([
    selectInChunks(candidates, (chunk) => admin.from('dogs').select('user_id').in('user_id', chunk)),
    selectInChunks(candidates, (chunk) => admin.from('orders').select('user_id').in('user_id', chunk)),
    selectInChunks(candidates, (chunk) => admin.from('subscriptions').select('user_id').in('user_id', chunk)),
  ])
  const lookupErr = dogs.error ?? orders.error ?? subs.error
  if (lookupErr) {
    return NextResponse.json(
      { ok: false, reason: `강아지·주문·정기배송 확인 실패 — 오늘은 지우지 않음: ${lookupErr.message}` },
      { status: 500 },
    )
  }
  const hasData = new Set<string>()
  for (const r of [...(dogs.data ?? []), ...(orders.data ?? []), ...(subs.data ?? [])] as Array<{ user_id: string | null }>) {
    if (r.user_id) hasData.add(r.user_id)
  }
  const targets = candidates.filter((id) => !hasData.has(id)).slice(0, MAX_PER_RUN)

  // 3) 지운다(auth 사용자 삭제 → profiles 등은 FK 로 함께 지워진다).
  let purged = 0
  let failed = 0
  for (const id of targets) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) {
      failed += 1
      captureBusinessEvent('warning', 'cron.unverified_signup_purge.delete_failed', {
        userId: id,
        authError: error.message.slice(0, 200),
      })
      continue
    }
    purged += 1
  }

  return NextResponse.json({
    ok: true,
    checked: candidates.length,
    purged,
    keptWithData: candidates.filter((id) => hasData.has(id)).length,
    failed,
  })
}
