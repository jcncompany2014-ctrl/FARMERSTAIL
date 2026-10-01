import { NextResponse } from 'next/server'
import { resolveAutoDiscount } from '@/lib/payments/auto-discount'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { trackCron } from '@/lib/cron-tracking'
import { notifySubscriptionReminder } from '@/lib/email'
import { pushToUser } from '@/lib/push'
import { dbError } from '@/lib/api/errors'
import { getChargeTimings } from '@/lib/payments/charge-timing'
import { chargeDateFor, weekdayKo } from '@/lib/shipping-schedule'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/subscription-reminders
 *
 * 매일 1회 실행을 권장 (KST 09:00 ~ 10:00 사이). 다음 조건의 구독을 스캔해
 * 알림 메일 발송:
 *   - status = 'active'
 *   - reminder_enabled = true
 *   - ★**결제일** - reminder_days_before = 오늘 (KST) — 2026-10-01 일정 변경. 결제일은 청구 크론과 같은 정본
 *     (lib/shipping-schedule chargeDateFor): 일반 = 발송 3일 전 토요일(→ 목요일 알림), 서포터즈 체험 구간 =
 *     발송일(→ 일요일 알림). 예전엔 발송일 기준이라, 토요일에 이미 결제가 끝난 일반 고객은 사전 고지를
 *     **한 통도 받지 못했다**(결제 성공이 next_delivery_date 를 다음 주기로 민 뒤라 D-16 으로 보였다).
 *     결제 시점을 모르면(서포터즈 조회 실패) 아무것도 보내지 않고 빨간불 — 틀린 결제일을 알리느니.
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
  /** 실제 청구액 — 정기결제 사전고지에 금액을 넣기 위해 조회한다(2026-09-01 감사). */
  total_amount: number | null
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
  // R83-E3 (D3): trackCron wrap.
  return trackCron('subscription-reminders', async () => {
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
      'id, user_id, next_delivery_date, reminder_days_before, total_amount, subscription_items(product_name, quantity)',
    )
    .eq('status', 'active')
    .eq('reminder_enabled', true)
    .not('next_delivery_date', 'is', null)

  if (error) {
    return dbError(error, 'cron_subscription_reminders', '정기배송 알림 큐 조회 실패')
  }

  // 결제 시점(서포터즈 체험 구간 = 발송일, 그 외 = 발송 3일 전 토요일) — 모르면 보내지 않는다.
  const subList = (subs ?? []) as SubscriptionRow[]
  const timings = await getChargeTimings(subList.map((x) => x.user_id))
  if (!timings) {
    return NextResponse.json(
      { ok: false, reason: 'charge_timing_lookup_failed', note: '결제 시점을 몰라 사전 고지를 보내지 않음 — 내일 다시' },
      { status: 500 },
    )
  }

  // 오늘 KST 자정 ms.
  const todayMs = new Date(todayKst).getTime()
  const dueSubs: Array<{ sub: SubscriptionRow; days: number; chargeIso: string }> = []

  for (const sub of subList) {
    if (!sub.next_delivery_date) continue
    // next_delivery_date 는 **발송일**('YYYY-MM-DD'). 알림은 결제일 기준.
    const chargeIso = chargeDateFor(sub.next_delivery_date, timings.get(sub.user_id) ?? 'before_cooking')
    const chargeMs = new Date(`${chargeIso}T00:00:00+09:00`).getTime()
    const daysUntil = Math.round((chargeMs - todayMs) / (24 * 3600 * 1000))
    // reminder_days_before === daysUntil 이면 오늘 알림 보낼 타이밍.
    if (daysUntil === sub.reminder_days_before) {
      dueSubs.push({ sub, days: daysUntil, chargeIso })
    }
  }

  if (dueSubs.length === 0) {
    return NextResponse.json({ checked: subs?.length ?? 0, sent: 0, errors: 0 })
  }

  // 수신자 프로필 일괄 조회 (in-list).
  const userIds = [...new Set(dueSubs.map((d) => d.sub.user_id))]
  const { data: profiles, error: profilesErr } = await admin
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds)
  // 프로필 조회 실패를 빈 맵으로 접으면 **이메일만 조용히 누락**되고 푸시는
  // 나간다 — 받는 사람은 절반만 받은 걸 알 수 없다(2026-08-05 · 규칙1).
  if (profilesErr) {
    console.error('[subscription-reminders] 수신자 프로필 조회 실패:', profilesErr.message)
    return NextResponse.json(
      { ok: false, reason: 'profiles_lookup_failed', error: profilesErr.message },
      { status: 500 },
    )
  }
  const profileById = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  )

  let sent = 0
  let errors = 0
  let pushed = 0
  for (const { sub, days, chargeIso } of dueSubs) {
    const profile = profileById.get(sub.user_id)

    /**
     * ★사전고지 금액 = 실제 청구 금액 (2026-09-25 출시 전 점검 3차).
     * 예전엔 total_amount(할인 전)를 "결제될 금액"으로 알렸다. 청구 크론은
     * resolveAutoDiscount 로 체험단(100원·반값)·나무 10%·이벤트 할인을 적용해 긁으므로,
     * 체험단 고객은 "85,700원이 결제돼요"를 받고 체험이 끝난 줄 알았다. 정기결제
     * 사전고지는 실제 금액이어야 한다 — 청구와 **같은 함수**로 계산한다.
     */
    const chargeAmount =
      typeof sub.total_amount === 'number' && sub.total_amount > 0
        ? (await resolveAutoDiscount({ userId: sub.user_id, subtotal: sub.total_amount, subscriptionId: sub.id }))
            .chargeAmount
        : sub.total_amount

    // 이메일 발송 (수신자 프로필에 email 있으면).
    if (profile?.email) {
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
          chargeDate: chargeIso,
          daysBefore: days,
          chargeAmount,
        })
        if (result.ok) sent++
        else errors++
      } catch (err) {
        console.error('[cron/subscription-reminders] email send failed', {
          subscriptionId: sub.id,
          err,
        })
        errors++
      }
    }

    // 푸시 알림 — order 카테고리 (push_preferences 동의 + quiet hours 자동 검사).
    // 이메일과 별개. 이메일 OFF + 푸시 ON 사용자에게도 닿게.
    const itemCountLabel =
      sub.subscription_items.length > 1
        ? `${sub.subscription_items[0]?.product_name ?? '상품'} 외 ${sub.subscription_items.length - 1}개`
        : sub.subscription_items[0]?.product_name ?? '정기배송 상품'
    // ★결제 전 고지(2026-10-01) — 결제일 기준으로 말한다. 일반 고객은 토요일 결제·화요일 발송이다.
    const pushTitle =
      days === 0
        ? '오늘 다음 박스가 결제돼요'
        : days === 1
          ? '내일 다음 박스가 결제돼요'
          : `${days}일 뒤 다음 박스가 결제돼요`
    const mdw = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${weekdayKo(iso)})`
    const whenLine =
      chargeIso === sub.next_delivery_date
        ? `${mdw(chargeIso)} 아침 결제 · 같은 날 발송`
        : `${mdw(chargeIso)} 아침 결제 · ${mdw(sub.next_delivery_date)} 발송`
    // ★재실행 dedup — 같은 리마인더가 같은 날 두 번 나가지 않게 (2026-08-19
    //   5라운드 감사). 이메일은 Resend idempotencyKey(sub:date)로 이미 dedup
    //   되는데 푸시만 빠져 있어, 크론이 수동+예약으로 겹치거나 재시도되면 배송
    //   알림이 2번 갔다(payload 의 tag 는 클라 표시 병합 힌트일 뿐 두 번째 발생을
    //   못 막는다). push_log 엔 sub·tag 컬럼이 없어 user_id + 정확한 title(=
    //   day-offset 을 구분한다) + 20시간 창으로 앵커한다 — 같은 날 재실행만 막고
    //   D-3/D-1/D-0 시퀀스(각 다른 날·다른 title)와 다음 주기는 통과시킨다.
    //   조회 실패 시 푸시를 건너뛴다(모르면 안 보낸다 — 하루 늦는 것 < 두 번).
    const { count: alreadyPushed, error: dedupErr } = await admin
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', sub.user_id)
      .eq('title', pushTitle)
      // ★구독 단위로 거른다(2026-09-25) — 제목은 D-N 뿐이라 같은 날 두 번째 구독(둘째 강아지)의
      //   금액 사전고지가 '이미 보냄'으로 빠졌다. url 에 구독 id 가 들어 있다.
      .eq('url', `/mypage/subscriptions?focus=${sub.id}`)
      .gt('sent_at', new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString())
    if (dedupErr) {
      console.error('[cron/subscription-reminders] push dedup 조회 실패, 건너뜀', {
        subscriptionId: sub.id,
        err: dedupErr.message,
      })
    } else if ((alreadyPushed ?? 0) === 0) {
      // R84-D4: 이전엔 fire-and-forget (.then/.catch) → Vercel function 종료 시
      //   background promise 절단 가능. await 으로 안전화 + try/catch 격리.
      try {
        const res = await pushToUser(
          sub.user_id,
          {
            title: pushTitle,
            // 정기결제 사전고지 — 푸시로만 받는 고객도 금액·결제 사실을 알아야
            // 한다(2026-09-01 감사: 이전엔 품목명 한 줄뿐이었다).
            body:
              typeof chargeAmount === 'number' && chargeAmount > 0
                ? `${itemCountLabel} · ${chargeAmount.toLocaleString()}원 · ${whenLine}`
                : `${itemCountLabel} · ${whenLine}`,
            // ?focus 로 해당 구독 카드까지 자동 스크롤 + highlight + skip/pause 강조.
            // 결제 전 마지막 컨트롤 권한 — 1탭으로 도달.
            url: `/mypage/subscriptions?focus=${sub.id}`,
            tag: `sub-reminder-${sub.id}-${sub.next_delivery_date}`,
          },
          { category: 'order' },
        )
        if (res.ok && res.sent > 0) pushed++
      } catch {
        /* push 실패 — 다음 cycle 에 retry */
      }
    }
  }

    return NextResponse.json({ checked: subs?.length ?? 0, sent, errors, pushed })
  })
}
