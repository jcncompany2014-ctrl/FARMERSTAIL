/**
 * Cart loading skeleton — R39b (#5).
 *
 * 카트 페이지 server-side fetch 대기 중 표시. CLS 방지를 위해 실제 카트
 * 카드의 박스 사이즈와 거의 동일한 placeholder. web + app 공유 페이지라
 * v3 톤과 web editorial 톤 사이의 중립 grammar — 단순 회색 bg-2 wash.
 */
import { ShoppingCart } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

export default function CartLoading() {
  return (
    <main
      className="min-h-screen px-4 pb-24 md:px-6"
      role="status"
      aria-label="장바구니 불러오는 중"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-md mx-auto md:max-w-2xl pt-6 md:pt-10">
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-5">
          <ShoppingCart
            className="w-5 h-5"
            strokeWidth={1.8}
            style={{ color: 'var(--muted)' }}
          />
          <Skeleton className="h-6 w-32 rounded" />
        </div>

        {/* 상품 카드 3개 */}
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex gap-3 p-3 rounded"
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--rule)',
              }}
            >
              <Skeleton className="w-20 h-20 rounded shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
                <div className="mt-auto flex items-center justify-between">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-4 w-14 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 요약 카드 */}
        <div
          className="mt-5 p-4 rounded space-y-3"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--rule)',
          }}
        >
          <Skeleton className="h-4 w-1/3 rounded" />
          <Skeleton className="h-4 w-2/5 rounded" />
          <Skeleton className="h-6 w-1/2 rounded" />
        </div>
      </div>

      <span className="sr-only">장바구니 불러오는 중</span>
    </main>
  )
}
