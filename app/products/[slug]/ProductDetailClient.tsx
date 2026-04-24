'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  ArrowLeft,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import ProductReviews from './ProductReviews'
import RestockButton from './RestockButton'
import { trackAddToCart, trackViewItem } from '@/lib/analytics'
import { stockState, maxOrderable, stockMessage } from '@/lib/products/stock'
import { StockBadge, StockOverlay } from '@/components/ui/StockBadge'
import { VariantSelector } from '@/components/ui/VariantSelector'
import {
  type ProductVariant,
  defaultVariant,
  effectivePrice,
  effectiveListPrice,
  hasSale as variantHasSale,
} from '@/lib/products/variants'

/**
 * /products/[slug] — 상세 페이지.
 *
 * 톤: catalog(/products)의 에디토리얼 언어를 이어받아 "제품을 읽게 만드는"
 * 지면으로. 섹션을 kicker로 구분하고, 헤드라인은 serif, 가격/합계는
 * serif + 토큰 컬러(ink / sale). 모든 색은 CSS 토큰 경유.
 *
 *   - 히어로 이미지 + 썸네일 스트립
 *   - Product · 제품 소개 (kicker, h1, 리뷰 요약, 태그)
 *   - Price · 가격 카드 (serif 가격 + 무료배송 상태)
 *   - Description · 상품 설명 (있을 때만)
 *   - Quantity · 수량 선택 + 합계
 *   - Reviews · 리뷰 (하위 컴포넌트)
 *   - 하단 고정 CTA (rounded-full ink, 정기배송 있으면 2-column)
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

// React 19 static-components 규칙 대응 — JSX 요소를 직접 반환.
function renderCategoryIcon(category: string | null, size: number) {
  const shared = {
    strokeWidth: 1.2,
    color: 'var(--ink)',
    style: { opacity: 0.35, width: size, height: size },
  }
  if (category === '간식') return <Cookie {...shared} />
  if (category === '체험팩') return <PackageOpen {...shared} />
  return <Soup {...shared} />
}

export default function ProductDetailClient({
  product,
  variants = [],
}: {
  product: Product
  variants?: ProductVariant[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  // variant 선택 상태 — 초기값은 재고 있는 것 중 첫 번째.
  const activeVariants = variants.filter((v) => v.is_active)
  const hasVariants = activeVariants.length > 0
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    () => defaultVariant(variants)?.id ?? null
  )
  const selectedVariant =
    activeVariants.find((v) => v.id === selectedVariantId) ?? null

  // variant 변경 시 수량을 1로 reset — variant별 재고 상한이 다르므로 이전
  // variant의 수량이 새 variant의 qtyMax를 초과할 수 있음. 이벤트 핸들러에서
  // 직접 처리 (useEffect 내 setState는 cascading render 유발).
  function handleVariantChange(variantId: string) {
    setSelectedVariantId(variantId)
    setQuantity(1)
  }

  // 유효 가격/재고 — variant가 있으면 variant 값이 우선, 없으면 product 값.
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

  // 재고 상태 — 'out'이면 CTA 잠금, 'low'면 수량 스텝퍼 상한 & 경고 표시.
  const stockBucket = stockState(effStock)
  const isSoldOut = stockBucket === 'out'
  const qtyMax = maxOrderable(effStock)

  // All product images in display order. Hero first, then gallery. Dedupe in
  // case the admin accidentally added the hero URL to the gallery too.
  const allImages = Array.from(
    new Set(
      [product.image_url, ...(product.gallery_urls ?? [])].filter(
        (u): u is string => !!u
      )
    )
  )
  const [activeImageIdx, setActiveImageIdx] = useState(0)
  const activeImage = allImages[activeImageIdx] ?? null

  // review summary + wishlist state
  const [reviewAvg, setReviewAvg] = useState<number | null>(null)
  const [reviewCount, setReviewCount] = useState<number>(0)
  const [wished, setWished] = useState(false)
  const [wishBusy, setWishBusy] = useState(false)

  // 제품 조회 이벤트 — 마운트 시 한 번만.
  useEffect(() => {
    trackViewItem({
      item_id: product.id,
      item_name: product.name,
      price: product.sale_price ?? product.price,
      quantity: 1,
      item_category: product.category ?? undefined,
    })
  }, [
    product.id,
    product.name,
    product.price,
    product.sale_price,
    product.category,
  ])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('reviews')
        .select('rating')
        .eq('product_id', product.id)
      if (!mounted) return
      const arr = data ?? []
      const sum = arr.reduce((s, r) => s + (r.rating ?? 0), 0)
      setReviewCount(arr.length)
      setReviewAvg(arr.length > 0 ? sum / arr.length : null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: wish } = await supabase
          .from('wishlists')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('product_id', product.id)
          .maybeSingle()
        if (!mounted) return
        setWished(!!wish)
      }
    })()
    return () => {
      mounted = false
    }
  }, [product.id, supabase])

  async function toggleWish() {
    if (wishBusy) return
    setWishBusy(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?next=/products/${product.slug}`)
      return
    }
    if (wished) {
      await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', product.id)
      setWished(false)
    } else {
      await supabase
        .from('wishlists')
        .insert({ user_id: user.id, product_id: product.id })
      setWished(true)
    }
    setWishBusy(false)
  }

  async function handleAddToCart() {
    // 방어선: 서버(RLS)가 품절을 거부하기 전에 UI에서 막는다. 동시에 다른
    // 사용자가 막 사 간 상황(stock이 이미 0인 채 SSR됐는데 클라이언트에서
    // 뒤늦게 확인되는 경우)은 PDP reload 혹은 Step 16의 결제 단 재검증이
    // 커버한다.
    if (isSoldOut) return
    // variant 카탈로그 상품은 반드시 선택되어야 함 — 기본 선택이 있으므로
    // 여기서 막히는 건 예외 상황이지만 방어.
    if (hasVariants && !selectedVariant) return

    const capped = Math.min(quantity, qtyMax)
    if (capped <= 0) return
    setAdding(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // variant가 있으면 (user, product, variant) 튜플 단위, 없으면 (user, product, null).
    // maybeSingle은 정확히 0 또는 1 개를 기대 — (user_id, product_id, variant_id)
    // 복합 unique 키로 보장.
    const existingQuery = supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('product_id', product.id)
    const { data: existing } = selectedVariant
      ? await existingQuery.eq('variant_id', selectedVariant.id).maybeSingle()
      : await existingQuery.is('variant_id', null).maybeSingle()

    // 누적 수량도 qtyMax를 넘지 않게 자른다 — 이미 장바구니에 담긴 수량 +
    // 이번에 담는 수량이 재고를 초과할 수 있음.
    if (existing) {
      const nextQty = Math.min(existing.quantity + capped, qtyMax)
      await supabase
        .from('cart_items')
        .update({ quantity: nextQty })
        .eq('id', existing.id)
    } else {
      await supabase.from('cart_items').insert({
        user_id: user.id,
        product_id: product.id,
        variant_id: selectedVariant?.id ?? null,
        quantity: capped,
      })
    }

    trackAddToCart({
      item_id: product.id,
      item_name: product.name,
      price: effPrice,
      quantity: capped,
      item_category: product.category ?? undefined,
    })

    setAdding(false)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const displayPrice = effPrice
  const total = displayPrice * quantity
  const discount = effIsSale
    ? Math.round(((effListPrice - effPrice) / effListPrice) * 100)
    : 0
  const freeShipping = displayPrice >= 30000

  return (
    <main className="pb-36" style={{ background: 'var(--bg)' }}>
      {/* 뒤로가기 */}
      <div className="px-5 pt-3 pb-2">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold transition"
          style={{ color: 'var(--muted)' }}
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          제품 목록
        </Link>
      </div>

      {/* ── 메인 이미지 ──────────────────────────────────────── */}
      <div
        className="w-full aspect-square relative overflow-hidden"
        style={{ background: 'var(--bg-2)' }}
      >
        {activeImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={activeImage}
            src={activeImage}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {renderCategoryIcon(product.category, 80)}
          </div>
        )}

        {/* 뱃지 */}
        {discount > 0 && (
          <div
            className="absolute top-3 left-3 text-[11px] font-black px-2 py-1 rounded-full z-10"
            style={{ background: 'var(--sale)', color: 'var(--bg)' }}
          >
            {discount}% OFF
          </div>
        )}
        {product.is_subscribable && (
          <div
            className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full z-10"
            style={{ background: 'var(--moss)', color: 'var(--bg)' }}
          >
            <Repeat className="w-3 h-3" strokeWidth={2.5} />
            정기배송 가능
          </div>
        )}

        {/* 품절 오버레이 — 이미지 전체를 덮는다. in_stock / low 일땐 렌더 안 함.
            variant가 있으면 '선택된' variant 기준으로 판정 — 다른 옵션은 살아 있을
            수 있으니 variant selector가 여전히 가시적이라 UX 상 이상하지 않다. */}
        <StockOverlay stock={effStock} />

        {/* 이미지 인덱스 */}
        {allImages.length > 1 && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[10px] font-mono px-2.5 py-0.5 rounded-full"
            style={{
              background: 'rgba(30,26,20,0.5)',
              color: 'var(--bg)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {activeImageIdx + 1} / {allImages.length}
          </div>
        )}
      </div>

      {/* 썸네일 strip */}
      {allImages.length > 1 && (
        <div className="px-5 pt-3 -mb-2 flex gap-2 overflow-x-auto scrollbar-none">
          {allImages.map((url, idx) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveImageIdx(idx)}
              className="shrink-0 w-14 h-14 rounded-lg overflow-hidden transition active:scale-95"
              style={{
                border: '2px solid',
                borderColor:
                  idx === activeImageIdx
                    ? 'var(--terracotta)'
                    : 'transparent',
                opacity: idx === activeImageIdx ? 1 : 0.65,
              }}
              aria-label={`이미지 ${idx + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      <div className="px-5">
        {/* ── Product · 제품 소개 ────────────────────────── */}
        <section className="pt-6 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {product.category && (
                <span className="kicker">
                  Item · {product.category}
                </span>
              )}
              <h1
                className="font-serif mt-2 leading-tight"
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {product.name}
              </h1>
            </div>
            <button
              onClick={toggleWish}
              disabled={wishBusy}
              aria-label={wished ? '찜 해제' : '찜하기'}
              className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition active:scale-95"
              style={{
                background: wished
                  ? 'color-mix(in srgb, var(--terracotta) 10%, transparent)'
                  : 'var(--bg-2)',
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
          </div>

          {/* 리뷰 요약 */}
          {reviewCount > 0 && reviewAvg !== null && (
            <a
              href="#reviews"
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] transition"
              style={{ color: 'var(--muted)' }}
            >
              <Star
                className="w-3.5 h-3.5"
                strokeWidth={1.5}
                fill="var(--gold)"
                color="var(--gold)"
              />
              <span
                className="font-black"
                style={{ color: 'var(--text)' }}
              >
                {reviewAvg.toFixed(1)}
              </span>
              <span>· 리뷰 {reviewCount}개</span>
            </a>
          )}

          {/* short description — prose */}
          {product.short_description && (
            <p
              className="text-[12.5px] mt-2 leading-relaxed"
              style={{ color: 'var(--muted)' }}
            >
              {product.short_description}
            </p>
          )}

          {/* tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <span
                  key={t}
                  className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
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

        {/* ── Price · 가격 ──────────────────────────── */}
        <section
          className="rounded-2xl px-5 py-5 mb-3"
          style={{
            background: 'var(--bg-2)',
            boxShadow: 'inset 0 0 0 1px var(--rule)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="kicker">Price · 가격</span>
            <div
              className="flex-1 h-px"
              style={{ background: 'var(--rule-2)' }}
            />
          </div>

          <div className="flex items-baseline gap-2 flex-wrap">
            {effIsSale && (
              <span
                className="text-[12px] line-through"
                style={{ color: 'var(--muted)' }}
              >
                {effListPrice.toLocaleString()}원
              </span>
            )}
            <span
              className="font-serif font-black leading-none"
              style={{
                fontSize: 28,
                color: effIsSale ? 'var(--sale)' : 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {displayPrice.toLocaleString()}
            </span>
            <span
              className="text-[13px] font-semibold"
              style={{ color: 'var(--muted)' }}
            >
              원
            </span>
          </div>

          {/* 무료배송 상태 */}
          <div
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: freeShipping ? 'var(--moss)' : 'var(--muted)' }}
          >
            {freeShipping ? (
              <>
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                무료배송
              </>
            ) : (
              <>
                <Truck className="w-3.5 h-3.5" strokeWidth={1.8} />
                3만원 이상 무료배송 (배송비 3,000원)
              </>
            )}
          </div>
        </section>

        {/* ── Options · 옵션 ─────────────── */}
        {hasVariants && (
          <section
            className="rounded-2xl px-5 py-5 mb-3"
            style={{
              background: 'var(--bg-2)',
              boxShadow: 'inset 0 0 0 1px var(--rule)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="kicker">Options · 옵션</span>
              <div
                className="flex-1 h-px"
                style={{ background: 'var(--rule-2)' }}
              />
            </div>
            <VariantSelector
              variants={variants}
              selectedId={selectedVariantId}
              parent={{ price: product.price, sale_price: product.sale_price }}
              onChange={handleVariantChange}
              layout="tiles"
            />
            {selectedVariant && (
              <p className="mt-3 text-[11px] text-muted">
                선택: <span className="font-bold text-text">{selectedVariant.name}</span>
              </p>
            )}
          </section>
        )}

        {/* ── Description · 상품 설명 ─────────────── */}
        {product.description && (
          <section
            className="rounded-2xl px-5 py-5 mb-3"
            style={{
              background: 'var(--bg-2)',
              boxShadow: 'inset 0 0 0 1px var(--rule)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="kicker">Description · 상품 설명</span>
              <div
                className="flex-1 h-px"
                style={{ background: 'var(--rule-2)' }}
              />
            </div>
            <p
              className="text-[13px] leading-relaxed whitespace-pre-line"
              style={{ color: 'var(--text)' }}
            >
              {product.description}
            </p>
          </section>
        )}

        {/* ── Quantity · 수량 ──────────────────── */}
        <section
          className="rounded-2xl px-5 py-5 mb-3"
          style={{
            background: 'var(--bg-2)',
            boxShadow: 'inset 0 0 0 1px var(--rule)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="kicker">Quantity · 수량</span>
            <div
              className="flex-1 h-px"
              style={{ background: 'var(--rule-2)' }}
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-95"
              style={{
                background: 'var(--bg)',
                color: 'var(--text)',
                boxShadow: 'inset 0 0 0 1px var(--rule-2)',
              }}
              aria-label="수량 감소"
            >
              <Minus className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <div
              className="flex-1 text-center font-serif font-black leading-none"
              style={{
                fontSize: 22,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
              }}
            >
              {quantity}
            </div>
            <button
              onClick={() =>
                setQuantity((q) => Math.min(q + 1, Math.max(1, qtyMax)))
              }
              disabled={quantity >= qtyMax}
              className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-40"
              style={{
                background: 'var(--bg)',
                color: 'var(--text)',
                boxShadow: 'inset 0 0 0 1px var(--rule-2)',
              }}
              aria-label="수량 증가"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

          <div
            className="mt-4 pt-4 flex items-baseline justify-between"
            style={{ borderTop: '1px solid var(--rule-2)' }}
          >
            <span className="kicker kicker-muted">Total · 합계</span>
            <div className="flex items-baseline gap-1">
              <span
                className="font-serif font-black leading-none"
                style={{
                  fontSize: 20,
                  color: 'var(--terracotta)',
                  letterSpacing: '-0.02em',
                }}
              >
                {total.toLocaleString()}
              </span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: 'var(--muted)' }}
              >
                원
              </span>
            </div>
          </div>
        </section>

        {/* ── Reviews · 리뷰 ──────────────────── */}
        <ProductReviews productId={product.id} />
      </div>

      {/* ── 하단 고정 CTA ─────────────────── */}
      <div
        className="fixed bottom-16 left-0 right-0 px-5 py-3 z-30"
        style={{
          background: 'var(--bg)',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <div className="max-w-md mx-auto">
          {/* 재고 상태 힌트 — CTA 바로 위에 한 줄. out/low일 때만. */}
          {stockBucket !== 'in_stock' && (
            <div className="flex items-center gap-1.5 mb-2 text-[11.5px]">
              <StockBadge stock={effStock} placement="inline" showCount />
              {stockBucket === 'out' ? (
                <span className="text-muted">
                  곧 다시 만나요. 재입고 알림으로 소식을 전해 드릴게요.
                </span>
              ) : (
                <span className="text-muted">{stockMessage(effStock)}</span>
              )}
            </div>
          )}

          {isSoldOut ? (
            // 품절: 재입고 알림 구독 버튼으로 교체. variant가 있으면 variant
            // 단위로 구독한다 — 대용량 품절/소포장 재고 상황을 분리해 통지.
            <RestockButton
              productId={product.id}
              variantId={selectedVariant?.id ?? null}
            />
          ) : product.is_subscribable ? (
            <div className="flex gap-2">
              <button
                onClick={handleAddToCart}
                disabled={adding || added}
                className="flex-1 py-3.5 rounded-full font-bold text-[13px] transition-all disabled:opacity-70 active:scale-[0.98]"
                style={{
                  background: added ? 'var(--moss)' : 'var(--ink)',
                  color: 'var(--bg)',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
                }}
              >
                {added ? (
                  <span className="inline-flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    담김
                  </span>
                ) : adding ? (
                  '담는 중...'
                ) : (
                  '장바구니'
                )}
              </button>
              <Link
                href={`/subscribe/${product.slug}`}
                className="flex-1 inline-flex items-center justify-center gap-1 py-3.5 rounded-full font-bold text-[13px] text-center active:scale-[0.98] transition-all"
                style={{
                  background: 'var(--moss)',
                  color: 'var(--bg)',
                  letterSpacing: '-0.01em',
                  boxShadow:
                    '0 4px 14px color-mix(in srgb, var(--moss) 30%, transparent)',
                }}
              >
                <Repeat className="w-3.5 h-3.5" strokeWidth={2.5} />
                정기배송
              </Link>
            </div>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={adding || added}
              className="w-full py-4 rounded-full font-bold text-[14px] transition-all disabled:opacity-70 active:scale-[0.98]"
              style={{
                background: added ? 'var(--moss)' : 'var(--ink)',
                color: 'var(--bg)',
                letterSpacing: '-0.01em',
                boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
              }}
            >
              {added ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" strokeWidth={3} />
                  장바구니에 담김
                </span>
              ) : adding ? (
                '담는 중...'
              ) : (
                <>장바구니 담기 · {total.toLocaleString()}원</>
              )}
            </button>
          )}
        </div>
      </div>
    </main>
  )
}
