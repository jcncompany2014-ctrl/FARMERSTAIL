'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Loader2,
  ShoppingCart,
  Check,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { haptic } from '@/lib/haptic'
import { trackAddToCart } from '@/lib/analytics'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import './order.css'

/**
 * /dogs/[id]/order — 맞춤 박스 한 번에 cart 담기 페이지.
 *
 * # 흐름
 *  1. 강아지 + 최신 dog_formulas (cycle desc 1) fetch
 *  2. 5 라인 + 2 토퍼 → SKU 매핑 (slug 기준)
 *  3. 카드 그리드 + 가격 합계
 *  4. "다 담기" → upsert_cart_item RPC × 모든 SKU → /cart 이동
 *
 * # SKU 매핑 (현재 등록된 4 라인 + 2 토퍼; joint 미등록)
 */
const LINE_TO_SLUG: Record<FoodLine, string | null> = {
  basic: 'chicken-basic',
  weight: 'duck-weight',
  skin: 'salmon-skin',
  premium: 'beef-premium',
  joint: null, // 현재 SKU 미등록 — "준비 중" 표시
}

const TOPPER_TO_SLUG: Record<'vegetable' | 'protein', string> = {
  vegetable: 'harvest-veggie-mix',
  protein: 'ocean-omega-mix',
}

type Product = {
  id: string
  name: string
  slug: string
  price: number
  sale_price: number | null
  image_url: string | null
  stock: number
}

export default function OrderPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const dogId = params.id as string

  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const [dogName, setDogName] = useState('')
  const [formula, setFormula] = useState<Formula | null>(null)
  const [products, setProducts] = useState<Record<string, Product>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/login?next=/dogs/${dogId}/order`)
        return
      }
      const [{ data: dog }, { data: formulaRow }] = await Promise.all([
        supabase
          .from('dogs')
          .select('name')
          .eq('id', dogId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('dog_formulas')
          .select(
            'cycle_number, formula, reasoning, transition_strategy, ' +
              'algorithm_version, daily_kcal, daily_grams, user_adjusted',
          )
          .eq('dog_id', dogId)
          .eq('user_id', user.id)
          .order('cycle_number', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (cancelled) return
      if (!dog) {
        router.push('/dogs')
        return
      }
      setDogName((dog as { name: string }).name)

      if (!formulaRow) {
        setErr('아직 맞춤 박스 추천이 없어요. 분석을 먼저 받아 주세요.')
        setLoading(false)
        return
      }
      const f = formulaRow as unknown as {
        cycle_number: number
        formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
        reasoning: Formula['reasoning']
        transition_strategy: Formula['transitionStrategy']
        algorithm_version: string
        daily_kcal: number
        daily_grams: number
        user_adjusted: boolean
      }
      setFormula({
        lineRatios: f.formula.lineRatios,
        toppers: f.formula.toppers,
        reasoning: f.reasoning,
        transitionStrategy: f.transition_strategy,
        dailyKcal: f.daily_kcal,
        dailyGrams: f.daily_grams,
        cycleNumber: f.cycle_number,
        algorithmVersion: f.algorithm_version,
        userAdjusted: f.user_adjusted,
      })

      // 매핑된 모든 slug 의 product fetch
      const allSlugs = [
        ...Object.values(LINE_TO_SLUG).filter((s): s is string => s !== null),
        ...Object.values(TOPPER_TO_SLUG),
      ]
      const { data: prodList } = await supabase
        .from('products')
        .select('id, name, slug, price, sale_price, image_url, stock')
        .in('slug', allSlugs)
        .eq('is_active', true)
      const map: Record<string, Product> = {}
      for (const p of ((prodList ?? []) as unknown) as Product[]) {
        map[p.slug] = p
      }
      setProducts(map)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, router, supabase])

  const selectedItems: Array<{
    slug: string
    line?: FoodLine
    topper?: 'vegetable' | 'protein'
    pct: number
    product: Product
    quantity: number
  }> = []

  if (formula) {
    for (const line of ALL_LINES) {
      const ratio = formula.lineRatios[line] ?? 0
      if (ratio <= 0) continue
      const slug = LINE_TO_SLUG[line]
      if (!slug) continue
      const p = products[slug]
      if (!p) continue
      selectedItems.push({
        slug,
        line,
        pct: Math.round(ratio * 100),
        product: p,
        quantity: 1, // v1 단순화 — 1개씩. 추후 1주분 g 기준 수량 산정.
      })
    }
    for (const k of ['vegetable', 'protein'] as const) {
      const ratio = formula.toppers[k] ?? 0
      if (ratio <= 0) continue
      const slug = TOPPER_TO_SLUG[k]
      const p = products[slug]
      if (!p) continue
      selectedItems.push({
        slug,
        topper: k,
        pct: Math.round(ratio * 100),
        product: p,
        quantity: 1,
      })
    }
  }

  const subtotal = selectedItems.reduce(
    (sum, it) => sum + (it.product.sale_price ?? it.product.price) * it.quantity,
    0,
  )

  // joint line 매칭 안 된 케이스 — UI 에 "준비 중" 카드
  const missingJoint =
    formula && (formula.lineRatios.joint ?? 0) > 0 && !LINE_TO_SLUG.joint

  async function addAllToCart() {
    if (selectedItems.length === 0) return
    setAdding(true)
    setErr('')
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/login?next=/dogs/${dogId}/order`)
        return
      }
      // 모든 SKU 를 upsert_cart_item RPC 로 atomic insert
      const errors: string[] = []
      for (const it of selectedItems) {
        const { error } = await supabase.rpc('upsert_cart_item', {
          p_user_id: user.id,
          p_product_id: it.product.id,
          p_variant_id: null,
          p_quantity: it.quantity,
          p_max_qty: Math.max(1, it.product.stock || 99),
        })
        if (error) errors.push(`${it.product.name}: ${error.message}`)
        else {
          trackAddToCart({
            item_id: it.product.id,
            item_name: it.product.name,
            price: it.product.sale_price ?? it.product.price,
            quantity: it.quantity,
          })
        }
      }
      if (errors.length > 0) {
        setErr(`일부 상품 추가 실패:\n${errors.join('\n')}`)
        return
      }
      haptic('confirm')
      toast.success(`${selectedItems.length}개 상품 장바구니 담음`)
      try {
        window.dispatchEvent(new CustomEvent('ft:cart:add'))
      } catch {
        /* noop */
      }
      router.push('/cart')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '장바구니 추가 실패')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <main className="ord-page">
        <div className="ord-state">
          <Loader2
            size={18}
            strokeWidth={2}
            color="var(--terracotta)"
            className="animate-spin"
          />
          박스 정보 불러오는 중...
        </div>
      </main>
    )
  }

  return (
    <main className="ord-page">
      <Link href={`/dogs/${dogId}/analysis`} className="ord-back">
        <ChevronLeft size={14} strokeWidth={2.2} />
        분석 결과
      </Link>

      <header className="ord-hero">
        <span className="ord-kicker">CUSTOM BOX · CYCLE {formula?.cycleNumber ?? '–'}</span>
        <h1>
          {dogName}이 맞춤 박스<br />
          이대로 주문할까요?
        </h1>
        <p>
          알고리즘이 추천한 5종 메인 + 토퍼를 한 번에 담아요. 장바구니에서
          수량 조정 가능.
        </p>
      </header>

      {!formula && (
        <div className="ord-empty">
          <p>{err || '아직 박스 추천이 없어요.'}</p>
          <Link href={`/dogs/${dogId}/analysis`} className="ord-empty-cta">
            분석 보러가기 →
          </Link>
        </div>
      )}

      {formula && selectedItems.length > 0 && (
        <>
          <ul className="ord-list">
            {selectedItems.map((it) => {
              const meta = it.line ? FOOD_LINE_META[it.line] : null
              const label = meta
                ? `${meta.name} · ${meta.subtitle}`
                : it.topper === 'vegetable'
                  ? '야채 토퍼 · 동결건조'
                  : '육류 토퍼 · 동결건조'
              const color = meta ? meta.color : 'var(--moss)'
              const price = it.product.sale_price ?? it.product.price
              return (
                <li key={it.slug} className="ord-item">
                  <span className="ord-item-bar" style={{ background: color }} />
                  <div className="ord-item-body">
                    <div className="ord-item-head">
                      <span
                        className="ord-item-name"
                        style={{ color: 'var(--ink)' }}
                      >
                        {label}
                      </span>
                      <span className="ord-item-pct" style={{ color }}>
                        {it.pct}%
                      </span>
                    </div>
                    <div className="ord-item-meta">
                      <span>1팩</span>
                      <span className="ord-divider" />
                      <span>{price.toLocaleString()}원</span>
                      {it.product.sale_price !== null && (
                        <>
                          <span className="ord-divider" />
                          <s style={{ color: 'var(--muted)', fontSize: 10 }}>
                            {it.product.price.toLocaleString()}원
                          </s>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
            {missingJoint && (
              <li className="ord-item ord-item-missing">
                <span
                  className="ord-item-bar"
                  style={{ background: 'var(--rule)' }}
                />
                <div className="ord-item-body">
                  <div className="ord-item-head">
                    <span className="ord-item-name">Joint · 돼지 관절·시니어</span>
                    <span className="ord-item-pct">준비 중</span>
                  </div>
                  <div className="ord-item-meta">
                    <span>곧 출시 — 다른 라인으로 임시 보완</span>
                  </div>
                </div>
              </li>
            )}
          </ul>

          <section className="ord-summary">
            <div className="ord-summary-row">
              <span>상품 합계</span>
              <strong>{subtotal.toLocaleString()}원</strong>
            </div>
            <div className="ord-summary-row ord-summary-info">
              <Sparkles size={11} strokeWidth={2.2} color="var(--moss)" />
              <span>
                알고리즘 v{formula.algorithmVersion} · {formula.dailyKcal} kcal/일
              </span>
            </div>
          </section>

          {err && (
            <div className="ord-err" role="alert">
              <AlertCircle size={13} strokeWidth={2.2} />
              <span style={{ whiteSpace: 'pre-line' }}>{err}</span>
            </div>
          )}

          <div className="ord-cta">
            <Link href="/products" className="ord-btn ord-btn-ghost">
              개별 보기
            </Link>
            <button
              type="button"
              onClick={addAllToCart}
              disabled={adding || selectedItems.length === 0}
              className="ord-btn ord-btn-prim"
            >
              {adding ? (
                <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
              ) : (
                <ShoppingCart size={14} strokeWidth={2.4} color="#fff" />
              )}
              {selectedItems.length}개 다 담기
              <ArrowRight size={12} strokeWidth={2.4} color="#fff" />
            </button>
          </div>
          <p className="ord-foot">
            <Check size={11} strokeWidth={2.6} color="var(--moss)" />
            장바구니에서 수량 / 정기배송 주기 변경 가능
          </p>
        </>
      )}
    </main>
  )
}
