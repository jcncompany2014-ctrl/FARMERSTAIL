import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

/**
 * 뉴스레터 수신거부 — GET(링크 클릭) · POST(메일 앱 원클릭, RFC 8058).
 *
 * unsubscribe_token 은 가입 시 자동 발급된 영구 토큰 (확인 후 cleared 되지
 * 않음 — 같은 사용자가 여러 번 해지/재가입 가능해야 하니).
 *
 * # RLS / 클라이언트 선택
 * 이전엔 anon UPDATE 를 RLS 로 열어 anon 키로 mass-unsubscribe 가 가능했다
 * (마이그레이션 20260502000000 에서 정책 제거). 이제 service-role 로 RLS 우회
 * + 라우트가 token 매칭 + 1행 좁힘.
 *
 * # ★POST 를 추가한 이유 (2026-08-20 7라운드 감사)
 * lib/email/client.ts 가 광고 메일에 `List-Unsubscribe-Post:
 * List-Unsubscribe=One-Click` 헤더를 붙인다. RFC 8058 상 이 헤더는 "이 URI 는
 * POST 를 받는다"는 **선언**이고, Gmail·Apple Mail 은 사용자가 기본 UI 의
 * '구독취소'를 누르면 GET 이 아니라 **POST** 를 보낸다. 그런데 이 파일엔
 * GET 뿐이라 Next 가 405 를 돌려줬다 — 우리가 지원한다고 선언해 놓고 실제로는
 * 실패하는 상태였다(수신거부 불이행 = 정보통신망법 §50 리스크, 게다가 실패가
 * 잦으면 메일 제공자가 도메인 평판을 깎는다).
 *
 * GET 은 사람이 보는 페이지로 redirect, POST 는 메일 클라이언트가 기대하는
 * 2xx 를 돌려준다(invalid·already 도 200 — 재시도를 유발하지 않는다. 단
 * DB 오류만 500 이라 제공자가 재시도한다).
 */

type UnsubResult = 'invalid' | 'already-unsubscribed' | 'unsubscribed' | 'error'

/** 토큰 검증 → 해지. 응답 형태는 호출부(GET/POST)가 정한다. */
async function applyUnsubscribe(token: string | undefined): Promise<UnsubResult> {
  if (!token || !/^[a-f0-9]{32}$/i.test(token)) return 'invalid'

  const supabase = createAdminClient()

  const { data: row, error: lookupErr } = await supabase
    .from('newsletter_subscribers')
    .select('id, email, status')
    .eq('unsubscribe_token', token)
    .maybeSingle()

  // 규칙1 — 조회 실패를 '그런 토큰 없음'으로 접으면 수신거부가 조용히 무시된다.
  if (lookupErr) return 'error'
  if (!row) return 'invalid'
  if (row.status === 'unsubscribed') return 'already-unsubscribed'

  const { error } = await supabase
    .from('newsletter_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  return error ? 'error' : 'unsubscribed'
}

export async function GET(req: Request) {
  const rl = rateLimit({
    bucket: 'newsletter-unsubscribe',
    key: ipFromRequest(req),
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요' },
      { status: 429, headers: rl.headers },
    )
  }

  const url = new URL(req.url)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin
  const result = await applyUnsubscribe(url.searchParams.get('token')?.trim())
  return NextResponse.redirect(`${baseUrl}/newsletter?status=${result}`)
}

/**
 * RFC 8058 원클릭 수신거부. 메일 앱이 보내므로 사람 UI 가 아니다.
 *
 * ⚠️ rate limit 버킷을 GET 과 나눈다 — 메일 제공자(Gmail 등)는 **자기 서버
 * IP** 로 POST 하므로 여러 고객의 수신거부가 한 IP 로 몰린다. GET 과 같은
 * 버킷(분당 10)을 쓰면 정상 수신거부가 429 로 막혀, 고치려던 문제가 다른
 * 얼굴로 재현된다. 토큰은 추측 불가(32자 hex)이고 한 번 해지하면 멱등이라
 * 넉넉히 잡는다.
 */
export async function POST(req: Request) {
  const rl = rateLimit({
    bucket: 'newsletter-unsubscribe-oneclick',
    key: ipFromRequest(req),
    limit: 300,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    // 제공자가 재시도하도록 429 (헤더 포함).
    return NextResponse.json({ ok: false }, { status: 429, headers: rl.headers })
  }

  const url = new URL(req.url)
  let token = url.searchParams.get('token')?.trim()

  // 토큰이 쿼리에 없으면 본문에서도 찾는다(제공자에 따라 form 으로 보낸다).
  if (!token) {
    try {
      const ct = req.headers.get('content-type') ?? ''
      if (ct.includes('application/x-www-form-urlencoded')) {
        const form = await req.formData()
        token = String(form.get('token') ?? '').trim() || undefined
      }
    } catch {
      /* 본문 파싱 실패 — 아래에서 invalid 로 처리된다 */
    }
  }

  const result = await applyUnsubscribe(token)
  // DB 오류만 재시도를 요청한다. invalid/already 는 재시도해도 같으므로 200.
  if (result === 'error') {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true, status: result })
}
