/**
 * /dogs/[id]/survey 로딩 폴백 (audit #108).
 *
 * survey 는 2053줄 단일 client component 라 hydration 부담 큼. 진입 직후
 * 첫 step (체중·BCS) 영역 placeholder.
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function SurveyLoading() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      <section className="px-5 pt-6">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-6 w-2/3 mt-3" />
        <Skeleton className="h-3 w-1/2 mt-2" />
      </section>
      <section className="px-5 mt-8 flex-1">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </section>
      <section className="px-5 pb-6">
        <Skeleton className="h-12 w-full rounded-full" />
      </section>
    </main>
  )
}
