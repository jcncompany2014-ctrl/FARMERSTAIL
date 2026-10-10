'use client'

/**
 * 레시피 4종 2열 카드(웹 시안 Main·Store) — 팩 사진(위 6px 레시피 띠) · 이름 · 고기 부위 · 500g 가격 · [담기].
 * 담으면 버튼이 '− N개 담김 +' 로 바뀐다(500g 기준). 다른 용량(1kg)은 상품 페이지에서.
 * showDetail: 스토어 화면처럼 토핑·100g 값·kcal 줄까지 보일 때.
 */
import Link from 'next/link'
import { useStoreCart } from './useStoreCart'
import {
  RECIPE_BAND,
  RECIPE_NAME,
  RECIPE_STUDIO_IMG,
  STORE_RECIPES,
  kcalPer100g,
  meatLine,
  per100gPrice,
  storeItem,
  toppingLine,
  type StoreRecipe,
} from '@/lib/store/catalog'

const won = (n: number) => n.toLocaleString('ko-KR')

export function QtyStepper({ qty, onMinus, onPlus, label }: { qty: number; onMinus: () => void; onPlus: () => void; label: string }) {
  const btn = (aria: string, onClick: () => void, d: string) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      style={{ height: 48, border: 0, background: 'transparent', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
        <path d={d} />
      </svg>
    </button>
  )
  return (
    <div
      role="group"
      aria-label={label}
      style={{ height: 48, boxSizing: 'border-box', borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'grid', gridTemplateColumns: '48px 1fr 48px', alignItems: 'center' }}
    >
      {btn('하나 빼기', onMinus, 'M5 12h14')}
      <span aria-live="polite" style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap' }}>
        {qty}개 담김
      </span>
      {btn('하나 더하기', onPlus, 'M12 5v14M5 12h14')}
    </div>
  )
}

export default function RecipeGrid({ recipes = STORE_RECIPES, showDetail = false }: { recipes?: readonly StoreRecipe[]; showDetail?: boolean }) {
  const cart = useStoreCart()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 10, rowGap: 28 }}>
      {recipes.map((r) => {
        const item = storeItem(`${r}-500g`)
        const qty = cart.qtyOf(item.id)
        return (
          <article key={r} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Link
              href={`/store/${r}`}
              aria-label={`${RECIPE_NAME[r]} 화식 자세히 보기`}
              style={{ position: 'relative', display: 'block', aspectRatio: '1 / 1', borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={RECIPE_STUDIO_IMG[r]} alt="" width={400} height={400} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 6, background: RECIPE_BAND[r] }} />
            </Link>
            <Link href={`/store/${r}`} className="d" style={{ marginTop: 12, fontSize: 23, lineHeight: 1.1, color: '#141414', textDecoration: 'none' }}>
              {RECIPE_NAME[r]}
            </Link>
            <span style={{ marginTop: 4, fontSize: 15, lineHeight: 1.45, color: '#595959' }}>
              {showDetail ? `${meatLine(r)}에 ${toppingLine(r)}` : meatLine(r)}
            </span>
            {showDetail && (
              <span style={{ marginTop: 2, fontSize: 14, color: '#595959' }}>
                100g당 {won(per100gPrice(r))}원 · {kcalPer100g(r)}kcal
              </span>
            )}
            <span style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
              <span className="n" style={{ fontSize: 24 }}>
                {won(item.price)}
              </span>
              <span className="d" style={{ fontSize: 16 }}>
                원
              </span>
            </span>
            <div style={{ marginTop: 10 }}>
              {qty === 0 ? (
                <button
                  type="button"
                  onClick={() => cart.add(item.id)}
                  aria-label={`${item.name} 담기`}
                  style={{ width: '100%', height: 48, borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', color: '#141414', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}
                >
                  담기
                </button>
              ) : (
                <QtyStepper
                  qty={qty}
                  label={`${item.name} 담은 수량`}
                  onMinus={() => cart.set(item.id, qty - 1)}
                  onPlus={() => cart.set(item.id, qty + 1)}
                />
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
