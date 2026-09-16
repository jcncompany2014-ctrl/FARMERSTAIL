import { createAdminClient } from '@/lib/supabase/admin'
import { notifyWelcome } from '@/lib/email'

/**
 * 가입 환영 메일 — 첫 홈 진입에서 한 통.
 *
 * # 왜 홈인가
 * 프로필은 auth 트리거(handle_new_user)가 만들어 앱 코드에 "가입 직후" 지점이
 * 없다. 이메일·카카오·애플 세 가입 경로가 전부 홈으로 모이니 거기서 잡는다
 * (푸시 자동 등록과 같은 자리). 2026-09-15 검수 전까지 이 메일은 **서비스
 * 시작부터 한 통도 안 나갔다** — 템플릿은 있는데 부르는 코드가 없었다.
 *
 * # 두 번 안 보내는 법
 * profiles.welcome_email_sent_at 을 **먼저 선점**한다(null 인 행만 now() 로
 * UPDATE, 통과한 쪽만 보낸다) — 두 탭이 동시에 열려도 한 통이다. 발송이 실제로
 * 실패하면 표시를 되돌려 다음 홈 진입에 다시 시도한다. 억제 목록(bounce)이나
 * 이메일 없음(카카오)은 재시도할 이유가 없으니 표시를 남긴 채 끝낸다.
 * Resend idempotencyKey 만 믿으면 안 된다 — 24시간 창이라 그 뒤엔 또 간다.
 */
export type WelcomeResult = 'sent' | 'already' | 'no_email' | 'skipped' | 'failed'

export async function sendWelcomeEmailOnce(userId: string): Promise<WelcomeResult> {
  const admin = createAdminClient()

  const { data: claimed, error: claimErr } = await admin
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', userId)
    .is('welcome_email_sent_at', null)
    .select('email, name')
    .maybeSingle()
  if (claimErr) {
    console.error('[welcome-email] 선점 실패:', claimErr.message)
    return 'failed'
  }
  if (!claimed) return 'already'
  if (!claimed.email) return 'no_email'

  const res = await notifyWelcome({ email: claimed.email, name: claimed.name })
  if (res.ok) return 'sent'
  if (res.skipped) {
    // suppressed(바운스 목록)는 다시 해도 같다 — 표시를 남긴다.
    // not_configured(RESEND 키·발신자 누락)는 일시 상태다 — 표시를 되돌려 환경을
    // 고친 뒤 다음 홈 진입에서 다시 시도한다(2026-09-16 점검).
    if (res.reason === 'not_configured') {
      await admin.from('profiles').update({ welcome_email_sent_at: null }).eq('id', userId)
    }
    return 'skipped'
  }

  // 진짜 실패 — 되돌려서 다음 홈 진입에 재시도. 되돌리기가 실패하면 그때는
  // 영영 안 가지만, 그건 로그로 남기고 사람이 본다(조용히 두 통보다 낫다).
  console.error('[welcome-email] 발송 실패:', res.error)
  const { error: revertErr } = await admin
    .from('profiles')
    .update({ welcome_email_sent_at: null })
    .eq('id', userId)
  if (revertErr) console.error('[welcome-email] 표시 되돌리기 실패:', revertErr.message)
  return 'failed'
}
