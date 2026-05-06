/**
 * Cron 엔드포인트용 인증 가드.
 *
 * Vercel Cron 은 예약 호출 시 `Authorization: Bearer <CRON_SECRET>` 헤더를
 * 붙인다 — 이 값과 env 의 `CRON_SECRET` 이 일치하는지만 확인한다. 외부 툴
 * (예: upstash, GitHub Actions) 도 같은 방식으로 호출 가능.
 *
 * 왜 admin 쿠키 가드가 아닌가: cron 은 유저 세션이 없는 서버 컨텍스트에서
 * 호출되므로 Supabase auth 쿠키가 없다. 고정 bearer 가 가장 단순.
 *
 * # 타이밍 공격 방어 (audit fix)
 * `===` 비교는 첫 mismatch 에서 즉시 종료 → 길이별 응답 시간 차이로 secret
 * brute-force 가능 (이론적). `timingSafeEqual` 로 length-independent 비교.
 */
import { timingSafeEqual } from 'node:crypto'

export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  // dev 환경 + secret 미설정 → 우회 (로컬 cron 트리거 편의).
  // production 에선 env.ts 가 secret 누락을 startup 차단 (process.exit).
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  // 길이가 다르면 즉시 false (timingSafeEqual 은 같은 길이 요구).
  if (header.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(expected))
  } catch {
    return false
  }
}
