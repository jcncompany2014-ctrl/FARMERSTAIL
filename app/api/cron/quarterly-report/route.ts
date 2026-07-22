import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { notifyQuarterlyReport } from '@/lib/email'
import { TIERS } from '@/lib/tiers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/quarterly-report
 *
 * 새싹(sprout) 이상 등급 혜택 "분기 맞춤 분석 리포트" 의 백엔드.
 *
 * # 동작
 *   - 분기 1회 실행 (1·4·7·10월 1일 KST 09:00 / UTC 00:00 — "0 0 1 1,4,7,10 *")
 *   - 강아지별 *최신 분석*(analyses) 을 뽑아, 그 주인이 **새싹 이상 등급**
 *     (스탬프 1개 이상 = 첫 박스 결제)이면 영양 요약 리포트 메일 발송.
 *     ⚠️ 2026-07-16 등급 기준이 누적금액 → 스탬프 개수로 바뀌었다. 예전 코드는
 *     `cumulative_spend >= SPROUT_THRESHOLD` 였는데, 임계가 50,000(원)에서
 *     1(개)이 되면서 **'1원 이상 쓴 사람 전부'** 를 뽑는 조용한 오작동이 됐다.
 *     단위가 다른 값을 비교하고 있었던 것 — 이제 도달 등급(profiles.tier)을 본다.
 *   - 본인 강아지 데이터 요약(광고 없음) = 거래/정보성 메일이라 마케팅
 *     수신동의(agree_email) 게이트 없이 발송. 분석 페이지로 연결.
 *
 * # 중복 방지
 *   sendEmail idempotencyKey `quarterly-report:{dogId}:{YYYY-Qn}`.
 *   분기 1회 스케줄 + Resend 24h dedup 으로 같은 분기 중복 발송 차단 (별도
 *   DB 테이블 불필요).
 *
 * # 패턴
 *   reanalysis-reminder-6m 과 동일한 "analyses dog별 최신 dedup" 전략 +
 *   profiles 일괄 등급 게이트.
 */

/** 새싹 도달에 필요한 **스탬프 개수** (lib/tiers.ts 와 한 곳에서). */
const SPROUT_STAMPS = TIERS.find((t) => t.key === 'sprout')?.threshold ?? 1
/**
 * 새싹 이상 등급 키 — 게이트는 **살아있는 stamp_count 가 아니라 도달 등급(profiles.tier)**
 * 으로 한다(강등 없음 2026-07-22). 만료로 개수가 20 밑으로 줄어도 한 번 새싹이면
 * 분기 리포트는 계속 받는다.
 */
const SPROUT_OR_HIGHER_TIERS = TIERS.filter(
  (t) => t.threshold >= SPROUT_STAMPS,
).map((t) => t.key)
const MAX_PER_RUN = 1000
const PROFILE_CHUNK = 500

function quarterInfo(d: Date): { key: string; label: string } {
  const y = d.getFullYear()
  const q = Math.floor(d.getMonth() / 3) + 1
  return { key: `${y}-Q${q}`, label: `${y}년 ${q}분기` }
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('quarterly-report', () => runReport())
}

async function runReport(): Promise<Response> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any
  const { key: quarterKey, label: quarterLabel } = quarterInfo(new Date())

  // 1) 강아지별 최신 분석 (created_at DESC dedup) — N+1 회피, 1 round-trip.
  const { data: analyses } = await admin
    .from('analyses')
    .select(
      'dog_id, user_id, created_at, protein_pct, fat_pct, mer, feed_g, bcs_label, dogs(name, weight)',
    )
    .order('created_at', { ascending: false })
    .limit(8000)

  type Row = {
    dog_id: string
    user_id: string
    created_at: string | null
    protein_pct: number | null
    fat_pct: number | null
    mer: number | null
    feed_g: number | null
    bcs_label: string | null
    dogs?:
      | { name: string | null; weight: number | null }
      | Array<{ name: string | null; weight: number | null }>
      | null
  }
  const rows = (analyses ?? []) as Row[]
  const latestByDog = new Map<string, Row>()
  for (const r of rows) {
    if (!latestByDog.has(r.dog_id)) latestByDog.set(r.dog_id, r)
  }
  const dogs = Array.from(latestByDog.values())

  // 2) 등급 게이트 — 해당 user 들의 profiles 를 청크로 일괄 조회 (새싹 이상만).
  const userIds = [...new Set(dogs.map((d) => d.user_id))]
  const eligible = new Map<string, { email: string; name: string }>()
  for (let i = 0; i < userIds.length; i += PROFILE_CHUNK) {
    const chunk = userIds.slice(i, i + PROFILE_CHUNK)
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, name, tier')
      .in('id', chunk)
      .in('tier', SPROUT_OR_HIGHER_TIERS)
    for (const p of (profiles ?? []) as Array<{
      id: string
      email: string | null
      name: string | null
      tier: string | null
    }>) {
      if (p.email) eligible.set(p.id, { email: p.email, name: p.name ?? '보호자' })
    }
  }

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const r of dogs) {
    const user = eligible.get(r.user_id)
    if (!user) {
      skipped += 1
      continue
    }
    const dog = Array.isArray(r.dogs) ? r.dogs[0] : r.dogs
    try {
      const result = await notifyQuarterlyReport({
        email: user.email,
        recipientName: user.name,
        dogName: dog?.name ?? '우리 아이',
        dogId: r.dog_id,
        quarterKey,
        quarterLabel,
        weightKg: dog?.weight ?? null,
        bcsLabel: r.bcs_label,
        feedG: r.feed_g,
        merKcal: r.mer,
        proteinPct: r.protein_pct,
        fatPct: r.fat_pct,
      })
      if (result?.ok) sent += 1
      else failed += 1
    } catch {
      failed += 1
    }
    if (sent >= MAX_PER_RUN) break
  }

  return NextResponse.json({
    ok: true,
    quarter: quarterKey,
    dogs: dogs.length,
    eligible: eligible.size,
    sent,
    skipped,
    failed,
  })
}
