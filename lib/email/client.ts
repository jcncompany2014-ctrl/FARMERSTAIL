/**
 * Farmer's Tail — Resend 메일 전송 최소 클라이언트.
 *
 * 왜 fetch 기반이냐:
 *   - `resend` npm 패키지는 내부에서 또 axios 비슷한 걸 번들해 Lambda 번들이
 *     커진다. 실제로 쓰는 건 POST /emails 엔드포인트 한 개뿐이라 fetch로 충분.
 *   - 새 의존성을 더하지 않는 쪽이 CI 설치·보안 감사 모두 가볍다.
 *
 * 환경변수:
 *   - `RESEND_API_KEY`  없으면 모든 호출이 `{ ok: false, skipped: true }` 로
 *                       조용히 지나간다. 로컬/스테이징에서 오작동 안 나도록.
 *   - `EMAIL_FROM`      "파머스테일 <no-reply@farmerstail.kr>" 같은 RFC 5322
 *                       형식. Resend는 도메인 인증된 주소만 허용.
 *   - `EMAIL_REPLY_TO`  (선택) 고객이 "답장" 눌렀을 때 가는 주소.
 *
 * 거래 메일은 "베스트 에포트" 정책: 전송 실패가 주문 완료를 막아선 안 된다.
 * 호출처는 `.catch()` 로 감싸거나 이 함수의 ok=false 반환을 로깅만 하고 넘기자.
 */
// NOTE: `process.env.X` 를 직접 읽는다. `@/lib/env` 의 zod 파싱은 서버 부팅
// 초기에 instrumentation.ts 에서 한 번만 돌리는 게 원칙. 여기서 다시 import
// 하면 Next.js 의 page-data-collection 단계에서 해당 라우트가 env 을 미리
// 파싱하려 들어 SUPABASE_SERVICE_ROLE_KEY 같은 서버 전용 시크릿이 유출된
// 것 처럼 오인된다 (실제로는 빌드 머신에 키가 없어서 throw).
// `admin.ts` 와 같은 전략으로, 런타임에 undefined 를 허용하고 조용히 no-op.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  /** HTML을 읽지 못하는 메일 클라이언트용 plain-text fallback. */
  text?: string
  /** 태그 (Resend 대시보드에서 그룹 집계). 예: 'order-confirmation' */
  tag?: string
  /** 기본 replyTo 를 덮어쓰고 싶을 때. */
  replyTo?: string
  /**
   * 멱등 재시도 방지용 키 — R95 (D7): Resend `Idempotency-Key` 헤더로 실제
   * 전달한다 (24시간 윈도우 dedup). 이전엔 body 어디에도 안 실리는 no-op
   * 이라, 이 키에만 의존하던 cron (subscription-reminders 등) 이 하루 2회
   * 발사 시 중복 발송될 수 있었다. 1~256자 권장.
   */
  idempotencyKey?: string
  /**
   * R87-A1: 광고성 메일 1-click unsubscribe URL. 넘기면 RFC 8058 헤더 추가:
   *   List-Unsubscribe: <https://...>, <mailto:...>
   *   List-Unsubscribe-Post: List-Unsubscribe=One-Click
   * Gmail/Yahoo 2024.2 bulk-sender 정책에서 mandatory — 누락 시 spam 폴더 직행.
   * Transactional 메일에는 unset (배송/결제 안내까지 unsubscribe 옵션 노출 안 함).
   */
  unsubscribeUrl?: string
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true; reason: 'not_configured' | 'suppressed' }
  | { ok: false; skipped: false; status: number; error: string }

/**
 * 메일 1건 전송. Resend REST 의 `POST /emails` 를 래핑한다.
 *
 * 반환:
 *   - `{ ok: true, id }`                — 성공, Resend 에서 부여한 메시지 ID
 *   - `{ ok: false, skipped: true }`    — RESEND_API_KEY 미설정, no-op
 *   - `{ ok: false, status, error }`    — API 응답 실패 (도메인 검증 실패 등)
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const replyTo = process.env.EMAIL_REPLY_TO
  if (!apiKey || !from) {
    return { ok: false, skipped: true, reason: 'not_configured' }
  }

  // R101-F: suppression 체크 — 하드바운스/스팸신고 주소엔 발송 안 함(도메인 평판).
  // fail-open: 조회 실패(테이블 부재/네트워크)면 그냥 발송(메일 누락 < 평판 리스크).
  if (await isAnyEmailSuppressed(input.to)) {
    return { ok: false, skipped: true, reason: 'suppressed' }
  }

  const tags = input.tag ? [{ name: 'category', value: input.tag }] : undefined

  // R87-A1: RFC 8058 List-Unsubscribe + List-Unsubscribe-Post 헤더 — 광고성 메일에만.
  // Resend body.headers 객체로 전달 (REST API 가 그대로 전달).
  // mailto fallback 은 사용자가 mail client 에서 답장으로 해지 의사 전달 가능.
  const mailtoFallback =
    process.env.EMAIL_REPLY_TO ?? 'help@farmerstail.kr'
  const extraHeaders: Record<string, string> | undefined = input.unsubscribeUrl
    ? {
        'List-Unsubscribe': `<${input.unsubscribeUrl}>, <mailto:${mailtoFallback}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
    : undefined

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        // R95 (D7): Resend 가 지원하는 멱등 헤더 — 같은 키로 24h 내 재요청
        // 시 Resend 가 첫 전송의 결과를 그대로 반환 (중복 발송 차단).
        // 키는 1~256자. cron 들이 `xxx-${id}-${date}` 형태로 전달.
        ...(input.idempotencyKey
          ? { 'Idempotency-Key': input.idempotencyKey.slice(0, 256) }
          : {}),
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text ?? stripHtml(input.html),
        reply_to: input.replyTo ?? replyTo,
        tags,
        ...(extraHeaders ? { headers: extraHeaders } : {}),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return {
        ok: false,
        skipped: false,
        status: res.status,
        error: body || `HTTP ${res.status}`,
      }
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id ?? '' }
  } catch (e) {
    return {
      ok: false,
      skipped: false,
      status: 0,
      error: e instanceof Error ? e.message : 'unknown',
    }
  }
}

/**
 * R101-F: 수신자 중 하나라도 email_suppressions(하드바운스/스팸신고)에 있으면 true.
 * createAdminClient 는 동적 import — client 번들/빌드 env 평가 영향 회피(상단 NOTE).
 * fail-open: 어떤 실패든 false 반환해 발송을 막지 않는다.
 */
async function isAnyEmailSuppressed(to: string | string[]): Promise<boolean> {
  const emails = (Array.isArray(to) ? to : [to]).map((e) => e.toLowerCase())
  if (emails.length === 0) return false
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { data } = await (
      admin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            in: (
              c: string,
              v: string[],
            ) => { limit: (n: number) => Promise<{ data: unknown[] | null }> }
          }
        }
      }
    )
      .from('email_suppressions')
      .select('email')
      .in('email', emails)
      .limit(1)
    return (data?.length ?? 0) > 0
  } catch {
    return false
  }
}

/** HTML → plain-text 폴백. 태그 제거 + 엔티티 최소 디코드. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h\d|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
