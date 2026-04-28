/**
 * /dashboard 로딩 폴백.
 *
 * 5개 쿼리가 Promise.all 로 ~1×RTT 안에 끝나지만 RSC 페이로드 + auth 핸드셰이크
 * 동안 짧게 보일 수 있어 placeholder 를 그려준다. 실제 마스트헤드 + 다음 배송
 * 카드 + 강아지 + 카테고리 + 상품 그리드 사이즈에 맞춰 layout shift 최소화.
 */
import { Skeleton, ProductGridSkeleton } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <main className="pb-8" style={{ background: 'var(--bg)' }}>
      {/* 마스트헤드 (terracotta tick + 인사) */}
      <section className="px-5 pt-4 pb-5">
        <div className="flex items-center gap-2.5">
          <span className="block h-px w-6 bg-[var(--terracotta)]" />
          <Skeleton className="h-2.5 w-28" />
        </div>
        <Skeleton className="h-7 w-1/3 mt-4" />
        <Skeleton className="h-7 w-2/3 mt-2" />
        <Skeleton className="h-3.5 w-3/4 mt-3" />
        <div className="mt-5 flex items-center gap-2">
          <span className="h-1 w-1 rounded-sm bg-[var(--terracotta)]" />
          <span className="flex-1 h-px bg-[var(--rule)]" />
          <span className="h-1 w-1 rounded-sm bg-[var(--terracotta)]" />
        </div>
      </section>

      {/* 다음 배송 히어로 자리 */}
      <section className="px-5 mt-4">
        <Skeleton className="h-24 w-full" rounded="lg" />
      </section>

      {/* 내 강아지 */}
      <section className="px-5 mt-6">
        <Skeleton className="h-4 w-24 mb-3" />
        <div className="flex gap-3 overflow-hidden">
          <Skeleton className="w-[120px] h-[120px] shrink-0" rounded="lg" />
          <Skeleton className="w-[120px] h-[120px] shrink-0" rounded="lg" />
          <Skeleton className="w-[120px] h-[120px] shrink-0" rounded="lg" />
        </div>
      </section>

      {/* 카테고리 3 그리드 */}
      <section className="px-5 mt-6">
        <Skeleton className="h-2.5 w-16 mb-2.5" />
        <div className="grid grid-cols-3 gap-2.5">
          <Skeleton className="aspect-[1/1.1]" rounded="lg" />
          <Skeleton className="aspect-[1/1.1]" rounded="lg" />
          <Skeleton className="aspect-[1/1.1]" rounded="lg" />
        </div>
      </section>

      {/* 전체 상품 */}
      <section className="px-5 mt-8">
        <Skeleton className="h-5 w-24 mb-3" />
        <ProductGridSkeleton count={4} />
      </section>
    </main>
  )
}
