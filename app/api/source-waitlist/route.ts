import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zSourceWaitlist } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { dbError } from '@/lib/api/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/source-waitlist — 기능성 소스(레이어 B) 출시 알림 구독.
 *
 * body: { concerns: ('skin'|'joint'|'digestion'|'immune')[], dogId?: string }
 *
 * v3 추천 카드에서 "출시 알림 받기" 클릭 시 호출. concern 단위로 대기열에 등록
 * (restock_alerts 와 동일 패턴). 소스 상품 출시 시 cron 이 통지.
 *
 * 멱등성: (user, concern) 유니크 — 여러 번 눌러도 알림 한 번. upsert
 * ignoreDuplicates 로 중복 무시.
 *
 * graceful: source_waitlist 테이블이 아직 없으면(마이그레이션 미적용)
 * deferred=true 로 ok 응답 — UI 가 깨지지 않게. 테이블 적용 후부터 실제 저장.
 */
export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'source-waitlist',
    key: ipFromRequest(req),
    limit: 20,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const parsed = await parseRequest(req, zSourceWaitlist)
  if (!parsed.ok) return parsed.response
  const { concerns, dogId } = parsed.data

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

  const rows = [...new Set(concerns)].map((concern) => ({
    user_id: user.id,
    dog_id: dogId ?? null,
    concern,
  }))

  // source_waitlist 는 신규 테이블 — supabase typegen 미적용이라 unknown 캐스팅
  // (마이그레이션 20260606000001 적용 + gen types 후 제거 가능).
  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        upsert: (
          rows: Record<string, unknown>[],
          opts: { onConflict: string; ignoreDuplicates: boolean },
        ) => Promise<{ error: { code?: string } | null }>
      }
    }
  )
    .from('source_waitlist')
    .upsert(rows, { onConflict: 'user_id,concern', ignoreDuplicates: true })

  if (error) {
    // 42P01 = undefined_table — 마이그레이션 미적용. UI 깨짐 방지 위해 graceful.
    if ((error as { code?: string }).code === '42P01') {
      return NextResponse.json({ ok: true, deferred: true })
    }
    return dbError(error, 'source_waitlist', '출시 알림 등록에 실패했어요')
  }

  return NextResponse.json({ ok: true })
}
