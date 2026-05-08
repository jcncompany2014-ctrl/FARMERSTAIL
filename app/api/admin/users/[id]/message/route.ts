import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { pushToUser } from '@/lib/push'

/**
 * POST /api/admin/users/[id]/message
 *
 * 어드민이 단일 사용자에게 1:1 푸시 알림을 보낸다. CS 도구.
 * Body: { title: string, body: string, url?: string }
 *
 * - 사용자가 push subscription 이 없으면 ok=true, sent=0 (실패가 아님 — 알림 안 받는 상태일 뿐)
 * - push_log 에 기록되므로 사용자의 알림 센터에 누적
 * - category='marketing' 이지만 어드민이 직접 보내는 1:1 CS 메시지는 quiet_hours/선호도 무시 — admin 의도
 *   (사용자 직접 신청한 환불 안내 등 critical CS 케이스)
 *
 * 보안: admin role 만 호출 가능. body 길이 제한.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { id: targetUserId } = await params

  let parsed: { title?: unknown; body?: unknown; url?: unknown }
  try {
    parsed = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const title =
    typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 80) : ''
  const body =
    typeof parsed.body === 'string' ? parsed.body.trim().slice(0, 240) : ''
  const url =
    typeof parsed.url === 'string' && parsed.url.trim()
      ? parsed.url.trim().slice(0, 240)
      : undefined

  if (!title || !body) {
    return NextResponse.json(
      { ok: false, error: 'title_and_body_required' },
      { status: 400 },
    )
  }

  // 대상 사용자 존재 검증
  const { data: targetProfile, error: profErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', targetUserId)
    .maybeSingle()
  if (profErr || !targetProfile) {
    return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  }

  // category 를 안 넘기면 카테고리 게이팅 없이 발송 (admin CS 메시지는 사용자 선호 무시)
  const result = await pushToUser(targetUserId, { title, body, url })

  // pushToUser 자체도 { ok, sent, dead, reason } 를 반환 — sent>0 이면 ok 가 true.
  // 우리는 admin API 입장에서 호출 자체가 성공했음을 알리고 싶으므로 ok 는 그대로
  // pushToUser 의 결과를 따라간다 (구독 없으면 ok=false 지만 sent=0 으로 동작).
  return NextResponse.json(result)
}
