import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { DCM_RISK_BREEDS } from '@/lib/chronic-sku-mapper'
import { petName } from '@/lib/korean'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/dcm-screening-reminder
 *
 * Round D3 (2026-05-20): F5-4 DCM 호발 견종 6개월 정기 검진 reminder.
 *
 * # 근거
 *   FDA 2018 grain-free DCM 보고서 + Mooney 2024 후속 — Doberman·Boxer·
 *   Cocker Spaniel·Great Dane·Irish Wolfhound·Golden Retriever·Newfoundland.
 *   타우린 결핍 검사 + 심초음파 6개월 정기 권장.
 *
 * # 동작
 *   1. 활성 dog 중 breed ∈ DCM_RISK_BREEDS 픽업.
 *   2. 마지막 같은 push (category='order' + DCM 식별 태그) 가 180일 이전 또는
 *      없으면 발송.
 *   3. push CTA — /dogs/{dogId} (수의사 상담 카드 노출 자리).
 *
 * # 일정
 *   매주 수 KST 11시 (UTC 02:00). weight-change / protein-rotation 슬롯과
 *   분리. 운영 부하 분산.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return trackCron('dcm-screening-reminder', () => runReminder())
}

async function runReminder(): Promise<Response> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = supabase as any

  const now = Date.now()
  const oneEightyDaysAgo = new Date(now - 180 * 86_400_000).toISOString()

  // DCM 호발 견종 dog 픽업.
  // breed 컬럼은 lib/breeds/registry.ts 의 code 와 매핑 (텍스트).
  const { data: dogsRaw } = await admin
    .from('dogs')
    .select('id, user_id, name, breed')
    .is('deleted_at', null)
    .in('breed', DCM_RISK_BREEDS)
    .limit(300)

  const dogs = (dogsRaw ?? []) as Array<{
    id: string
    user_id: string
    name: string
    breed: string
  }>

  let sent = 0
  let skippedSpam = 0
  let failed = 0

  for (const dog of dogs) {
    // 180일 이내 같은 알림 보냈으면 skip
    const tag = `dcm-screening-${dog.id}`
    const { count: recent } = await admin
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', dog.user_id)
      .ilike('title', '%미리 살펴두면%')
      .gt('sent_at', oneEightyDaysAgo)
    if ((recent ?? 0) > 0) {
      skippedSpam += 1
      continue
    }

    try {
      await pushToUser(
        dog.user_id,
        {
          title: `${petName(dog.name)} 심장, 미리 살펴두면 좋아요`,
          body: '우리 아이 견종은 심장이 조금 예민할 수 있어요. 6개월에 한 번쯤 병원에서 심장을 체크해두면 안심이 돼요. 꼭 지금이 아니어도 괜찮지만, 미리 챙기면 좋은 관리예요.',
          url: `/dogs/${dog.id}`,
          tag,
        },
        { category: 'health' },
      )
      sent += 1
    } catch {
      failed += 1
    }
  }

  return NextResponse.json({
    ok: true,
    total: dogs.length,
    sent,
    skipped_spam: skippedSpam,
    failed,
  })
}
