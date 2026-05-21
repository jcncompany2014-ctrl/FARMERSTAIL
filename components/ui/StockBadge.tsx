/**
 * Farmer's Tail — StockBadge.
 *
 * 2026-05-21 변경 — 사용자 요청으로 박스/pill 스타일 제거.
 * 모든 재고 표시는 **빨간 글씨 plain text**. 광고/뱃지 톤 X.
 *
 *   - 'out'     : "품절"          — text-sale font-bold
 *   - 'low'     : "재고 N개 남음" — text-sale font-bold
 *   - 'in_stock': null (렌더 X)
 *
 * 두 가지 배치 스타일 유지 (위치만 결정, 시각은 동일):
 *   - `overlay` : absolute 위치 (PLP 카드 hero overlay와 함께 쓸 때만 의미).
 *   - `inline`  : 흐름에 자연스럽게 (기본).
 */
import { cn } from '@/lib/ui/cn'
import { stockState, stockMessage } from '@/lib/products/stock'

export interface StockBadgeProps {
  /** 원시 재고 수치. 내부에서 stockState()로 분류. */
  stock: number | null | undefined
  /** 표시 위치 타입. 기본 'inline'. */
  placement?: 'inline' | 'overlay'
  /** low 상태에서 구체 수량까지 보여줄지 (기본 true). false면 "재고 소량". */
  showCount?: boolean
  className?: string
}

export function StockBadge({
  stock,
  placement = 'inline',
  showCount = true,
  className,
}: StockBadgeProps) {
  const state = stockState(stock)
  if (state === 'in_stock') return null

  const label =
    state === 'out'
      ? '품절'
      : showCount && typeof stock === 'number'
        ? stockMessage(stock) // "재고 N개 남음"
        : '재고 소량'

  return (
    <span
      className={cn(
        // 박스/pill 제거 — 빨간 글씨 plain.
        'text-[11px] font-bold tracking-tight text-sale',
        placement === 'inline' ? 'inline-flex items-center' : 'absolute top-3 left-3',
        className
      )}
      aria-label={state === 'out' ? '품절 상품' : `재고 소량 상품 (${label})`}
    >
      {label}
    </span>
  )
}

/**
 * 이미지 전체를 덮어 "품절" 을 크게 보이게 하는 overlay. PLP에서 품절 카드에
 * 씌워서 사용자가 눌러보기 전에 상태를 인지하게 한다.
 *
 * 2026-05-21: 내부 라벨도 plain 빨간 글씨 — 검정 pill 제거. 다만 어두운
 * 오버레이 위에서는 빨간글씨 가독성을 위해 약간의 그림자만.
 */
export function StockOverlay({
  stock,
  className,
}: {
  stock: number | null | undefined
  className?: string
}) {
  if (stockState(stock) !== 'out') return null
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center',
        'bg-ink/45 backdrop-blur-[1px]',
        'pointer-events-none',
        className
      )}
      aria-hidden
    >
      <span
        className="text-[13px] font-black tracking-wider text-sale"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
      >
        품절
      </span>
    </div>
  )
}
