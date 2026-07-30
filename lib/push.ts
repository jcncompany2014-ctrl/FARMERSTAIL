import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureBusinessEvent } from '@/lib/sentry/trace'

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
 * (order/health=ON, marketing=OFF).
 *
 * ⚠️ 카테고리를 늘리기 전에 — 왜 3종인가 (2026-07-16)
 * 한때 restock·cart 가 있었지만 낱개 커머스와 함께 사라졌다. 그런데 정작
 * **건강 알림엔 카테고리가 없어서** 체중 리마인더·검진 권고가 'order' 로
 * 위장해 나갔다 → 보호자가 배송 알림을 끄면 건강 경보까지 꺼졌다.
 * 카테고리는 "보내는 쪽 사정"이 아니라 **보호자가 끄고 싶어 하는 단위**로
 * 나눈다. 그 단위가 늘지 않으면 카테고리도 늘리지 않는다.
 *
 * ⚠️ 왜 service_role 클라이언트인가 — 안 그러면 **한 건도 안 나간다** (2026-07-30)
 * 이 파일은 쿠키 기반 `createClient()` 를 쓰고 있었다. 그런데 이 함수를 부르는
 * 곳은 대부분 **크론과 웹훅**이고, 거기엔 로그인 쿠키가 없다 → `auth.uid()` 가
 * NULL 이다. 관련 4개 테이블(push_subscriptions · push_preferences ·
 * push_log · native_push_tokens)의 RLS 는 전부 `auth.uid() = user_id`
 * self-only 라서(실측), 크론에서는 **모든 조회가 0행**이 된다:
 *
 *   구독 0행 → `rows.length === 0` → `{ ok: true, sent: 0 }` 로 조용히 성공 반환
 *
 * "받는 사람이 없음"과 "볼 권한이 없음"이 같은 모양이어서, 배송·결제·건강 알림이
 * 전부 나가지 않으면서 **모든 크론이 성공으로 집계**됐다.
 * `push_log` 는 더해서 INSERT 정책이 아예 없다(SELECT·UPDATE 만) — 기록도 거부돼
 * 알림 센터가 영구히 비어 있었고, 그 오류는 아래 catch 가 삼켰다.
 *
 * → 이 함수는 `userId` 를 인자로 받아 스스로 `.eq('user_id', userId)` 로 범위를
 *   좁힌다. RLS 로 대신 좁힐 필요가 없고, 크론에서는 좁힐 수도 없다.
 *   **service_role 로 조회하고 범위는 코드가 책임진다.**
 *   서버 전용이다(webpush 는 node 모듈이라 클라이언트 번들에 들어가지 않는다).
 *
 * 지금은 구독자가 0명이라 실제 피해가 없었다(실측: web 0 · native 0 · 로그 0건).
 * 첫 고객이 알림을 허용하는 순간 드러날 문제였다.
 */

export type PushCategory = 'order' | 'health' | 'marketing'

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
 * @param opts.nudge - **안 보내도 되는 권유성**이면 true (체중 재기 리마인더·체크인·
 *   설문 이어하기·광고). 주 2건 상한이 여기에만 걸린다. 경보·거래 통지엔 붙이지 말 것 —
 *   붙이는 순간 잔소리에 밀려 안 나갈 수 있다.
 */
export async function pushToUser(
  userId: string,
  payload: PushPayload,
  opts?: { category?: PushCategory; nudge?: boolean }
): Promise<{ ok: boolean; sent: number; dead: number; reason?: string }> {
  if (!ensureConfigured()) {
    return { ok: false, sent: 0, dead: 0, reason: 'VAPID_NOT_CONFIGURED' }
  }

  // service_role 키가 없는 환경(로컬 dev 등)에서 throw 로 호출부를 깨지 않는다 —
  // 이 파일의 기존 graceful degradation(VAPID_NOT_CONFIGURED)과 같은 방식.
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return { ok: false, sent: 0, dead: 0, reason: 'ADMIN_CLIENT_UNAVAILABLE' }
  }

  // 카테고리 게이트 — 선호 행이 없으면 기본값으로 대체.
  if (opts?.category) {
    const { data: pref, error: prefErr } = await supabase
      .from('push_preferences')
      .select(
        'notify_order, notify_health, notify_marketing, quiet_hours_start, quiet_hours_end'
      )
      .eq('user_id', userId)
      .maybeSingle()

    // 조회 실패는 "선호 없음"과 다르다. 다만 여기서 막아버리면 결제·배송 통지가
    // 사라지므로, **기본값으로 진행하고 사람에게 알린다**(marketing 은 기본 OFF 라
    // 광고만 자동으로 잠긴다 — 유리한 쪽으로 닫힌다).
    if (prefErr) {
      captureBusinessEvent('warning', 'push.preferences.query_failed', {
        userId,
        category: opts.category,
        dbError: prefErr.message,
      })
    }

    const flag = pref
      ? {
          order: pref.notify_order,
          health: pref.notify_health,
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

  // 능동 개입 빈도 상한 — voice-guidelines §5 정책 (주 2건).
  //
  // ⚠️ 카테고리로 걸지 않는다. 'health' 안에 "체중 재주세요"(안 보내도 되는 잔소리)와
  // "체중이 급격히 줄었어요"(절대 잘리면 안 되는 경보)가 같이 살기 때문이다.
  // 보내는 쪽이 `nudge: true` 로 스스로 권유성이라 밝힌 것만 센다 — 경보는 밝히지
  // 않으므로 상한과 무관하게 항상 나간다.
  if (opts?.nudge) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { count, error: countErr } = await supabase
      .from('push_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('nudge', true)
      .gte('sent_at', sevenDaysAgo)
    // 셀 수 없으면 상한을 보장할 수 없다. 권유성 알림은 **안 보내는 쪽**으로 —
    // 경보는 nudge 를 안 붙이므로 이 분기에 걸리지 않는다(잔소리만 잠긴다).
    if (countErr) {
      captureBusinessEvent('warning', 'push.nudge_cap.query_failed', {
        userId,
        dbError: countErr.message,
      })
      return { ok: true, sent: 0, dead: 0, reason: 'NUDGE_CAP_UNVERIFIABLE' }
    }
    if ((count ?? 0) >= 2) {
      return { ok: true, sent: 0, dead: 0, reason: 'RATE_LIMITED_WEEKLY' }
    }
  }

  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  // ★ 조회 실패를 "받는 사람 없음"으로 보고하면 안 된다 — 그게 이 파일의 원래 버그다.
  if (subsErr) {
    captureBusinessEvent('error', 'push.subscriptions.query_failed', {
      userId,
      dbError: subsErr.message,
    })
    return { ok: false, sent: 0, dead: 0, reason: 'SUBS_QUERY_FAILED' }
  }

  const rows = (subs ?? []) as SubRow[]

  // ⚠️ 여기에 `if (rows.length === 0) return` 을 두지 말 것 (2026-07-30 제거).
  // 그 조기 반환이 **네이티브 팬아웃 앞에** 있었다 → 웹 푸시 구독이 없고 APNs/FCM
  // 토큰만 있는 사용자(= 앱스토어로 설치한 iOS/Android 사용자 대부분)에게는
  // 단 한 건도 안 나갔다. 웹 0건은 정상 상태이고 종료 조건이 아니다.

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
    const { error: delErr } = await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', dead)
    // 못 지우면 다음 발송에서 또 410 을 받는다 — 발송 자체는 성공이므로 알리고 진행.
    if (delErr) {
      captureBusinessEvent('warning', 'push.dead_subscription.delete_failed', {
        userId,
        count: dead.length,
        dbError: delErr.message,
      })
    }
  }

  // ── Native (APNs/FCM) fan-out ─────────────────────────────────────────
  // 같은 user 의 native 토큰들에도 같은 알림 발송. 환경변수 미설정 시
  // sendNativePush 가 즉시 실패 반환 — 정상 흐름 유지.
  const { data: nativeRows, error: nativeErr } = await supabase
    .from('native_push_tokens')
    .select('id, platform, token')
    .eq('user_id', userId)
  if (nativeErr) {
    captureBusinessEvent('error', 'push.native_tokens.query_failed', {
      userId,
      dbError: nativeErr.message,
    })
  }
  type NativeRow = { id: string; platform: 'ios' | 'android'; token: string }
  const nativeList = (nativeRows ?? []) as NativeRow[]
  const deadNative: string[] = []
  let nativeSent = 0
  if (nativeList.length > 0) {
    const { sendNativePush } = await import('./push/native')
    await Promise.all(
      nativeList.map(async (row) => {
        // native 도 광고 표기가 붙은 제목을 쓴다 — 웹만 붙던 것 함께 정리.
        const result = await sendNativePush(row.platform, row.token, {
          title: stampedPayload.title,
          body: stampedPayload.body ?? '',
          url: stampedPayload.url,
          threadId: stampedPayload.tag,
        })
        if (result.ok) {
          nativeSent += 1
        } else if (result.unregistered) {
          deadNative.push(row.id)
        }
      }),
    )
  }
  if (deadNative.length > 0) {
    const { error: delNativeErr } = await supabase
      .from('native_push_tokens')
      .delete()
      .in('id', deadNative)
    if (delNativeErr) {
      captureBusinessEvent('warning', 'push.dead_native_token.delete_failed', {
        userId,
        count: deadNative.length,
        dbError: delNativeErr.message,
      })
    }
  }

  // 알림 센터 (`/notifications`) 가 조회할 push_log 에 이력 저장. 0건 발송
  // (sub 없음) 도 기록 — 발송 시도/실패 자체가 디버깅 신호. RLS 가 self-only
  // select 라 다른 사용자에 노출 안 됨.
  //
  // ⚠️ 여기는 try/catch 로 감싸도 아무것도 잡지 못했다 — `.insert()` 는 throw 가
  // 아니라 `{ error }` 를 돌려준다. 그래서 "실패는 무시" 주석과 달리 **오류가
  // 통째로 버려졌다.** push_log 에는 INSERT 정책이 아예 없어서(SELECT·UPDATE 만)
  // 이 insert 는 늘 거부되고 있었고, 알림 센터가 왜 비어 있는지 아무 흔적도
  // 남지 않았다. service_role 로 바뀌어 이제 통과하지만, 오류는 드러낸다.
  // 발송 자체엔 영향 없으니 흐름은 그대로 진행한다.
  const totalSent = sent + nativeSent
  const { error: logErr } = await supabase.from('push_log').insert({
    user_id: userId,
    title: stampedPayload.title,
    body: stampedPayload.body ?? '',
    url: stampedPayload.url ?? null,
    category: opts?.category ?? null,
    nudge: opts?.nudge ?? false,
    sent_count: totalSent,
  })
  if (logErr) {
    captureBusinessEvent('warning', 'push.log.insert_failed', {
      userId,
      category: opts?.category ?? null,
      sentCount: totalSent,
      dbError: logErr.message,
    })
  }

  return {
    ok: true,
    sent: totalSent,
    dead: dead.length + deadNative.length,
  }
}
