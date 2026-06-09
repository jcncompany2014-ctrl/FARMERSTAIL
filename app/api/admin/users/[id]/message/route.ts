import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { pushToUser } from '@/lib/push'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { recordAdminAction } from '@/lib/admin-audit'
import { sanitizeLogText } from '@/lib/log-sanitize'

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
  // 어드민 신뢰 대상이지만 실수 / 자동화 루프 방어를 위한 가벼운 limit.
  // 분당 30건 — 정상 CS 작업 한도, 실수로 spam loop 차단.
  const rl = rateLimit({
    bucket: 'admin-msg',
    key: ipFromRequest(req),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: rl.headers },
    )
  }

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

  // 자기 자신에게 발송 차단 — UI 실수 방지 (관리자가 회원 목록 검색 중 자기 row 누름)
  if (targetUserId === user.id) {
    return NextResponse.json(
      { ok: false, error: 'cannot_message_self' },
      { status: 400 },
    )
  }

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

  // url 은 동일 origin path 만 허용 — 외부 도메인으로 사용자 유도 차단.
  // 어드민 신뢰가 깨지는 시나리오 (계정 탈취 등) 에서 외부 phishing link
  // 발송을 막는 1차 방어선. "/" 로 시작하는 path 만 통과.
  const rawUrl =
    typeof parsed.url === 'string' && parsed.url.trim()
      ? parsed.url.trim().slice(0, 240)
      : undefined
  const url = rawUrl && rawUrl.startsWith('/') ? rawUrl : undefined

  if (rawUrl && !url) {
    return NextResponse.json(
      { ok: false, error: 'url_must_be_relative_path' },
      { status: 400 },
    )
  }

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

  // CS 양방향 thread 에도 같은 메시지 기록 — 사용자가 /mypage/cs 에서 답장
  // 가능. push 발송 실패해도 thread 에는 남도록 별도 처리. RLS 가 admin
  // role 만 insert 허용하므로 sender_id=user.id (현재 admin).
  // 점검 F: cs_messages insert error 무검사 → 스레드 누락을 조용히 삼키지 않도록
  // 경고 로그(요청 자체는 push 결과로 응답하므로 실패시켜 admin 을 혼란시키지 않음).
  const { error: csErr } = await supabase.from('cs_messages').insert({
    user_id: targetUserId,
    sender: 'admin',
    sender_id: user.id,
    body: title === body ? body : `${title}\n\n${body}`,
  })
  if (csErr) {
    console.warn(
      `[admin-message] cs_messages insert failed user=${targetUserId}: ${sanitizeLogText(csErr.message)}`,
    )
  }

  // Audit log — admin 이 사용자에게 보낸 메시지 추적 (분쟁 시 증거).
  await recordAdminAction(supabase, {
    action: 'user_message_send',
    entityType: 'user',
    entityId: targetUserId,
    diff: {
      after: { title, body_length: body.length, url: url ?? null },
    },
    req,
  })

  // pushToUser 자체도 { ok, sent, dead, reason } 를 반환 — sent>0 이면 ok 가 true.
  // 우리는 admin API 입장에서 호출 자체가 성공했음을 알리고 싶으므로 ok 는 그대로
  // pushToUser 의 결과를 따라간다 (구독 없으면 ok=false 지만 sent=0 으로 동작).
  return NextResponse.json(result)
}
