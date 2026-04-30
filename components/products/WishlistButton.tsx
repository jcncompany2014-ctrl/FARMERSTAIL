'use client'

import { Heart } from 'lucide-react'
import { useWishlist } from './WishlistContext'

/**
 * WishlistButton — ProductCard 우상단 floating heart.
 *
 * 데이터는 WishlistProvider (WebChrome 안) 가 한 번만 batch fetch 한 set 을
 * 공유. 카드 N개여도 client side 에서 추가 fetch 0회.
 *
 * 토글은 provider 의 `toggle()` 이 처리 — 비로그인 → /login 자동 redirect.
 */
export default function WishlistButton({
  productId,
  productSlug,
}: {
  productId: string
  productSlug: string
}) {
  const { wishedIds, toggle, isBusy, ready } = useWishlist()
  const wished = wishedIds.has(productId)
  const busy = isBusy(productId)

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    toggle(productId, productSlug)
  }

  // ready 전에는 neutral heart — flicker 방지
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={wished ? '찜 해제' : '찜하기'}
      aria-pressed={wished}
      className="absolute top-1.5 right-1.5 z-20 w-10 h-10 md:w-10 md:h-10 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-70"
      style={{
        background: wished
          ? 'rgba(160,69,46,0.92)'
          : 'rgba(245,240,230,0.86)',
        color: wished ? 'var(--bg)' : 'var(--ink)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        boxShadow: wished
          ? '0 2px 8px rgba(160,69,46,0.32)'
          : '0 2px 8px rgba(0,0,0,0.08)',
        opacity: ready ? 1 : 0.85,
      }}
    >
      <Heart
        className="w-4 h-4 md:w-[18px] md:h-[18px]"
        strokeWidth={wished ? 0 : 2}
        fill={wished ? 'currentColor' : 'none'}
      />
    </button>
  )
}
