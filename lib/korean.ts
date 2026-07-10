/**
 * 한글 조사·이름 친근형 유틸 — 받침(종성) 유무로 조사를 정확히 선택.
 *
 * 사장님 2026-06-19 지시: 강아지 이름 문법을 웹·앱 전체에서 정확히.
 *   · "나우"(모음 끝)  → "나우의 식단"   (이 붙이지 않음)
 *   · "푸린"(받침 끝)  → "푸린이의 식단" (받침 있으니 친근형 '이')
 *   · 잘못된 예: "나우이의 식단" (X)
 *
 * 한글 음절 영역 = U+AC00..U+D7A3. (code - 0xAC00) % 28 === 0 이면 받침 없음(모음 끝).
 */

/** 문자열 마지막 글자에 받침(종성)이 있으면 true. 한글 음절이 아니면 false. */
export function hasBatchim(s: string | null | undefined): boolean {
  const t = (s ?? '').trim()
  if (!t) return false
  const code = t.charCodeAt(t.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return false // 한글 음절 아님(영문·숫자 등)
  return (code - 0xac00) % 28 !== 0
}

/**
 * 강아지/사람 이름 친근형 — 받침 있으면 '이' 붙임(푸린→푸린이), 없으면 그대로(나우→나우).
 *
 * ★ 친근형은 **항상 모음으로 끝난다** (받침 이름엔 '이'가 붙고, 모음 이름은 원래
 * 모음 끝). 따라서 `petName(name)` 뒤에 오는 조사는 언제나 **모음형**(는/가/를/예요)
 * 을 그대로 붙이면 된다. 예: `${petName(name)}의`, `${petName(name)}가`,
 * `${petName(name)}는`, `${petName(name)}를`.
 */
export function petName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (!n) return n
  return hasBatchim(n) ? `${n}이` : n
}

/** 일반 조사 선택(원형 word 기준). 예: josa('나우', '은', '는') → '나우는'. */
export function josa(
  word: string,
  withBatchim: string,
  withoutBatchim: string,
): string {
  const w = (word ?? '').trim()
  return `${w}${hasBatchim(w) ? withBatchim : withoutBatchim}`
}

/** 자주 쓰는 조사 프리셋(원형 word 기준 — 친근형엔 모음형 직접 사용). */
export const eunNeun = (w: string) => josa(w, '은', '는')
export const iGa = (w: string) => josa(w, '이', '가')
export const eulReul = (w: string) => josa(w, '을', '를')
export const waGwa = (w: string) => josa(w, '과', '와')

/**
 * 보호자(사용자) 이름 경칭 — 이름 뒤에 '님' 부착. 사장님 2026-07-09 지시:
 * "사용자 이름이 나오면 무조건 님" (안성민 → 안성민님).
 *   · 이미 '님'으로 끝나면 그대로 (안성민님 → 안성민님)
 *   · 영문 이름은 그대로 (John → John, '님' 안 붙임)
 *   · 빈 값은 '' — 폴백(나·보호자 등)은 호출부에서 처리.
 * ★강아지 이름은 petName, 사람(보호자) 이름은 withHonorific 을 쓴다.
 */
export function withHonorific(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return ''
  if (trimmed.endsWith('님')) return trimmed
  if (/^[A-Za-z][A-Za-z\s'-]*$/.test(trimmed)) return trimmed
  return `${trimmed}님`
}
