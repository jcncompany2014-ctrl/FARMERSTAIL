import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

/**
 * Web Push helper.
 *
 * Requires env:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT (mailto: or https:)
 *
 * If any is missing, helpers return `{ ok: false, reason: 'VAPID_NOT_CONFIGURED' }`
 * so callers can degrade gracefully during local dev.
 *
 * Category gating
 * ---------------
 * `PushCategory` 는 push_preferences 의 카테고리 플래그와 1:1 매칭된다.
 * pushToUser 에 category 를 넘기면 (1) 그 플래그가 OFF 이거나 (2) 현재가
 * quiet_hours 안이면 발송을 skip 한다. 선호 행이 없으면 기본값으로 처리
 * (order/restock/cart=ON, marketing=OFF) — 마이그레이션 배포 전에도 동작.
 */

export type PushCategory = 'order' | 'restock' | 'cart' | 'marketing'

let configured = false

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  )
}

function ensureConfigured() {
  if (configured) return true
  if (!isPushConfigured()) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configured = true
  return true
}

export type PushPayload = {
  title: string
  body?: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

type SubRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * "현재 시각이 이 유저의 quiet 구간 안인가" 를 서울 기준으로 계산.
 * 랩어라운드(22→8) 를 지원하기 위해 start>end 면 "start 이후 OR end 이전" 으로.
 */
function isWithinQuietHours(
  startHour: number | null | undefined,
  endHour: number | null | undefined,
  now: Date = new Date()
): boolean {
  if (startHour == null || endHour == null) return false
  // Asia/Seoul 고정 — 한국 서비스 대상. intl API 로 정확한 TZ 시간을 추출.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    hour12: false,
  })
  const h = Number(fmt.format(now))
  if (Number.isNaN(h)) return false
  if (startHour === endHour) return false
  if (startHour < endHour) return h >= startHour && h < endHour
  // wrap-around: 22→8 → 22..23, 0..7
  return h >= startHour || h < endHour
}

/**
 * Send a push to every subscription registered for a given user. Dead subscriptions
 * (410 Gone / 404) are removed from the DB so we don't keep retrying.
 *
 * @param opts.category - `PushCategory` (선택). 주면 push_preferences 를 조회해
 *   사용자가 이 종류 알림을 허용하고 quiet hours 밖인지 확인. 없으면 언제나 발송.
 */
export async function pushToUser(
  userId: string,
  payload: PushPayload,
  opts?: { category?: PushCategory }
): Promise<{ ok: boolean; sent: number; dead: number; reason?: string }> {
  if (!ensureConfigured()) {
    return { ok: false, sent: 0, dead: 0, reason: 'VAPID_NOT_CONFIGURED' }
  }

  const supabase = await createClient()

  // 카테고리 게이트 — 선호 행이 없으면 기본값으로 대체.
  if (opts?.category) {
    const { data: pref } = await supabase
      .from('push_preferences')
      .select(
        'notify_order, notify_restock, notify_cart, notify_marketing, quiet_hours_start, quiet_hours_end'
      )
      .eq('user_id', userId)
      .maybeSingle()

    const flag = pref
      ? {
          order: pref.notify_order,
          restock: pref.notify_restock,
          cart: pref.notify_cart,
          marketing: pref.notify_marketing,
        }[opts.category]
      : opts.category !== 'marketing' // 행 없으면 marketing 만 기본 OFF
    if (!flag) {
      return { ok: true, sent: 0, dead: 0, reason: 'CATEGORY_DISABLED' }
    }
    if (
      pref &&
      isWithinQuietHours(pref.quiet_hours_start, pref.quiet_hours_end)
    ) {
      return { ok: true, sent: 0, dead: 0, reason: 'QUIET_HOURS' }
    }
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  const rows = (subs ?? []) as SubRow[]
  if (rows.length === 0) return { ok: true, sent: 0, dead: 0 }

  // 정보통신망법 §50④ — 광고성 정보 발송 시 매체에 (광고) 표기 의무.
  // 푸시는 모바일 알림센터/잠금화면에 노출되므로 광고 매체로 분류.
  // category 'marketing' 일 때만 title 에 "[광고]" 자동 prefix.
  // (이미 prefix 가 붙어 있으면 중복 추가하지 않음.)
  const stampedPayload: PushPayload =
    opts?.category === 'marketing'
      ? {
          ...payload,
          title: payload.title.startsWith('[광고]')
            ? payload.title
            : `[광고] ${payload.title}`,
        }
      : payload
  const body = JSON.stringify(stampedPayload)
  const dead: string[] = []
  let sent = 0

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body
        )
        sent += 1
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          dead.push(row.id)
        }
      }
    })
  )

  if (dead.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', dead)
  }
  return { ok: true, sent, dead: dead.length }
}
