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
 *   - 중복 공백은 한 번만 정리.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}
