/**
 * /dogs/[id]/analysis 로딩 폴백 (audit #108).
 *
 * 설문 직후 진입하는 가장 기대치 높은 페이지. layout shift 최소화 위해 큰
 * 차트/추천 박스 영역 placeholder.
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function AnalysisLoading() {
  return (
    <div className="pb-8" style={{ background: 'var(--bg)' }}>
      <section className="px-5 pt-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-2/3 mt-3" />
        <Skeleton className="h-3 w-1/2 mt-2" />
      </section>
      <section className="px-5 mt-6">
        <Skeleton className="h-48 w-full rounded" />
      </section>
      <section className="px-5 mt-4 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded" />
        ))}
      </section>
      <section className="px-5 mt-6">
        <Skeleton className="h-32 w-full rounded" />
      </section>
    </div>
  )
}
