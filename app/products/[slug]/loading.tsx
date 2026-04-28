/**
 * PDP 로딩 폴백 — 마켓컬리 톤 2-column PDP 의 skeleton.
 *
 * 좌측 sticky 갤러리 + 우측 sticky 정보 카드 + 하단 sticky 탭 구조 매칭.
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function ProductDetailLoading() {
  return (
    <main className="pb-32 md:pb-16" style={{ background: 'var(--bg)' }}>
      {/* breadcrumb */}
      <div className="px-5 md:px-6 pt-3 md:pt-5 max-w-6xl mx-auto">
        <Skeleton className="h-3 w-40 md:w-52" />
      </div>

      {/* 2-col main */}
      <section className="px-5 md:px-6 pt-3 md:pt-5 max-w-6xl mx-auto md:flex md:gap-10 md:items-start">
        {/* gallery (left) */}
        <div className="md:w-[55%]">
          <Skeleton className="aspect-square w-full" rounded="lg" />
          <div className="mt-3 md:mt-4 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-16 h-16 md:w-20 md:h-20"
                rounded="md"
              />
            ))}
          </div>
        </div>

        {/* info column (right) */}
        <div className="md:w-[45%] mt-6 md:mt-0 space-y-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 md:h-10 w-[80%]" />
          <Skeleton className="h-3 w-32" />

          {/* price block */}
          <div className="pt-4 border-t" style={{ borderColor: 'var(--rule)' }}>
            <Skeleton className="h-3 w-16 mb-1" />
            <div className="flex items-baseline gap-2">
              <Skeleton className="h-8 md:h-10 w-12" />
              <Skeleton className="h-8 md:h-10 w-28" />
            </div>
          </div>

          {/* delivery / point rows */}
          <div className="space-y-2 pt-3">
            <Skeleton className="h-3 w-[80%]" />
            <Skeleton className="h-3 w-[60%]" />
            <Skeleton className="h-3 w-[70%]" />
          </div>

          {/* qty card */}
          <div
            className="rounded-xl p-4 md:p-5 space-y-3 mt-3"
            style={{
              background: 'var(--bg-2)',
              boxShadow: 'inset 0 0 0 1px var(--rule)',
            }}
          >
            <div className="flex justify-between">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-8 w-24" rounded="md" />
            </div>
            <div
              className="flex justify-between pt-3 border-t"
              style={{ borderColor: 'var(--rule-2)' }}
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-32" />
            </div>
          </div>

          {/* CTAs */}
          <div className="hidden md:flex gap-2">
            <Skeleton className="h-12 flex-1" rounded="full" />
            <Skeleton className="h-12 flex-1" rounded="full" />
          </div>
        </div>
      </section>

      {/* sticky tab bar */}
      <div
        className="mt-10 md:mt-16 border-t border-b"
        style={{ borderColor: 'var(--rule)' }}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-6 flex">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 md:flex-initial md:px-7 py-3">
              <Skeleton className="h-3.5 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* description placeholder */}
      <section className="px-5 md:px-6 mt-8 md:mt-12 max-w-6xl mx-auto space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 md:h-6 w-[80%] mt-3" />
        <Skeleton className="h-5 md:h-6 w-[60%]" />
      </section>
    </main>
  )
}
