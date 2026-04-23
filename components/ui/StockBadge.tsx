/**
 * Farmer's Tail — StockBadge.
 *
 * PLP/PDP/Cart 어디서든 재고 상태를 시각적으로 알리는 작은 뱃지.
 * - 'out'  : Ink 톤 — "품절". bg는 반투명 오버레이 또는 카드 자체 위에.
 * - 'low'  : Sale 톤 — "재고 소량" 또는 "N개 남음". 절박감 약간, 광고 X.
 * - 'in_stock': null 반환 (뱃지 자체를 그리지 않음).
 *
 * 두 가지 배치 스타일:
 *   - `overlay` : 이미지 위에 겹치는 pill (PLP 카드, PDP hero).
 *   - `inline`  : 텍스트 흐름 안에 붙는 작은 라벨 (PDP info 섹션, cart row).
 */
import { cn } from '@/lib/ui/cn'
import { stockState, stockMessage, type StockState } from '@/lib/products/stock'

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
        placement === 'inline' ? 'inline-flex' : 'absolute',
        'items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight',
        placement === 'overlay' && 'top-3 left-3',
        stateClass(state),
        className
      )}
      aria-label={state === 'out' ? '품절 상품' : `재고 소량 상품 (${label})`}
    >
      {label}
    </span>
  )
}

function stateClass(state: StockState): string {
  switch (state) {
    case 'out':
      // Ink: 고요하지만 명확. overlay 시 사진 위에서도 가독성 충분.
      return 'bg-ink text-bg'
    case 'low':
      return 'bg-sale text-bg'
    default:
      return ''
  }
}

/**
 * 이미지 전체를 덮어 "품절" 을 크게 보이게 하는 overlay. PLP에서 품절 카드에
 * 씌워서 사용자가 눌러보기 전에 상태를 인지하게 한다.
 *
 *   <div className="relative">
 *     <img src=... />
 *     <StockOverlay stock={product.stock} />
 *   </div>
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
      <span className="text-bg text-[13px] font-black tracking-wider px-3 py-1 rounded-full bg-ink/70">
        SOLD OUT · 품절
      </span>
    </div>
  )
}
