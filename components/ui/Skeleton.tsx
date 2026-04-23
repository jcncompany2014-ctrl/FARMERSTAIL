/**
 * Farmer's Tail — Skeleton 로더.
 *
 * Suspense fallback / 데이터 페치 중 placeholder로 쓰는 유틸 + preset.
 *
 * # 디자인 원칙
 * - shimmer는 있지만 은근하게 — 금속성 "반짝임"이 아니라 종이에 스며든 듯한
 *   gradient. brand 배경(bg-2)과 shade(rule-2) 사이를 왕복.
 * - motion-safe에서만 애니메이션. reduce-motion 사용자에겐 평평한 bg-2.
 * - 레이아웃이 본 컨텐츠와 "거의 같은 박스 사이즈"여야 CLS가 없다. 페이지별
 *   preset이 그걸 보장.
 * - role="status" + sr-only 텍스트로 스크린리더에 "로딩 중" 알림.
 */
import { cn } from '@/lib/ui/cn'

// ──────────────────────────────────────────────────────────────────────────
// Primitive
// ──────────────────────────────────────────────────────────────────────────

export interface SkeletonProps {
  className?: string
  /**
   * skeleton이 radius-free인 자리(h1, 가격 라벨 등)에 ""로 override 가능.
   * 기본은 rounded-md.
   */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  /** role="status" + aria-label 자동. 목록처럼 반복되는 경우는 false로 줄여도 됨. */
  announce?: boolean
}

const roundedMap: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

export function Skeleton({
  className,
  rounded = 'md',
  announce = false,
}: SkeletonProps) {
  return (
    <div
      role={announce ? 'status' : undefined}
      aria-label={announce ? '로딩 중' : undefined}
      aria-live={announce ? 'polite' : undefined}
      className={cn(
        'bg-bg-2 relative overflow-hidden',
        'motion-safe:before:absolute motion-safe:before:inset-0',
        'motion-safe:before:bg-gradient-to-r',
        'motion-safe:before:from-transparent motion-safe:before:via-rule-2/60 motion-safe:before:to-transparent',
        'motion-safe:before:animate-[shimmer_1.6s_ease-in-out_infinite]',
        roundedMap[rounded],
        className
      )}
    />
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Presets — 주요 페이지 형태에 맞춘 compo-skeleton.
// 사용처가 이걸 쓰면 본 UI로 swap할 때 레이아웃 점프가 거의 없어야 한다.
// ──────────────────────────────────────────────────────────────────────────

/**
 * PLP(Product List Page) 그리드 카드 한 칸. 2열 그리드에 N개 배치해서 사용.
 *
 * 실제 ProductCard: image (aspect-square) + title (~2줄) + 가격.
 */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-square w-full" rounded="lg" />
      <Skeleton className="h-3.5 w-[80%]" />
      <Skeleton className="h-3.5 w-[55%]" />
      <Skeleton className="h-4 w-[40%] mt-1" />
    </div>
  )
}

/**
 * PLP 페이지 전체 — 2열 그리드 × N.
 */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="제품 목록 로딩 중"
      className="grid grid-cols-2 gap-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * PDP 상단 — hero image + title + price + CTA line.
 */
export function PdpHeroSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="제품 정보 로딩 중">
      <Skeleton className="aspect-square w-full" rounded="lg" />
      <Skeleton className="h-5 w-[70%] mt-2" />
      <Skeleton className="h-4 w-[50%]" />
      <Skeleton className="h-7 w-[30%] mt-1" />
      <Skeleton className="h-11 w-full mt-3" rounded="lg" />
    </div>
  )
}

/**
 * 주문 내역 / 리뷰 목록 / 알림 등 **리스트 row** 한 줄.
 * thumb(sq 48) + 두 줄 텍스트 + 우측 meta.
 */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="w-12 h-12 shrink-0" rounded="md" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-[65%]" />
        <Skeleton className="h-3 w-[40%]" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  )
}

/**
 * 리스트 페이지 — row × N + 상단 title.
 */
export function ListPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="px-4" role="status" aria-label="목록 로딩 중">
      <Skeleton className="h-5 w-[40%] my-4" />
      <div className="divide-y divide-rule-2">
        {Array.from({ length: rows }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

/**
 * 블로그 아티클 스켈레톤 — cover + title + 4 paragraph lines.
 */
export function ArticleSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="아티클 로딩 중">
      <Skeleton className="aspect-[16/9] w-full" rounded="lg" />
      <Skeleton className="h-5 w-[75%] mt-2" />
      <Skeleton className="h-3 w-[30%]" />
      <div className="flex flex-col gap-2 mt-4">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-[95%]" />
        <Skeleton className="h-3.5 w-[98%]" />
        <Skeleton className="h-3.5 w-[60%]" />
      </div>
    </div>
  )
}

/**
 * 한 줄짜리 간단한 loading placeholder — fallback 안에서 N개 쌓는 용도.
 * ex) <Suspense fallback={<TextLineSkeleton lines={3} />}>
 */
export function TextLineSkeleton({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          // 마지막 줄은 짧게 — 자연스러운 "문단 끝".
          className={cn('h-3.5', i === lines - 1 ? 'w-[55%]' : 'w-full')}
        />
      ))}
    </div>
  )
}
