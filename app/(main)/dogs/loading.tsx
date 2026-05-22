/**
 * /dogs 목록 로딩 폴백 (audit #108).
 *
 * 강아지 목록은 보통 1-2개라 카드 2개 placeholder.
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function DogsLoading() {
  return (
    <main className="pb-8" style={{ background: 'var(--bg)' }}>
      <section className="px-5 pt-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-1/2 mt-3" />
      </section>
      <section className="px-5 mt-6 space-y-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded border border-rule bg-white p-4 flex items-center gap-4"
          >
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2 mt-2" />
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
