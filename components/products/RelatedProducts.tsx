import CatalogProductCard, {
  type CatalogProduct,
} from './CatalogProductCard'

/**
 * RelatedProducts — 같은 카테고리의 다른 상품을 가로 스크롤로 노출.
 * 서버 컴포넌트로 받은 products 를 그대로 렌더만.
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
    <section className="px-5 md:px-6 mt-10 md:mt-16">
      <div className="flex items-baseline justify-between mb-4 md:mb-6">
        <h2
          className="font-serif text-[18px] md:text-[26px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
        <span
          className="font-mono text-[10px] md:text-[11.5px] tracking-[0.18em] uppercase"
          style={{ color: 'var(--muted)' }}
        >
          {products.length} items
        </span>
      </div>

      {/* 모바일: 가로 스크롤. 데스크톱: 4-grid. */}
      <div className="md:grid md:grid-cols-4 md:gap-5 -mx-5 md:mx-0 px-5 md:px-0 flex md:block gap-3 overflow-x-auto md:overflow-visible scrollbar-hide">
        {products.map((p) => (
          <div
            key={p.id}
            className="w-[160px] md:w-auto shrink-0 md:shrink"
          >
            <CatalogProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  )
}
