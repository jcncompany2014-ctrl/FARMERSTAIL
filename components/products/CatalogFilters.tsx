'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'

/**
 * CatalogFilters — 카탈로그 필터 (가격대 / 정기배송 / 세일 / 카테고리).
 *
 * 데스크톱: 좌측 sticky 사이드바.
 * 모바일: "필터" 버튼 → bottom sheet (60vh).
 *
 * URL 단일 진실원 — `category`, `on_sale`, `subscribable`, `price_min`, `price_max`.
 * 모든 변경은 router.replace + scroll:false 로 그리드만 갱신.
 */

const CATEGORIES = ['화식', '간식', '체험팩'] as const
type Cat = (typeof CATEGORIES)[number]

const PRICE_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: '전체', min: null, max: null },
  { label: '1만원 이하', min: null, max: 10000 },
  { label: '1만~3만원', min: 10000, max: 30000 },
  { label: '3만~5만원', min: 30000, max: 50000 },
  { label: '5만원 이상', min: 50000, max: null },
]

/**
 * Default export = desktop sidebar + mobile trigger 둘 다.
 * 같은 페이지에서 두 번 mount 하면 desktop sidebar 가 중복 렌더되니 주의 —
 * 보통은 named exports `CatalogFilterTrigger` / `CatalogFilterSidebar` 를
 * 각자 한 번씩 호출.
 */
export default function CatalogFilters() {
  return (
    <>
      <DesktopSidebar />
      <MobileTrigger />
    </>
  )
}

/** 모바일 toolbar 자리에서 사용 — "필터" 버튼 + bottom sheet 만. */
export function CatalogFilterTrigger() {
  return <MobileTrigger />
}

/** Grid 좌측 sidebar 자리에서 사용 — 데스크톱 sticky aside 만. */
export function CatalogFilterSidebar() {
  return <DesktopSidebar />
}

function useFilterState() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const category = params?.get('category') ?? ''
  const onSale = params?.get('on_sale') === '1'
  const subscribable = params?.get('subscribable') === '1'
  const priceMin = params?.get('price_min')
    ? Number(params.get('price_min'))
    : null
  const priceMax = params?.get('price_max')
    ? Number(params.get('price_max'))
    : null

  function patch(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(params?.toString() ?? '')
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') sp.delete(k)
      else sp.set(k, v)
    }
    sp.delete('page')
    const qs = sp.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  function setCategory(c: Cat | '') {
    patch({ category: c || null })
  }
  function setOnSale(v: boolean) {
    patch({ on_sale: v ? '1' : null })
  }
  function setSubscribable(v: boolean) {
    patch({ subscribable: v ? '1' : null })
  }
  function setPrice(min: number | null, max: number | null) {
    patch({
      price_min: min !== null ? String(min) : null,
      price_max: max !== null ? String(max) : null,
    })
  }
  function clearAll() {
    const sp = new URLSearchParams(params?.toString() ?? '')
    ;[
      'category',
      'on_sale',
      'subscribable',
      'price_min',
      'price_max',
      'page',
    ].forEach((k) => sp.delete(k))
    const qs = sp.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  return {
    category,
    onSale,
    subscribable,
    priceMin,
    priceMax,
    setCategory,
    setOnSale,
    setSubscribable,
    setPrice,
    clearAll,
    pending,
  }
}

function DesktopSidebar() {
  const f = useFilterState()
  const activePresetIdx = useMemo(() => {
    return PRICE_PRESETS.findIndex(
      (p) => p.min === f.priceMin && p.max === f.priceMax,
    )
  }, [f.priceMin, f.priceMax])

  return (
    <aside className="hidden md:block w-[240px] shrink-0">
      <div className="sticky top-[140px] pb-10">
        <FilterHeader onClear={f.clearAll} />

        <FilterGroup label="카테고리">
          <FilterRow
            label="전체"
            active={f.category === ''}
            onClick={() => f.setCategory('')}
          />
          {CATEGORIES.map((c) => (
            <FilterRow
              key={c}
              label={c}
              active={f.category === c}
              onClick={() => f.setCategory(c)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="가격대">
          {PRICE_PRESETS.map((p, i) => (
            <FilterRow
              key={p.label}
              label={p.label}
              active={i === activePresetIdx || (i === 0 && activePresetIdx === -1)}
              onClick={() => f.setPrice(p.min, p.max)}
            />
          ))}
        </FilterGroup>

        <FilterGroup label="혜택">
          <CheckRow
            label="세일 진행중"
            tone="sale"
            checked={f.onSale}
            onChange={f.setOnSale}
          />
          <CheckRow
            label="정기배송 가능"
            tone="moss"
            checked={f.subscribable}
            onChange={f.setSubscribable}
          />
        </FilterGroup>
      </div>
    </aside>
  )
}

function MobileTrigger() {
  const [open, setOpen] = useState(false)
  const f = useFilterState()
  const activeCount =
    (f.category ? 1 : 0) +
    (f.onSale ? 1 : 0) +
    (f.subscribable ? 1 : 0) +
    (f.priceMin !== null || f.priceMax !== null ? 1 : 0)

  // 모바일 sheet 열렸을 때 body scroll lock
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition active:scale-[0.97]"
        style={{
          background: 'var(--bg-2)',
          color: 'var(--ink)',
          boxShadow: 'inset 0 0 0 1px var(--rule)',
        }}
        aria-label="필터 열기"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2} />
        필터
        {activeCount > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black"
            style={{ background: 'var(--terracotta)', color: 'var(--bg)' }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="필터"
          className="md:hidden fixed inset-0 z-50"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(46,31,20,0.5)' }}
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 right-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl"
            style={{ background: 'var(--bg)' }}
          >
            <div
              className="sticky top-0 flex items-center justify-between px-5 h-14 border-b"
              style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
            >
              <span
                className="font-serif"
                style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}
              >
                필터
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="w-9 h-9 -mr-2 flex items-center justify-center"
              >
                <X className="w-4 h-4" style={{ color: 'var(--muted)' }} strokeWidth={2.25} />
              </button>
            </div>

            <div className="px-5 py-4">
              <SheetContent f={f} />
            </div>

            <div
              className="sticky bottom-0 grid grid-cols-2 gap-2 px-5 py-3 border-t"
              style={{ background: 'var(--bg)', borderColor: 'var(--rule)' }}
            >
              <button
                type="button"
                onClick={() => {
                  f.clearAll()
                }}
                className="py-3 rounded-full text-[13px] font-bold border"
                style={{
                  borderColor: 'var(--rule-2)',
                  color: 'var(--text)',
                  background: 'var(--bg)',
                }}
              >
                전체 해제
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="py-3 rounded-full text-[13px] font-bold"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                결과 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SheetContent({ f }: { f: ReturnType<typeof useFilterState> }) {
  const activePresetIdx = useMemo(() => {
    return PRICE_PRESETS.findIndex(
      (p) => p.min === f.priceMin && p.max === f.priceMax,
    )
  }, [f.priceMin, f.priceMax])

  return (
    <>
      <FilterGroup label="카테고리">
        <div className="grid grid-cols-2 gap-1.5">
          <SheetChip
            label="전체"
            active={f.category === ''}
            onClick={() => f.setCategory('')}
          />
          {CATEGORIES.map((c) => (
            <SheetChip
              key={c}
              label={c}
              active={f.category === c}
              onClick={() => f.setCategory(c)}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="가격대">
        <div className="grid grid-cols-2 gap-1.5">
          {PRICE_PRESETS.map((p, i) => (
            <SheetChip
              key={p.label}
              label={p.label}
              active={i === activePresetIdx || (i === 0 && activePresetIdx === -1)}
              onClick={() => f.setPrice(p.min, p.max)}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="혜택">
        <div className="grid grid-cols-2 gap-1.5">
          <SheetChip
            label="세일"
            active={f.onSale}
            onClick={() => f.setOnSale(!f.onSale)}
            tone="sale"
          />
          <SheetChip
            label="정기배송"
            active={f.subscribable}
            onClick={() => f.setSubscribable(!f.subscribable)}
            tone="moss"
          />
        </div>
      </FilterGroup>
    </>
  )
}

// ─────────────────────────── atoms ───────────────────────────

function FilterHeader({ onClear }: { onClear: () => void }) {
  return (
    <div className="hidden md:flex items-center justify-between mb-4">
      <span
        className="font-mono text-[10px] tracking-[0.2em] uppercase"
        style={{ color: 'var(--muted)' }}
      >
        Filter · 필터
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-[10.5px] font-bold underline underline-offset-2"
        style={{ color: 'var(--terracotta)' }}
      >
        전체 해제
      </button>
    </div>
  )
}

function FilterGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-5 md:mb-6 md:pb-5 md:border-b" style={{ borderColor: 'var(--rule)' }}>
      <div
        className="text-[11px] md:text-[12px] font-black mb-2 md:mb-3"
        style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
      >
        {label}
      </div>
      <div className="md:space-y-1">{children}</div>
    </section>
  )
}

function FilterRow({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden md:flex items-center justify-between w-full py-1.5 text-left text-[12.5px] transition"
      style={{
        color: active ? 'var(--terracotta)' : 'var(--text)',
        fontWeight: active ? 800 : 500,
      }}
    >
      <span>{label}</span>
      {active && (
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--terracotta)' }}
        />
      )}
    </button>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
  tone,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  tone: 'sale' | 'moss'
}) {
  const accent = tone === 'sale' ? 'var(--sale)' : 'var(--moss)'
  return (
    <label className="hidden md:flex items-center gap-2 py-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5"
        style={{ accentColor: accent }}
      />
      <span
        className="text-[12.5px]"
        style={{
          color: checked ? accent : 'var(--text)',
          fontWeight: checked ? 800 : 500,
        }}
      >
        {label}
      </span>
    </label>
  )
}

function SheetChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string
  active: boolean
  onClick: () => void
  tone?: 'sale' | 'moss'
}) {
  const accent =
    tone === 'sale'
      ? 'var(--sale)'
      : tone === 'moss'
        ? 'var(--moss)'
        : 'var(--ink)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="py-2.5 rounded-lg text-[12.5px] font-bold transition active:scale-[0.97]"
      style={{
        background: active ? accent : 'var(--bg-2)',
        color: active ? 'var(--bg)' : 'var(--text)',
        boxShadow: active ? 'none' : 'inset 0 0 0 1px var(--rule)',
      }}
    >
      {label}
    </button>
  )
}
