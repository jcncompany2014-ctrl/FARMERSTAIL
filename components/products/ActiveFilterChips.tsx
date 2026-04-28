'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { useTransition } from 'react'

/**
 * ActiveFilterChips — 카탈로그 그리드 위에 활성 필터를 chip 으로 표시.
 * 각 chip 의 X 클릭으로 단일 필터만 해제. "전체 해제" 마지막 chip.
 *
 * URL 단일 진실원 (CatalogFilters 와 동일 모델).
 */
export default function ActiveFilterChips() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const category = params?.get('category') ?? ''
  const onSale = params?.get('on_sale') === '1'
  const subscribable = params?.get('subscribable') === '1'
  const priceMin = params?.get('price_min')
  const priceMax = params?.get('price_max')
  const sort = params?.get('sort') ?? ''
  const query = params?.get('q') ?? ''

  function removeKeys(keys: string[]) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    keys.forEach((k) => sp.delete(k))
    sp.delete('page')
    const qs = sp.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  const chips: { label: string; onRemove: () => void; tone?: 'sale' | 'moss' | 'terracotta' }[] = []

  if (query) {
    chips.push({
      label: `검색: "${query}"`,
      onRemove: () => removeKeys(['q']),
    })
  }
  if (category) {
    chips.push({
      label: category,
      onRemove: () => removeKeys(['category']),
    })
  }
  if (priceMin || priceMax) {
    let label = ''
    if (priceMin && priceMax)
      label = `${Number(priceMin).toLocaleString()}~${Number(priceMax).toLocaleString()}원`
    else if (priceMin) label = `${Number(priceMin).toLocaleString()}원 이상`
    else if (priceMax) label = `${Number(priceMax).toLocaleString()}원 이하`
    chips.push({ label, onRemove: () => removeKeys(['price_min', 'price_max']) })
  }
  if (onSale) {
    chips.push({
      label: '세일',
      tone: 'sale',
      onRemove: () => removeKeys(['on_sale']),
    })
  }
  if (subscribable) {
    chips.push({
      label: '정기배송',
      tone: 'moss',
      onRemove: () => removeKeys(['subscribable']),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {chips.map((c) => {
        const accent =
          c.tone === 'sale'
            ? 'var(--sale)'
            : c.tone === 'moss'
              ? 'var(--moss)'
              : 'var(--ink)'
        return (
          <button
            key={c.label}
            type="button"
            onClick={c.onRemove}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition active:scale-[0.97]"
            style={{
              background: 'var(--bg-2)',
              color: accent,
              boxShadow: `inset 0 0 0 1px ${accent}`,
            }}
            aria-label={`${c.label} 필터 해제`}
          >
            {c.label}
            <X className="w-3 h-3" strokeWidth={2.5} />
          </button>
        )
      })}
      <button
        type="button"
        onClick={() =>
          removeKeys([
            'category',
            'on_sale',
            'subscribable',
            'price_min',
            'price_max',
            'q',
          ])
        }
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold underline underline-offset-2"
        style={{ color: 'var(--muted)' }}
      >
        전체 해제
      </button>
      {/* sort 가 비-default 면 표시만 (해제는 우상단 select 에서) */}
      {sort && sort !== 'popular' && (
        <span
          className="ml-auto inline-flex items-center text-[10.5px] font-mono"
          style={{ color: 'var(--muted)', letterSpacing: '0.1em' }}
        >
          SORT · {sortLabel(sort)}
        </span>
      )}
    </div>
  )
}

function sortLabel(s: string): string {
  switch (s) {
    case 'new':
      return '신상품'
    case 'price_asc':
      return '낮은가격'
    case 'price_desc':
      return '높은가격'
    case 'discount':
      return '할인율'
    case 'best':
      return '베스트'
    default:
      return s
  }
}
