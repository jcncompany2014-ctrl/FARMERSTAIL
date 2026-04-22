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
 */

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
 * Send a push to every subscription registered for a given user. Dead subscriptions
 * (410 Gone / 404) are removed from the DB so we don't keep retrying.
 */
export async function pushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ ok: boolean; sent: number; dead: number; reason?: string }> {
  if (!ensureConfigured()) {
    return { ok: false, sent: 0, dead: 0, reason: 'VAPID_NOT_CONFIGURED' }
  }

  const supabase = await createClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  const rows = (subs ?? []) as SubRow[]
  if (rows.length === 0) return { ok: true, sent: 0, dead: 0 }

  const body = JSON.stringify(payload)
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
