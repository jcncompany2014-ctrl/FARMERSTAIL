import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Heart, Soup } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import WishlistRemoveButton from './WishlistRemoveButton'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '찜한 상품',
  robots: { index: false, follow: false },
}

export default async function WishlistPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/mypage/wishlist')

  const { data: rows } = await supabase
    .from('wishlists')
    .select(
      `product_id, created_at,
       products ( id, name, slug, short_description, price, sale_price, image_url, is_active, is_subscribable, category )`
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (rows ?? []) as any[]

  return (
    <main className="pb-8">
      <section className="px-5 pt-6 pb-2">
        <Link
          href="/mypage"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← 내 정보
        </Link>
        <span className="kicker mt-3 inline-block">Wishlist · 찜한 상품</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          찜한 상품
        </h1>
        <p className="text-[11px] text-muted mt-1">{items.length}개</p>
      </section>

      {items.length === 0 ? (
        <section className="px-5 mt-6">
          <div
            className="rounded-2xl border px-6 py-12 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-4"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <Heart
                className="w-6 h-6 text-terracotta"
                strokeWidth={1.5}
              />
            </div>
            <span className="kicker">Empty · 찜 없음</span>
            <h3
              className="font-serif mt-2"
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              찜한 상품이 없어요
            </h3>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              마음에 드는 상품에 하트를 눌러
              <br />
              나만의 위시리스트를 만들어보세요
            </p>
            <Link
              href="/products"
              className="mt-5 inline-flex items-center gap-1.5 px-6 py-2.5 text-[12px] font-bold rounded-full active:scale-[0.98] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              상품 둘러보기
            </Link>
          </div>
        </section>
      ) : (
        <section className="px-5 mt-3 grid grid-cols-2 gap-3">
          {items.map((w) => {
            const p = w.products
            if (!p) return null
            const hasSale = p.sale_price !== null
            const discount = hasSale
              ? Math.round(((p.price - (p.sale_price ?? p.price)) / p.price) * 100)
              : 0
            return (
              <div
                key={p.id}
                className="relative bg-white rounded-xl border border-rule overflow-hidden hover:border-text hover:shadow-sm transition-all"
              >
                <Link href={`/products/${p.slug}`} className="block">
                  <div className="aspect-square bg-bg relative overflow-hidden">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Soup
                          className="w-10 h-10 text-muted"
                          strokeWidth={1.2}
                        />
                      </div>
                    )}
                    {hasSale && discount > 0 && (
                      <div className="absolute top-2 left-2 bg-terracotta text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">
                        {discount}%
                      </div>
                    )}
                  </div>
                  <div className="border-t border-rule px-3 py-3">
                    <div className="text-[11px] text-text font-bold leading-snug line-clamp-2 min-h-[30px]">
                      {p.name}
                    </div>
                    {hasSale ? (
                      <div className="mt-2 flex items-baseline gap-1">
                        <span
                          className="font-serif"
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: 'var(--terracotta)',
                            letterSpacing: '-0.015em',
                          }}
                        >
                          {(p.sale_price ?? p.price).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted">원</span>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-baseline gap-1">
                        <span
                          className="font-serif"
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: 'var(--ink)',
                            letterSpacing: '-0.015em',
                          }}
                        >
                          {p.price.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted">원</span>
                      </div>
                    )}
                  </div>
                </Link>
                <WishlistRemoveButton productId={p.id} />
              </div>
            )
          })}
        </section>
      )}
    </main>
  )
}
