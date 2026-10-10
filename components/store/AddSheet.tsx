'use client'

/**
 * "닭고기 화식, 얼마나 담을까요?"(웹 시안 Sheet) — 아래에서 올라오는 창. 용량(500g·1kg) · 몇 개 · 합계(배송비 안내) ·
 * [장바구니 담기] [바로 구매]. 바로 구매는 장바구니를 건드리지 않고 이 상품만 주문서로 간다(/store/checkout?buy=…).
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QtyStepper } from './RecipeGrid'
import { useStoreCart } from './useStoreCart'
import { RECIPE_PRODUCT_NAME, STORE_SIZES, storeItem, type StoreRecipe, type StoreSize } from '@/lib/store/catalog'
import { shippingFeeFor, untilFreeShipping } from '@/lib/store/shipping'
import { MAX_QTY } from '@/lib/store/cart'

const won = (n: number) => n.toLocaleString('ko-KR')

export default function AddSheet({
  open,
  onClose,
  recipe,
  size,
  onSize,
  qty,
  onQty,
  daysFor,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  recipe: StoreRecipe
  size: StoreSize
  onSize: (s: StoreSize) => void
  qty: number
  onQty: (q: number) => void
  /** 이 용량이면 며칠분(계산기 몸무게 기준). */
  daysFor: (s: StoreSize) => number
  onAdded: () => void
}) {
  const router = useRouter()
  const cart = useStoreCart()
  const item = storeItem(`${recipe}-${size}`)
  const total = item.price * qty
  const fee = shippingFeeFor(total)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <button type="button" aria-label="닫기" onClick={onClose} style={{ position: 'absolute', inset: 0, border: 0, background: 'rgba(20,20,20,0.45)', cursor: 'pointer' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${RECIPE_PRODUCT_NAME[recipe]} 담기`}
        className="fts-col"
        style={{ position: 'relative', width: '100%', boxSizing: 'border-box', background: '#FFFFFF', borderRadius: '12px 12px 0 0', padding: '20px 16px calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="d" style={{ margin: 0, fontSize: 21 }}>
            {RECIPE_PRODUCT_NAME[recipe]}, 얼마나 담을까요?
          </h2>
          <button type="button" onClick={onClose} style={{ height: 44, border: 0, background: 'transparent', fontSize: 16, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', color: '#141414' }}>
            닫기
          </button>
        </div>
        <div role="radiogroup" aria-label="용량" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STORE_SIZES.map((s) => {
            const it = storeItem(`${recipe}-${s}`)
            const on = s === size
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onSize(s)}
                style={{ minHeight: 64, borderRadius: 4, border: on ? '2px solid #141414' : '1px solid #BDBDBD', background: '#FFFFFF', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', color: '#141414' }}
              >
                <span aria-hidden style={{ width: 22, height: 22, borderRadius: 11, border: '2px solid #141414', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {on && <span style={{ width: 10, height: 10, borderRadius: 5, background: '#141414' }} />}
                </span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span>
                    <span className="d" style={{ fontSize: 20 }}>
                      {s}
                    </span>{' '}
                    <span style={{ fontSize: 14, color: '#595959' }}>100g 팩 {it.packs}개</span>
                  </span>
                  <span style={{ fontSize: 14, color: s === '1kg' ? '#C63D2A' : '#595959', fontWeight: s === '1kg' ? 700 : 400 }}>
                    약 {daysFor(s)}일분{s === '1kg' ? ` · ${Math.round((1 - it.price / it.listPrice) * 100)}% 할인` : ''}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 1, whiteSpace: 'nowrap' }}>
                  <span className="n" style={{ fontSize: 22 }}>
                    {won(it.price)}
                  </span>
                  <span className="d" style={{ fontSize: 14 }}>
                    원
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <span style={{ fontSize: 13, color: '#595959' }}>며칠분은 위 계산기의 몸무게·주는 방법 기준이에요</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid #E5E5E5', paddingTop: 14 }}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>몇 개</span>
          <div style={{ width: 168 }}>
            <QtyStepper qty={qty} label="몇 개" onMinus={() => onQty(Math.max(1, qty - 1))} onPlus={() => onQty(Math.min(MAX_QTY, qty + 1))} />
          </div>
        </div>
        <div style={{ borderTop: '2px solid #141414', paddingTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>합계</span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
              <span className="n" style={{ fontSize: 30 }}>
                {won(total)}
              </span>
              <span className="d" style={{ fontSize: 17 }}>
                원
              </span>
            </span>
          </div>
          <span style={{ fontSize: 14, color: '#595959' }}>
            {fee > 0 ? `배송비 ${won(fee)}원 · ${won(untilFreeShipping(total))}원 더 담으면 무료` : '배송비 무료'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              cart.add(item.id, qty)
              onClose()
              onAdded()
            }}
            style={{ height: 56, borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', color: '#141414', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}
          >
            장바구니 담기
          </button>
          <button
            type="button"
            onClick={() => router.push(`/store/checkout?buy=${item.id}&qty=${qty}`)}
            style={{ height: 56, borderRadius: 4, border: 0, background: '#141414', color: '#FFFFFF', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}
          >
            바로 구매
          </button>
        </div>
      </div>
    </div>
  )
}
