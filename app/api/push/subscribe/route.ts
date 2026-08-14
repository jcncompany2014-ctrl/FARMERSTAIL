import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isPushConfigured } from '@/lib/push'
import { zPushSubscribe } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { dbError } from '@/lib/api/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/push/subscribe
 * body: PushSubscription JSON (from pushManager.subscribe().toJSON())
 * Upserts a subscription row keyed by endpoint.
 */
export async function POST(req: Request) {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { code: 'VAPID_NOT_CONFIGURED', message: '푸시 설정이 완료되지 않았어요' },
      { status: 503 }
    )
  }

  // 사용자가 여러 디바이스에서 구독 가능하지만 분당 5회면 충분.
  const rl = rateLimit({
    bucket: 'push-subscribe',
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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요해요' },
      { status: 401 }
    )
  }

  const parsed = await parseRequest(req, zPushSubscribe)
  if (!parsed.ok) return parsed.response
  const { endpoint, keys } = parsed.data
  const p256dh = keys.p256dh
  const auth = keys.auth

  /**
   * ★endpoint 충돌 upsert 는 **service_role 로** 한다 (2026-08-14 4라운드 감사).
   *
   * push_subscriptions 에는 SELECT·INSERT·DELETE 정책만 있고 **UPDATE 정책이
   * 없다**(프로덕션 pg_policies 실측). 그런데 이건 `onConflict: 'endpoint'`
   * upsert 라 충돌 시 ON CONFLICT DO UPDATE 를 타고, 그 UPDATE 가 RLS 에
   * 걸린다. 롤백 트랜잭션으로 재현한 결과:
   *   · 본인이 같은 브라우저에서 알림을 **다시 켜기**        → 42501 거부
   *   · 공유 폰의 **다음 사용자**가 알림 켜기                 → 42501 거부
   * 화면에는 '푸시 구독 등록에 실패했어요' 만 뜬다. endpoint 는 브라우저당
   * 하나라, 한 번 남은 행이 그 브라우저의 알림을 영구히 잠갔다.
   *
   * 고객용 UPDATE 정책을 새로 열지 않는다 — 열어도 **다른 사용자의 행을
   * 넘겨받는 경우(공유 폰)** 는 USING 이 막아서 여전히 못 고치고, 대신 고객이
   * 쓸 수 있는 칸만 늘어난다(규칙3: 값을 검사하기 전에 못 쓰게 하는 층위).
   * endpoint 를 제시했다는 것 자체가 그 브라우저의 구독을 쥐고 있다는 뜻이고,
   * 소유자 판정은 위에서 검증한 세션의 `user.id` 가 책임진다 — 규칙8 의
   * "service_role 로 쓰고 범위는 코드가 책임진다" 와 같은 형태다.
   * (단일 문장이라 원자적이다. delete→insert 로 쪼개면 사이에서 죽었을 때
   *  구독이 사라진다.)
   */
  const userAgent = req.headers.get('user-agent') ?? null
  const { error } = await createAdminClient().from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
    },
    { onConflict: 'endpoint' }
  )
  if (error) {
    return dbError(error, 'push_subscribe', '푸시 구독 등록에 실패했어요')
  }
  return NextResponse.json({ ok: true })
}
