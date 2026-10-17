'use client'

/**
 * 레시피 4종 목록(홈·스토어) — 한 줄에 한 레시피: 왼쪽 실제 사진(팩 + 한 그릇) · 오른쪽 이름 · 고기 부위 · 500g 가격 · [담기].
 * 2026-10-17 사장님: 이름은 '치킨 레시피' 바로 옆에 작게 '닭고기 화식'(RecipeName) — 2열 카드 폭(170px)엔 두 이름이 나란히
 * 들어가지 않아 한 줄 목록으로 바꿨다. 사진 위 레시피 색 띠는 뺐다("색 들어가는 데마다 위에 띠 — AI 티").
 * 담으면 버튼이 '− N개 담김 +' 로 바뀐다(500g 기준). 다른 용량(1kg)은 상품 페이지에서.
 * showDetail: 스토어 화면처럼 토핑·100g 값·kcal 줄까지 보일 때.
 * paused: 자사몰 결제 막음(storeSalesPaused) — 담기를 회색으로, 위에 스마트스토어 안내(규칙177).
 */
import Link from 'next/link'
import { useStoreCart } from './useStoreCart'
import { PAUSED_BTN, PayPausedNotice } from './PayPaused'
import RecipeName from './RecipeName'
import {
  RECIPE_REAL_IMG,
  RECIPE_TITLE,
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

export default function RecipeGrid({
  recipes = STORE_RECIPES,
  showDetail = false,
  paused,
}: {
  recipes?: readonly StoreRecipe[]
  showDetail?: boolean
  paused: boolean
}) {
  const cart = useStoreCart()
  return (
    <>
      {paused && (
        <div style={{ marginBottom: 20 }}>
          <PayPausedNotice />
        </div>
      )}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: '2px solid #141414' }}>
        {recipes.map((r) => {
          const item = storeItem(`${r}-500g`)
          const qty = cart.qtyOf(item.id)
          return (
            <li key={r} style={{ padding: '16px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '128px minmax(0, 1fr)', columnGap: 14, alignItems: 'stretch' }}>
              <Link
                href={`/store/${r}`}
                aria-label={`${RECIPE_TITLE[r]} 자세히 보기`}
                style={{ display: 'block', minHeight: 128, borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={RECIPE_REAL_IMG[r]} alt="" width={384} height={256} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '62% 50%', display: 'block' }} />
              </Link>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Link href={`/store/${r}`} style={{ color: '#141414', textDecoration: 'none' }}>
                  <RecipeName recipe={r} size={22} />
                </Link>
                <span style={{ marginTop: 6, fontSize: 15, lineHeight: 1.45, color: '#595959' }}>
                  {showDetail ? `${meatLine(r)}에 ${toppingLine(r)}` : meatLine(r)}
                </span>
                {showDetail && (
                  <span style={{ marginTop: 2, fontSize: 14, color: '#595959' }}>
                    100g당 {won(per100gPrice(r))}원 · {kcalPer100g(r)}kcal
                  </span>
                )}
                <span style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span className="n" style={{ fontSize: 24 }}>
                      {won(item.price)}
                    </span>
                    <span className="d" style={{ fontSize: 16 }}>
                      원
                    </span>
                  </span>
                  <span style={{ fontSize: 14, color: '#595959' }}>500g</span>
                </span>
                <div style={{ marginTop: 10 }}>
                  {paused ? (
                    <button type="button" disabled style={{ width: '100%', height: 48, borderRadius: 4, fontSize: 17, fontWeight: 700, ...PAUSED_BTN }}>
                      담기
                    </button>
                  ) : qty === 0 ? (
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
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
