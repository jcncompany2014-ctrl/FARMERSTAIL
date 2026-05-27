/**
 * Farmer's Tail — 광고성 이메일 universal 1-click unsubscribe 토큰.
 *
 * R87-A3 (D10): newsletter_subscribers 가 아닌 일반 app user 에게 발송하는
 *   광고성 이메일 (cart-abandoned / vip / birthday / comeback) 의 List-Unsubscribe
 *   헤더에 박을 URL 토큰. HMAC-SHA256(user_id, secret) 로 결정적 + 위변조 차단.
 *
 * # 사용
 *
 *   const token = generateMarketingUnsubscribeToken(user.id)
 *   const url = `${siteUrl}/api/marketing/unsubscribe?uid=${user.id}&token=${token}`
 *   // sendEmail 의 unsubscribeUrl 에 전달.
 *
 *   // 서버 측 처리 (GET /api/marketing/unsubscribe):
 *   if (!verifyMarketingUnsubscribeToken(uid, token)) return 400
 *   await supabase.from('profiles').update({ agree_email: false, agree_sms: false })
 *
 * # secret
 *
 *   UNSUBSCRIBE_TOKEN_SECRET — Vercel env. 누락 시 throw (광고 메일 발송 자체 차단).
 *   별도 secret 으로 다른 토큰류와 분리 (rotation 시 다른 토큰 영향 없음).
 */

import crypto from 'node:crypto'

function getSecret(): string {
  const s = process.env.UNSUBSCRIBE_TOKEN_SECRET
  if (!s || s.length < 16) {
    // dev/staging 에서는 fallback 으로 동작 — prod 에선 env 누락 시 sendEmail
    // 자체가 silent skip 되므로 도달 안 함.
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error(
        '[unsubscribe-token] UNSUBSCRIBE_TOKEN_SECRET is required in production',
      )
    }
    return 'dev-only-fallback-not-for-prod'
  }
  return s
}

export function generateMarketingUnsubscribeToken(userId: string): string {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`marketing:${userId}`)
    .digest('hex')
    .slice(0, 32)
}

export function verifyMarketingUnsubscribeToken(
  userId: string,
  token: string,
): boolean {
  if (!token || token.length !== 32) return false
  const expected = generateMarketingUnsubscribeToken(userId)
  // timing-safe compare — 토큰 추측 공격 차단.
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'utf8'),
      Buffer.from(expected, 'utf8'),
    )
  } catch {
    return false
  }
}
