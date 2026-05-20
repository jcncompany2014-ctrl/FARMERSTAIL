import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/quality-check-reminder
 *
 * Round D4 (2026-05-20): F4-5 자가품질검사 6개월 알람.
 *
 * # 근거
 *   사료관리법 시행규칙 별표 8 — 펫푸드 제조업자는 6개월 1회 자가품질검사
 *   (성분·미생물·중금속·이물) 의무. KAPA (한국애완동물협회) 분석 활용 권장.
 *
 * # 동작
 *   매월 1일 — admin role user (profiles.role='admin') 에게 push.
 *   "이번 달 KAPA 분석 일정 점검" + admin 가이드 페이지 링크.
 *
 * # 본인 알림 정책
 *   - solo 운영자 가정 (admin 1명).
 *   - 같은 달 내 중복 발송 차단 (push_log 30일 lookup).
 *
 * # 일정
 *   매월 1일 KST 9시 (UTC 00:00). "0 0 1 * *".
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('quality-check-reminder', () => runReminder())
}

async function runReminder(): Promise<Response> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any

  // admin user 픽업 — profiles.role='admin'.
  const { data: adminProfiles } = await admin
    .from('profiles')
    .select('id, name')
    .eq('role', 'admin')
    .limit(20)

  const admins = (adminProfiles ?? []) as Array<{ id: string; name: string | null }>

  if (admins.length === 0) {
    return NextResponse.json({
      ok: true,
      reason: 'no_admin_users',
      sent: 0,
    })
  }

  // 30일 spam 차단
  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString()

  // 현재 월·연도 (KST). 보고서 카피에 사용.
  const nowKst = new Date(now + 9 * 60 * 60 * 1000) // UTC + 9h
  const year = nowKst.getUTCFullYear()
  const month = nowKst.getUTCMonth() + 1 // 1-12

  let sent = 0
  let skippedSpam = 0
  let failed = 0

  for (const a of admins) {
    const { count: recent } = await admin
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', a.id)
      .ilike('title', '%자가품질검사%')
      .gt('sent_at', thirtyDaysAgo)
    if ((recent ?? 0) > 0) {
      skippedSpam += 1
      continue
    }

    try {
      await pushToUser(
        a.id,
        {
          title: `[관리자] ${year}년 ${month}월 자가품질검사 점검`,
          body: '사료관리법 별표 8 — 6개월 1회 KAPA 자가품질검사 의무. 마지막 검사일과 다음 일정 확인하세요.',
          url: '/admin',
          tag: `quality-check-${year}-${String(month).padStart(2, '0')}`,
        },
        { category: 'order' }, // 운영용 — order 카테고리 재사용 (별도 admin category 부재)
      )
      sent += 1
    } catch {
      failed += 1
    }
  }

  return NextResponse.json({
    ok: true,
    admins: admins.length,
    sent,
    skipped_spam: skippedSpam,
    failed,
  })
}
