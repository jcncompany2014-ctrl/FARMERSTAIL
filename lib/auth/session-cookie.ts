/**
 * "Supabase 세션 쿠키가 있어 보이는가" — 빠른 존재 판정, 정본 한 곳.
 *
 * # 왜 (2026-08-22 — 사장님: "로그인 했는데 다시 또 온보딩 뜨네")
 *
 * proxy 의 `/` 게이트가 `c.name.endsWith('-auth-token')` 으로 세션을 찾았다.
 * 그런데 @supabase/ssr 는 세션이 쿠키 한 개 한도를 넘으면 **조각으로 쪼개**
 * `sb-<ref>-auth-token.0`, `.1` … 로 저장한다(패키지 소스 cookies.js 실측 —
 * 조각이 있으면 원래 이름의 쿠키는 **없다**). 카카오 로그인은 provider 토큰이
 * 실려 세션이 커서 거의 항상 쪼개진다. 결과: **로그인한 앱 사용자가 미로그인
 * 판정**을 받아 대시보드 대신 /welcome 온보딩으로 보내졌다.
 *
 * # 무엇을 세션으로 보나
 *  · `sb-<ref>-auth-token`          — 통짜 (이메일 로그인처럼 작은 세션)
 *  · `sb-<ref>-auth-token.0` 등     — 조각 (카카오 등 큰 세션)
 * 다음은 세션이 **아니다**:
 *  · `sb-<ref>-auth-token-code-verifier` — OAuth 진행 중에만 있는 PKCE 쿠키.
 *    로그인을 **시작만** 하고 만 사용자를 로그인으로 오판하면, /dashboard 로
 *    보냈다가 거기서 다시 /login 으로 튕기는 루프성 동선이 된다.
 *
 * 이 판정은 인증이 아니라 **동선 힌트**다 — 위조 쿠키면 목적지 페이지의
 * 자체 가드(getSafeUser)가 잡는다. DB 왕복 없이 이름만 본다.
 */

const SESSION_COOKIE_RE = /^sb-.+-auth-token(\.\d+)?$/

/** 쿠키 이름 하나가 Supabase 세션(통짜 또는 조각)인가. */
export function isSupabaseSessionCookieName(name: string): boolean {
  return SESSION_COOKIE_RE.test(name)
}

/** 쿠키 이름 목록에 세션이 있어 보이는가. */
export function hasSupabaseSessionCookie(names: readonly string[]): boolean {
  return names.some(isSupabaseSessionCookieName)
}
