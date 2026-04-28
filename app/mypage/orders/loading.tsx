/**
 * /mypage/orders 로딩 폴백 — 주문 목록 placeholder.
 */
import { Skeleton } from '@/components/ui/Skeleton'

export default function OrdersLoading() {
  return (
    <main className="pb-8" style={{ background: 'var(--bg)' }}>
      {/* 헤더: 뒤로가기 + kicker + h1 + 카운트 */}
      <section className="px-5 pt-6 pb-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-2.5 w-32 mt-3" />
        <Skeleton className="h-6 w-32 mt-2" />
        <Skeleton className="h-3 w-24 mt-2" />
      </section>

      {/* 주문 카드 N개 — 실제와 같은 박스 사이즈 (image 56 + 본문 + 가격) */}
      <section className="px-5 mt-3 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-rule px-4 py-4"
          >
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-16" rounded="md" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="shrink-0 w-14 h-14" rounded="lg" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-24 mt-1.5" />
                <Skeleton className="h-5 w-20 mt-2" />
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}
