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
/** 해석 기준으로만 쓰는 가짜 출처 — 결과의 출처가 이것과 다르면 외부로 새는 경로다. */
const PROBE_ORIGIN = 'https://probe.invalid'

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  if (raw.startsWith('/\\')) return null
  if (raw.startsWith('/api')) return null
  // ★제어문자·공백 차단 (2026-09-24 보안 점검). URL 파서는 탭·줄바꿈을 **지운 뒤**
  //   해석한다 — 탭이 낀 `/<TAB>/evil.com`(주소창엔 `/%09/evil.com`)은 위 검사를 전부
  //   통과하지만 브라우저·Next 라우터는 `//evil.com` 으로 읽어 로그인 직후 외부 사이트로
  //   보낸다(Node 로 재현). 정상 경로엔 제어문자·생 공백이 올 일이 없다(쿼리는 인코딩됨).
  if (/[\u0000- \u007f]/.test(raw)) return null
  // 최종 방어: 실제 URL 파서로 해석해 출처가 바뀌면(외부로 새면) 거부 — 문자열 검사가
  // 놓친 변형은 파서 자신이 판정한다. 인코딩으로 /api 로 풀리는 경로(`/%61pi`)도 막는다.
  let resolved: URL
  try {
    resolved = new URL(raw, PROBE_ORIGIN)
  } catch {
    return null
  }
  if (resolved.origin !== PROBE_ORIGIN) return null
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(resolved.pathname)
  } catch {
    return null
  }
  if (decodedPath.toLowerCase().startsWith('/api')) return null
  return raw
}
