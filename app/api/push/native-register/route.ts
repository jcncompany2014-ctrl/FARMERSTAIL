import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zNativePushRegister } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/push/native-register
 *
 * Capacitor 네이티브 앱이 첫 실행 시 또는 알림 토글 ON 시 호출.
 * APNs / FCM 토큰을 native_push_tokens 테이블에 upsert.
 *
 * # 멱등성
 * (user_id, device_id) 가 UNIQUE — 같은 디바이스에서 토큰 갱신되면 row update.
 * Supabase upsert with `onConflict: 'user_id,device_id'`.
 *
 * # 보안
 * - 로그인 사용자만
 * - rate limit 분당 5
 * - Zod 검증 (platform, token 길이, deviceId)
 */
export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'native-push-register',
    key: ipFromRequest(req),
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, zNativePushRegister)
  if (!parsed.ok) return parsed.response
  const { platform, token, deviceId, appVersion, osVersion } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  const { error } = await supabase.from('native_push_tokens').upsert(
    {
      user_id: user.id,
      platform,
      token,
      device_id: deviceId,
      app_version: appVersion ?? null,
      os_version: osVersion ?? null,
    },
    { onConflict: 'user_id,device_id' },
  )

  if (error) {
    return NextResponse.json(
      { code: 'DB_ERROR', message: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/push/native-register
 * body: { deviceId } — 사용자가 알림 OFF 또는 앱 삭제 시 토큰 제거.
 */
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 },
    )
  }

  const url = new URL(req.url)
  const deviceId = url.searchParams.get('deviceId')
  if (!deviceId) {
    return NextResponse.json(
      { code: 'INVALID_BODY', message: 'deviceId 가 필요합니다' },
      { status: 400 },
    )
  }

  await supabase
    .from('native_push_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('device_id', deviceId)

  return NextResponse.json({ ok: true })
}
