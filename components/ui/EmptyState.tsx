/**
 * Farmer's Tail — EmptyState 컴포넌트.
 *
 * 컬렉션(장바구니, 위시리스트, 리뷰, 알림, 주문목록, 반려견 목록 등)이 비어
 * 있을 때 공통으로 쓰는 빈 상태 카드. 디자인 목표:
 *
 *   1) "에러처럼 보이지 않기" — 처음 쓰는 사용자에게 이 상태가 기본이고
 *      걱정할 일이 없음을 전달.
 *   2) "다음 행동 안내" — 빈 상태는 CTA를 제공할 최고의 자리.
 *   3) "브랜드 보이스" — 메시지는 아주 짧지만 파머스테일 톤(따뜻, 농담 X).
 *
 * # 사용법
 *
 *   <EmptyState
 *     kind="cart"
 *     title="장바구니가 비어 있어요"
 *     description="마음에 드는 제품을 담아보세요."
 *     action={{ label: '둘러보기', href: '/products' }}
 *   />
 *
 *   // 커스텀 SVG/이모지 illustration:
 *   <EmptyState
 *     illustration={<MyDogSVG />}
 *     title="등록된 반려견이 없어요"
 *     action={{ label: '강아지 등록하기', href: '/dogs/new' }}
 *   />
 *
 * # Variants
 *
 * `kind` prop으로 흔한 케이스는 기본 illustration + 톤이 자동 선택됨:
 *   - 'cart', 'wishlist', 'orders', 'reviews', 'notifications',
 *     'dogs', 'search', 'coupons', 'points', 'generic' (기본)
 *
 * illustration을 직접 prop으로 주면 kind가 제공하는 기본 아이콘을 덮어씀.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/ui/cn'
import { Button } from './Button'

// ──────────────────────────────────────────────────────────────────────────
// Illustrations — SVG/이모지 기반, 가볍고 브랜드 톤에 맞춤.
// 이모지는 플랫폼별 렌더링이 달라 일부는 SVG로 제공. 당장은 이모지로 시작하고
// 아트팀이 정식 아이콘 세트를 주면 교체.
// ──────────────────────────────────────────────────────────────────────────

type EmptyKind =
  | 'cart'
  | 'wishlist'
  | 'orders'
  | 'reviews'
  | 'notifications'
  | 'dogs'
  | 'search'
  | 'coupons'
  | 'points'
  | 'generic'

const defaults: Record<EmptyKind, { icon: string; label: string }> = {
  cart: { icon: '🛒', label: '빈 장바구니' },
  wishlist: { icon: '🤎', label: '빈 위시리스트' },
  orders: { icon: '📦', label: '주문 내역 없음' },
  reviews: { icon: '📝', label: '리뷰 없음' },
  notifications: { icon: '🔔', label: '알림 없음' },
  dogs: { icon: '🐕', label: '등록된 반려견 없음' },
  search: { icon: '🔍', label: '검색 결과 없음' },
  coupons: { icon: '🎟️', label: '쿠폰 없음' },
  points: { icon: '✨', label: '포인트 없음' },
  generic: { icon: '🍂', label: '아직 없음' },
}

function DefaultIllustration({ kind }: { kind: EmptyKind }) {
  const d = defaults[kind]
  return (
    <div
      role="img"
      aria-label={d.label}
      className={cn(
        'w-20 h-20 rounded-full bg-bg-2 ring-1 ring-rule-2',
        'flex items-center justify-center text-3xl',
        'mx-auto mb-4'
      )}
    >
      <span aria-hidden>{d.icon}</span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────────────────────────────────

export type EmptyStateAction =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never }

export interface EmptyStateProps {
  kind?: EmptyKind
  title: string
  description?: string
  /** 직접 렌더할 illustration. 지정하면 kind 기본 아이콘 덮어씀. */
  illustration?: ReactNode
  /** CTA 버튼. href 또는 onClick 중 하나만. */
  action?: EmptyStateAction
  /** 보조 링크 (ghost 스타일). action 옆에 작게. */
  secondaryAction?: EmptyStateAction
  /** 컴포넌트 래퍼 className — 호출처에서 여백/배경 조정. */
  className?: string
  /**
   * compact=true면 리스트 중간 inline 공간용 작은 버전.
   * 기본은 전체 뷰포트급(py-16) 크기.
   */
  compact?: boolean
}

export function EmptyState({
  kind = 'generic',
  title,
  description,
  illustration,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'w-full text-center',
        compact ? 'py-10 px-6' : 'py-16 px-6',
        className
      )}
    >
      {illustration ?? <DefaultIllustration kind={kind} />}
      <h2
        className={cn(
          'font-bold text-text',
          compact ? 'text-[14px]' : 'text-[16px]'
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            'text-muted mt-1.5 break-keep max-w-[320px] mx-auto',
            compact ? 'text-[12px]' : 'text-[13px]'
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className={cn('flex items-center justify-center gap-2', compact ? 'mt-4' : 'mt-6')}>
          {action && <EmptyAction action={action} variant="primary" />}
          {secondaryAction && (
            <EmptyAction action={secondaryAction} variant="ghost" />
          )}
        </div>
      )}
    </div>
  )
}

function EmptyAction({
  action,
  variant,
}: {
  action: EmptyStateAction
  variant: 'primary' | 'ghost'
}) {
  if ('href' in action && action.href) {
    return (
      <Button asChild variant={variant} size="md">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    )
  }
  return (
    <Button
      variant={variant}
      size="md"
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Convenience presets — 흔한 케이스는 prop 없이 바로 쓸 수 있게.
// 호출처에서 reasoning 없이 "쓰면 맞는" 디폴트 카피.
// ──────────────────────────────────────────────────────────────────────────

export const CartEmpty = () => (
  <EmptyState
    kind="cart"
    title="장바구니가 비어 있어요"
    description="오늘의 한 끼를 담아보세요."
    action={{ label: '제품 둘러보기', href: '/products' }}
  />
)

export const WishlistEmpty = () => (
  <EmptyState
    kind="wishlist"
    title="위시리스트가 비어 있어요"
    description="하트를 누르면 여기에 모여요."
    action={{ label: '제품 둘러보기', href: '/products' }}
  />
)

export const OrdersEmpty = () => (
  <EmptyState
    kind="orders"
    title="아직 주문 내역이 없어요"
    description="첫 주문을 기다리고 있어요."
    action={{ label: '제품 보러 가기', href: '/products' }}
  />
)

export const ReviewsEmpty = () => (
  <EmptyState
    kind="reviews"
    title="작성한 리뷰가 없어요"
    description="구매한 제품의 후기를 남겨주세요."
  />
)

export const NotificationsEmpty = () => (
  <EmptyState
    kind="notifications"
    title="새 알림이 없어요"
    description="주문·배송 알림이 오면 여기에 표시됩니다."
  />
)

export const DogsEmpty = () => (
  <EmptyState
    kind="dogs"
    title="등록된 반려견이 없어요"
    description="아이 정보를 등록하고 맞춤 레시피를 추천받으세요."
    action={{ label: '반려견 등록', href: '/dogs/new' }}
  />
)

/**
 * 검색 결과 0건 전용. query를 설명으로 자동 포맷.
 */
export function SearchEmpty({ query }: { query?: string }) {
  return (
    <EmptyState
      kind="search"
      title={query ? `"${query}" 검색 결과가 없어요` : '검색 결과가 없어요'}
      description="다른 키워드로 다시 시도해 보세요."
      compact
    />
  )
}
