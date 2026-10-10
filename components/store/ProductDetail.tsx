'use client'

/**
 * 상품 상세(웹 시안 Product) — 레시피 하나. 위에서부터:
 * 사진(4장) · 레시피 바꾸기 · 이름·한 줄·가격 · "○kg 아이에게 500g이면 약 ○일"(계산기로) · 출고·배송비·보관·원산지 ·
 * 용량(500g·1kg) · [장바구니 담기][바로 구매] · 환불 한 줄 · 앱 정기배송 한 줄 · 하루에 얼마나(계산기) · 들어간 재료 ·
 * 이렇게 만들어요 · 상품 정보(원재료·등록성분·도착·배송환불·제공고시) · 후기 · 다른 레시피 · 아래 고정 구매 바.
 * 숫자는 상품표(lib/store/catalog)·급여 계산(lib/store/feeding)·배송(lib/store/shipping), 법정 표시는 DB 라벨 칸.
 * 웹에는 '맞춤'이라는 말을 쓰지 않는다 — 양은 일반 기준 예상치, 정확한 양은 앱.
 */
import { useState } from 'react'
import Link from 'next/link'
import AddSheet from './AddSheet'
import DaysBox from './DaysBox'
import { useShipDate } from './useShipDate'
import {
  RECIPE_BAND,
  RECIPE_NAME,
  RECIPE_PRODUCT_NAME,
  RECIPE_REAL_IMG,
  RECIPE_STUDIO_IMG,
  STORE_RECIPES,
  STORE_SIZES,
  alternativeAdvice,
  fullIngredients,
  meatLine,
  recipeIntro,
  storeItem,
  subscriptionPer100g,
  toppingLine,
  type StoreRecipe,
  type StoreSize,
} from '@/lib/store/catalog'
import { FEED_RATIOS, MAX_WEIGHT_KG, MIN_WEIGHT_KG, feedingSummary, type FeedRatioKey } from '@/lib/store/feeding'
import { FREE_SHIPPING_MIN, SHIPPING_FEE } from '@/lib/store/shipping'
import type { RecipeLabel } from '@/lib/store/label'
import { business } from '@/lib/business'
import { RECIPE_INGREDIENTS } from '@/lib/recipe-ingredients'
import { SKU_MODEL } from '@/lib/personalization/skuModel'

const won = (n: number) => n.toLocaleString('ko-KR')
const SHORT: Record<StoreRecipe, string> = { chicken: '닭', duck: '오리', pork: '흑돼지', beef: '한우' }

function Chevron({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function Acc({ title, children, open = false, id }: { title: string; children: React.ReactNode; open?: boolean; id?: string }) {
  return (
    <details id={id} open={open} style={{ borderBottom: '1px solid #E5E5E5' }}>
      <summary style={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 18, fontWeight: 700 }}>
        {title}
        <span aria-hidden className="fts-acc-plus" style={{ fontSize: 26, fontWeight: 300 }}>
          +
        </span>
        <span aria-hidden className="fts-acc-minus" style={{ fontSize: 26, fontWeight: 300 }}>
          −
        </span>
      </summary>
      <div style={{ paddingBottom: 20 }}>{children}</div>
    </details>
  )
}

export default function ProductDetail({ recipe, label }: { recipe: StoreRecipe; label: RecipeLabel | null }) {
  const ship = useShipDate()
  const [size, setSize] = useState<StoreSize>('500g')
  const [kg, setKg] = useState(5)
  const [ratio, setRatio] = useState<FeedRatioKey>('light')
  const [photo, setPhoto] = useState(0)
  const [sheet, setSheet] = useState(false)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const item = storeItem(`${recipe}-${size}`)
  const color = RECIPE_BAND[recipe]
  const name = RECIPE_NAME[recipe]
  const ing = RECIPE_INGREDIENTS[SKU_MODEL[recipe].legacyLine]!
  const feed = feedingSummary(kg, recipe, ratio, item.grams)
  const daysFor = (s: StoreSize) => feedingSummary(kg, recipe, ratio, storeItem(`${recipe}-${s}`).grams).days
  const ratioLabel = FEED_RATIOS.find((r) => r.key === ratio)!.label
  const ratioShort = ratio === 'light' ? '건사료에 곁들이면' : ratio === 'half' ? '건사료와 반반이면' : '화식만 주면'
  const monthKg = Math.round(((feed.gramsPerDay * 30) / 1000) * 10) / 10
  const advice = alternativeAdvice(recipe)

  const photos = [
    { src: RECIPE_STUDIO_IMG[recipe], alt: `${RECIPE_PRODUCT_NAME[recipe]} 팩` },
    { src: RECIPE_REAL_IMG[recipe], alt: `그릇에 담은 ${RECIPE_PRODUCT_NAME[recipe]}` },
    { src: '/store/real-serving.webp', alt: '화식 그릇을 받는 셸티' },
  ]
  const cur = photos[photo]!

  const openSheet = () => {
    setQty(1)
    setSheet(true)
  }

  return (
    <>
      {/* 사진 */}
      <section aria-label="상품 사진">
        <div style={{ position: 'relative', aspectRatio: '1 / 1', background: '#F6F4F5', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cur.src} alt={cur.alt} width={800} height={800} fetchPriority="high" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <span className="n" style={{ position: 'absolute', right: 12, bottom: 12, background: '#141414', color: '#FFFFFF', borderRadius: 2, padding: '4px 9px', fontSize: 14 }}>
            {photo + 1} / {photos.length}
          </span>
        </div>
        <div style={{ padding: '10px 20px 0', display: 'flex', gap: 8 }}>
          {photos.map((p, i) => (
            <button
              key={p.src}
              type="button"
              onClick={() => setPhoto(i)}
              aria-label={p.alt}
              aria-pressed={i === photo}
              style={{ width: 62, height: 62, padding: 0, borderRadius: 4, overflow: 'hidden', border: i === photo ? '2px solid #141414' : '1px solid #E5E5E5', background: '#F6F4F5', cursor: 'pointer' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" width={62} height={62} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      </section>

      {/* 레시피 바꾸기 */}
      <nav aria-label="레시피 바꾸기" style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderTop: '1px solid #E5E5E5', borderBottom: '2px solid #141414' }}>
        {STORE_RECIPES.map((r) => {
          const on = r === recipe
          return (
            <Link
              key={r}
              href={`/store/${r}`}
              replace
              scroll={false}
              aria-current={on ? 'page' : undefined}
              className="d"
              style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 17, textDecoration: 'none', background: on ? RECIPE_BAND[r] : '#FFFFFF', color: on && r === 'pork' ? '#FFFFFF' : '#141414' }}
            >
              <span aria-hidden style={{ width: 9, height: 9, background: on ? (r === 'pork' ? '#FFFFFF' : '#141414') : RECIPE_BAND[r] }} />
              {SHORT[r]}
            </Link>
          )
        })}
      </nav>

      {/* 이름·가격 */}
      <section style={{ padding: '22px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h1 className="d" style={{ margin: 0, fontSize: 38, lineHeight: 1.1 }}>
          {RECIPE_PRODUCT_NAME[recipe]}
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.55, color: '#3D3D3D' }}>{recipeIntro(recipe)}</p>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            {size === '1kg' && (
              <span className="d" style={{ fontSize: 24, color: '#C63D2A' }}>
                {Math.round((1 - item.price / item.listPrice) * 100)}%
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
              <span className="n" style={{ fontSize: 44, lineHeight: 1 }}>
                {won(item.price)}
              </span>
              <span className="d" style={{ fontSize: 22 }}>
                원
              </span>
            </span>
          </p>
          <p style={{ margin: 0, textAlign: 'right', fontSize: 14, lineHeight: 1.5, color: '#595959' }}>
            {size} · 100g 팩 {item.packs}개
            <br />
            100g당 {won(Math.round(item.price / item.packs))}원
          </p>
        </div>
        {size === '1kg' && (
          <span style={{ marginTop: 6, fontSize: 15, color: '#595959' }}>
            500g 두 봉 <span style={{ textDecoration: 'line-through' }}>{won(item.listPrice)}원</span>보다 싸요
          </span>
        )}
        <a
          href="#calc"
          style={{ marginTop: 16, border: '2px solid #141414', borderRadius: 4, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: '#141414', textDecoration: 'none' }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 14, color: '#595959' }}>
              {kg.toFixed(1)}kg 아이에게, {ratioShort}
            </span>
            <span className="d" style={{ fontSize: 22 }}>
              {size}이면 약 {feed.days}일
            </span>
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', textDecoration: 'underline' }}>몸무게 바꾸기</span>
        </a>
        <dl style={{ margin: '18px 0 0', borderTop: '2px solid #141414' }}>
          {[
            [
              '출고',
              ship ? (
                <>
                  <strong style={{ fontWeight: 800 }}>{ship.label}</strong> · 오늘 밤 12시까지 주문
                </>
              ) : (
                '화·목 출고'
              ),
            ],
            ['배송비', `${won(SHIPPING_FEE)}원 · ${FREE_SHIPPING_MIN / 10_000}만 원 이상 무료`],
            ['보관', '냉동 180일'],
            ['원산지', label?.origin ?? '국내산'],
          ].map(([k, v], i) => (
            <div key={i} style={{ minHeight: 52, borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '76px 1fr', alignItems: 'center', gap: 8 }}>
              <dt style={{ fontSize: 15, color: '#595959' }}>{k}</dt>
              <dd style={{ margin: 0, fontSize: 16 }}>{v}</dd>
            </div>
          ))}
        </dl>

        <h2 className="d" style={{ margin: '26px 0 0', fontSize: 22 }}>
          용량
        </h2>
        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {STORE_SIZES.map((s) => {
            const it = storeItem(`${recipe}-${s}`)
            const on = s === size
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => setSize(s)}
                style={{ borderRadius: 4, border: on ? '2px solid #141414' : '1px solid #BDBDBD', background: '#FFFFFF', padding: '12px 14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, textAlign: 'left', cursor: 'pointer', color: '#141414' }}
              >
                <span>
                  <span className="d" style={{ fontSize: 22 }}>
                    {s}
                  </span>{' '}
                  <span style={{ fontSize: 13, color: '#595959' }}>{it.packs}팩</span>
                </span>
                <span style={{ fontSize: 17, fontWeight: 800 }}>{won(it.price)}원</span>
                <span style={{ fontSize: 13, fontWeight: s === '1kg' ? 700 : 400, color: s === '1kg' ? '#C63D2A' : '#595959' }}>
                  {s === '1kg' ? `${Math.round((1 - it.price / it.listPrice) * 100)}% 할인 · 약 ${daysFor(s)}일분` : `이 아이에게 약 ${daysFor(s)}일분`}
                </span>
              </button>
            )
          })}
        </div>
        {size === '500g' && daysFor('500g') < 7 && (
          <p style={{ margin: '10px 0 0', padding: '12px 14px', background: '#F6F4F5', borderRadius: 4, fontSize: 15, lineHeight: 1.55 }}>
            이 아이에겐 500g이 일주일을 못 가요. <strong>1kg이 덜 번거로워요.</strong>
          </p>
        )}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
          <button type="button" onClick={openSheet} style={{ height: 58, borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', color: '#141414', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
            장바구니 담기
          </button>
          <button type="button" onClick={openSheet} style={{ height: 58, borderRadius: 4, border: 0, background: '#141414', color: '#FFFFFF', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
            바로 구매
          </button>
        </div>
        {added && (
          <p role="status" style={{ margin: '10px 0 0', padding: '12px 14px', background: '#141414', color: '#FFFFFF', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
            장바구니에 담았어요
            <Link href="/store/cart" style={{ color: '#FFFFFF', fontWeight: 800, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              장바구니 보기
            </Link>
          </p>
        )}
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#595959' }}>
          받은 날부터 7일 안, 뜯지 않았다면 환불돼요.{' '}
          <a href="#shipping" style={{ fontWeight: 700, color: '#141414' }}>
            교환·환불 안내
          </a>
        </p>
        <Link
          href="/app"
          style={{ marginTop: 14, minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 16, color: '#141414', textDecoration: 'none' }}
        >
          <span>
            매일 먹인다면 앱 정기배송 <strong style={{ fontWeight: 800, color: '#1D3B2F' }}>500g {won(subscriptionPer100g(recipe) * 5)}원</strong>
          </span>
          <Chevron />
        </Link>
      </section>

      {/* 하루에 얼마나 */}
      <section id="calc" aria-labelledby="calc-title" style={{ marginTop: 48, padding: '40px 20px 36px', background: '#F6F4F5', display: 'flex', flexDirection: 'column', scrollMarginTop: 64 }}>
        <h2 id="calc-title" className="d" style={{ margin: 0, fontSize: 30, lineHeight: 1.12 }}>
          하루에 얼마나 줄까요?
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 16, color: '#595959' }}>몸무게와 주는 방법만 고르면 돼요</p>
        <div style={{ marginTop: 18, background: '#FFFFFF', borderRadius: 4, padding: '10px 12px 10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span id="calc-weight" style={{ fontSize: 17, fontWeight: 800 }}>
            몸무게
          </span>
          <div role="group" aria-labelledby="calc-weight" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              aria-label="0.5kg 줄이기"
              onClick={() => setKg((k) => Math.max(MIN_WEIGHT_KG, Math.round((k - 0.5) * 2) / 2))}
              style={{ width: 52, height: 52, borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', fontSize: 24, cursor: 'pointer', color: '#141414' }}
            >
              −
            </button>
            <span aria-live="polite" style={{ minWidth: 86, textAlign: 'center', whiteSpace: 'nowrap' }}>
              <span className="n" style={{ fontSize: 30 }}>
                {kg.toFixed(1)}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700 }}> kg</span>
            </span>
            <button
              type="button"
              aria-label="0.5kg 늘리기"
              onClick={() => setKg((k) => Math.min(MAX_WEIGHT_KG, Math.round((k + 0.5) * 2) / 2))}
              style={{ width: 52, height: 52, borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', fontSize: 24, cursor: 'pointer', color: '#141414' }}
            >
              +
            </button>
          </div>
        </div>
        <div role="group" aria-label="주는 방법" style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {FEED_RATIOS.map((t) => {
            const on = t.key === ratio
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => setRatio(t.key)}
                style={{ minHeight: 60, borderRadius: 4, border: '1.5px solid #141414', background: on ? '#141414' : '#FFFFFF', color: on ? '#FFFFFF' : '#141414', fontSize: 16, fontWeight: 800, lineHeight: 1.25, cursor: 'pointer', padding: '6px 4px' }}
              >
                {t.label === '건사료에 곁들여서' ? (
                  <>
                    건사료에
                    <br />
                    곁들여서
                  </>
                ) : (
                  t.label
                )}
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 14 }}>
          <DaysBox heading={`${size} 한 봉이면`} days={feed.days} gramsPerDay={feed.gramsPerDay} costPerDay={feed.costPerDay} packLabel={feed.packLabel} color={color} />
        </div>
        {monthKg >= 3 && (
          <Link
            href="/app"
            style={{ marginTop: 14, padding: '14px 16px', background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 15, lineHeight: 1.55, color: '#141414', textDecoration: 'none' }}
          >
            <span>
              이렇게 주면 한 달에 약 <strong>{monthKg}kg</strong>이 필요해요. 자주 주문해야 해서 <strong style={{ color: '#1D3B2F' }}>앱 정기배송</strong>이 편해요.
            </span>
            <Chevron />
          </Link>
        )}
        <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.6, color: '#595959' }}>
          중성화한 성견·보통 활동량 기준의 예상치예요({ratioLabel}). 나이·체형까지 본 양은{' '}
          <Link href="/app" style={{ fontWeight: 700, color: '#141414' }}>
            앱에서 알려드려요
          </Link>
          .
        </p>
      </section>

      {/* 들어간 재료 */}
      <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 className="d" style={{ margin: 0, fontSize: 30 }}>
          들어간 재료
        </h2>
        <div style={{ marginTop: 14, borderTop: '2px solid #141414' }}>
          {[
            ['고기', meatLine(recipe).split('·').join(' · ')],
            ['더한 것', toppingLine(recipe).split('·').join(' · ')],
          ].map(([k, v]) => (
            <div key={k} style={{ minHeight: 56, borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '76px 1fr', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, color: '#595959' }}>{k}</span>
              <span className="d" style={{ fontSize: 19 }}>
                {v}
              </span>
            </div>
          ))}
        </div>
        <a href="#info" style={{ marginTop: 12, height: 44, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 700, color: '#141414' }}>
          원재료 전체 보기
          <Chevron size={15} />
        </a>
        {advice && (
          <div style={{ marginTop: 12, padding: '16px 18px', background: '#F6F4F5', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong style={{ fontSize: 16 }}>이런 아이에겐 다른 레시피를 권해요</strong>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>{advice}</p>
          </div>
        )}
      </section>

      {/* 이렇게 만들어요 */}
      <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <h2 className="d" style={{ margin: 0, fontSize: 30 }}>
          이렇게 만들어요
        </h2>
        {[
          { src: '/prep-hygiene-43.jpg', alt: '위생 장갑을 낀 손으로 고기를 손질하고 있어요', t: '국내산 고기만 써요', d: `${[ing.main, ...ing.organs].join('·')}을 위생 장갑을 끼고 하나하나 손질해요.` },
          { src: '/kitchen-sousvide.jpg', alt: '진공 포장한 고기를 수비드 기계로 익히고 있어요', t: '수비드로 천천히 익혀요', d: '진공 포장한 재료를 정해진 온도의 물에서 익히고, 바로 얼려 100g씩 나눠 담아요.' },
          { src: RECIPE_REAL_IMG[recipe], alt: `그릇에 담은 ${RECIPE_PRODUCT_NAME[recipe]}`, t: '녹이면 바로 한 그릇', d: '데우지 않아도 돼요. 녹인 그대로 그릇에 담아 주세요.' },
        ].map((f) => (
          <figure key={f.t} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.src} alt={f.alt} width={1200} height={800} loading="lazy" style={{ width: '100%', aspectRatio: '350 / 210', objectFit: 'cover', borderRadius: 4, display: 'block' }} />
            <figcaption style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <strong style={{ fontSize: 19, fontWeight: 800 }}>{f.t}</strong>
              <span style={{ fontSize: 16, lineHeight: 1.55, color: '#595959' }}>{f.d}</span>
            </figcaption>
          </figure>
        ))}
      </section>

      {/* 상품 정보 */}
      <section id="info" style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column', scrollMarginTop: 64 }}>
        <h2 className="d" style={{ margin: 0, fontSize: 30 }}>
          상품 정보
        </h2>
        <div style={{ marginTop: 14, borderTop: '2px solid #141414' }}>
          <Acc title="원재료 전체">
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#3D3D3D' }}>{fullIngredients(recipe).join(', ')}</p>
          </Acc>
          <Acc title="등록성분">
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#3D3D3D' }}>
              공인 기관의 검사 결과가 나오는 대로 이 자리에 그대로 올려요. 그 전까지는 팩 라벨의 표기가 기준이에요.
            </p>
          </Acc>
          <Acc title="이렇게 도착해요" open>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['보냉 상자에 얼린 채로 와요.', '받으면 바로 냉동실에 넣어 주세요.'],
                ['먹일 팩 하나를 전날 밤 냉장실로.', '천천히 녹여요.'],
                ['녹인 팩은 3일 안에.', '다시 얼리지 마세요.'],
              ].map(([a, b], i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span className="d" style={{ width: 28, height: 28, flexShrink: 0, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 16, lineHeight: 1.65 }}>
                    <strong style={{ fontWeight: 800 }}>{a}</strong> {b}
                  </span>
                </li>
              ))}
            </ol>
          </Acc>
          <Acc title="배송·교환·환불" id="shipping">
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#3D3D3D', whiteSpace: 'pre-line' }}>
              화·목요일에 냉동으로 출고해요. 출고 후 하루나 이틀이면 받아요(지역에 따라 달라요). 배송비는 {won(SHIPPING_FEE)}원이고 {FREE_SHIPPING_MIN / 10_000}만 원 이상이면 무료예요.
              {'\n\n'}상품에 문제가 있으면 사진 한 장이면 돼요. 확인하고 다시 보내드리거나 환불해 드려요. 단순 변심은 받은 날부터 7일 안, 뜯지 않은 상품만 환불돼요.{' '}
              <Link href="/legal/refund" style={{ fontWeight: 700, color: '#141414' }}>
                환불정책 전체
              </Link>
            </p>
          </Acc>
          <Acc title="상품정보 제공고시">
            {label ? (
              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                {[
                  ['제품명', `${RECIPE_PRODUCT_NAME[recipe]} ${size}`],
                  ['내용량', `${item.grams}g (100g × ${item.packs}팩)`],
                  ['사료의 종류', label.petFoodClass],
                  ['원산지', label.origin],
                  ['제조원', [label.manufacturer, label.manufacturerAddress].filter(Boolean).join(' · ')],
                  ['제조연월일', label.manufactureDatePolicy],
                  ['유통기한', label.shelfLifeDays ? `제조일부터 냉동 ${label.shelfLifeDays}일` : null],
                  ['보관 방법', label.storageMethod],
                  ['알레르기 정보', label.allergens.length ? label.allergens.join(', ') : null],
                  ['인증·원료', label.certifications.length ? label.certifications.join(' · ') : null],
                  ['포장 국가', label.countryOfPackaging],
                  ['상품 번호', label.sku],
                  ['고객센터', business.phone],
                ]
                  .filter((row): row is [string, string] => !!row[1])
                  .map(([k, v]) => (
                    <div key={k} style={{ padding: '10px 0', borderBottom: '1px solid #F0F0F0', display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10 }}>
                      <dt style={{ fontSize: 14, color: '#595959' }}>{k}</dt>
                      <dd style={{ margin: 0, fontSize: 15, lineHeight: 1.55 }}>{v}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#3D3D3D' }}>
                정보를 불러오지 못했어요. 팩 라벨을 확인하시거나 {business.phone}로 물어봐 주세요.
              </p>
            )}
          </Acc>
        </div>
      </section>

      {/* 후기 */}
      <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="d" style={{ margin: 0, fontSize: 30 }}>
          후기
        </h2>
        <div style={{ border: '2px solid #141414', borderRadius: 4, padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <strong style={{ fontSize: 17 }}>첫 후기를 모으는 중이에요</strong>
          {/* 후기 쓰기 기능은 아직 없다(2026-07-16 폐기 · 기획서 §7 의 구매자 후기는 2단계) — 쓸 수 있다고 말하지 않는다. */}
          <span style={{ fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>먹여 보신 분들의 이야기가 모이면 고치지 않고 이 자리에 올려요.</span>
        </div>
        {business.kakaoChannelUrl && (
          <a
            href={business.kakaoChannelUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: '14px 16px', background: '#F6F4F5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: '#141414', textDecoration: 'none' }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: 16 }}>궁금한 게 있나요?</strong>
              <span style={{ fontSize: 14, color: '#595959' }}>카카오톡으로 물어보면 만든 사람이 직접 답해요</span>
            </span>
            <Chevron />
          </a>
        )}
      </section>

      {/* 다른 레시피 */}
      <section style={{ padding: '56px 20px 120px', display: 'flex', flexDirection: 'column' }}>
        <h2 className="d" style={{ margin: 0, fontSize: 30 }}>
          다른 레시피
        </h2>
        <div style={{ marginTop: 14, borderTop: '2px solid #141414' }}>
          {STORE_RECIPES.filter((r) => r !== recipe).map((r) => (
            <Link key={r} href={`/store/${r}`} style={{ minHeight: 80, borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', gap: 14, color: '#141414', textDecoration: 'none' }}>
              <span style={{ position: 'relative', width: 58, height: 58, borderRadius: 4, overflow: 'hidden', background: '#F6F4F5', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={RECIPE_STUDIO_IMG[r]} alt="" width={58} height={58} loading="lazy" style={{ width: 58, height: 58, objectFit: 'cover', display: 'block' }} />
                <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: RECIPE_BAND[r] }} />
              </span>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className="d" style={{ fontSize: 19 }}>
                  {RECIPE_PRODUCT_NAME[r]}
                </span>
                <span style={{ fontSize: 14, color: '#595959' }}>{meatLine(r)}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 1, whiteSpace: 'nowrap' }}>
                <span className="n" style={{ fontSize: 21 }}>
                  {won(storeItem(`${r}-500g`).price)}
                </span>
                <span className="d" style={{ fontSize: 13 }}>
                  원
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 아래 고정 구매 바 */}
      <div style={{ position: 'sticky', bottom: 0, zIndex: 20, background: '#FFFFFF', borderTop: '1px solid #E5E5E5', padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 14, color: '#595959', display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="n" style={{ fontSize: 20, color: '#141414' }}>
            {won(item.price)}
          </span>
          원 · {name} {size} · 이 아이에게 약 {feed.days}일분
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
          <button type="button" onClick={openSheet} style={{ height: 54, borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', color: '#141414', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
            장바구니
          </button>
          <button type="button" onClick={openSheet} style={{ height: 54, borderRadius: 4, border: 0, background: '#141414', color: '#FFFFFF', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
            바로 구매
          </button>
        </div>
      </div>

      <AddSheet
        open={sheet}
        onClose={() => setSheet(false)}
        recipe={recipe}
        size={size}
        onSize={setSize}
        qty={qty}
        onQty={setQty}
        daysFor={daysFor}
        onAdded={() => setAdded(true)}
      />
      <noscript>
        <p style={{ padding: 20 }}>장바구니에 담으려면 브라우저에서 자바스크립트를 켜 주세요. 전화({business.phone})로도 주문할 수 있어요.</p>
      </noscript>
    </>
  )
}
