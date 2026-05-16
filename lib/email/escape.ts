/**
 * HTML 삽입용 안전 escape (attribute / text 공용).
 *
 * 별도 모듈 분리 이유: layout.ts 는 `@/lib/business` (tsconfig path alias) 를
 * import 하는데, node:test 단위 테스트 환경은 path alias 를 resolve 못 함.
 * escape pure function 만 별도 파일로 빼서 단위 테스트 가능.
 *
 * # 정책 (XSS 가드)
 * 1) `&` 가 가장 먼저 — 다른 entity 재인코딩 방지 (&lt; → &amp;lt; 차단)
 * 2) `<`, `>` — 태그 무력화
 * 3) `"`, `'` — attribute 값 안전 (`src="..."` 안에서 끝나지 않게)
 *
 * idempotent 아님 — 호출처가 raw input 만 통과시켜야 함.
 */
export function escape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
