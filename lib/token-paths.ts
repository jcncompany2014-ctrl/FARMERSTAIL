/**
 * 주소 자체가 열람권인 페이지 — 토큰만 있으면 누구나 연다 (2026-09-26 출시 전 점검 8차).
 *   /vet/<토큰>          수의사 공유(14일 — 강아지 알레르기·만성질환·체중·분석, 보호자 실명)
 *   /photo-upload/<토큰> 친구에게 사진 요청(보호자·강아지 이름)
 *
 * 이 주소가 광고·분석 도구(메타 픽셀·GA·Clarity)나 오류 수집(Sentry)으로 가면 **열람권이 복제**된다.
 * 그래서 이 경로에선 분석 스크립트·쿠키 배너를 띄우지 않고, 지표·오류 기록엔 토큰을 가린다.
 */
const TOKEN_PATH = /\/(vet|photo-upload)\/[^/?#\s"']+/g

/** 현재 경로가 토큰 페이지인가. */
export function isTokenBearerPath(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && /^\/(vet|photo-upload)\/[^/]+/.test(pathname)
}

/** 문자열 속 토큰 경로를 '/vet/[token]' 처럼 가린다(URL·브레드크럼·트랜잭션 이름 어디든). */
export function redactTokenPaths(s: string): string {
  return s.replace(TOKEN_PATH, '/$1/[token]')
}
