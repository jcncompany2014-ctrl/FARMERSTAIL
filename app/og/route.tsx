import { logoOgImage } from '@/lib/og/logo-card'

// Node 런타임 — 로고를 파일에서 읽는다(lib/og/logo-card). Edge 는 이 Next 에서 폐기 예정.
export const runtime = 'nodejs'

/**
 * GET /og — 링크 미리보기 카드. **로고만** (사장님 2026-09-26).
 *
 * lib/seo/jsonld.ts `ogImageUrl()` 이 페이지마다 `/og?title=…` 를 만들지만 여기서는
 * 파라미터를 일부러 무시한다 — 글자 카드가 메신저 정사각형 자르기에서 ':테일' 같은 조각으로
 * 보였다. 호출부를 다 고치지 않아도 사이트 전체 미리보기가 한 장으로 모인다.
 */
export async function GET() {
  return logoOgImage()
}
