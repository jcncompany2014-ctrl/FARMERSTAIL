/**
 * /dogs/[id] 강아지 상세 로딩 폴백 (audit #108).
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function DogDetailLoading() {
  return (
    <main className="pb-8" style={{ background: 'var(--bg)' }}>
      <section className="px-5 pt-6 flex items-center gap-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-1/2 mt-2" />
          <Skeleton className="h-3 w-2/3 mt-1.5" />
        </div>
      </section>
      <section className="px-5 mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded" />
        ))}
      </section>
    </main>
  )
}
