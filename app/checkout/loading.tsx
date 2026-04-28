/**
 * /checkout 로딩 폴백.
 *
 * 카트 → 주문 형태 변환 + 주소 prefill + Toss SDK 로드까지 합쳐서 첫 페인트
 * 가 가장 느린 라우트. 폼 layout 그대로 미리 그려둠.
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function CheckoutLoading() {
  return (
    <main className="pb-32" style={{ background: 'var(--bg)' }}>
      {/* 헤더 */}
      <section className="px-5 pt-6 pb-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-2.5 w-28 mt-3" />
        <Skeleton className="h-6 w-24 mt-2" />
      </section>

      {/* 주문 상품 리스트 */}
      <section className="px-5 mt-4">
        <Skeleton className="h-4 w-20 mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-rule px-4 py-3 flex gap-3 items-center"
            >
              <Skeleton className="shrink-0 w-14 h-14" rounded="lg" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/3 mt-1.5" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </section>

      {/* 배송지 카드 */}
      <section className="px-5 mt-6">
        <Skeleton className="h-4 w-20 mb-3" />
        <div className="bg-white rounded-xl border border-rule p-5 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </section>

      {/* 결제 수단 / 합계 */}
      <section className="px-5 mt-6 space-y-3">
        <Skeleton className="h-12 w-full" rounded="lg" />
        <Skeleton className="h-12 w-full" rounded="lg" />
        <Skeleton className="h-16 w-full mt-4" rounded="lg" />
      </section>

      {/* 결제 CTA */}
      <section className="px-5 mt-6">
        <Skeleton className="h-12 w-full" rounded="full" />
      </section>
    </main>
  )
}
