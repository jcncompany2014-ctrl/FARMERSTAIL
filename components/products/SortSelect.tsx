'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

/**
 * SortSelect — 카탈로그 정렬 드롭다운.
 *
 * 마켓컬리/SSF 의 우상단 정렬 select 동선:
 *   인기순 (default · 큐레이션 sort_order)
 *   신상품 (created_at DESC)
 *   낮은가격순 (price ASC)
 *   높은가격순 (price DESC)
 *   할인율순 (sale_price 기반)
 *
 * URL `?sort=` 와 동기화 — 서버 컴포넌트가 그대로 다시 쿼리.
 * router.replace + scroll:false 로 드롭다운 변경이 위로 점프시키지 않게.
 */

export type SortKey = 'popular' | 'new' | 'price_asc' | 'price_desc' | 'discount'

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'popular', label: '인기순' },
  { value: 'new', label: '신상품' },
  { value: 'price_asc', label: '낮은가격순' },
  { value: 'price_desc', label: '높은가격순' },
  { value: 'discount', label: '할인율순' },
]

export default function SortSelect({
  current,
}: {
  current: SortKey
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as SortKey
    const sp = new URLSearchParams(params?.toString() ?? '')
    if (next === 'popular') sp.delete('sort')
    else sp.set('sort', next)
    sp.delete('page')
    const qs = sp.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  return (
    <label
      className="relative inline-flex items-center"
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <select
        value={current}
        onChange={onChange}
        aria-label="정렬"
        className="appearance-none bg-transparent pr-6 pl-0 text-[12px] md:text-[13px] font-bold cursor-pointer focus:outline-none"
        style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px]"
        style={{ color: 'var(--muted)' }}
      >
        ▾
      </span>
    </label>
  )
}
