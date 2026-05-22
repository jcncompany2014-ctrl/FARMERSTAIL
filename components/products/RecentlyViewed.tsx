'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CatalogProductCard, {
  type CatalogProduct,
} from './CatalogProductCard'

/**
 * RecentlyViewed — 최근 본 상품 strip.
 *
 * 성능 메모:
 *   • 페이지 진입 직후엔 hot path (LCP / 인터랙션 가능 시점) 에 fetch 가
 *     개입하지 않도록 idle scheduling 으로 지연.
 *   • localStorage read 도 hydrate 직후엔 sync 부담 — requestIdleCallback
 *     fallback 으로 처리.
 *   • SSR 시엔 빈 div, hydrate 후 idle 일 때 fetch.
 */

const KEY = 'ft_recently_viewed'

type IdleScheduler = (cb: () => void) => () => void

const scheduleIdle: IdleScheduler =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? (cb) => {
        const handle = (window as unknown as {
          requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number
        }).requestIdleCallback(cb, { timeout: 1500 })
        return () =>
          (window as unknown as {
            cancelIdleCallback: (h: number) => void
          }).cancelIdleCallback(handle)
      }
    : (cb) => {
        const id = window.setTimeout(cb, 250)
        return () => window.clearTimeout(id)
      }

export default function RecentlyViewed({
  excludeSlug,
  title = '최근 본 상품',
}: {
  excludeSlug?: string
  title?: string
}) {
  const [products, setProducts] = useState<CatalogProduct[]>([])

  useEffect(() => {
    let mounted = true
    const cancel = scheduleIdle(async () => {
      if (!mounted) return
      let slugs: string[] = []
      try {
        const raw = localStorage.getItem(KEY)
        slugs = raw ? JSON.parse(raw) : []
      } catch {
        return
      }
      if (excludeSlug) slugs = slugs.filter((s) => s !== excludeSlug)
      if (slugs.length === 0) return

      const supabase = createClient()
      const { data } = await supabase
        .from('products')
        .select(
          'id, name, slug, short_description, price, sale_price, category, is_subscribable, image_url, stock, created_at',
        )
        .in('slug', slugs.slice(0, 8))
        .eq('is_active', true)

      if (!mounted) return
      const ordered: CatalogProduct[] = []
      for (const s of slugs) {
        const found = (data ?? []).find(
          (p: { slug: string }) => p.slug === s,
        ) as CatalogProduct | undefined
        if (found) ordered.push(found)
      }
      setProducts(ordered.slice(0, 8))
    })

    return () => {
      mounted = false
      cancel()
    }
  }, [excludeSlug])

  if (products.length === 0) return null

  return (
    <section className="px-5 md:px-6 mt-10 md:mt-16 mb-4">
      <div className="flex items-baseline justify-between mb-3 md:mb-5">
        <h2
          className="font-serif text-[16px] md:text-[20px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
        <span
          className="font-mono text-[10px] md:text-[11px] tracking-[0.18em] uppercase"
          style={{ color: 'var(--muted)' }}
        >
          {products.length} items
        </span>
      </div>
      <div className="-mx-5 md:mx-0 px-5 md:px-0 flex md:grid md:grid-cols-6 gap-3 md:gap-4 overflow-x-auto md:overflow-visible scrollbar-hide">
        {products.map((p) => (
          <div key={p.id} className="w-[140px] md:w-auto shrink-0 md:shrink">
            <CatalogProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  )
}
