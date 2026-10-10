import { permanentRedirect } from 'next/navigation'
import { recipeFromSlug } from '@/lib/store/catalog'

/**
 * /products/[slug] — 구독 전용 전환(2026-06-26)으로 낱개 상품 상세(PDP) 폐지.
 *
 * ★2026-10-10 웹 리뉴얼(웹 = 단품 가게): 새 가게 상품 상세로 308. 옛 상품 주소(chicken-basic 등)는 앞의 레시피 이름으로
 *  새 주소(/store/chicken)를 찾고, 모르는 주소는 스토어로.
 */
export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const recipe = recipeFromSlug(slug.split('-')[0] ?? '')
  permanentRedirect(recipe ? `/store/${recipe}` : '/store')
}
