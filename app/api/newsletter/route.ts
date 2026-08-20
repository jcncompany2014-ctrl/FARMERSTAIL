import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { zNewsletterSubscribe } from '@/lib/api/schemas'
import { parseRequest } from '@/lib/api/parseRequest'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'
import { notifyNewsletterConfirm } from '@/lib/email'

/**
 * POST /api/newsletter — 뉴스레터 구독 신청.
 *
 * Body: { email: string, source?: string }
 *
 * 동작:
 *   1. Zod 검증 (이메일 형식)
 *   2. 기존 구독자 (status=confirmed) 면 200 + alreadySubscribed 반환
 *   3. 기존 구독자 (status=unsubscribed) 면 status='pending' 으로 재활성화
 *   4. 신규 → insert (status='pending', confirm_token 발급)
 *   5. 추후: Resend 로 confirm 메일 발송 — 1차는 placeholder
 *
 * # 보호
 * - Rate limit: IP 당 분당 5회 — confirm 메일 spam / DB 무제한 insert 방어
 *
 * RLS:
 *   - newsletter_subscribers 의 public insert 정책이 status=pending 만 허용.
 *   - 본 route 는 server-side anon client 를 사용해 정책에 맞게 insert.
 */

export async function POST(req: Request) {
  // confirm 메일 발송 (Resend 비용) + DB insert 폭주 방어
  const rl = rateLimit({
    bucket: 'newsletter-subscribe',
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

  const parsed = await parseRequest(req, zNewsletterSubscribe)
  if (!parsed.ok) return parsed.response
  const email = parsed.data.email.trim().toLowerCase()
  const source = (parsed.data.source ?? 'web').slice(0, 32)

  // ★admin — 이 조회는 RLS 로 **항상 0행**이었다(2026-08-05 병렬 감사).
  //   newsletter_subscribers 에는 anon SELECT 정책이 없다(INSERT + admin 뿐).
  //   그래서 ① 아래 "이미 구독 중" 안내와 재활성화 경로가 한 번도 실행된 적이
  //   없고(해지한 사람은 영구히 재구독 불가), ② 항상 insert 로 직행해 UNIQUE
  //   위반 500 이 났다 — 그 500/200 차이로 **어떤 주소가 명단에 있는지**가
  //   외부에 드러났다. 규칙1("조회 실패 ≠ 데이터 없음")의 RLS 판이다.
  //   범위는 코드가 책임진다(.eq('email', ...) — 단일 행).
  const supabase = createAdminClient()

  // 1) 기존 row 확인
  const { data: existing, error: existingErr } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .maybeSingle()
  if (existingErr) {
    console.error('[newsletter] 기존 구독 조회 실패:', existingErr.message)
    return NextResponse.json(
      { code: 'LOOKUP_FAILED', message: '신청 중 오류가 발생했어요.' },
      { status: 500 },
    )
  }

  if (existing) {
    if (existing.status === 'confirmed') {
      return NextResponse.json({
        ok: true,
        alreadySubscribed: true,
        message: '이미 구독 중인 이메일이에요.',
      })
    }
    // pending / unsubscribed 모두 → pending 으로 재활성화 (새 token 발급)
    const confirmToken = crypto.randomUUID().replace(/-/g, '')
    const { error: upErr } = await supabase
      .from('newsletter_subscribers')
      .update({
        status: 'pending',
        confirm_token: confirmToken,
        unsubscribed_at: null,
        source,
      })
      .eq('id', existing.id)
    if (upErr) {
      return NextResponse.json(
        { code: 'UPDATE_FAILED', message: '재활성화에 실패했어요.' },
        { status: 500 },
      )
    }
    // double opt-in confirm 메일 — fire-and-forget. 발송 실패해도 사용자에게는
    // "확인 메일을 보냈어요" 라고 응답해 spam check 우회 차단.
    notifyNewsletterConfirm({ email, confirmToken }).catch(() => {
      /* swallow */
    })
    return NextResponse.json({
      ok: true,
      reactivated: true,
      message: '확인 메일을 보냈어요. 이메일을 열어 구독을 마무리해 주세요.',
    })
  }

  // 2) 신규 insert
  const confirmToken = crypto.randomUUID().replace(/-/g, '')
  /**
   * ★사용자 확인은 **쿠키 클라이언트**로 (2026-08-20 7라운드 감사).
   *
   * 위 `supabase` 는 service_role admin 클라이언트라 세션이 없다(persistSession
   * false·쿠키 없음). 그래서 여기서 getUser() 를 부르면 로그인한 사람이
   * 신청해도 **항상 null** 이었고, user_id 가 언제나 NULL 로 저장됐다.
   * 그 결과 탈퇴 시 user_id 기준 삭제가 한 건도 못 지워 광고 메일이 계속 갔다
   * (규칙8 의 거울상 — 거기선 쿠키 클라이언트를 크론에서 써서 0행이 됐다).
   * 비로그인 신청도 정상 경로이므로 실패는 조용히 null 로 둔다.
   */
  let userId: string | null = null
  try {
    const cookieClient = await createClient()
    const {
      data: { user },
    } = await cookieClient.auth.getUser()
    userId = user?.id ?? null
  } catch {
    /* 비로그인·세션 오류 — user_id 없이 진행(이메일이 조인 키다) */
  }

  const { error: insErr } = await supabase
    .from('newsletter_subscribers')
    .insert({
      email,
      user_id: userId,
      status: 'pending',
      confirm_token: confirmToken,
      source,
    })

  if (insErr) {
    return NextResponse.json(
      { code: 'INSERT_FAILED', message: '신청 중 오류가 발생했어요.' },
      { status: 500 },
    )
  }

  // double opt-in — confirm 메일 발송 후 사용자가 토큰 링크를 클릭해야 비로소
  // status='confirmed' 로 전환. 정보통신망법 §50 명시 동의 절차 준수.
  // 메일 발송 실패해도 row 는 남기고 사용자 응답엔 정상 — 재시도는 사용자가
  // 다시 구독 신청하면 토큰 갱신 + 재발송.
  notifyNewsletterConfirm({ email, confirmToken }).catch(() => {
    /* swallow — Resend 미설정 / 일시 오류 시 다음 신청에 재발송 */
  })

  return NextResponse.json({
    ok: true,
    subscribed: true,
    message: '확인 메일을 보냈어요. 이메일을 열어 구독을 마무리해 주세요.',
  })
}
