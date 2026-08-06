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
  //
  // ⛔ **프로덕션에서 secret 이 없으면 29개 크론이 전부 401 이 된다.**
  //   예전 이 자리 주석은 "production 에선 env.ts 가 startup 차단(process.exit)"
  //   이라고 적혀 있었는데 **그런 방어는 없다** — lib/env.ts:197 은 console.error
  //   만 한다(사이트 전체를 죽이지 않으려고 의도적으로 그렇게 둔 것이다).
  //   AGENTS.md 규칙4 그대로: 없는 방어를 주장하는 주석.
  //
  //   그리고 401 은 trackCron **진입 전**에 반환되므로 cron_health 에 행이
  //   아예 안 생긴다 → /admin/cron-health 는 그 크론이 **빨간불이 되는 게
  //   아니라 화면에서 사라진다.** 그래서 감지는 "행이 있는데 error" 가 아니라
  //   **"돌았어야 하는데 행이 없다"** 로 해야 한다 —
  //   lib/cron-watchdog.findMissedCrons 가 그 판정이고,
  //   /admin/cron-health 가 크론과 무관하게 그걸 화면에 띄운다.
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
