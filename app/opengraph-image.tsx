import { logoOgImage, OG_SIZE } from '@/lib/og/logo-card'

/**
 * 사이트 기본 미리보기 이미지(파일 규칙 — 모든 하위 페이지의 og:image 기본값).
 * **로고만** — lib/og/logo-card 가 정본이고 /og 도 같은 한 장을 그린다(사장님 2026-09-26).
 */
export const runtime = 'nodejs'
export const alt = '파머스테일'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function OGImage() {
  return logoOgImage()
}
