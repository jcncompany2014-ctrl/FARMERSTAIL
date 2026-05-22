import CatalogProductCard, {
  type CatalogProduct,
} from './CatalogProductCard'
import { V3, V3FontWeight, V3LetterSpacing } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

/**
 * RelatedProducts — 같은 카테고리의 다른 상품을 가로 스크롤로 노출.
 * 서버 컴포넌트로 받은 products 를 그대로 렌더만.
 *
 * 2026-05-22 R11-3: v3 톤 정리 — Mono kicker count + sans 800 heading.
 */
export default function RelatedProducts({
  products,
  title = '함께 보면 좋은 상품',
}: {
  products: CatalogProduct[]
  title?: string
}) {
  if (products.length === 0) return null

  return (
    <section
      className="md:px-6 md:mt-16"
      style={{ padding: '0 20px', marginTop: 40 }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ marginBottom: 16 }}
      >
        <h2
          className="md:text-[26px]"
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 20,
            color: V3.ink,
            letterSpacing: V3LetterSpacing.heading,
          }}
        >
          {title}
        </h2>
        <Mono color="inkMute" size="xs" weight={500} letterSpacing="0.16em">
          {products.length} items
        </Mono>
      </div>

      {/* 모바일: 가로 스크롤. 데스크톱: 4-grid. */}
      <div
        className="md:grid md:grid-cols-4 -mx-5 md:mx-0 px-5 md:px-0 flex md:block overflow-x-auto md:overflow-visible scrollbar-hide"
        style={{ gap: 12 }}
      >
        {products.map((p) => (
          <div
            key={p.id}
            className="md:w-auto md:shrink"
            style={{ width: 160, flexShrink: 0 }}
          >
            <CatalogProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  )
}
