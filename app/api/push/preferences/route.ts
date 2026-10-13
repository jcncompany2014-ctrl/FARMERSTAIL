import { NextResponse } from 'next/server'
import { notifyConsentResult } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MARKETING_POLICY_VERSION } from '@/lib/consent'
import { dbError } from '@/lib/api/errors'
import { parsePrefsPatch, validateQuietHours, PUSH_PREF_DEFAULTS, type PushPrefs } from '@/lib/push-preferences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET  /api/push/preferences — 현재 사용자의 푸시 선호 조회. 행이 없으면 기본값 반환.
 * PATCH /api/push/preferences — **보낸 칸만** 바꾼다.
 *
 * body (PATCH):
 *   { notify_order?, notify_health?, notify_marketing?,
 *     quiet_hours_start?, quiet_hours_end? }
 *
 * quiet_hours 는 둘 다 null 이어야 "끄기" — 바꾼 뒤의 두 값(보낸 값 + 저장된 값)으로 검사한다.
 *
 * # ★2026-10-13 점검(규칙193) — '읽고 합쳐 다섯 칸 통째로 덮어쓰기'를 없앴다
 * 예전 PATCH 는 행을 읽고(오류는 버림) 기본값·읽은 값·보낸 값을 합쳐 **다섯 칸을 통째로 upsert** 했다.
 *  ① 읽기가 실패하면 '행 없음'으로 보여 기본값으로 합쳐졌다 — 배송 알림을 끈 고객이 방해 금지 시간만
 *    바꿔도 배송 알림이 다시 켜지는 식으로 **다른 칸이 기본값으로 되돌아갔다.**
 *  ② 두 토글을 빠르게 누르면 둘 다 옛 행을 읽고 각자 다섯 칸을 써서 **나중 요청이 먼저 요청을 지웠다.**
 *  ③ 광고 동의 변화 판정도 같은 '기본값(꺼짐)'을 이전 값으로 써서, 읽기 실패 때 이미 켠 사람을 '새로 켬'으로
 *    기록하거나 끈 사람의 철회를 놓칠 수 있었다(법정 증적이 틀린다).
 * 이제: 읽기 오류 = 503(아무것도 안 바꿈) · 행이 없으면 기본값으로 만들고(이미 있으면 그대로) ·
 *   **보낸 칸만 update** · 동의 변화는 실제로 읽은 이전 값과 비교한다.
 */

const COLS = 'notify_order, notify_health, notify_marketing, quiet_hours_start, quiet_hours_end'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }
  const { data, error } = await supabase
    .from('push_preferences')
    .select(COLS)
    .eq('user_id', user.id)
    .maybeSingle()
  // ★오류를 '행 없음'(=기본값)으로 접지 않는다(규칙1·193) — 화면이 기본값을 진짜 설정으로 그리면
  //   고객이 이미 끈 알림이 켜진 것처럼 보이고, 그 상태에서 누른 토글이 반대로 저장된다.
  if (error) {
    return dbError(error, 'push_preferences_read', '알림 설정을 불러오지 못했어요', 500)
  }
  return NextResponse.json({ ok: true, prefs: (data as PushPrefs | null) ?? PUSH_PREF_DEFAULTS })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: '요청 형식이 올바르지 않습니다' },
      { status: 400 },
    )
  }
  const parsed = parsePrefsPatch(raw)
  if (!parsed.ok) {
    return NextResponse.json({ code: 'INVALID_BODY', message: parsed.message }, { status: 400 })
  }
  const patch = parsed.patch

  // 1) 지금 값 — 오류면 아무것도 바꾸지 않는다(503). 기본값으로 착각하면 다른 칸이 되돌아간다.
  const readCurrent = () =>
    supabase.from('push_preferences').select(COLS).eq('user_id', user.id).maybeSingle()
  let { data: current, error: readErr } = await readCurrent()
  if (readErr) {
    return dbError(readErr, 'push_preferences_read', '지금 설정을 확인하지 못했어요. 잠시 후 다시 시도해 주세요', 503)
  }

  // 2) 행이 없으면 기본값으로 만든다 — 이미 있으면(동시에 만든 요청) 건드리지 않는다(on conflict do nothing).
  if (!current) {
    const { error: seedErr } = await supabase
      .from('push_preferences')
      .upsert({ user_id: user.id, ...PUSH_PREF_DEFAULTS }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (seedErr) {
      return dbError(seedErr, 'push_preferences_seed', '푸시 설정 저장에 실패했어요')
    }
    // 동시에 만든 요청이 있었다면 그 값이 '이전 값'이다 — 다시 읽는다.
    ;({ data: current, error: readErr } = await readCurrent())
    if (readErr || !current) {
      return dbError(readErr ?? { message: 'push_preferences 행을 만들었는데 읽히지 않음' }, 'push_preferences_read', '지금 설정을 확인하지 못했어요. 잠시 후 다시 시도해 주세요', 503)
    }
  }
  const prev = current as PushPrefs

  // 3) 방해 금지 시간은 바뀐 뒤의 두 값으로 검사한다(한쪽만 보내도 된다).
  const quietErr = validateQuietHours(prev, patch)
  if (quietErr) {
    return NextResponse.json({ code: 'INVALID_QUIET_HOURS', message: quietErr }, { status: 400 })
  }

  // 4) 보낸 칸만 바꾼다.
  const { data: saved, error } = await supabase
    .from('push_preferences')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select(COLS)
    .single()
  if (error || !saved) {
    return dbError(error ?? { message: 'push_preferences update 0행' }, 'push_preferences', '푸시 설정 저장에 실패했어요')
  }

  /**
   * 광고성 정보 수신 동의 증적 (정보통신망법 §50) — 2026-09-01 감사.
   *
   * 실제로 값이 **바뀐 경우에만** 남긴다 — 이전 값은 위에서 실제로 읽은 행이다(기본값 추측 아님, 규칙193).
   * 저장이 성공한 뒤에 기록한다(저장 실패한 동의를 증적에 남기지 않으려고).
   * ★기록은 서버가 service_role 로 쓴다(2026-10-13 규칙197) — 고객 권한의 consent_log INSERT 를 회수해
   *   고객이 임의 날짜·임의 동의 기록을 넣을 수 없다. 시각은 칸 기본값 now() 가 정한다.
   */
  if (typeof patch.notify_marketing === 'boolean' && patch.notify_marketing !== prev.notify_marketing) {
    let consentErr: { message: string } | null = null
    try {
      ;({ error: consentErr } = await createAdminClient().from('consent_log').insert({
        user_id: user.id,
        channel: 'push',
        granted: patch.notify_marketing,
        policy_version: MARKETING_POLICY_VERSION,
        source: 'app_settings',
      }))
    } catch (e) {
      consentErr = { message: e instanceof Error ? e.message : 'admin client unavailable' }
    }
    // 증적 실패가 설정 저장을 되돌리지는 않는다(고객은 이미 껐다/켰다).
    // 대신 조용히 넘기지 않는다 — 증적이 빠진 사실 자체가 문제다.
    if (consentErr) {
      console.error('[push/preferences] 광고 수신 동의 증적 기록 실패:', consentErr.message)
    }
    // ★처리결과 통지 (정보통신망법 §50⑦, 2026-09-25) — 앱 푸시 광고를 켜도 꺼도 14일 안에 알려야 한다.
    if (user.email) {
      await notifyConsentResult({
        email: user.email,
        channels: ['push'],
        granted: patch.notify_marketing,
      }).catch(() => {
        /* 통지 실패가 설정 저장을 되돌리지 않는다 */
      })
    }
  }

  return NextResponse.json({ ok: true, prefs: saved as PushPrefs })
}
