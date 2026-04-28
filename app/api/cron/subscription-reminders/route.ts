import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { notifySubscriptionReminder } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/subscription-reminders
 *
 * 매일 1회 실행을 권장 (KST 09:00 ~ 10:00 사이). 다음 조건의 구독을 스캔해
 * 알림 메일 발송:
 *   - status = 'active'
 *   - reminder_enabled = true
 *   - next_delivery_date - reminder_days_before = 오늘 (KST)
 *
 * 응답: { checked, sent, errors }
 *
 * 보안: `CRON_SECRET` bearer. 값이 안 맞으면 401.
 *
 * # 멱등성
 *
 * Resend `idempotencyKey: sub-reminder:{sub_id}:{date}` 로 24h 안에 같은
 * (구독 × 배송일) 중복 발송이 자동 차단. 이 cron 이 일 중에 두 번 발사되거나
 * 재시도돼도 최대 1통.
 *
 * # 한계
 *
 * 사용자 timezone 이 KST 가 아니면 "오늘 도착" 판단이 어긋날 수 있다. 한국
 * 사용자 위주 서비스라 단일화. 글로벌 확장 시 user.timezone 컬럼 추가 + 그
 * 기준으로 KST → user TZ 변환 후 체크.
 */
type SubscriptionRow = {
  id: string
  user_id: string
  next_delivery_date: string
  reminder_days_before: number
  subscription_items: { product_name: string; quantity: number }[]
}

type ProfileRow = { id: string; name: string | null; email: string | null }

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'invalid cron secret' },
      { status: 401 },
    )
  }

  const admin = createAdminClient()

  // 오늘 (KST) 자정 기준 ISO. KST = UTC+9 → 그 자정이 ms 로는
  // (NOW + 9h 의 날짜의) 00:00 KST = (NOW + 9h 의 날짜) + UTC offset −9h.
  const nowKstStr = new Date(Date.now() + 9 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
  const todayKst = `${nowKstStr}T00:00:00+09:00`

  // 모든 reminder_enabled 활성 구독 — 조건이 컬럼 산술 ("date - days_before
  // = today") 이라 Postgres 측 필터가 어렵다. 우선 후보를 모은 뒤 클라(여기)
  // 에서 N일 전인지 판정. 활성 구독 수가 충분히 작아 풀스캔 가능.
  // 대량 트래픽이 되면 generated column (reminder_at) 에 인덱스를 거는 게 정공.
  const { data: subs, error } = await admin
    .from('subscriptions')
    .select(
      'id, user_id, next_delivery_date, reminder_days_before, subscription_items(product_name, quantity)',
    )
    .eq('status', 'active')
    .eq('reminder_enabled', true)
    .not('next_delivery_date', 'is', null)

  if (error) {
    console.error('[cron/subscription-reminders] subscriptions query failed', error)
    return NextResponse.json(
      { code: 'QUERY_FAILED', message: error.message },
      { status: 500 },
    )
  }

  // 오늘 KST 자정 ms.
  const todayMs = new Date(todayKst).getTime()
  const dueSubs: Array<{ sub: SubscriptionRow; days: number }> = []

  for (const sub of (subs ?? []) as SubscriptionRow[]) {
    if (!sub.next_delivery_date) continue
    // next_delivery_date 는 'YYYY-MM-DD' 형태로 가정.
    const deliveryMs = new Date(
      `${sub.next_delivery_date}T00:00:00+09:00`,
    ).getTime()
    const daysUntil = Math.round((deliveryMs - todayMs) / (24 * 3600 * 1000))
    // reminder_days_before === daysUntil 이면 오늘 알림 보낼 타이밍.
    if (daysUntil === sub.reminder_days_before) {
      dueSubs.push({ sub, days: daysUntil })
    }
  }

  if (dueSubs.length === 0) {
    return NextResponse.json({ checked: subs?.length ?? 0, sent: 0, errors: 0 })
  }

  // 수신자 프로필 일괄 조회 (in-list).
  const userIds = [...new Set(dueSubs.map((d) => d.sub.user_id))]
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds)
  const profileById = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  )

  let sent = 0
  let errors = 0
  for (const { sub, days } of dueSubs) {
    const profile = profileById.get(sub.user_id)
    if (!profile?.email) {
      // 이메일이 없으면 건너뜀 — 마케팅 동의 없이 거래성 메일만 발송하므로
      // 이메일 부재는 곧 미수신.
      continue
    }
    try {
      const result = await notifySubscriptionReminder({
        email: profile.email,
        name: profile.name,
        subscriptionId: sub.id,
        items: sub.subscription_items.map((it) => ({
          productName: it.product_name,
          quantity: it.quantity,
        })),
        nextDeliveryDate: sub.next_delivery_date,
        daysBefore: days,
      })
      if (result.ok) sent++
      else errors++
    } catch (err) {
      console.error('[cron/subscription-reminders] send failed', {
        subscriptionId: sub.id,
        err,
      })
      errors++
    }
  }

  return NextResponse.json({ checked: subs?.length ?? 0, sent, errors })
}
