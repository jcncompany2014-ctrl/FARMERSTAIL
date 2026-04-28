import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyWelcome } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/welcome-email
 *
 * 회원가입 직후 client 가 fire-and-forget 으로 호출. 서버에서 현재 세션을
 * 확인해 본인 이메일/이름으로만 환영 메일을 발송한다.
 *
 * 왜 server hook 이 아닌가
 * ────────────────────
 * Supabase Auth Hooks (database trigger on auth.users insert) 로도 가능하지만:
 *   1) Supabase 프리/프로 플랜에서 hook 환경 (edge function) 을 추가 호출하는
 *      로직을 계속 운영해야 함
 *   2) 우리 profiles update 가 client 에서 일어나서 name 이 hook 시점에 비어
 *      있을 가능성이 큼 — name 빈 메일이 가는 것보다 client 호출이 정확
 *
 * 보안: 본인 user 확인 + email/name 모두 서버에서 다시 조회 (client 가 임의의
 * 이메일 주소를 넘겨 발송하는 abuse 차단). Resend tag 'welcome' 으로 분류.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const email = user.email
  if (!email) {
    return NextResponse.json({ error: 'no_email' }, { status: 400 })
  }

  // name 은 profiles 에서 조회 — auth.users 메타데이터엔 안 들어감.
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()

  // best-effort 발송. notifyWelcome 자체가 idempotencyKey 를 걸어두기 때문에
  // 같은 이메일로 두 번 호출돼도 Resend 가 한 번만 발송 (24h 윈도우).
  try {
    await notifyWelcome({ email, name: profile?.name ?? null })
  } catch (err) {
    // 메일 실패가 가입 플로우를 막아선 안 됨. console.error → Sentry 로 흐름.
    console.error('[welcome-email] notifyWelcome failed', err)
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
