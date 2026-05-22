/**
 * /mypage 로딩 폴백 (audit #108).
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function MypageLoading() {
  return (
    <main className="pb-8" style={{ background: 'var(--bg)' }}>
      <section className="px-5 pt-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-1/3 mt-3" />
      </section>
      <section className="px-5 mt-6 space-y-2.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded" />
        ))}
      </section>
    </main>
  )
}
