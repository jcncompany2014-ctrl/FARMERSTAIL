/**
 * scripts/send-newsletter-vol-01.ts
 *
 * Tail Letter Vol. 01 수동 발송 스크립트. 현재 newsletter broadcast 용 cron 이
 * 없어서 (가입자 규모 작음 + 발송 타이밍을 사람이 결정) 사람이 직접 실행.
 *
 * 사용법:
 *   # 1) 먼저 dry-run 으로 발송 대상 수만 확인
 *   node --experimental-strip-types scripts/send-newsletter-vol-01.ts --dry-run
 *
 *   # 2) 실제 발송 (대상자 전원에게 한 통씩)
 *   node --experimental-strip-types scripts/send-newsletter-vol-01.ts
 *
 *   # 3) 자기 자신에게만 테스트 발송
 *   node --experimental-strip-types scripts/send-newsletter-vol-01.ts --test you@example.com
 *
 * 필수 환경변수 (.env.local 또는 셸에서):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY   ← service_role 필수 (RLS 우회로 confirmed 전체 select)
 *   - RESEND_API_KEY
 *   - EMAIL_FROM                  ← "파머스테일 <no-reply@farmerstail.kr>"
 *   - NEXT_PUBLIC_SITE_URL        ← "https://farmerstail.kr" (메일 안 링크용)
 *
 * 주의:
 *   - 같은 (이슈, 이메일) 페어로 24h 안에 중복 발송은 broadcastNewsletterVol01
 *     이 last_sent_at 으로 스스로 막아요. 두 번 실행해도 안전.
 *   - 발송 후엔 newsletter_subscribers.last_sent_at 이 업데이트됩니다.
 *   - Resend free tier 2 rps 를 고려해 250ms 텀으로 sequential 발송. 100명
 *     발송에 ~25초 걸려요.
 */
import { createClient } from '@supabase/supabase-js'
import { broadcastNewsletterVol01, sendEmail } from '../lib/email'
import { renderNewsletterVol01 } from '../lib/email/templates/newsletter-vol-01'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const testIdx = args.indexOf('--test')
  const testEmail = testIdx >= 0 ? args[testIdx + 1] : null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      '[send-newsletter-vol-01] NEXT_PUBLIC_SUPABASE_URL 와 SUPABASE_SERVICE_ROLE_KEY 가 필요해요.',
    )
    process.exit(1)
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.error(
      '[send-newsletter-vol-01] RESEND_API_KEY / EMAIL_FROM 미설정 — 실제 발송 안 됨.',
    )
    if (!dryRun) process.exit(1)
  }

  // ── 테스트 모드 ──────────────────────────────────────────────
  // 자기 자신에게만 보내서 톤/디자인 미리 확인. unsubscribe 토큰은 더미.
  if (testEmail) {
    console.log(`[send-newsletter-vol-01] 테스트 발송: ${testEmail}`)
    const { subject, html } = renderNewsletterVol01({
      email: testEmail,
      unsubscribeToken: '00000000000000000000000000000000',
    })
    const result = await sendEmail({
      to: testEmail,
      subject,
      html,
      tag: 'newsletter-vol-01-test',
    })
    console.log('[send-newsletter-vol-01] 결과:', result)
    process.exit(result.ok ? 0 : 1)
  }

  // ── 일괄 발송 ────────────────────────────────────────────────
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(
    `[send-newsletter-vol-01] ${dryRun ? 'DRY RUN' : '실제 발송'} 시작…`,
  )

  const result = await broadcastNewsletterVol01(supabase, {
    dryRun,
    markSent: !dryRun,
  })

  console.log('[send-newsletter-vol-01] 결과:')
  console.log(`  · 전체 confirmed 구독자: ${result.total}`)
  console.log(`  · 발송 성공:            ${result.sent}`)
  console.log(`  · 발송 실패:            ${result.failed}`)
  console.log(`  · 스킵 (24h 이내 중복): ${result.skipped}`)

  if (dryRun) {
    console.log(
      '\n실제 발송하려면 --dry-run 빼고 다시 실행하세요.',
    )
  }

  process.exit(result.failed > 0 ? 2 : 0)
}

void main()
