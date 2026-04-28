'use client'

/**
 * Farmer's Tail — VariantSelector.
 *
 * PDP에서 variant(중량/맛/등) 선택 UI. 큰 드롭다운 대신 **타일 카드** 배열로
 * 렌더해서 선택지 전체와 각각의 가격 차이, 품절 상태를 한눈에 보여준다. 이게
 * mobile 터치 UX에 가장 자연스럽고, 선택지가 3~4개 내외로 작은 카탈로그에서는
 * 드롭다운보다 탭수가 적다.
 *
 * 상태는 **controlled**. 선택 값(id)은 상위 컴포넌트가 소유하고, 선택 시
 * onChange로 올려보낸다. 부모는 variant의 price/stock으로 CTA와 수량 스텝퍼를
 * 업데이트.
 */

import { cn } from '@/lib/ui/cn'
import { stockState } from '@/lib/products/stock'
import { effectivePrice, type ProductVariant } from '@/lib/products/variants'

export interface VariantSelectorProps {
  variants: ProductVariant[]
  selectedId: string | null
  parent: { price: number; sale_price: number | null }
  onChange: (variantId: string) => void
  /** 레이아웃 — 'tiles'는 카드 타일 (기본), 'chips'는 더 작은 pill. */
  layout?: 'tiles' | 'chips'
  className?: string
}

export function VariantSelector({
  variants,
  selectedId,
  parent,
  onChange,
  layout = 'tiles',
  className,
}: VariantSelectorProps) {
  const actives = variants.filter((v) => v.is_active)
  if (actives.length === 0) return null

  return (
    <div className={cn('w-full', className)} role="radiogroup" aria-label="옵션 선택">
      <div
        className={cn(
          layout === 'tiles'
            ? 'grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3'
            : 'flex flex-wrap gap-2 md:gap-2.5',
        )}
      >
        {actives.map((v) => {
          const selected = v.id === selectedId
          const priceNow = effectivePrice(v, parent)
          const state = stockState(v.stock)
          const out = state === 'out'
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={out}
              disabled={out}
              onClick={() => {
                if (!out) onChange(v.id)
              }}
              className={cn(
                'relative text-left transition active:scale-[0.99]',
                layout === 'tiles'
                  ? 'rounded-xl border px-3 py-2.5 md:px-4 md:py-3.5'
                  : 'rounded-full border px-3 py-1.5 md:px-4 md:py-2',
                // 선택 상태
                selected
                  ? 'bg-ink text-bg border-ink'
                  : 'bg-white text-text border-rule hover:border-rule-2',
                // 품절
                out && 'opacity-50 cursor-not-allowed',
              )}
            >
              {layout === 'tiles' ? (
                <div className="flex flex-col">
                  <span
                    className={cn(
                      'text-[12px] md:text-[14px] font-bold leading-tight',
                      selected ? 'text-bg' : 'text-text',
                    )}
                  >
                    {v.name}
                  </span>
                  <div className="mt-1 md:mt-1.5 flex items-baseline gap-1">
                    <span
                      className={cn(
                        'text-[11px] md:text-[13px] font-bold',
                        selected ? 'text-bg' : 'text-terracotta',
                      )}
                    >
                      {priceNow.toLocaleString()}원
                    </span>
                    {state === 'low' && !out && (
                      <span
                        className={cn(
                          'text-[9px] md:text-[10px] font-bold',
                          selected ? 'text-bg/70' : 'text-sale',
                        )}
                      >
                        재고 {v.stock}
                      </span>
                    )}
                    {out && (
                      <span className="text-[9px] md:text-[10px] font-bold text-muted">
                        품절
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-[11px] md:text-[13px] font-bold inline-flex items-center gap-1.5">
                  {v.name}
                  {out && (
                    <span className="text-[9px] md:text-[10px] font-bold text-muted">품절</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
