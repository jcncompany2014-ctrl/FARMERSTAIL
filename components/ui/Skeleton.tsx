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
 * PLP 페이지 전체 — 2열 그리드 × N.
 *
 * audit #54: 이전 grid-cols-2 sm:3 lg:4 → AppChrome phone-frame (max-w 440px)
 * 안에서 desktop viewport 일 때 4열 잠시 깜빡 후 globals.css override 로 2열
 * → CLS. data-skeleton="product-grid" 마크 + globals.css 의 phone-frame
 * selector 가 강제 2열.
 */
/** ProductGridSkeleton 내부 부품 — 밖에선 안 쓰여서 export 는 뗐다(2026-07-16). */
function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-square w-full" rounded="lg" />
      <Skeleton className="h-3.5 w-[80%]" />
      <Skeleton className="h-3.5 w-[55%]" />
      <Skeleton className="h-4 w-[40%] mt-1" />
    </div>
  )
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="제품 목록 로딩 중"
      data-skeleton="product-grid"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-5"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

// 2026-07-16: 죽은 파생 스켈레톤 5개 제거 — PdpHeroSkeleton / ListRowSkeleton /
// ListPageSkeleton / ArticleSkeleton / TextLineSkeleton. 상품 PDP·목록·아티클
// 페이지가 구독 전용 전환으로 사라지면서 소비처가 0이 됐다.
// 남은 건 Skeleton(14곳) + ProductGridSkeleton(홈 로딩) + 그 내부 부품.
