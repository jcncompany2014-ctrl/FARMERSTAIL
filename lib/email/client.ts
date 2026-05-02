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
  /** 멱등 재시도 방지용 키 — Resend 자체 지원은 없지만 의도 표시용 로깅. */
  idempotencyKey?: string
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true; reason: 'not_configured' }
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

  const tags = input.tag ? [{ name: 'category', value: input.tag }] : undefined

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text ?? stripHtml(input.html),
        reply_to: input.replyTo ?? replyTo,
        tags,
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
