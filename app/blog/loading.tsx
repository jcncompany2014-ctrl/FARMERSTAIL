/**
 * /blog 라우트 로딩 폴백 — 매거진 ListLatest + RecentList placeholder.
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function BlogLoading() {
  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: 'var(--bg)' }}
    >
      <section className="px-5 pt-7">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-9 w-2/3 mt-3" />
        <Skeleton className="h-3.5 w-3/4 mt-3" />
      </section>

      {/* Hero post placeholder */}
      <section className="px-5 mt-8">
        <Skeleton className="aspect-[16/9] w-full" rounded="lg" />
        <Skeleton className="h-2.5 w-20 mt-4" />
        <Skeleton className="h-5 w-full mt-2" />
        <Skeleton className="h-5 w-3/4 mt-1.5" />
        <Skeleton className="h-3.5 w-1/3 mt-3" />
      </section>

      {/* Recent rows */}
      <section className="px-5 mt-8 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="shrink-0 w-28 h-28" rounded="lg" />
            <div className="flex-1 flex flex-col gap-1.5 pt-1">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4 w-3/4 mt-1" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
