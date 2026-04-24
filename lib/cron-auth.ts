/**
 * Cron 엔드포인트용 인증 가드.
 *
 * Vercel Cron 은 예약 호출 시 `Authorization: Bearer <CRON_SECRET>` 헤더를
 * 붙인다 — 이 값과 env 의 `CRON_SECRET` 이 일치하는지만 확인한다. 외부 툴
 * (예: upstash, GitHub Actions) 도 같은 방식으로 호출 가능.
 *
 * 왜 admin 쿠키 가드가 아닌가: cron 은 유저 세션이 없는 서버 컨텍스트에서
 * 호출되므로 Supabase auth 쿠키가 없다. 고정 bearer 가 가장 단순.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  // "Bearer xxx" 와 "Bearer  xxx" 차이를 용납하지 않도록 strict compare.
  return header === `Bearer ${secret}`
}
