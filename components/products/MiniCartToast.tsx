'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Check, ShoppingBag, X, ArrowRight } from 'lucide-react'

/**
 * MiniCartToast — 장바구니 담기 시 우상단(데스크톱) / 하단(모바일) 슬라이드 토스트.
 *
 * 동작:
 *   • PDP 또는 어디서든 `window.dispatchEvent(new CustomEvent('ft:cart:add', { detail }))`
 *     이벤트가 들어오면 5 초간 뜬다.
 *   • detail: { productName: string, quantity: number, imageUrl?: string | null }
 *   • 클릭 → /cart 이동.
 *
 * WebChrome 안에 한 번만 mount 되어 전역으로 listen.
 */

type ToastDetail = {
  productName: string
  quantity: number
  imageUrl?: string | null
}

export default function MiniCartToast() {
  const [toast, setToast] = useState<ToastDetail | null>(null)
  // dismiss timeout — 빠른 연속 클릭 시 이전 timeout 누락 없이 교체.
  const dismissRef = useRef<number | null>(null)

  useEffect(() => {
    const onAdd = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail
      if (!detail) return
      // 이전 dismiss timer 먼저 클리어 — 누적 leak 방지.
      if (dismissRef.current !== null) {
        window.clearTimeout(dismissRef.current)
      }
      setToast(detail)
      dismissRef.current = window.setTimeout(() => {
        setToast(null)
        dismissRef.current = null
      }, 5000)
    }
    window.addEventListener('ft:cart:add', onAdd as EventListener)
    return () => {
      window.removeEventListener('ft:cart:add', onAdd as EventListener)
      if (dismissRef.current !== null) {
        window.clearTimeout(dismissRef.current)
        dismissRef.current = null
      }
    }
  }, [])

  if (!toast) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="ft-mini-cart-toast fixed z-50 left-1/2 -translate-x-1/2 bottom-24 md:bottom-auto md:top-24 md:right-6 md:left-auto md:translate-x-0 w-[calc(100%-32px)] max-w-sm md:max-w-[360px] animate-fade-in"
    >
      <div
        className="rounded-2xl shadow-xl flex items-center gap-3 p-3 md:p-3.5"
        style={{
          background: 'var(--ink)',
          color: 'var(--bg)',
          boxShadow: '0 12px 40px rgba(30,26,20,0.32)',
        }}
      >
        <span
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{
            background: 'var(--moss)',
            color: 'var(--bg)',
          }}
        >
          <Check className="w-[18px] h-[18px]" strokeWidth={3} />
        </span>

        <div className="flex-1 min-w-0">
          <p
            className="text-[12px] md:text-[12.5px] font-bold mb-0.5"
            style={{ color: 'var(--gold)', letterSpacing: '-0.005em' }}
          >
            장바구니에 담겼어요
          </p>
          <p className="text-[11px] md:text-[12px] truncate opacity-90">
            {toast.productName}
            {toast.quantity > 1 && (
              <span className="opacity-70"> · {toast.quantity}개</span>
            )}
          </p>
        </div>

        {toast.imageUrl && (
          <div className="shrink-0 relative w-11 h-11 rounded-lg overflow-hidden bg-bg/10">
            <Image
              src={toast.imageUrl}
              alt=""
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>
        )}

        <Link
          href="/cart"
          onClick={() => setToast(null)}
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] md:text-[12px] font-bold transition active:scale-[0.97]"
          style={{
            background: 'var(--gold)',
            color: 'var(--ink)',
            letterSpacing: '-0.005em',
          }}
        >
          <ShoppingBag className="w-3 h-3" strokeWidth={2.5} />
          담기
          <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
        </Link>

        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="닫기"
          className="shrink-0 w-7 h-7 -mr-1 flex items-center justify-center rounded-full transition active:scale-90"
          style={{ color: 'rgba(245,240,230,0.6)' }}
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
