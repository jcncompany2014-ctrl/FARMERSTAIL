/**
 * 로그인 후 돌아갈 경로(`?next=`) 검증 — **정본 한 곳**.
 *
 * # 왜 (2026-08-12 4라운드 감사)
 * 같은 검사가 세 곳에 흩어져 있었고 실제로 갈라져 있었다:
 *  · app/auth/callback/route.ts — 4개 검사 (엄격판)
 *  · app/(auth)/login/page.tsx  — 3개 검사, **백슬래시 변형(`/\evil.com`)이 빠짐**
 *  · app/start/claim/page.tsx   — 검사 없음(목적지를 아예 안 받았다)
 * 그리고 소셜 로그인 버튼은 `next` 를 **하드코딩**해서, 보호 경로에서 튕긴 고객이
 * 카카오·애플로 로그인하면 원래 보던 화면으로 못 돌아갔다(금액변경 동의 화면·
 * 구독 관리 등 40여 곳이 `/login?next=...` 로 보낸다).
 *
 * # 무엇을 막나
 *  · `//evil.com` — 프로토콜 상대 URL. 브라우저가 외부 도메인으로 읽는다.
 *  · `/\evil.com` — 백슬래시 변형. 일부 브라우저가 `//` 처럼 해석한다.
 *  · `/api/...`   — 인증 직후 GET 으로 부작용 엔드포인트를 태우는 것(R101-B).
 *  · 절대 URL     — `/` 로 시작하지 않으면 전부 거부.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  if (raw.startsWith('/\\')) return null
  if (raw.startsWith('/api')) return null
  return raw
}
