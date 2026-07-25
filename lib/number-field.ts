/**
 * 숫자 입력 칸의 순수 로직 (2026-07-26).
 *
 * # 왜 별도 파일인가
 * 이 규칙이 깨지면 사장님이 숫자를 못 고친다. 컴포넌트 안에 묻어두면 테스트가
 * 안 되므로 순수 함수로 떼어내고 `lib/number-field.test.ts` 로 고정한다.
 * 화면 렌더는 `components/admin/NumberInput.tsx` 가 이걸 그대로 쓴다.
 *
 * # 고친 버그
 * 예전 admin 숫자 칸은 전부 `onChange={(e) => set(Number(e.target.value))}`
 * 였다. 칸을 다 지우면 `Number('')` 가 **0** 이라 state 가 0 이 되고 화면이
 * 즉시 "0" 을 다시 그린다 — **칸이 빌 수가 없어 그 0 을 지울 방법이 없었다.**
 * 그 상태로 150 을 치면 "0150" 이 된다(사장님 제보).
 *
 * # 핵심 아이디어
 * 편집 중에는 **사용자가 친 글자(raw)를 그대로 화면에 유지**한다. 그래야 빈 칸
 * 상태가 살아남는다. 포커스가 빠지면 raw 를 버리고 바깥 값을 다시 따른다.
 */

/** 화면에 실제로 보여줄 글자. raw 가 null 이면 편집 중이 아니라는 뜻. */
export function displayValue(
  raw: string | null,
  outer: number | null | undefined,
): string {
  if (raw !== null) return raw
  if (outer === null || outer === undefined) return ''
  return String(outer)
}

/**
 * 사용자가 친 글자 → 바깥(폼 state)으로 보낼 값.
 *
 * - 빈 칸 → `emptyAs` (필수 항목이면 0, 선택 항목이면 null)
 * - 정상 숫자 → 그 숫자
 * - `'-'` · `'1e'` 처럼 **입력 도중이라 아직 숫자가 아닌 상태** → `undefined`
 *   를 돌려준다. 호출부는 이때 바깥 값을 **건드리지 않는다** — 안 그러면 NaN 이
 *   폼에 새어 들어간다. 화면에는 사용자가 친 글자가 그대로 남으므로 마저 치면 된다.
 */
export function parseTyped(
  text: string,
  emptyAs: number | null,
): number | null | undefined {
  if (text === '') return emptyAs
  const n = Number(text)
  if (Number.isNaN(n)) return undefined
  return n
}
