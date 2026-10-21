'use client'

/**
 * 상품 상세(웹 시안 Product) — 레시피 하나.
 * ★2026-10-22 구조 다시 짜기(사장님 "잘 짜인 상세페이지 레퍼런스 다 긁어와서 우리 입맛에 맞게, 디자인도 더 강력하게"):
 *   레퍼런스 20곳(해외 신선 펫푸드 Lyka·Nom Nom·Ollie·JFFD·Spot&Tango… / 국내 컬리·정육각·하림·어니스트밀·29CM / 식품 D2C Graza·Huel…
 *   + Baymard·NN/g 상세 연구)을 실제로 열어 본 공통 공식으로 다시 짰다:
 *   ① 위: 사진(사진마다 큰 한 줄 설명) · 레시피 바꾸기 · 이름 · 별점·후기 수(제목 바로 아래) · 가격·100g당 · 계산 한 줄 · 출고·배송·보관·원산지 · 용량 · 담기
 *   ② 바로가기 줄(화면 위에 붙음 — 내용은 숨기지 않고 펼친 채, 가로 '탭'이 아니라 건너뛰기만)
 *   ③ 한눈에 = 검정 숫자 띠(국내산·kcal·100g·180일) + 흐르는 글자 띠
 *   ④ 01 재료 → 02 만드는 법 → 03 급여량(계산기 + 몸무게별 빠른 표) → 04 주는 법(녹이기·담기 + 처음 바꿀 땐 일주일)
 *   ⑤ 05 믿고 먹일 수 있게(등록 시설·성분 등록 + 모자라기 쉬운 영양) → 후기(별점 요약) → 이런 아이에게 + 자주 묻는 질문
 *   ⑥ 4가지 레시피(다른 레시피는 아래쪽 — 레퍼런스 전부 같은 자리) → 상품 정보(펼침) → 아래 고정 구매 바.
 * 숫자는 상품표(lib/store/catalog)·급여 계산(lib/store/feeding)·배송(lib/store/shipping), 법정 표시는 DB 라벨 칸.
 * 웹에는 '맞춤'이라는 말을 쓰지 않는다 — 양은 일반 기준 예상치, 정확한 양은 앱. 비율%·성분%는 쓰지 않는다(막대·말로만).
 * paused: 자사몰 결제 막음(storeSalesPaused) — 구매 버튼 두 곳(본문·아래 고정 바)을 회색으로, 바로 위에 스마트스토어(규칙177).
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import AddSheet from './AddSheet'
import DaysBox from './DaysBox'
import { PAUSED_BTN, PayPausedNotice, SmartStoreButton } from './PayPaused'
import { useShipDate } from './useShipDate'
import {
  ANTIBIOTIC_FREE_MAIN,
  RECIPE_BAND,
  RECIPE_NAME,
  RECIPE_PRODUCT_NAME,
  RECIPE_REAL_IMG,
  RECIPE_STUDIO_IMG,
  STORE_RECIPES,
  STORE_SIZES,
  alternativeAdvice,
  fullIngredients,
  kcalPer100g,
  recipeIntro,
  storeItem,
  subscriptionPer100g,
  toppingLine,
  type StoreRecipe,
  type StoreSize,
} from '@/lib/store/catalog'
import RegisteredTable from './RegisteredTable'
import RecipeName from './RecipeName'
import { FEED_RATIOS, MAX_WEIGHT_KG, MIN_WEIGHT_KG, feedingSummary, type FeedRatioKey } from '@/lib/store/feeding'
import { FREE_SHIPPING_MIN, SHIPPING_FEE } from '@/lib/store/shipping'
import { REFUND_RULE_HAEYO } from '@/lib/store/refund-copy'
import { reviewsFor } from '@/lib/store/reviews'
import { FeaturedReview, SmartstoreReview } from './ReviewMedia'
import { SMARTSTORE_URL } from '@/lib/links'
import type { RecipeLabel } from '@/lib/store/label'
import { Acc, NoticeList, ShippingRefundInfo } from './ProductInfo'
import { business } from '@/lib/business'
import { RECIPE_INGREDIENTS } from '@/lib/recipe-ingredients'
import { SKU_MODEL } from '@/lib/personalization/skuModel'

const won = (n: number) => n.toLocaleString('ko-KR')
const SHORT: Record<StoreRecipe, string> = { chicken: '닭', duck: '오리', pork: '흑돼지', beef: '한우' }

/** 구획 — 머리(큰 번호 + 머리말) + 제목 32. scrollMarginTop: 웹 전체에 scroll-padding-top 96(globals.css)이 이미 걸려 있어 그만큼 빼고, 위 여백(64·PC 96)까지 빼서 번호가 바로가기 줄 바로 밑에 오게(실측 10/22). */
const SEC: CSSProperties = { padding: '64px 20px 0', display: 'flex', flexDirection: 'column', gap: 20, scrollMarginTop: -40 }
const TAG: CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 12px', borderRadius: 4, background: '#F6F4F5', fontSize: 15, fontWeight: 700 }

/** 바로가기 줄 — 레퍼런스(Baymard): 내용을 가로 탭에 숨기지 말고 펼친 채 건너뛰기만. 한국 상세의 '상품정보·후기' 줄 자리. */
const JUMP: ReadonlyArray<readonly [string, string]> = [
  ['ing', '재료'],
  ['make', '만드는 법'],
  ['calc', '급여량'],
  ['reviews', '후기'],
  ['info', '상품 정보'],
]

function Kicker({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800, color: 'var(--fts-kicker, #595959)' }}>
      {/* 검정 띠(한눈에) 위에선 흑돼지 색 네모가 안 보여 흰 테두리를 두른다(--fts-kicker-ring) */}
      <span aria-hidden style={{ width: 10, height: 10, flexShrink: 0, background: color, display: 'block', outline: 'var(--fts-kicker-ring, none)' }} />
      {children}
    </span>
  )
}

/** 큰 번호(Anton) + 머리말 — 구획이 열 개가 넘어 같은 머리말만 되풀이되면 단조롭다(조사: 01·02 번호로 리듬). */
function Head({ no, color, children }: { no: string; color: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
      <span className="n" aria-hidden style={{ fontSize: 56, lineHeight: 0.82 }}>
        {no}
      </span>
      <Kicker color={color}>{children}</Kicker>
    </div>
  )
}

function SecTitle({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="d" style={{ margin: 0, fontSize: 32, lineHeight: 1.12 }}>
      {children}
    </h2>
  )
}

/** 한눈에 검정 띠의 한 칸 — 숫자(Anton) 하나 + 단위 + 한 줄. */
function Stat({ k, v, unit, s, word }: { k: string; v: string; unit?: string; s: string; word?: boolean }) {
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.28)', padding: '14px 0 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#BDBDBD' }}>{k}</span>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className={word ? 'd' : 'n'} style={{ fontSize: word ? 34 : 50, lineHeight: 1 }}>
          {v}
        </span>
        {unit && <span style={{ fontSize: 17, fontWeight: 800 }}>{unit}</span>}
      </span>
      <span style={{ fontSize: 15, color: '#E5E5E5' }}>{s}</span>
    </div>
  )
}

/** 자주 묻는 질문 — 가게 화면이라 '맞춤'·'언제든'은 쓰지 않는다. 정기배송 값은 계산(15% — subscriptionPer100g). */
function faqs(recipe: StoreRecipe): Array<[string, string]> {
  const off = Math.round((1 - subscriptionPer100g(recipe) / (storeItem(`${recipe}-500g`).price / storeItem(`${recipe}-500g`).packs)) * 100)
  return [
    ['처음부터 화식만 줘도 되나요?', "먹던 사료에 조금씩 섞어 일주일쯤 걸쳐 바꾸는 게 좋아요. 위 '처음 바꿀 땐'을 보시고, 양은 '하루에 얼마나'에서 몸무게를 넣어 보세요."],
    ['4가지 레시피를 번갈아 줘도 되나요?', '네, 괜찮아요. 처음 바꿀 땐 하루이틀 섞어 주면 더 편하게 적응해요. 먹고 탈이 난 고기가 있다면 그 레시피만 빼 주세요.'],
    ['언제 보내 주나요?', "위 '출고' 칸의 날짜에 얼린 채로 보냉 상자에 담아 보내 드려요. 받으면 바로 냉동실에 넣어 주세요."],
    ['앱 정기배송과 뭐가 달라요?', `가게에서는 원하는 레시피를 한 봉씩 사요. 앱 정기배송은 우리 아이 몸무게와 나이로 하루 양을 계산해 2주마다 보내 드리고, 100g당 ${off}% 싸요.`],
  ]
}

function Chevron({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** 바로가기 줄 — 지금 보고 있는 칸에 밑줄. 내용은 그대로 펼쳐 둔다(건너뛰기만). */
function JumpNav() {
  const [on, setOn] = useState<string>('ing')
  useEffect(() => {
    const els = JUMP.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => e !== null)
    if (els.length === 0 || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setOn(vis[0].target.id)
      },
      { rootMargin: '-120px 0px -55% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])
  return (
    <nav aria-label="상세 바로가기" className="fts-pd-jump" style={{ position: 'sticky', top: 56, zIndex: 25, marginTop: 40, background: '#FFFFFF', borderTop: '2px solid #141414', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: `repeat(${JUMP.length}, minmax(0, 1fr))` }}>
      {JUMP.map(([id, t]) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={on === id ? 'true' : undefined}
          style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', textDecoration: 'none', color: on === id ? '#141414' : '#757575', boxShadow: on === id ? 'inset 0 -3px 0 #141414' : 'none' }}
        >
          {t}
        </a>
      ))}
    </nav>
  )
}

export default function ProductDetail({ recipe, label, paused }: { recipe: StoreRecipe; label: RecipeLabel | null; paused: boolean }) {
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
  const reviews = reviewsFor(recipe)
  // 별점 = 스마트스토어 후기 별점만(인스타 후기엔 별점이 없다). 없으면 후기 수만.
  const rated = reviews.filter((r) => typeof r.rating === 'number') as Array<(typeof reviews)[number] & { rating: number }>
  const avg = rated.length > 0 ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : null

  // 사진마다 큰 한 줄(조사 Baymard: 사진부터 보는 사람이 절반 — 사진 위에 설명을 얹는다)
  const photos = [
    { src: RECIPE_STUDIO_IMG[recipe], alt: `${RECIPE_PRODUCT_NAME[recipe]} 팩`, cap: '100g씩 한 팩, 얼려서 와요' },
    { src: RECIPE_REAL_IMG[recipe], alt: `그릇에 담은 ${RECIPE_PRODUCT_NAME[recipe]}`, cap: '그릇에 담으면 이렇게' },
    { src: `/store/ingredients-${recipe}.webp`, alt: `흰 접시에 담은 ${name} 레시피 재료`, cap: '들어가는 재료 그대로' },
    { src: '/store/real-serving.webp', alt: '화식 그릇을 받는 셸티', cap: '셸티 땅콩이의 한 그릇' },
  ]
  const cur = photos[photo]!

  const openSheet = () => {
    setQty(1)
    setSheet(true)
  }

  return (
    <>
      {/* PC(폭 1024 이상): 사진(왼쪽, 따라 내려옴) · 구매 상자(오른쪽) 2단 — store.css .fts-pd-top. 폰에선 그냥 위아래. */}
      <div className="fts-pd-top">
      {/* 사진 */}
      <section aria-label="상품 사진" className="fts-pd-media">
        <div className="fts-pd-photo" style={{ position: 'relative', aspectRatio: '1 / 1', background: '#F6F4F5', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cur.src} alt={cur.alt} width={800} height={800} fetchPriority="high" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <span aria-hidden className="d" style={{ position: 'absolute', left: 12, bottom: 12, maxWidth: 'calc(100% - 96px)', background: '#141414', color: '#FFFFFF', borderRadius: 2, padding: '7px 11px', fontSize: 17, lineHeight: 1.2 }}>
            {cur.cap}
          </span>
          <span className="n" style={{ position: 'absolute', right: 12, bottom: 12, background: '#FFFFFF', color: '#141414', borderRadius: 2, padding: '5px 9px', fontSize: 15 }}>
            {photo + 1} / {photos.length}
          </span>
        </div>
        <div className="fts-pd-thumbs" style={{ padding: '10px 20px 0', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {photos.map((p, i) => (
            <button
              key={p.src}
              type="button"
              onClick={() => setPhoto(i)}
              aria-label={p.alt}
              aria-pressed={i === photo}
              style={{ width: '100%', aspectRatio: '1 / 1', padding: 0, borderRadius: 4, overflow: 'hidden', border: i === photo ? '2px solid #141414' : '1px solid #E5E5E5', background: '#F6F4F5', cursor: 'pointer' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt="" width={240} height={240} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      </section>

      <div className="fts-pd-buy">
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
        {/* 무항생제 꼬리표 — 닭가슴살·오리 안심만(사장님 2026-10-11, 정본 ANTIBIOTIC_FREE_MAIN) */}
        {ANTIBIOTIC_FREE_MAIN[recipe] && (
          <span style={{ alignSelf: 'flex-start', marginBottom: 10, padding: '5px 10px', borderRadius: 2, background: '#1D3B2F', color: '#FFFFFF', fontSize: 14, fontWeight: 800 }}>
            무항생제 {ing.main}
          </span>
        )}
        <RecipeName recipe={recipe} size={38} as="h1" />
        {/* 별점·후기 수는 제목 바로 아래(조사: 레퍼런스 전부 같은 자리) — 누르면 후기로 */}
        {reviews.length > 0 && (
          <a href="#reviews" style={{ marginTop: 10, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#141414', textDecoration: 'none' }}>
            {avg !== null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span aria-hidden style={{ color: '#141414', fontSize: 16, letterSpacing: 1 }}>
                  ★
                </span>
                <span className="n" style={{ fontSize: 18 }}>
                  {avg.toFixed(1)}
                </span>
              </span>
            )}
            <span style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>후기 {reviews.length}개</span>
          </a>
        )}
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
        {paused ? (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PayPausedNotice />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
              <button type="button" disabled style={{ height: 58, borderRadius: 4, fontSize: 17, fontWeight: 800, ...PAUSED_BTN }}>
                장바구니 담기
              </button>
              <button type="button" disabled style={{ height: 58, borderRadius: 4, fontSize: 17, fontWeight: 800, ...PAUSED_BTN }}>
                바로 구매
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
            <button type="button" onClick={openSheet} style={{ height: 58, borderRadius: 4, border: '1.5px solid #141414', background: '#FFFFFF', color: '#141414', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
              장바구니 담기
            </button>
            <button type="button" onClick={openSheet} style={{ height: 58, borderRadius: 4, border: 0, background: '#141414', color: '#FFFFFF', fontSize: 17, fontWeight: 800, cursor: 'pointer' }}>
              바로 구매
            </button>
          </div>
        )}
        {added && (
          <p role="status" style={{ margin: '10px 0 0', padding: '12px 14px', background: '#141414', color: '#FFFFFF', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
            장바구니에 담았어요
            <Link href="/store/cart" style={{ color: '#FFFFFF', fontWeight: 800, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              장바구니 보기
            </Link>
          </p>
        )}
        <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.55, color: '#595959' }}>
          {REFUND_RULE_HAEYO}{' '}
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
      </div>
      </div>

      <JumpNav />

      {/* ② 한눈에 — 검정 숫자 띠(조사: 구매 상자 바로 밑 '단어 하나 + 증거 한 줄' 3~4칸, Anton 숫자 블록) */}
      <section className="fts-sec fts-pd-glance" style={{ padding: '44px 20px 36px', background: '#141414', color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 20, ['--fts-kicker' as string]: '#BDBDBD', ['--fts-kicker-ring' as string]: '1px solid #FFFFFF' } as CSSProperties}>
        <Kicker color={color}>한눈에</Kicker>
        <SecTitle>
          국내산 고기를
          <br />
          수비드로 익힌 한 그릇
        </SecTitle>
        <div className="fts-pd-cols4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 8 }}>
          <Stat k="고기" v="국내산" word s={ANTIBIOTIC_FREE_MAIN[recipe] ? `무항생제 ${ing.main}` : ing.main} />
          <Stat k="100g당" v={String(kcalPer100g(recipe))} unit="kcal" s="한 팩 기준" />
          <Stat k="한 팩" v="100" unit="g" s="양 맞추기 쉬워요" />
          <Stat k="냉동 보관" v="180" unit="일" s="녹인 뒤엔 냉장 3일" />
        </div>
      </section>
      {/* 흐르는 글자 띠 — 구획 사이 리듬(조사: Nom Nom). 같은 말을 두 번 이어 붙여 끊김 없이 돈다. 움직임 줄이기 설정이면 멈춘다(store.css). */}
      <div className="fts-marq" aria-hidden>
        <div className="fts-marq-track">
          {[0, 1].map((k) => (
            <span key={k} className="d">
              국내산 고기 ✦ 저온 수비드 ✦ 한 레시피에 고기 한 가지 ✦ 100g씩 소분 냉동 ✦ 등록한 사료 제조 시설 ✦{' '}
            </span>
          ))}
        </div>
      </div>

      {/* 01 재료 — 원물 사진(흰 접시 탑다운, 사장님 10/15 고른 4장) + 재료 표(원산지는 재료 바로 옆 — 조사: 한국 상세 공통) */}
      <section id="ing" className="fts-sec fts-pt fts-pd-narrow fts-pd-wide fts-pd-ing" style={SEC}>
        <Head no="01" color={color}>
          재료
        </Head>
        <SecTitle>
          한 그릇에
          <br />
          들어간 것
        </SecTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/store/ingredients-${recipe}.webp`}
          alt={`흰 접시에 담은 ${[ing.main, ...ing.organs, ...ing.toppings, ...ing.veg].join('·')}와 작은 그릇에 담은 기름·영양 재료`}
          width={1080}
          height={724}
          loading="lazy"
          className="fts-pd-bleed"
          style={{ width: 'calc(100% + 40px)', maxWidth: 'none', margin: '0 -20px', aspectRatio: '1080 / 724', objectFit: 'cover', display: 'block' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '2px solid #141414' }}>
          {[
            { k: '고기', list: [ANTIBIOTIC_FREE_MAIN[recipe] ? `무항생제 ${ing.main}` : ing.main, ...ing.organs] },
            { k: '더한 것', list: [...ing.toppings] },
            { k: '채소·곡물', list: ing.veg },
            { k: '기름·영양', list: ing.base.map((b) => (b.includes('뉴트리 코어') ? '뉴트리 코어' : b)) },
          ].map((g) => (
            <div key={g.k} style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '84px 1fr', gap: 10, alignItems: 'start' }}>
              <span style={{ fontSize: 15, fontWeight: 800, paddingTop: 7 }}>{g.k}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {g.list.map((x, i) => (
                  <span key={x} style={g.k === '고기' && i === 0 ? { ...TAG, background: color, color: recipe === 'chicken' ? '#141414' : '#FFFFFF' } : TAG}>
                    {x}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '84px 1fr', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>원산지</span>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{label?.origin ?? '국내산'}</span>
          </div>
        </div>
        {label && label.allergens.length > 0 && (
          <p style={{ margin: 0, padding: '12px 14px', borderRadius: 4, background: '#F6F4F5', fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>
            <strong style={{ color: '#141414' }}>알레르기 정보</strong> · {label.allergens.join(', ')}
          </p>
        )}
        <a href="#info" style={{ marginTop: -8, height: 44, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 700, color: '#141414' }}>
          원재료 전체 보기
          <Chevron size={15} />
        </a>
      </section>

      {/* 02 만드는 법 — 번호 = 실제 공정 순서 */}
      <section id="make" className="fts-sec fts-pt fts-pd-narrow fts-pd-wide" style={SEC}>
        <Head no="02" color={color}>
          만드는 법
        </Head>
        <SecTitle>이렇게 만들어요</SecTitle>
        <ol className="fts-pd-steps" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
          {[
            { t: '재료를 손질해 진공 포장해요', d: `${[ing.main, ...ing.organs].join('·')}을 위생 장갑을 끼고 하나하나 손질해요.`, src: '/prep-hygiene-43.jpg', alt: '위생 장갑을 끼고 고기를 손질하는 손' },
            { t: '수비드로 천천히 익혀요', d: '정해진 온도의 물에서 오래 끓이지 않고 익혀 촉촉해요.', src: '/kitchen-sousvide.jpg', alt: '진공 포장한 재료를 수비드로 익히는 모습' },
            { t: '채소와 고루 섞고 영양을 더해요', d: '비타민·미네랄(뉴트리 코어)과 연어유를 넣어요.', src: '/bowl/fresh.webp', alt: '고루 섞어 그릇에 담은 화식' },
            { t: '바로 얼려 100g씩 나눠 담아요', d: '한 팩이 100g이라 양을 맞추기 쉬워요.', src: RECIPE_STUDIO_IMG[recipe], alt: `${RECIPE_PRODUCT_NAME[recipe]} 100g 팩` },
          ].map((s, i, all) => (
            <li key={s.t} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 12, paddingBottom: i < all.length - 1 ? 24 : 0, position: 'relative' }}>
              {i < all.length - 1 && <span aria-hidden style={{ position: 'absolute', left: 19, top: 40, bottom: 0, width: 2, background: '#E5E5E5' }} />}
              <span className="n" style={{ width: 40, height: 40, borderRadius: '50%', background: '#141414', color: '#FFFFFF', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                {i + 1}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 7, minWidth: 0 }}>
                <strong style={{ fontSize: 18, fontWeight: 800 }}>{s.t}</strong>
                <span style={{ fontSize: 15, lineHeight: 1.55, color: '#3D3D3D' }}>{s.d}</span>
                {s.src && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.src} alt={s.alt} width={900} height={506} loading="lazy" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: i === all.length - 1 ? 'contain' : 'cover', borderRadius: 4, display: 'block', background: i === all.length - 1 ? '#F3F2EF' : '#F6F4F5' }} />
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* 03 하루에 얼마나 — 계산기 + 몸무게별 빠른 표(조사: Nom Nom 급여표 두 층). 숫자는 전부 feedingSummary. */}
      <section id="calc" aria-labelledby="calc-title" className="fts-sec fts-pd-narrow fts-pd-wide fts-pd-calc" style={{ marginTop: 64, padding: '40px 20px 36px', background: '#F6F4F5', display: 'flex', flexDirection: 'column', scrollMarginTop: -16 }}>
        <Head no="03" color={color}>
          급여량
        </Head>
        <h2 id="calc-title" className="d" style={{ margin: '14px 0 0', fontSize: 32, lineHeight: 1.12 }}>
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
        {/* 몸무게별 빠른 표 — 지금 고른 주는 방법·용량 그대로. 누르면 그 몸무게로 계산기가 바뀐다. */}
        <div style={{ marginTop: 14, background: '#FFFFFF', borderRadius: 4, padding: '14px 16px 6px' }}>
          <strong style={{ fontSize: 16, fontWeight: 800 }}>몸무게별로 보면</strong>
          <span style={{ marginLeft: 6, fontSize: 14, color: '#595959' }}>{ratioShort}</span>
          <table style={{ width: '100%', marginTop: 8, borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ color: '#595959', textAlign: 'left' }}>
                <th scope="col" style={{ padding: '8px 0', fontWeight: 700 }}>몸무게</th>
                <th scope="col" style={{ padding: '8px 0', fontWeight: 700 }}>하루</th>
                <th scope="col" style={{ padding: '8px 0', fontWeight: 700, textAlign: 'right' }}>{size}이면</th>
              </tr>
            </thead>
            <tbody>
              {[3, 5, 10, 15].map((w) => {
                const f = feedingSummary(w, recipe, ratio, item.grams)
                const on = w === kg
                return (
                  <tr key={w} onClick={() => setKg(w)} style={{ borderTop: '1px solid #E5E5E5', cursor: 'pointer', fontWeight: on ? 800 : 400 }}>
                    <td style={{ padding: '10px 0' }}>
                      <span className="n" style={{ fontSize: 18 }}>
                        {w}
                      </span>{' '}
                      kg{on && ' ◀'}
                    </td>
                    <td style={{ padding: '10px 0' }}>약 {f.gramsPerDay}g</td>
                    <td style={{ padding: '10px 0', textAlign: 'right' }}>약 {f.days}일</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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

      {/* 04 주는 법 — 사진 = 사장님 상세 참고 자료의 실제 장면(serve-1~3) + 처음 바꿀 땐 일주일(조사: Nom Nom '바꾸는 4단계' — %는 쓰지 않고 그릇 채움으로) */}
      <section className="fts-sec fts-pt fts-pd-narrow" style={SEC}>
        <Head no="04" color={color}>
          주는 법
        </Head>
        <SecTitle>녹여서 담으면 끝</SecTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {[
            { src: '/store/serve-1.webp', alt: '녹인 팩을 그릇 옆에 든 손', t: '전날 냉장실로 옮겨 녹여요' },
            { src: '/store/serve-2.webp', alt: '팩을 가위로 잘라 그릇에 담는 손', t: '팩을 잘라 그릇에 담아요' },
            { src: '/store/serve-3.webp', alt: '그릇에 담은 화식', t: '데우지 않고 그대로 줘요' },
          ].map((f, i) => (
            <figure key={f.src} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.src} alt={f.alt} width={420} height={420} loading="lazy" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 4, display: 'block' }} />
              <figcaption style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="n" style={{ fontSize: 18 }}>
                  {i + 1}
                </span>
                <strong style={{ fontSize: 15, lineHeight: 1.35, wordBreak: 'keep-all' }}>{f.t}</strong>
              </figcaption>
            </figure>
          ))}
        </div>
        <div style={{ borderLeft: `4px solid ${color}`, padding: '4px 0 4px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>얼린 채로 보냉 상자에 와요 — 받으면 바로 냉동실에</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>녹인 뒤엔 냉장 3일 안에 주세요</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>한 번 녹인 팩은 다시 얼리지 마세요</span>
        </div>
        <div style={{ border: '2px solid #141414', borderRadius: 4, padding: '18px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong className="d" style={{ fontSize: 22, fontWeight: 400 }}>
              처음 바꿀 땐 일주일에 걸쳐
            </strong>
            <span style={{ fontSize: 15, color: '#3D3D3D' }}>먹던 사료에 섞어 화식을 조금씩 늘려요</span>
          </span>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {[
              { d: '1~2', f: 1, t: '조금 섞어서' },
              { d: '3~4', f: 2, t: '절반쯤' },
              { d: '5~6', f: 3, t: '대부분' },
              { d: '7~', f: 4, t: '정한 양 그대로' },
            ].map((s) => (
              <li key={s.d} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* 그릇 채움 — 네 칸 중 화식 칸 수(숫자·% 대신 그림) */}
                <span aria-hidden style={{ height: 44, maxWidth: 120, borderRadius: '0 0 22px 22px', border: '2px solid #141414', borderTop: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
                  {[1, 2, 3, 4].map((n) => (
                    <span key={n} style={{ flex: 1, background: n <= s.f ? color : 'transparent' }} />
                  ))}
                </span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span className="n" style={{ fontSize: 20 }}>
                    {s.d}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>일</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, wordBreak: 'keep-all' }}>{s.t}</span>
              </li>
            ))}
          </ol>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #E5E5E5' }}>
          {[
            ['입이 짧다면', '살짝 미지근하게 주면 고기 향이 더 살아나요'],
            ['화식이 처음이면', '먹던 사료에 조금씩 섞어 며칠에 걸쳐 늘려요'],
            ['이가 약하다면', '미지근한 물을 조금 더해 부드럽게 줘요'],
          ].map(([a, b]) => (
            <div key={a} style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '118px 1fr', gap: 10 }}>
              <strong style={{ fontSize: 16 }}>{a}</strong>
              <span style={{ fontSize: 15, lineHeight: 1.55, color: '#3D3D3D' }}>{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 05 믿고 먹일 수 있게 — 등록(번호 안 보이게, 사장님 10/15) + 모자라기 쉬운 영양(정직한 버전 — '100% 충족' 표 대신).
          조사: 신뢰는 근거 한 덩어리로 세운다. PC 에선 왼쪽 등록증 · 오른쪽 영양(store.css .fts-pd-trust). */}
      <section className="fts-sec fts-pt fts-pd-narrow fts-pd-wide fts-pd-trust" style={SEC}>
        <Head no="05" color={color}>
          믿고 먹일 수 있게
        </Head>
        <SecTitle>
          나라에 등록한
          <br />
          사료 제조 시설에서 만들어요
        </SecTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { src: '/store/cert-maker.webp', w: 274, h: 346, alt: '사료제조업 등록증(번호 가림)', t: '사료제조업 등록', d: '인천광역시에 등록한 우리 제조 시설에서 직접 만들어요' },
            { src: '/store/cert-recipes.webp', w: 308, h: 384, alt: '사료성분 등록증 4장(번호 가림)', t: '사료성분 등록 · 4가지 모두', d: '레시피마다 성분을 등록했어요. 등록한 성분량은 아래 상품 정보에 있어요' },
          ].map((c) => (
            <div key={c.t} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 16, alignItems: 'center', border: '1px solid #E5E5E5', borderRadius: 4, padding: 14 }}>
              <span style={{ background: '#F6F4F5', borderRadius: 4, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.src} alt={c.alt} width={c.w} height={c.h} loading="lazy" style={{ height: 104, width: 'auto', display: 'block' }} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontSize: 17 }}>{c.t}</strong>
                <span style={{ fontSize: 15, lineHeight: 1.5, color: '#3D3D3D' }}>{c.d}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{ background: '#F6F4F5', borderRadius: 4, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 className="d" style={{ margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 400 }}>
            모자라기 쉬운 영양은
            <br />
            따로 채워요
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 22px 1fr 22px 1fr', alignItems: 'center', gap: 4 }}>
            {[
              { a: '고기·채소', b: '간·염통·현미' },
              { a: '뉴트리 코어', b: '비타민·미네랄' },
            ].flatMap((x, i) => [
              <div key={x.a} style={{ background: '#FFFFFF', borderRadius: 4, padding: '14px 6px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 92, justifyContent: 'center' }}>
                <strong style={{ fontSize: 16 }}>{x.a}</strong>
                <span style={{ fontSize: 13, color: '#595959' }}>{x.b}</span>
              </div>,
              <span key={`op${i}`} aria-hidden style={{ textAlign: 'center', fontSize: 22, fontWeight: 800 }}>
                {i === 0 ? '+' : '='}
              </span>,
            ])}
            <div style={{ background: '#141414', color: '#FFFFFF', borderRadius: 4, padding: '14px 6px', textAlign: 'center', display: 'flex', minHeight: 92, alignItems: 'center', justifyContent: 'center' }}>
              <strong className="d" style={{ fontSize: 19, lineHeight: 1.15, fontWeight: 400 }}>
                {name}
                <br />
                화식
              </strong>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: '#3D3D3D' }}>
            고기와 채소만으로는 모자라기 쉬운 비타민과 미네랄을 &lsquo;파머스테일 뉴트리 코어&rsquo;로 채워요. 식품으로 품목제조보고를 마친 프리믹스예요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid #DADADA' }}>
            {[
              ['비타민·미네랄', '뉴트리 코어'],
              ['칼슘', '난각분말'],
              ['오메가-3', '연어유'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, padding: '12px 0', borderBottom: '1px solid #DADADA' }}>
                <span style={{ fontSize: 15, color: '#595959', fontWeight: 700 }}>{k}</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#595959' }}>
            미국 AAFCO·유럽 FEDIAF의 성견 영양 기준을 참고해 재료 하나하나의 영양을 계산해서 배합했어요. 등록한 성분량은 아래{' '}
            <a href="#info" style={{ fontWeight: 700, color: '#141414' }}>
              상품 정보
            </a>
            에 있어요.
          </p>
        </div>
      </section>

      {/* 후기 — 홈 '먹어 본 아이 이야기'가 #reviews 로 바로 온다. 머리에 별점 요약(조사: 요약 + 개수 먼저). */}
      <section id="reviews" className="fts-sec fts-pt fts-pd-narrow" style={{ padding: '64px 20px 0', display: 'flex', flexDirection: 'column', gap: 12, scrollMarginTop: -40 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingBottom: 6 }}>
          <h2 className="d" style={{ margin: 0, fontSize: 40, lineHeight: 1 }}>
            후기
          </h2>
          {reviews.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              {avg !== null && (
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span aria-hidden style={{ fontSize: 22 }}>★</span>
                  <span className="n" style={{ fontSize: 34, lineHeight: 1 }}>
                    {avg.toFixed(1)}
                  </span>
                </span>
              )}
              <span style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>{reviews.length}개</span>
            </span>
          )}
        </div>
        {/* 후기 = 정본 lib/store/reviews(규칙286·294) — 인스타 후기는 게시 동의를 받아, 스마트스토어 후기는 출처·가린 아이디 그대로(사장님 10/17).
            후기 쓰기 기능은 아직 없다 — 쓸 수 있다고 말하지 않는다. */}
        {reviews.length === 0 ? (
          <div style={{ border: '2px solid #141414', borderRadius: 4, padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong style={{ fontSize: 17 }}>첫 후기를 모으는 중이에요</strong>
            <span style={{ fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>먹여 보신 분들의 이야기가 모이면 이 자리에 올려요.</span>
          </div>
        ) : (
          <>
          {reviews.filter((r) => r.source === 'instagram').map((r) => (
            <FeaturedReview key={r.id} r={r} />
          ))}
          {reviews.some((r) => r.source === 'smartstore') && (
            <div style={{ borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
              {reviews.filter((r) => r.source === 'smartstore').map((r) => (
                <SmartstoreReview key={r.id} r={r} />
              ))}
              <a href={SMARTSTORE_URL} target="_blank" rel="noopener noreferrer" style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 15, fontWeight: 700, color: '#141414', textDecoration: 'none', borderBottom: '1px solid #E5E5E5' }}>
                스마트스토어에서 후기 전체 보기
                <Chevron />
              </a>
            </div>
          )}
          </>
        )}
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

      {/* 우리 아이한테 맞을까요 — 이런 아이에게(자기 확인 목록) + 자주 묻는 질문을 한 덩어리로(조사: Lyka 레시피별 질문 · 한국 상세 '이런 아이에게') */}
      <section className="fts-sec fts-pt fts-pd-narrow" style={SEC}>
        <Kicker color={color}>추천</Kicker>
        <SecTitle>이런 아이에게 좋아요</SecTitle>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bowl-eating.jpg" alt="그릇에 담긴 화식을 먹는 강아지" width={1200} height={750} loading="lazy" style={{ width: '100%', aspectRatio: '350 / 220', objectFit: 'cover', borderRadius: 4, display: 'block' }} />
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', borderTop: '2px solid #141414' }}>
          {[
            ['화식을 처음 시작하는 아이', '사료에 조금씩 섞어 시작해요'],
            ['사료를 자주 남기는 아이', '고기 향이 살아 있는 한 그릇'],
            ['물을 잘 안 마시는 아이', '물기 많은 한 그릇으로 수분도'],
            ['씹기 편한 게 좋은 노령견', '부드러운 식감이에요'],
          ].map(([a, b]) => (
            <li key={a} style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '28px 1fr', gap: 10, alignItems: 'start' }}>
              <span aria-hidden style={{ width: 24, height: 24, borderRadius: '50%', background: '#141414', color: '#FFFFFF', fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                ✓
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong style={{ fontSize: 17, lineHeight: 1.35, wordBreak: 'keep-all' }}>{a}</strong>
                <span style={{ fontSize: 15, lineHeight: 1.5, color: '#3D3D3D' }}>{b}</span>
              </span>
            </li>
          ))}
        </ul>
        {advice && (
          <div style={{ padding: '16px 18px', background: '#F6F4F5', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong style={{ fontSize: 17, fontWeight: 800 }}>이런 아이에겐 다른 레시피를 권해요</strong>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>{advice}</p>
          </div>
        )}
        <h3 className="d" style={{ margin: '20px 0 0', fontSize: 24, lineHeight: 1.2, fontWeight: 400 }}>
          자주 묻는 질문
        </h3>
        <div style={{ marginTop: -6, borderTop: '2px solid #141414' }}>
          {faqs(recipe).map(([q, a], i) => (
            <Acc key={q} title={q} open={i === 0}>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: '#3D3D3D' }}>{a}</p>
            </Acc>
          ))}
        </div>
      </section>

      {/* 4가지 레시피 — 팩 사진 카드(보고 있는 것만 굵은 테두리). 조사: 다른 레시피는 주 정보 아래(후기·질문 뒤). */}
      <section className="fts-sec fts-pt" style={SEC}>
        <Kicker color={color}>다른 레시피</Kicker>
        <SecTitle>
          4가지 레시피
          <br />
          이렇게 달라요
        </SecTitle>
        <div className="fts-pd-cols4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {STORE_RECIPES.map((r) => {
            const on = r === recipe
            const body = (
              <>
                <span style={{ position: 'relative', display: 'block', background: '#EDEDED' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={RECIPE_STUDIO_IMG[r]} alt={`${RECIPE_PRODUCT_NAME[r]} 팩`} width={400} height={240} loading="lazy" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                  {on && (
                    <span style={{ position: 'absolute', left: 8, top: 8, height: 24, padding: '0 8px', borderRadius: 999, background: '#141414', color: '#FFFFFF', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center' }}>
                      보고 있어요
                    </span>
                  )}
                </span>
                <span style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <RecipeName recipe={r} size={18} as="strong" stack />
                  <span style={{ fontSize: 14, color: '#3D3D3D' }}>{toppingLine(r)}</span>
                  <span>
                    <span className="n" style={{ fontSize: 20 }}>
                      {kcalPer100g(r)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#595959' }}> kcal</span>
                  </span>
                </span>
              </>
            )
            const box: CSSProperties = { border: on ? '2px solid #141414' : '1px solid #E5E5E5', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: '#141414', textDecoration: 'none' }
            return on ? (
              <div key={r} style={box} aria-current="page">
                {body}
              </div>
            ) : (
              <Link key={r} href={`/store/${r}`} style={box}>
                {body}
              </Link>
            )
          })}
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#595959' }}>모두 간·염통과 {ing.veg.join('·')}가 함께 들어가요. kcal은 100g 기준이에요.</p>
      </section>

      <section id="info" className="fts-sec fts-pt fts-pd-narrow" style={{ padding: '64px 20px 120px', display: 'flex', flexDirection: 'column', scrollMarginTop: -40 }}>
        <SecTitle>상품 정보</SecTitle>
        <div style={{ marginTop: 14, borderTop: '2px solid #141414' }}>
          <Acc title="원재료 전체">
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#3D3D3D' }}>{fullIngredients(recipe).join(', ')}</p>
          </Acc>
          {/* 등록성분량 — 등록한 값 그대로(사장님 10/17: '검사 결과 나오면 올려요'는 미완성 업장 같다). 정본 lib/store/registered. */}
          <Acc title="등록성분량" open>
            <RegisteredTable recipe={recipe} />
          </Acc>
          {/* 처음부터 펼친다 — 반품 배송비·환불 조건을 찾지 않아도 보이게(토스 일반결제 심사 준비, 규칙210). */}
          <Acc title="배송·교환·환불" id="shipping" open>
            <ShippingRefundInfo />
          </Acc>
          <Acc title="상품정보 제공고시">
            {label ? (
              <NoticeList
                rows={[
                  ['제품명', `${RECIPE_PRODUCT_NAME[recipe]} ${size}`],
                  ['내용량', `${item.grams}g (100g × ${item.packs}팩)`],
                  ['가격', `${won(item.price)}원`],
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
                ]}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#3D3D3D' }}>
                정보를 불러오지 못했어요. 팩 라벨을 확인하시거나 {business.phone}로 물어봐 주세요.
              </p>
            )}
          </Acc>
        </div>
      </section>

      {/* 아래 고정 구매 바 — 결제 막음이면 초록 스마트스토어 아래에 회색 버튼(값 줄은 본문에 있어 뺀다: 바가 너무 높아진다) */}
      <div className="fts-pd-bar" style={{ position: 'sticky', bottom: 0, zIndex: 20, background: '#FFFFFF', borderTop: '1px solid #E5E5E5', padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {paused ? (
          <>
            <SmartStoreButton height={50} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8 }}>
              <button type="button" disabled style={{ height: 46, borderRadius: 4, fontSize: 17, fontWeight: 800, ...PAUSED_BTN }}>
                장바구니
              </button>
              <button type="button" disabled style={{ height: 46, borderRadius: 4, fontSize: 17, fontWeight: 800, ...PAUSED_BTN }}>
                바로 구매
              </button>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
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
      {!paused && (
        <noscript>
          <p style={{ padding: 20 }}>장바구니에 담으려면 브라우저에서 자바스크립트를 켜 주세요. 궁금한 점은 전화({business.phone})로 물어보세요.</p>
        </noscript>
      )}
    </>
  )
}
