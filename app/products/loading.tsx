/**
 * /products 라우트 로딩 폴백 — 마켓컬리 톤 새 chrome 에 맞춘 skeleton.
 *
 * 새 layout:
 *   ┌─ breadcrumb + h1 + sort select ──────────┐
 *   ├─ filter sidebar │ active chips + grid    │
 *   └──────────────────────────────────────────┘
 *
 * 본 UI 와 박스 사이즈를 맞춰 swap 시 CLS 가 0 에 가깝도록.
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProductsLoading() {
  return (
    <main
      className="min-h-screen pb-12 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 1440 }}
    >
      {/* breadcrumb + toolbar */}
      <section className="px-5 md:px-8 pt-4 md:pt-6">
        <Skeleton className="h-3 w-28 md:w-36" />
        <div className="mt-3 md:mt-4 flex items-end justify-between gap-3">
          <Skeleton className="h-7 md:h-9 w-32 md:w-44" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-14" rounded="full" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
        {/* mobile search */}
        <div className="mt-3 md:hidden">
          <Skeleton className="h-11 w-full" rounded="full" />
        </div>
      </section>

      <hr
        className="my-4 md:my-5 mx-5 md:mx-8"
        style={{ borderColor: 'var(--rule)' }}
      />

      {/* 2-col layout */}
      <div className="px-5 md:px-8 md:flex md:gap-8">
        {/* desktop filter sidebar */}
        <aside className="hidden md:block w-[240px] shrink-0 space-y-6">
          <FilterGroupSkeleton rows={4} />
          <FilterGroupSkeleton rows={5} />
          <FilterGroupSkeleton rows={2} />
        </aside>

        {/* grid + chips */}
        <div className="flex-1 min-w-0">
          {/* active filter chips placeholder */}
          <div className="flex gap-1.5 mb-3">
            <Skeleton className="h-6 w-16" rounded="full" />
            <Skeleton className="h-6 w-20" rounded="full" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>

          {/* pagination */}
          <div className="mt-10 flex items-center justify-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-9" rounded="md" />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

function FilterGroupSkeleton({ rows }: { rows: number }) {
  return (
    <div className="pb-5 border-b" style={{ borderColor: 'var(--rule)' }}>
      <Skeleton className="h-3 w-16 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-[70%]" />
        ))}
      </div>
    </div>
  )
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="aspect-[4/5] w-full" rounded="lg" />
      <div className="pt-3 space-y-1.5">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-[60%]" />
        <Skeleton className="h-4 w-[40%] mt-1" />
      </div>
    </div>
  )
}
