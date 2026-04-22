'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

type Props = {
  initialQuery: string
  initialCategory: string
  initialStatus: string
}

const CATEGORIES = ['체험팩', '정기배송', '간식', '주식', '기타']

export default function ProductsFilterBar({
  initialQuery,
  initialCategory,
  initialStatus,
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory)
  const [status, setStatus] = useState(initialStatus)
  const [, startTransition] = useTransition()

  function applyFilters(overrides?: Partial<{ q: string; c: string; s: string }>) {
    const params = new URLSearchParams()
    const q = overrides?.q ?? query
    const c = overrides?.c ?? category
    const s = overrides?.s ?? status
    if (q.trim()) params.set('q', q.trim())
    if (c) params.set('category', c)
    if (s) params.set('status', s)
    startTransition(() => {
      const qs = params.toString()
      router.push(qs ? `/admin/products?${qs}` : '/admin/products')
    })
  }

  function clear() {
    setQuery('')
    setCategory('')
    setStatus('')
    startTransition(() => router.push('/admin/products'))
  }

  const hasAny = query.trim() || category || status

  return (
    <div className="p-4 rounded-2xl bg-white border border-rule">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applyFilters()
          }}
          className="flex-1 min-w-[240px] flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg"
        >
          <Search
            className="w-3.5 h-3.5 text-muted shrink-0"
            strokeWidth={2.25}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="상품명 / slug 검색"
            className="flex-1 bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                applyFilters({ q: '' })
              }}
              className="text-muted hover:text-text"
              aria-label="검색 지우기"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.25} />
            </button>
          )}
        </form>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            applyFilters({ c: e.target.value })
          }}
          className="px-3 py-2 rounded-lg bg-bg text-xs text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
        >
          <option value="">전체 카테고리</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <div className="inline-flex rounded-lg bg-bg p-0.5">
          {[
            { val: '', label: '전체' },
            { val: 'active', label: '판매 중' },
            { val: 'inactive', label: '비활성' },
          ].map((opt) => (
            <button
              key={opt.val || 'all'}
              type="button"
              onClick={() => {
                setStatus(opt.val)
                applyFilters({ s: opt.val })
              }}
              className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition ${
                status === opt.val
                  ? 'bg-text text-white'
                  : 'text-text hover:bg-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {hasAny && (
          <button
            type="button"
            onClick={clear}
            className="px-3 py-2 rounded-lg text-[11px] font-semibold text-muted hover:text-sale transition"
          >
            초기화
          </button>
        )}
      </div>
    </div>
  )
}
