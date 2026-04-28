import { redirect } from 'next/navigation'

/**
 * /best — alias for /products?sort=best.
 * Short URL 마케팅 / sitemap 노출용. 검색엔진은 redirect 따라가서 결국
 * /products?sort=best 의 콘텐츠로 인덱싱.
 */
export default function BestAlias() {
  redirect('/products?sort=best')
}
