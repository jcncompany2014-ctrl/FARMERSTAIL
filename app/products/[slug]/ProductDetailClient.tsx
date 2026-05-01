'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { BLUR_BG2 } from '@/lib/ui/blur'
import {
  Soup,
  Cookie,
  PackageOpen,
  Repeat,
  Truck,
  Check,
  Star,
  Heart,
  Minus,
  Plus,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ProductReviews from './ProductReviews'
import RestockButton from './RestockButton'
import ShareButton from '@/components/ShareButton'
import { trackAddToCart, trackViewItem } from '@/lib/analytics'
import { stockState, maxOrderable, stockMessage } from '@/lib/products/stock'
import { StockBadge, StockOverlay } from '@/components/ui/StockBadge'
import { VariantSelector } from '@/components/ui/VariantSelector'
import ProductDetailTabs from '@/components/products/ProductDetailTabs'
import RecentlyViewed from '@/components/products/RecentlyViewed'
import ProductImageLightbox from '@/components/products/ProductImageLightbox'
import {
  type ProductVariant,
  defaultVariant,
  effectivePrice,
  effectiveListPrice,
  hasSale as variantHasSale,
} from '@/lib/products/variants'

/**
 * /products/[slug] — 상세 페이지 (마켓컬리/SSF 톤 쇼핑몰).
 *
 * 레이아웃 (데스크톱):
 *   ┌────────────────────────────────────────────────────────┐
 *   │ breadcrumb                                              │
 *   ├────────────────────┬───────────────────────────────────┤
 *   │  [Gallery sticky]  │ [Right info column · sticky]      │
 *   │  hero + thumbs     │   카테고리 · 제품명 · 리뷰         │
 *   │                    │   가격 (할인%/현재가/정가)         │
 *   │                    │   배송 / 적립 안내                  │
 *   │                    │   옵션(variant)                     │
 *   │                    │   수량 + 합계                        │
 *   │                    │   [장바구니] [바로구매]              │
 *   ├────────────────────┴───────────────────────────────────┤
 *   │ Sticky tab nav · 상품설명 / 상세정보 / 후기(N) / 문의   │
 *   ├────────────────────────────────────────────────────────┤
 *   │ #description  (short_description + tags + 짧은 본문)    │
 *   │ #detail       (long-form 상세정보 server slot)           │
 *   │ #reviews      (ProductReviews)                          │
 *   │ #qna          (ProductQA stub)                          │
 *   ├────────────────────────────────────────────────────────┤
 *   │ Related products carousel                                │
 *   └────────────────────────────────────────────────────────┘
 *
 * 모바일은 단일 column · 하단 sticky CTA bar.
 */

type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  price: number
  sale_price: number | null
  category: string | null
  is_subscribable: boolean
  stock: number
  image_url: string | null
  gallery_urls?: string[] | null
  tags?: string[] | null
}

/**
 * scheduleIdle — hot path (LCP / 첫 인터랙션) 가 끝난 뒤에 task 를 실행하도록
 * requestIdleCallback 으로 지연. 지원 안 되는 브라우저는 setTimeout fallback.
 */
function scheduleIdle(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  type RIC = (cb: () => void, opts?: { timeout: number }) => number
  const win = window as unknown as {
    requestIdleCallback?: RIC
    cancelIdleCallback?: (h: number) => void
  }
  if (win.requestIdleCallback) {
    const handle = win.requestIdleCallback(cb, { timeout: 1500 })
    return () => win.cancelIdleCallback?.(handle)
  }
  const id = window.setTimeout(cb, 250)
  return () => window.clearTimeout(id)
}

function CategoryIcon({ category, size = 80 }: { category: string | null; size?: number }) {
  const shared = {
    strokeWidth: 1.2,
    color: 'var(--ink)',
    style: { opacity: 0.32, width: size, height: size },
  } as const
  if (category === '간식') return <Cookie {...shared} />
  if (category === '체험팩') return <PackageOpen {...shared} />
  return <Soup {...shared} />
}

export default function ProductDetailClient({
  product,
  variants = [],
  isApp = false,
  longDescSlot,
  relatedSlot,
  qnaSlot,
}: {
  product: Product
  variants?: ProductVariant[]
  /** App 컨텍스트일 때 marketing 모듈 (탭/related/Q&A/breadcrumb) 자동 숨김. */
  isApp?: boolean
  longDescSlot?: ReactNode
  relatedSlot?: ReactNode
  qnaSlot?: ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()

  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const activeVariants = variants.filter((v) => v.is_active)
  const hasVariants = activeVariants.length > 0
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    () => defaultVariant(variants)?.id ?? null,
  )
  const selectedVariant =
    activeVariants.find((v) => v.id === selectedVariantId) ?? null

  function handleVariantChange(variantId: string) {
    setSelectedVariantId(variantId)
    setQuantity(1)
  }

  // 유효 가격/재고 — variant 우선, 없으면 product.
  const effPrice = selectedVariant
    ? effectivePrice(selectedVariant, product)
    : product.sale_price ?? product.price
  const effListPrice = selectedVariant
    ? effectiveListPrice(selectedVariant, product)
    : product.price
  const effIsSale = selectedVariant
    ? variantHasSale(selectedVariant, product)
    : product.sale_price !== null
  const effStock = selectedVariant ? selectedVariant.stock : product.stock

  const stockBucket = stockState(effStock)
  const isSoldOut = stockBucket === 'out'
  const qtyMax = maxOrderable(effStock)

  const allImages = Array.from(
    new Set(
      [product.image_url, ...(product.gallery_urls ?? [])].filter(
        (u): u is string => !!u,
      ),
    ),
  )
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState<number | null>(null)

  const [reviewAvg, setReviewAvg] = useState<number | null>(null)
  const [reviewCount, setReviewCount] = useState<number>(0)
  const [wished, setWished] = useState(false)
  const [wishBusy, setWishBusy] = useState(false)

  // 통합 effect — recently-viewed push (sync) / analytics + reviews + wishlist
  // (deferred). hot path 와 분리하기 위해 idle scheduling 으로 fetch 를 미룸.
  useEffect(() => {
    // (1) 최근 본 상품 — sync. 가벼운 localStorage write.
    try {
      const KEY = 'ft_recently_viewed'
      const raw = localStorage.getItem(KEY)
      const list: string[] = raw ? JSON.parse(raw) : []
      const next = [
        product.slug,
        ...list.filter((s) => s !== product.slug),
      ].slice(0, 12)
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }

    // (2) idle 일 때 analytics + reviews + wishlist 한 번에.
    let mounted = true
    const idleHandle = scheduleIdle(async () => {
      if (!mounted) return

      // analytics — viewItem
      trackViewItem({
        item_id: product.id,
        item_name: product.name,
        price: product.sale_price ?? product.price,
        quantity: 1,
        item_category: product.category ?? undefined,
      })

      // reviews aggregate
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('rating')
        .eq('product_id', product.id)
      if (!mounted) return
      const arr = (reviewData ?? []) as { rating: number | null }[]
      const sum = arr.reduce((s: number, r) => s + (r.rating ?? 0), 0)
      setReviewCount(arr.length)
      setReviewAvg(arr.length > 0 ? sum / arr.length : null)

      // wishlist (PDP heart) — 비로그인이면 skip
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!mounted || !user) return
      const { data: wish } = await supabase
        .from('wishlists')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle()
      if (!mounted) return
      setWished(!!wish)
    })

    return () => {
      mounted = false
      idleHandle()
    }
  }, [
    product.id,
    product.slug,
    product.name,
    product.price,
    product.sale_price,
    product.category,
    supabase,
  ])

  async function toggleWish() {
    if (wishBusy) return
    const wasWished = wished
    // Optimistic — 즉시 heart fill flip. 실패 시 롤백.
    setWished(!wasWished)
    setWishBusy(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setWished(wasWished) // rollback before redirect
        router.push(`/login?next=/products/${product.slug}`)
        return
      }
      if (wasWished) {
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('wishlists')
          .insert({ user_id: user.id, product_id: product.id })
        if (error) throw error
      }
    } catch {
      // 네트워크 / RLS 오류 시 롤백
      setWished(wasWished)
    } finally {
      setWishBusy(false)
    }
  }

  async function handleAddToCart(opts?: { redirectAfter?: boolean }) {
    if (isSoldOut) return
    if (hasVariants && !selectedVariant) return

    const capped = Math.min(quantity, qtyMax)
    if (capped <= 0) return
    setAdding(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?next=/products/${product.slug}`)
      return
    }

    // Atomic upsert RPC — 두 번 빠르게 누르거나 동시 호출이 중복 row 만드는
    // race condition 차단. 함수 안에 SELECT FOR UPDATE → UPDATE 또는 INSERT.
    await supabase.rpc('upsert_cart_item', {
      p_user_id: user.id,
      p_product_id: product.id,
      p_variant_id: selectedVariant?.id ?? null,
      p_quantity: capped,
      p_max_qty: qtyMax,
    })

    trackAddToCart({
      item_id: product.id,
      item_name: product.name,
      price: effPrice,
      quantity: capped,
      item_category: product.category ?? undefined,
    })

    // 미니 카트 토스트 dispatch — MiniCartToast 가 listen.
    try {
      window.dispatchEvent(
        new CustomEvent('ft:cart:add', {
          detail: {
            productName: product.name,
            quantity: capped,
            imageUrl: product.image_url,
          },
        }),
      )
    } catch {
      // SSR / IE 같은 환경 — 무시.
    }

    setAdding(false)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)

    if (opts?.redirectAfter) {
      router.push('/cart')
    }
  }

  const displayPrice = effPrice
  const total = displayPrice * quantity
  const discount = effIsSale
    ? Math.round(((effListPrice - effPrice) / effListPrice) * 100)
    : 0
  const freeShipping = displayPrice * quantity >= 30000
  const earnPoints = Math.floor(displayPrice * quantity * 0.01)

  // 앱 컨텍스트에선 detail/qna 탭 자체가 안 그려지므로 후기 1개만 노출.
  const tabs = isApp
    ? [{ id: 'reviews', label: '후기', count: reviewCount }]
    : [
        { id: 'description', label: '상품설명' },
        { id: 'detail', label: '상세정보' },
        { id: 'reviews', label: '후기', count: reviewCount },
        { id: 'qna', label: '문의' },
      ]

  return (
    <main className="pb-40 md:pb-16" style={{ background: 'var(--bg)' }}>
      {/* breadcrumb — 앱 컨텍스트는 상단 헤더로 navigation 충분, 생략 */}
      {!isApp && (
        <div className="px-5 md:px-6 pt-3 md:pt-5 max-w-6xl mx-auto">
          <nav
            aria-label="현재 위치"
            className="flex items-center gap-1 text-[11px] md:text-[12px]"
            style={{ color: 'var(--muted)' }}
          >
            <Link href="/" className="hover:text-terracotta transition">
              홈
            </Link>
            <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
            <Link href="/products" className="hover:text-terracotta transition">
              상품
            </Link>
            {product.category && (
              <>
                <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
                <Link
                  href={`/products?category=${encodeURIComponent(product.category)}`}
                  className="hover:text-terracotta transition"
                >
                  {product.category}
                </Link>
              </>
            )}
          </nav>
        </div>
      )}

      {/* ── 메인 영역: 데스크톱 2-column ─────────────────────── */}
      <section className="px-5 md:px-6 pt-3 md:pt-5 max-w-6xl mx-auto md:flex md:gap-10 md:items-start">
        {/* 좌측: 갤러리 (sticky on desktop) */}
        <div className="md:w-[55%] ft-sticky-product-col">
          <Gallery
            images={allImages}
            activeIdx={activeImageIdx}
            onSelect={setActiveImageIdx}
            onZoom={(i) => setLightboxOpen(i)}
            productName={product.name}
            category={product.category}
            stock={effStock}
            isSubscribable={product.is_subscribable}
            discount={discount}
          />
        </div>

        {/* 우측: 정보 카드 */}
        <div className="md:w-[45%] mt-5 md:mt-0">
          <InfoColumn
            product={product}
            displayPrice={displayPrice}
            effListPrice={effListPrice}
            effIsSale={effIsSale}
            discount={discount}
            quantity={quantity}
            setQuantity={setQuantity}
            qtyMax={qtyMax}
            isSoldOut={isSoldOut}
            stockBucket={stockBucket}
            effStock={effStock}
            hasVariants={hasVariants}
            variants={variants}
            selectedVariantId={selectedVariantId}
            selectedVariant={selectedVariant}
            handleVariantChange={handleVariantChange}
            adding={adding}
            added={added}
            onAddToCart={() => handleAddToCart()}
            onBuyNow={() => handleAddToCart({ redirectAfter: true })}
            wished={wished}
            wishBusy={wishBusy}
            onToggleWish={toggleWish}
            reviewAvg={reviewAvg}
            reviewCount={reviewCount}
            freeShipping={freeShipping}
            earnPoints={earnPoints}
            total={total}
          />
        </div>
      </section>

      {/* ── 스티키 탭 ─────────────────────────────────────── */}
      <div className="mt-10 md:mt-16">
        <ProductDetailTabs tabs={tabs} />
      </div>

      {/* ── #description : 짧은 본문 + 태그 — 앱은 short_description 만 inline */}
      {!isApp && (
      <section
        id="description"
        className="ft-anchor-under-chrome px-5 md:px-6 mt-8 md:mt-12 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-2 mb-4 md:mb-5">
          <span
            className="font-mono text-[10px] md:text-[11px] tracking-[0.22em] uppercase"
            style={{ color: 'var(--muted)' }}
          >
            Description · 상품설명
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
        </div>
        {product.short_description && (
          <p
            className="font-serif text-[15px] md:text-[19px] leading-relaxed"
            style={{
              color: 'var(--ink)',
              fontWeight: 500,
              letterSpacing: '-0.015em',
              maxWidth: 720,
            }}
          >
            {product.short_description}
          </p>
        )}
        {product.tags && product.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {product.tags.map((t) => (
              <span
                key={t}
                className="inline-block text-[10px] md:text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
                style={{
                  color: 'var(--text)',
                  background: 'var(--bg-2)',
                  boxShadow: 'inset 0 0 0 1px var(--rule)',
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </section>
      )}

      {/* ── #detail : long-form spec table (server slot) — app 에선 null */}
      <div className="max-w-6xl mx-auto">{longDescSlot}</div>

      {/* ── #reviews ──────────────────────────────────────── */}
      <section
        id="reviews"
        className="ft-anchor-under-chrome px-5 md:px-6 mt-10 md:mt-14 max-w-6xl mx-auto"
      >
        <ProductReviews productId={product.id} />
      </section>

      {/* ── #qna ─────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto">{qnaSlot}</div>

      {/* ── related products carousel — app 에선 null */}
      <div className="max-w-6xl mx-auto">{relatedSlot}</div>

      {/* ── recently viewed — app 컨텍스트 생략 (mypage 가 자체 surface) */}
      {!isApp && (
        <div className="max-w-6xl mx-auto">
          <RecentlyViewed excludeSlug={product.slug} />
        </div>
      )}

      {/* ── 모바일 sticky bottom CTA ────────────────────── */}
      <div
        className="ft-sticky-cta-bottom md:hidden z-30 pt-3 px-5"
        style={{
          background: 'var(--bg)',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <div className="max-w-md mx-auto">
          {stockBucket !== 'in_stock' && (
            <div className="flex items-center gap-1.5 mb-2 text-[11.5px]">
              <StockBadge stock={effStock} placement="inline" showCount />
              {stockBucket === 'out' ? (
                <span className="text-muted">곧 다시 만나요. 재입고 알림 받기.</span>
              ) : (
                <span className="text-muted">{stockMessage(effStock)}</span>
              )}
            </div>
          )}

          {isSoldOut ? (
            <RestockButton
              productId={product.id}
              variantId={selectedVariant?.id ?? null}
            />
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleWish}
                disabled={wishBusy}
                aria-label={wished ? '찜 해제' : '찜하기'}
                className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition active:scale-95"
                style={{
                  background: 'var(--bg-2)',
                  color: wished ? 'var(--terracotta)' : 'var(--muted)',
                  boxShadow: wished
                    ? 'inset 0 0 0 1px var(--terracotta)'
                    : 'inset 0 0 0 1px var(--rule)',
                }}
              >
                <Heart
                  className="w-5 h-5"
                  strokeWidth={2}
                  fill={wished ? 'var(--terracotta)' : 'none'}
                />
              </button>

              <ShareButton
                url={`/products/${product.slug}`}
                title={product.name}
                description={product.short_description ?? undefined}
                imageUrl={product.image_url ?? undefined}
                iconOnly
                className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition active:scale-95"
                style={{
                  background: 'var(--bg-2)',
                  color: 'var(--muted)',
                  boxShadow: 'inset 0 0 0 1px var(--rule)',
                }}
              />

              <button
                onClick={() => handleAddToCart()}
                disabled={adding || added}
                className="flex-1 py-3.5 rounded-full font-bold text-[13px] transition-all disabled:opacity-70 active:scale-[0.98]"
                style={{
                  background: 'var(--bg)',
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                  boxShadow: 'inset 0 0 0 1.5px var(--ink)',
                }}
              >
                {added ? '담겼어요' : adding ? '담는 중...' : '장바구니'}
              </button>

              <button
                onClick={() => handleAddToCart({ redirectAfter: true })}
                disabled={adding}
                className="flex-1 py-3.5 rounded-full font-bold text-[13px] transition-all disabled:opacity-70 active:scale-[0.98]"
                style={{
                  background: 'var(--terracotta)',
                  color: 'var(--bg)',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 4px 14px rgba(160,69,46,0.3)',
                }}
              >
                바로구매
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox — 이미지 클릭 시 풀스크린 zoom */}
      <ProductImageLightbox
        images={allImages}
        startIndex={lightboxOpen}
        onClose={() => setLightboxOpen(null)}
        productName={product.name}
      />
    </main>
  )
}

// ─────────────────────────── Gallery ────────────────────────────

function Gallery({
  images,
  activeIdx,
  onSelect,
  onZoom,
  productName,
  category,
  stock,
  isSubscribable,
  discount,
}: {
  images: string[]
  activeIdx: number
  onSelect: (i: number) => void
  onZoom: (i: number) => void
  productName: string
  category: string | null
  stock: number
  isSubscribable: boolean
  discount: number
}) {
  const activeImage = images[activeIdx] ?? null
  return (
    <div>
      {/* main image — 클릭 시 lightbox (role=button div: 안쪽에 뱃지 div 들이 있어 button 사용 불가) */}
      <div
        role="button"
        tabIndex={activeImage ? 0 : -1}
        onClick={() => activeImage && onZoom(activeIdx)}
        onKeyDown={(e) => {
          if (!activeImage) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onZoom(activeIdx)
          }
        }}
        aria-label={activeImage ? '이미지 확대' : '이미지 없음'}
        className={`w-full aspect-square relative overflow-hidden rounded-2xl ${activeImage ? 'cursor-zoom-in' : ''}`}
        style={{ background: 'var(--bg-2)' }}
      >
        {activeImage ? (
          <Image
            key={activeImage}
            src={activeImage}
            alt={productName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 660px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CategoryIcon category={category} size={88} />
          </div>
        )}

        {/* 좌상단 뱃지 */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {discount > 0 && (
            <span
              className="font-mono text-[11px] md:text-[12px] font-black tabular-nums px-2.5 py-1 rounded-md"
              style={{
                background: 'var(--sale)',
                color: 'var(--bg)',
                letterSpacing: '0.02em',
              }}
            >
              −{discount}%
            </span>
          )}
          {isSubscribable && (
            <span
              className="inline-flex items-center gap-1 text-[10px] md:text-[11px] font-bold px-2 py-1 rounded-md"
              style={{
                background: 'rgba(245,240,230,0.92)',
                color: 'var(--moss)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            >
              <Repeat className="w-3 h-3" strokeWidth={2.5} />
              정기배송
            </span>
          )}
        </div>

        <StockOverlay stock={stock} />

        {/* 이미지 인덱스 */}
        {images.length > 1 && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[10px] md:text-[11px] font-mono px-2.5 py-0.5 rounded-full"
            style={{
              background: 'rgba(30,26,20,0.5)',
              color: 'var(--bg)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {activeIdx + 1} / {images.length}
          </div>
        )}
      </div>

      {/* thumbs */}
      {images.length > 1 && (
        <div className="mt-3 md:mt-4 flex gap-2 md:gap-2.5 overflow-x-auto scrollbar-hide">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => onSelect(i)}
              className="relative shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg md:rounded-xl overflow-hidden transition active:scale-95"
              style={{
                border: '2px solid',
                borderColor: i === activeIdx ? 'var(--terracotta)' : 'transparent',
                opacity: i === activeIdx ? 1 : 0.65,
              }}
              aria-label={`이미지 ${i + 1}`}
            >
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 768px) 64px, 80px"
                placeholder="blur"
                blurDataURL={BLUR_BG2}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────── Right info column ────────────────────────────

type InfoColumnProps = {
  product: Product
  displayPrice: number
  effListPrice: number
  effIsSale: boolean
  discount: number
  quantity: number
  setQuantity: (q: number) => void
  qtyMax: number
  isSoldOut: boolean
  stockBucket: 'out' | 'low' | 'in_stock'
  effStock: number
  hasVariants: boolean
  variants: ProductVariant[]
  selectedVariantId: string | null
  selectedVariant: ProductVariant | null
  handleVariantChange: (id: string) => void
  adding: boolean
  added: boolean
  onAddToCart: () => void
  onBuyNow: () => void
  wished: boolean
  wishBusy: boolean
  onToggleWish: () => void
  reviewAvg: number | null
  reviewCount: number
  freeShipping: boolean
  earnPoints: number
  total: number
}

function InfoColumn(p: InfoColumnProps) {
  return (
    <div className="ft-sticky-product-col">
      {/* 카테고리 + 제품명 + 찜 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {p.product.category && (
            <div
              className="font-mono text-[10px] md:text-[11px] tracking-[0.18em] uppercase"
              style={{ color: 'var(--terracotta)', fontWeight: 700 }}
            >
              {p.product.category}
            </div>
          )}
          <h1
            className="font-serif mt-2 md:mt-2.5 leading-tight text-[22px] md:text-[28px] lg:text-[32px]"
            style={{
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.025em',
            }}
          >
            {p.product.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={p.onToggleWish}
          disabled={p.wishBusy}
          aria-label={p.wished ? '찜 해제' : '찜하기'}
          className="hidden md:flex shrink-0 w-11 h-11 rounded-full items-center justify-center transition active:scale-95"
          style={{
            background: p.wished
              ? 'color-mix(in srgb, var(--terracotta) 10%, transparent)'
              : 'var(--bg-2)',
            color: p.wished ? 'var(--terracotta)' : 'var(--muted)',
            boxShadow: p.wished
              ? 'inset 0 0 0 1px var(--terracotta)'
              : 'inset 0 0 0 1px var(--rule)',
          }}
        >
          <Heart
            className="w-5 h-5"
            strokeWidth={2}
            fill={p.wished ? 'var(--terracotta)' : 'none'}
          />
        </button>
      </div>

      {/* 리뷰 요약 */}
      {p.reviewCount > 0 && p.reviewAvg !== null && (
        <a
          href="#reviews"
          className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] md:text-[13px]"
          style={{ color: 'var(--muted)' }}
        >
          <Star className="w-3.5 h-3.5" strokeWidth={1.5} fill="var(--gold)" color="var(--gold)" />
          <span className="font-black" style={{ color: 'var(--text)' }}>
            {p.reviewAvg.toFixed(1)}
          </span>
          <span className="opacity-70">·</span>
          <span className="underline underline-offset-2">리뷰 {p.reviewCount}개</span>
        </a>
      )}

      {/* 가격 — 마켓컬리 위계: 할인% (sale red, big) + 현재가 (ink, big) + 정가 (muted strike) */}
      <div className="mt-5 md:mt-6 pb-5 md:pb-6 border-b" style={{ borderColor: 'var(--rule)' }}>
        {p.effIsSale && p.discount > 0 && (
          <div
            className="text-[12px] md:text-[13px] tabular-nums line-through"
            style={{ color: 'var(--muted)' }}
          >
            {p.effListPrice.toLocaleString()}원
          </div>
        )}
        <div className="flex items-baseline gap-2 mt-0.5">
          {p.effIsSale && p.discount > 0 && (
            <span
              className="font-black text-[24px] md:text-[28px] tabular-nums"
              style={{ color: 'var(--sale)', letterSpacing: '-0.025em' }}
            >
              {p.discount}%
            </span>
          )}
          <span
            className="font-black text-[26px] md:text-[32px] tabular-nums"
            style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
          >
            {p.displayPrice.toLocaleString()}
          </span>
          <span
            className="text-[14px] md:text-[16px]"
            style={{ color: 'var(--muted)' }}
          >
            원
          </span>
        </div>
      </div>

      {/* 배송 / 적립 안내 */}
      <dl className="mt-4 md:mt-5 space-y-2 md:space-y-2.5 text-[12px] md:text-[13.5px]">
        <Row label="배송">
          <div className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2} />
            <span style={{ color: p.freeShipping ? 'var(--moss)' : 'var(--text)', fontWeight: 700 }}>
              {p.freeShipping ? '무료배송' : '배송비 3,000원'}
            </span>
            <span style={{ color: 'var(--muted)' }}>· 평일 오후 1시 전 결제 시 익일 출고</span>
          </div>
        </Row>
        <Row label="적립">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2} color="var(--terracotta)" />
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>
              {p.earnPoints.toLocaleString()}P
            </span>
            <span style={{ color: 'var(--muted)' }}>· 결제 금액의 1%</span>
          </div>
        </Row>
        {p.product.is_subscribable && (
          <Row label="정기배송">
            <div className="flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={2} color="var(--moss)" />
              <span style={{ color: 'var(--moss)', fontWeight: 700 }}>최대 10% 추가 할인</span>
            </div>
          </Row>
        )}
      </dl>

      {/* Variants */}
      {p.hasVariants && (
        <div className="mt-5 md:mt-6">
          <div
            className="text-[11px] md:text-[12px] font-black mb-2 md:mb-3"
            style={{ color: 'var(--ink)' }}
          >
            옵션
          </div>
          <VariantSelector
            variants={p.variants}
            selectedId={p.selectedVariantId}
            parent={{ price: p.product.price, sale_price: p.product.sale_price }}
            onChange={p.handleVariantChange}
            layout="tiles"
          />
          {p.selectedVariant && (
            <p className="mt-2 text-[11px] md:text-[12.5px]" style={{ color: 'var(--muted)' }}>
              선택:{' '}
              <span className="font-bold" style={{ color: 'var(--text)' }}>
                {p.selectedVariant.name}
              </span>
            </p>
          )}
        </div>
      )}

      {/* 수량 + 합계 */}
      <div
        className="mt-5 md:mt-6 rounded-xl p-4 md:p-5"
        style={{ background: 'var(--bg-2)', boxShadow: 'inset 0 0 0 1px var(--rule)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="text-[12px] md:text-[13px] font-black"
            style={{ color: 'var(--ink)' }}
          >
            수량
          </span>
          <div
            className="flex items-center"
            style={{
              background: 'var(--bg)',
              borderRadius: 8,
              boxShadow: 'inset 0 0 0 1px var(--rule)',
            }}
          >
            <button
              type="button"
              onClick={() => p.setQuantity(Math.max(1, p.quantity - 1))}
              disabled={p.quantity <= 1 || p.isSoldOut}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center transition active:scale-95 disabled:opacity-30"
              aria-label="수량 감소"
            >
              <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
            <span
              className="w-9 md:w-10 text-center font-bold text-[13px] md:text-[14px] tabular-nums"
              style={{ color: 'var(--ink)' }}
            >
              {p.quantity}
            </span>
            <button
              type="button"
              onClick={() =>
                p.setQuantity(Math.min(p.qtyMax, p.quantity + 1))
              }
              disabled={p.quantity >= p.qtyMax || p.isSoldOut}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center transition active:scale-95 disabled:opacity-30"
              aria-label="수량 증가"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        {/* 재고 메시지 */}
        {p.stockBucket === 'low' && (
          <p
            className="mt-2 text-[10.5px] md:text-[11.5px]"
            style={{ color: 'var(--sale)', fontWeight: 700 }}
          >
            재고가 {p.effStock}개 남았어요
          </p>
        )}
        <div
          className="mt-3 md:mt-4 pt-3 md:pt-4 flex items-baseline justify-between"
          style={{ borderTop: '1px solid var(--rule-2)' }}
        >
          <span
            className="text-[11.5px] md:text-[12.5px]"
            style={{ color: 'var(--muted)' }}
          >
            총 결제 금액
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className="font-black text-[22px] md:text-[26px] tabular-nums"
              style={{ color: 'var(--terracotta)', letterSpacing: '-0.025em' }}
            >
              {p.total.toLocaleString()}
            </span>
            <span
              className="text-[12px] md:text-[14px]"
              style={{ color: 'var(--muted)' }}
            >
              원
            </span>
          </div>
        </div>
      </div>

      {/* 데스크톱 CTA — 모바일은 하단 sticky */}
      <div className="hidden md:flex items-center gap-2 mt-5">
        {p.isSoldOut ? (
          <RestockButton
            productId={p.product.id}
            variantId={p.selectedVariant?.id ?? null}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={p.onAddToCart}
              disabled={p.adding || p.added}
              className="flex-1 py-4 rounded-full font-bold text-[14.5px] transition active:scale-[0.98] disabled:opacity-70"
              style={{
                background: 'var(--bg)',
                color: 'var(--ink)',
                boxShadow: 'inset 0 0 0 1.5px var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {p.added ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" strokeWidth={3} />
                  담겼어요
                </span>
              ) : p.adding ? (
                '담는 중...'
              ) : (
                '장바구니 담기'
              )}
            </button>
            <button
              type="button"
              onClick={p.onBuyNow}
              disabled={p.adding}
              className="flex-1 py-4 rounded-full font-bold text-[14.5px] transition active:scale-[0.98] disabled:opacity-70"
              style={{
                background: 'var(--terracotta)',
                color: 'var(--bg)',
                boxShadow: '0 4px 14px rgba(160,69,46,0.3)',
                letterSpacing: '-0.01em',
              }}
            >
              바로 구매하기
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 md:gap-4">
      <dt
        className="shrink-0 w-14 md:w-16 font-mono text-[10px] md:text-[11px] tracking-[0.14em] uppercase pt-0.5"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </dt>
      <dd className="flex-1 min-w-0">{children}</dd>
    </div>
  )
}
