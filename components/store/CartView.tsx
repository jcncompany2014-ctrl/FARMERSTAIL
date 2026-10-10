'use client'

/**
 * 장바구니(웹 시안 Cart) — 냉동 출고일 줄 · 담은 상품(수량·빼기·되돌리기) · 무료배송까지 · "하나만 더하면 배송비가 빠져요" ·
 * 금액 · 앱 정기배송으로 받으면 얼마 덜 내나 · [○원 주문하기]. 비었으면 체험팩·레시피로.
 * 금액은 전부 cartSummary(상품표에서 다시 계산) — 주문 생성 서버도 같은 함수를 쓴다.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useStoreCart } from './useStoreCart'
import { useShipDate } from './useShipDate'
import {
  RECIPE_BAND,
  RECIPE_STUDIO_IMG,
  STORE_RECIPES,
  TRIAL_ITEM,
  storeItem,
  subscriptionSaving,
  type StoreItem,
  type StoreItemId,
} from '@/lib/store/catalog'
import { FREE_SHIPPING_MIN, SHIPPING_FEE } from '@/lib/store/shipping'
import { MAX_QTY } from '@/lib/store/cart'
import { eulReul } from '@/lib/korean'

const won = (n: number) => n.toLocaleString('ko-KR')

function Thumb({ item, size = 64 }: { item: StoreItem; size?: number }) {
  const src = item.recipe ? RECIPE_STUDIO_IMG[item.recipe] : RECIPE_STUDIO_IMG.chicken
  return (
    <span style={{ position: 'relative', width: size, height: size, borderRadius: 4, overflow: 'hidden', background: '#F6F4F5', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', display: 'block' }} />
      {item.recipe ? (
        <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: RECIPE_BAND[item.recipe] }} />
      ) : (
        <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {STORE_RECIPES.map((r) => (
            <span key={r} style={{ background: RECIPE_BAND[r] }} />
          ))}
        </span>
      )}
    </span>
  )
}

export default function CartView() {
  const router = useRouter()
  const cart = useStoreCart()
  const ship = useShipDate()
  const [undo, setUndo] = useState<{ id: StoreItemId; qty: number } | null>(null)
  const s = cart.summary

  if (s.lines.length === 0) {
    return (
      <div style={{ padding: '32px 20px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
        {undo && (
          <div role="status" style={{ alignSelf: 'stretch', marginBottom: 12, padding: '12px 14px', background: '#141414', color: '#FFFFFF', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 15 }}>
            <span>{eulReul(storeItem(undo.id).name)} 뺐어요</span>
            <button type="button" onClick={() => { cart.set(undo.id, undo.qty); setUndo(null) }} style={{ border: 0, background: 'transparent', color: '#FFFFFF', fontWeight: 800, textDecoration: 'underline', fontSize: 15, cursor: 'pointer' }}>
              되돌리기
            </button>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sheltie-snow-45.jpg" alt="" width={200} height={250} style={{ width: 160, height: 200, objectFit: 'cover', borderRadius: 4 }} />
        <strong className="d" style={{ marginTop: 10, fontSize: 26 }}>
          장바구니가 비어 있어요
        </strong>
        <span style={{ fontSize: 16, color: '#595959' }}>처음이라면 체험팩부터 골라 보세요</span>
        <div style={{ marginTop: 14, alignSelf: 'stretch', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Link href="/store?tab=trial" style={{ height: 56, borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, textDecoration: 'none' }}>
            4종 체험팩 보기
          </Link>
          <Link href="/store" style={{ height: 56, borderRadius: 4, border: '1.5px solid #141414', color: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, textDecoration: 'none' }}>
            레시피 골라 사기
          </Link>
        </div>
      </div>
    )
  }

  const packs = s.lines.reduce((n, l) => n + l.item.packs * l.qty, 0)
  const pct = Math.min(100, Math.round((s.subtotal / FREE_SHIPPING_MIN) * 100))
  // 하나만 더하면 무료배송이 되는 것 — 담겨 있지 않은 500g·체험팩 중 싼 순 둘. 더 내는 돈 = 값 − 아끼는 배송비.
  const suggests =
    s.untilFree > 0
      ? [...STORE_RECIPES.map((r) => storeItem(`${r}-500g`)), TRIAL_ITEM]
          .filter((it) => it.price >= s.untilFree && cart.qtyOf(it.id) === 0)
          .sort((a, b) => a.price - b.price)
          .slice(0, 2)
      : []
  const saving = s.lines.reduce((n, l) => n + subscriptionSaving(l.item) * l.qty, 0)

  return (
    <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <section aria-label="냉동 상품" style={{ border: '2px solid #141414', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>❄ 냉동 · {ship ? `${ship.label} 출고` : '화·목 출고'}</span>
          {ship && <span style={{ fontSize: 13, color: '#D9D9D9' }}>오늘 밤 12시까지</span>}
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {s.lines.map((l) => (
            <li key={l.item.id} style={{ padding: '14px 14px', borderBottom: '1px solid #E5E5E5', display: 'flex', gap: 12 }}>
              <Thumb item={l.item} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="d" style={{ fontSize: 18 }}>
                      {l.item.recipe ? l.item.name.replace(/\s(500g|1kg)$/, '') : l.item.name}
                    </span>
                    <span style={{ fontSize: 14, color: '#595959' }}>{l.item.recipe ? `${l.item.size} · 100g 팩 ${l.item.packs}개` : '4종 100g씩'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUndo({ id: l.item.id, qty: l.qty })
                      cart.remove(l.item.id)
                    }}
                    style={{ height: 32, border: 0, background: 'transparent', fontSize: 14, color: '#595959', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    빼기
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div role="group" aria-label={`${l.item.name} 수량`} style={{ height: 44, border: '1.5px solid #141414', borderRadius: 4, display: 'grid', gridTemplateColumns: '44px 40px 44px', alignItems: 'center' }}>
                    <button type="button" aria-label="하나 빼기" onClick={() => cart.set(l.item.id, Math.max(1, l.qty - 1))} disabled={l.qty <= 1} style={{ height: 42, border: 0, background: 'transparent', fontSize: 20, cursor: l.qty <= 1 ? 'default' : 'pointer', color: l.qty <= 1 ? '#BDBDBD' : '#141414' }}>
                      −
                    </button>
                    <span className="n" style={{ textAlign: 'center', fontSize: 18 }}>
                      {l.qty}
                    </span>
                    <button type="button" aria-label="하나 더하기" onClick={() => cart.set(l.item.id, Math.min(MAX_QTY, l.qty + 1))} disabled={l.qty >= MAX_QTY} style={{ height: 42, border: 0, background: 'transparent', fontSize: 20, cursor: 'pointer', color: l.qty >= MAX_QTY ? '#BDBDBD' : '#141414' }}>
                      +
                    </button>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
                    <span className="n" style={{ fontSize: 24 }}>
                      {won(l.lineTotal)}
                    </span>
                    <span className="d" style={{ fontSize: 15 }}>
                      원
                    </span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <p style={{ margin: 0, padding: '12px 14px', fontSize: 14, lineHeight: 1.55, color: '#3D3D3D' }}>
          모두 <strong>{packs}팩(100g씩)</strong>이에요. 냉동실 자리를 먼저 확인해 주세요.
        </p>
      </section>

      {undo && (
        <div role="status" style={{ padding: '12px 14px', background: '#141414', color: '#FFFFFF', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 15 }}>
          <span>{eulReul(storeItem(undo.id).name)} 뺐어요</span>
          <button type="button" onClick={() => { cart.set(undo.id, undo.qty); setUndo(null) }} style={{ border: 0, background: 'transparent', color: '#FFFFFF', fontWeight: 800, textDecoration: 'underline', fontSize: 15, cursor: 'pointer' }}>
            되돌리기
          </button>
        </div>
      )}

      <section aria-label="무료배송" style={{ padding: '16px 14px', background: '#F6F4F5', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <strong className="d" style={{ fontSize: 20 }}>
          {s.untilFree > 0 ? `무료배송까지 ${won(s.untilFree)}원` : '배송비가 무료예요'}
        </strong>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="무료배송까지 채운 정도" style={{ height: 8, background: '#E5E5E5', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#141414' }} />
        </div>
        <span style={{ fontSize: 14, color: '#595959' }}>{FREE_SHIPPING_MIN / 10_000}만 원 이상이면 배송비가 없어요</span>
        {suggests.length > 0 && (
          <>
            <span style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>하나만 더하면 배송비가 빠져요</span>
            {suggests.map((g) => (
              <div key={g.id} style={{ padding: 10, background: '#FFFFFF', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Thumb item={g} size={52} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span className="d" style={{ fontSize: 16 }}>
                    {g.recipe ? g.name.replace(/\s500g$/, '') : g.name}
                  </span>
                  <span style={{ fontSize: 13, color: '#595959' }}>{won(g.price)}원</span>
                  <span style={{ fontSize: 13, color: '#595959' }}>
                    더 내는 돈 <strong style={{ color: '#141414' }}>{won(g.price - SHIPPING_FEE)}원</strong>
                  </span>
                </span>
                <button type="button" onClick={() => cart.add(g.id)} style={{ height: 44, padding: '0 16px', borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', fontSize: 16, fontWeight: 800, cursor: 'pointer', color: '#141414' }}>
                  담기
                </button>
              </div>
            ))}
          </>
        )}
      </section>

      <section aria-label="결제 예정 금액">
        <dl style={{ margin: 0 }}>
          <div style={{ minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 16 }}>
            <dt style={{ color: '#595959' }}>상품 금액</dt>
            <dd style={{ margin: 0 }}>{won(s.subtotal)}원</dd>
          </div>
          <div style={{ minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 16 }}>
            <dt style={{ color: '#595959' }}>배송비</dt>
            <dd style={{ margin: 0 }}>{s.shippingFee > 0 ? `${won(s.shippingFee)}원` : '무료'}</dd>
          </div>
          <div style={{ marginTop: 6, paddingTop: 12, borderTop: '2px solid #141414', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <dt style={{ fontSize: 18, fontWeight: 800 }}>합계</dt>
            <dd style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span className="n" style={{ fontSize: 34 }}>
                {won(s.total)}
              </span>
              <span className="d" style={{ fontSize: 18 }}>
                원
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {saving > 0 && (
        <Link href="/app" style={{ minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 15, color: '#141414', textDecoration: 'none' }}>
          <span>
            같은 양을 앱 정기배송으로 받으면 <strong style={{ color: '#1D3B2F' }}>{won(saving)}원</strong> 덜 내요
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      )}

      <div style={{ position: 'sticky', bottom: 0, zIndex: 20, margin: '0 -16px', padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', background: '#FFFFFF', borderTop: '1px solid #E5E5E5' }}>
        <button
          type="button"
          onClick={() => router.push('/store/checkout')}
          style={{ width: '100%', height: 60, borderRadius: 4, border: 0, background: '#141414', color: '#FFFFFF', fontSize: 19, fontWeight: 800, cursor: 'pointer' }}
        >
          {won(s.total)}원 주문하기
        </button>
      </div>
    </div>
  )
}
