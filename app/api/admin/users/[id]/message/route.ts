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
 *
 * # 2026-10-15 F-b(규칙277) — 문의함 먼저, 응답은 둘을 따로
 * 예전엔 앱 알림을 먼저 보내고 문의함(cs_messages) 저장 실패는 서버 로그로만 삼켰다. 그래서 ① 문의함엔 들어갔는데 알림 기기가
 * 없으면 '발송되지 않았어요 — 다시 시도'(다시 보내면 같은 글이 두 번 쌓임), ② 문의함 저장이 실패해도 '발송했어요'(손님은 앱에서 글을
 * 못 찾음)였다. 이제 문의함에 먼저 적고, 실패하면 알림도 보내지 않고 오류로 돌려준다. 응답에 inboxSaved·pushOk·sent 를 따로 싣는다.
 * 탈퇴한 회원에게는 보내지 않는다(409 deleted_customer).
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

  // 대상 사용자 존재·탈퇴 확인 — 조회 실패를 '없음'과 가른다(규칙1).
  const { data: targetProfile, error: profErr } = await supabase
    .from('profiles')
    .select('id, deleted_at')
    .eq('id', targetUserId)
    .maybeSingle()
  if (profErr) {
    return NextResponse.json({ ok: false, error: 'user_lookup_failed' }, { status: 500 })
  }
  if (!targetProfile) {
    return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  }
  if (targetProfile.deleted_at) {
    return NextResponse.json({ ok: false, error: 'deleted_customer' }, { status: 409 })
  }

  // ① 문의함(cs_messages) 먼저 — 손님이 앱 1:1 문의에서 보는 곳. RLS 가 admin role 만 insert 허용하므로 sender_id=user.id.
  //   실패하면 알림도 보내지 않는다(알림만 가고 글은 없는 상태를 만들지 않는다) — 사장님은 '다시 눌러 주세요'를 본다.
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
    return NextResponse.json({ ok: false, error: 'inbox_save_failed', inboxSaved: false }, { status: 500 })
  }
  {
    // ★'답 안 한 문의'는 **답장한 순간** 처리로 친다 (2026-09-26 출시 전 점검 5차).
    //   예전엔 스레드를 열기만 해도 read_at 이 찍혀 대시보드·문의함에서 빠졌고, 확인만 하고
    //   나중에 답하려던 문의가 다시 떠오르지 않아 고객이 답을 못 받았다.
    const { error: readErr } = await supabase
      .from('cs_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', targetUserId)
      .eq('sender', 'user')
      .is('read_at', null)
    if (readErr) {
      console.warn(
        `[admin-message] 답장 후 처리 표시 실패 user=${targetUserId}: ${sanitizeLogText(readErr.message)}`,
      )
    }
  }

  // ② 앱 알림 — category 를 안 넘기면 카테고리 게이팅 없이 발송 (admin CS 메시지는 사용자 선호 무시).
  //   던져도 문의함 글은 이미 저장됐다 — 결과를 따로 알린다(다시 보내면 같은 글이 두 번 쌓인다).
  let result: { ok: boolean; sent: number; dead: number; reason?: string }
  try {
    result = await pushToUser(targetUserId, { title, body, url })
  } catch (e) {
    result = { ok: false, sent: 0, dead: 0, reason: sanitizeLogText(e instanceof Error ? e.message : 'push_exception') }
  }

  // Audit log — admin 이 사용자에게 보낸 메시지 추적 (분쟁 시 증거).
  await recordAdminAction(supabase, {
    action: 'user_message_send',
    entityType: 'user',
    entityId: targetUserId,
    diff: {
      after: { title, body_length: body.length, url: url ?? null, inboxSaved: true, pushSent: result.sent },
    },
    req,
  })

  // ok = 요청 성공(문의함에 저장됨). 알림 결과는 pushOk·sent 로 따로 — 화면이 '문의함엔 남겼고 알림은 안 갔어요'를 가른다.
  return NextResponse.json({
    ok: true,
    inboxSaved: true,
    pushOk: result.ok,
    sent: result.sent,
    dead: result.dead,
    reason: result.reason,
  })
}
