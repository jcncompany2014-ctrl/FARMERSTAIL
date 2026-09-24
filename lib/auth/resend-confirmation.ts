/**
 * 가입 인증 메일 재발송 결과 → 고객 문구 (순수 함수 — 테스트: resend-confirmation.test.ts).
 * 로그인 화면의 인증 미완료 판정도 여기 둔다 — 문자열 비교를 화면마다 두면 갈라진다.
 */

/** Supabase 가 인증 전 로그인에 돌려주는 오류 코드. */
export function isEmailNotConfirmed(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  if (err.code === 'email_not_confirmed') return true
  // 코드가 비어 오는 옛 응답 대비 — 메시지는 Supabase 고정 문구다.
  return /email not confirmed/i.test(err.message ?? '')
}

export type ResendResult = { ok: boolean; rateLimited: boolean; text: string }

export function resendConfirmationMessage(
  err: { status?: number | null; code?: string | null } | null | undefined,
): ResendResult {
  if (!err) {
    return {
      ok: true,
      rateLimited: false,
      text: '인증 메일을 다시 보냈어요. 받은편지함과 스팸함을 확인해 주세요.',
    }
  }
  if (err.status === 429 || err.code === 'over_email_send_rate_limit' || err.code === 'over_request_rate_limit') {
    return {
      ok: false,
      rateLimited: true,
      text: '방금 보냈어요. 1분쯤 뒤에 다시 시도해 주세요.',
    }
  }
  return {
    ok: false,
    rateLimited: false,
    text: '메일을 보내지 못했어요. 잠시 후 다시 시도하거나 고객센터로 알려 주세요.',
  }
}
