'use client'

/**
 * 스토어(웹 시안 Store) — 탭 [레시피 4종 | 체험팩].
 *  레시피: 피하고 싶은 고기 고르기(그 카드는 흐리게 + 이유) · 2열 카드 · 한눈에 비교 표 · 앱 정기배송 한 줄.
 *  체험팩: 4종 100g씩 · 따로 사는 것보다 얼마 아끼나 · 먹여 보는 순서 · 담기.
 * 숫자는 전부 상품표(lib/store/catalog)·급여 계산(lib/store/feeding)에서.
 */
import { useState } from 'react'
import Link from 'next/link'
import RecipeGrid, { QtyStepper } from './RecipeGrid'
import { useStoreCart } from './useStoreCart'
import {
  RECIPE_BAND,
  RECIPE_NAME,
  RECIPE_STUDIO_IMG,
  STORE_RECIPES,
  TRIAL_ITEM,
  fullIngredients,
  kcalPer100g,
  storeItem,
  type StoreRecipe,
} from '@/lib/store/catalog'
import { RECIPE_INGREDIENTS } from '@/lib/recipe-ingredients'
import { SKU_MODEL } from '@/lib/personalization/skuModel'
import { feedingSummary } from '@/lib/store/feeding'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'

const won = (n: number) => n.toLocaleString('ko-KR')
const AVOID_LABEL: Record<StoreRecipe, string> = { chicken: '닭', duck: '오리', pork: '돼지', beef: '소' }
const AVOID_REASON: Record<StoreRecipe, string> = {
  chicken: '닭고기가 주재료예요',
  duck: '오리고기가 주재료예요',
  pork: '돼지고기가 주재료예요',
  beef: '소고기가 주재료예요',
}
const MEAT_PREFIX = /^(닭|오리|흑돼지|한우)\s*/

function ingOf(r: StoreRecipe) {
  return RECIPE_INGREDIENTS[SKU_MODEL[r].legacyLine]!
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function AppLine() {
  return (
    <Link
      href="/app"
      style={{ minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, color: '#141414', textDecoration: 'none' }}
    >
      <span>
        매일 먹인다면 <strong style={{ fontWeight: 800, color: '#1D3B2F' }}>앱 정기배송 {SUBSCRIPTION_DISCOUNT_PCT}% 할인</strong>
      </span>
      <Chevron />
    </Link>
  )
}

function CompareTable() {
  const rows: { label: React.ReactNode; cells: (r: StoreRecipe) => React.ReactNode; className?: string }[] = [
    { label: '주재료', cells: (r) => ingOf(r).main.replace(MEAT_PREFIX, '') },
    { label: '채소', cells: (r) => ingOf(r).toppings[0] },
    { label: '100g', cells: (r) => `${kcalPer100g(r)}kcal` },
    { label: '500g', cells: (r) => won(storeItem(`${r}-500g`).price), className: 'n' },
    {
      label: (
        <>
          5kg
          <br />
          곁들임
        </>
      ),
      cells: (r) => `약 ${feedingSummary(5, r, 'light', 500).days}일`,
      className: 'd',
    },
  ]
  return (
    <section aria-labelledby="compare-title" style={{ padding: '56px 20px 0' }}>
      <h2 id="compare-title" className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.12 }}>
        한눈에 비교
      </h2>
      <p style={{ margin: '8px 0 0', fontSize: 16, color: '#595959' }}>열량이 높을수록 같은 500g이 조금 더 오래가요</p>
      <table style={{ marginTop: 16, width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', borderTop: '2px solid #141414', borderBottom: '2px solid #141414' }}>
        <thead>
          <tr>
            <th scope="col" style={{ width: 64 }} />
            {STORE_RECIPES.map((r) => (
              <th key={r} scope="col" className="d" style={{ padding: '12px 2px 10px', fontSize: 16, fontWeight: 400, textAlign: 'center' }}>
                <span aria-hidden style={{ display: 'block', height: 4, margin: '0 6px 8px', background: RECIPE_BAND[r] }} />
                {AVOID_LABEL[r] === '돼지' ? '흑돼지' : AVOID_LABEL[r] === '소' ? '한우' : AVOID_LABEL[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid #E5E5E5' }}>
              <th scope="row" style={{ padding: '12px 0', fontSize: 14, fontWeight: 600, color: '#595959', textAlign: 'left', lineHeight: 1.3 }}>
                {row.label}
              </th>
              {STORE_RECIPES.map((r) => (
                <td key={r} className={row.className} style={{ padding: '12px 2px', fontSize: row.className ? 16 : 15, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {row.cells(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <span style={{ display: 'block', marginTop: 10, fontSize: 13, color: '#595959' }}>중성화한 성견·보통 활동량, 건사료에 곁들여 줄 때 기준</span>
    </section>
  )
}

function TrialPanel() {
  const cart = useStoreCart()
  const qty = cart.qtyOf(TRIAL_ITEM.id)
  const saving = TRIAL_ITEM.listPrice - TRIAL_ITEM.price
  const DAY = ['첫날', '둘째 날', '셋째 날', '넷째 날']
  return (
    <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: '#3D3D3D' }}>네 가지 맛을 100g씩, 우리 아이가 직접 골라요.</p>
      <div style={{ marginTop: 16, position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, borderRadius: 4, overflow: 'hidden' }}>
        {STORE_RECIPES.map((r) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={r} src={RECIPE_STUDIO_IMG[r]} alt={`${RECIPE_NAME[r]} 화식`} width={400} height={400} loading="lazy" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', background: '#F6F4F5' }} />
        ))}
        <span style={{ position: 'absolute', left: 10, top: 10, background: '#141414', color: '#FFFFFF', borderRadius: 2, padding: '5px 9px', fontSize: 13, fontWeight: 800 }}>자사몰에서만 팔아요</span>
      </div>
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
          <span className="n" style={{ fontSize: 40 }}>
            {won(TRIAL_ITEM.price)}
          </span>
          <span className="d" style={{ fontSize: 20 }}>
            원
          </span>
        </span>
        <span style={{ fontSize: 17, color: '#9A9A9A', textDecoration: 'line-through' }}>{won(TRIAL_ITEM.listPrice)}원</span>
      </div>
      <span style={{ marginTop: 4, fontSize: 16, fontWeight: 800, color: '#C63D2A' }}>따로 사는 것보다 {won(saving)}원 아껴요</span>
      <span style={{ marginTop: 2, fontSize: 15, color: '#595959' }}>
        100g 팩 {TRIAL_ITEM.packs}개 · 100g당 {won(Math.round(TRIAL_ITEM.price / TRIAL_ITEM.packs))}원
      </span>
      <div style={{ marginTop: 18 }}>
        {qty === 0 ? (
          <button
            type="button"
            onClick={() => cart.add(TRIAL_ITEM.id)}
            style={{ width: '100%', height: 56, borderRadius: 4, border: 0, background: '#141414', color: '#FFFFFF', fontSize: 18, fontWeight: 800, cursor: 'pointer' }}
          >
            체험팩 담기
          </button>
        ) : (
          <QtyStepper qty={qty} label="체험팩 담은 수량" onMinus={() => cart.set(TRIAL_ITEM.id, qty - 1)} onPlus={() => cart.set(TRIAL_ITEM.id, qty + 1)} />
        )}
      </div>

      <div style={{ marginTop: 32, padding: '22px 18px', background: '#F6F4F5', borderRadius: 4 }}>
        <h2 className="d" style={{ margin: 0, fontSize: 24 }}>
          이렇게 먹여 보세요
        </h2>
        <ol style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          {STORE_RECIPES.map((r, i) => (
            <li key={r} style={{ background: '#FFFFFF', borderRadius: 4, borderTop: `4px solid ${RECIPE_BAND[r]}`, padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13, color: '#595959' }}>{DAY[i]}</span>
              <span className="d" style={{ fontSize: 18 }}>
                {AVOID_LABEL[r] === '돼지' ? '흑돼지' : AVOID_LABEL[r] === '소' ? '한우' : AVOID_LABEL[r]}
              </span>
            </li>
          ))}
        </ol>
        <p style={{ margin: '14px 0 0', fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>가장 잘 먹은 날의 고기로 500g을 고르세요.</p>
      </div>
      <details style={{ marginTop: 16, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5' }}>
        <summary style={{ minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 17, fontWeight: 700 }}>
          4종 원재료 전체
          <span aria-hidden className="fts-acc-plus" style={{ fontSize: 24, fontWeight: 300 }}>
            +
          </span>
          <span aria-hidden className="fts-acc-minus" style={{ fontSize: 24, fontWeight: 300 }}>
            −
          </span>
        </summary>
        <div style={{ paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STORE_RECIPES.map((r) => (
            <p key={r} style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>
              <strong style={{ color: '#141414' }}>{RECIPE_NAME[r]}</strong> {fullIngredients(r).join(', ')}
            </p>
          ))}
        </div>
      </details>
    </div>
  )
}

export default function StoreBrowse({ initialTab = 'recipes' }: { initialTab?: 'recipes' | 'trial' }) {
  const [tab, setTab] = useState<'recipes' | 'trial'>(initialTab)
  const [avoid, setAvoid] = useState<Partial<Record<StoreRecipe, boolean>>>({})
  const tabs: { id: 'recipes' | 'trial'; label: string }[] = [
    { id: 'recipes', label: '레시피 4종' },
    { id: 'trial', label: '체험팩' },
  ]
  const shown = STORE_RECIPES.filter((r) => !avoid[r])
  const hidden = STORE_RECIPES.filter((r) => avoid[r])

  return (
    <>
      <div role="tablist" aria-label="상품 종류" style={{ padding: '16px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        {tabs.map((t) => {
          const on = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className="d"
              style={{ height: 52, borderRadius: 4, border: '1.5px solid #141414', background: on ? '#141414' : '#FFFFFF', color: on ? '#FFFFFF' : '#141414', fontSize: 19, cursor: 'pointer' }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'recipes' ? (
        <>
          <div style={{ padding: '20px 20px 0' }}>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: '#3D3D3D' }}>
              모두 100g 팩 5개, 500g 한 봉이에요.
              <br />
              1kg은 상품 페이지에서 골라요.
            </p>
            <span id="avoid-label" style={{ display: 'block', marginTop: 18, fontSize: 17, fontWeight: 800 }}>
              피하고 싶은 고기가 있나요?
            </span>
            <div role="group" aria-labelledby="avoid-label" style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {STORE_RECIPES.map((r) => {
                const on = !!avoid[r]
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAvoid((a) => ({ ...a, [r]: !a[r] }))}
                    style={{ height: 48, borderRadius: 4, border: on ? '1.5px solid #141414' : '1px solid #BDBDBD', background: on ? '#141414' : '#FFFFFF', color: on ? '#FFFFFF' : '#141414', fontSize: 16, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {on ? `${AVOID_LABEL[r]} 빼기` : AVOID_LABEL[r]}
                  </button>
                )
              })}
            </div>
            <span style={{ display: 'block', marginTop: 8, fontSize: 14, color: '#595959' }}>알레르기가 있다면 상품마다 원재료 전체를 꼭 확인해 주세요.</span>
          </div>

          <div style={{ padding: '22px 20px 0' }}>
            {shown.length > 0 ? (
              <RecipeGrid recipes={shown} showDetail />
            ) : (
              <p style={{ margin: 0, padding: '28px 16px', background: '#F6F4F5', borderRadius: 4, fontSize: 16, lineHeight: 1.6 }}>
                네 가지 고기를 모두 뺐어요. 고기를 하나 이상 남겨 주세요.
              </p>
            )}
            {hidden.length > 0 && (
              <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {hidden.map((r) => (
                  <li key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: '#595959' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={RECIPE_STUDIO_IMG[r]} alt="" width={36} height={36} style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', opacity: 0.35 }} />
                    <span>
                      <strong style={{ color: '#141414' }}>{RECIPE_NAME[r]}</strong> 뺐어요 · {AVOID_REASON[r]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <CompareTable />
          <div style={{ padding: '28px 20px 64px' }}>
            <AppLine />
          </div>
        </>
      ) : (
        <>
          <TrialPanel />
          <div style={{ padding: '28px 20px 64px' }}>
            <AppLine />
          </div>
        </>
      )}
    </>
  )
}
