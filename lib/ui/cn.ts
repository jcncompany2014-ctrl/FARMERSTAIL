/**
 * 아주 가벼운 class merger.
 *
 * clsx/tailwind-merge를 안 쓰는 이유: 의존성 줄이기 + Tailwind v4에선 대부분의
 * conflict를 소스 순서로 해결해도 충분함. 우리 컴포넌트는 "내부 base 클래스"
 * 뒤에 "호출자 className"을 붙이는 단순한 패턴이라 merge 충돌이 거의 안 나고,
 * 혹시 나더라도 뒤에 쓴 유틸이 이김.
 *
 * 규칙:
 *   - 문자열/undefined/false/null을 받아서 truthy 것만 공백으로 join.
 *   - `as const` 튜플 (readonly string[])도 받는다 — base 클래스 목록을 배열
 *     상수로 두고 재사용하는 흔한 패턴을 지원.
 *   - 중복 공백은 한 번만 정리.
 */
type ClassValue =
  | string
  | false
  | null
  | undefined
  | readonly ClassValue[]

function flatten(input: ClassValue): string {
  if (!input) return ''
  if (typeof input === 'string') return input
  // readonly array
  return input.map(flatten).filter(Boolean).join(' ')
}

export function cn(...classes: ClassValue[]): string {
  return classes
    .map(flatten)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
