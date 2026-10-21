import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import StoreShell from '@/components/store/StoreShell'
import ShipLine from '@/components/store/ShipLine'
import RecipeGrid from '@/components/store/RecipeGrid'
import TrialCard from '@/components/store/TrialCard'
import { storeSalesPaused } from '@/lib/store/toss-widget'
import HomeCalculator from '@/components/store/HomeCalculator'
import StoreFaq from '@/components/store/StoreFaq'
import { ogImageUrl } from '@/lib/seo/jsonld'
import { RECIPE_TITLE, STORE_RECIPES, storeItem } from '@/lib/store/catalog'
import { HOME_FEATURED_REVIEW, HOME_MORE_REVIEWS, reviewById, reviewerLabel, smartstoreSummary } from '@/lib/store/reviews'
import { SmartstoreReviewCard } from '@/components/store/ReviewMedia'
import { FREE_SHIPPING_MIN, SHIPPING_FEE } from '@/lib/store/shipping'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'
import { SMARTSTORE_URL } from '@/lib/links'
import { loadLinkContent, type LinkBanner } from '@/lib/link-content/load'
import { periodLabel } from '@/lib/link-content/status'
import { todayKstIsoDate } from '@/lib/datetime-kst'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 홈 — 웹 리뉴얼(2026-10-10, 사장님 "웹 = 단품 가게"). 2026-10-17 첫 화면 다시 짜기(웹 업그레이드 기획 3단계 — 사장님 "첫화면만 좀
 * 다시짜볼까"): 사진·한 줄 다음이 바로 가격 목록이라 '왜 이 집인지'가 비어 있었다. 위에서부터
 *   셸티 첫 화면("이거 제 밥 맞죠?!") → 증거 네 칸(별점·무항생제·제조업 등록·수비드) → 레시피 4종(한 줄 목록) → 4종 체험팩
 *   → 먹어 본 아이 이야기(게시 동의 후기) → 진행 중인 행사(링크 페이지 배너, 기간 끝나면 저절로 빠짐) → 500g 며칠분 계산기
 *   (+ 정기배송 줄 — 홈에 한 번만) → 손질부터 배송까지 → 매거진 3편 → 자주 묻는 질문 → 법정 바닥.
 * 사진·카드 위 레시피 색 띠는 뺐다(사장님 10/17 "AI 티"). 말 정리(문구)는 다음 단계 — 이번엔 자리만 바꿨다.
 * 예전 홈(설문 퍼널 — 모든 버튼이 /start)은 git 이력에 있다. 웹 설문·웹 정기배송 신청은 앱으로 옮겼다(기획서 D1·D2).
 * 출고일은 브라우저 시계로(ShipLine) — 이 화면은 캐시해 두므로 서버에서 날짜를 박지 않는다(행사 기간만 1시간 단위로 다시 굽는다).
 */
export const revalidate = 3600

const won = (n: number) => n.toLocaleString('ko-KR')
const FROM_PRICE = Math.min(...STORE_RECIPES.map((r) => storeItem(`${r}-500g`).price))

const HOME_OG = ogImageUrl({
  title: '국내산 고기를 수비드로 익힌 화식',
  subtitle: `500g ${won(FROM_PRICE)}원부터 · 화·목 출고`,
})

export const metadata: Metadata = {
  title: '파머스테일 — 국내산 고기를 수비드로 익힌 강아지 화식',
  description: `닭고기·오리고기·흑돼지·한우 화식, 500g ${won(FROM_PRICE)}원부터. 사료에 곁들여도, 한 끼로 줘도 돼요. 화·목 출고, ${FREE_SHIPPING_MIN / 10_000}만 원 이상 무료배송.`,
  alternates: { canonical: '/', types: { 'application/rss+xml': '/rss.xml' } },
  openGraph: {
    title: '파머스테일 — 국내산 고기를 수비드로 익힌 강아지 화식',
    description: `500g ${won(FROM_PRICE)}원부터. 사료에 곁들여도, 한 끼로 줘도 돼요.`,
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/',
    images: [{ url: HOME_OG, width: 1200, height: 630 }],
  },
}

/**
 * 스마트스토어 별점·후기 수 — 화식 상세에 옮겨 둔 스마트스토어 후기(lib/store/reviews)에서 센다. 화면에 '○월 ○일 기준'(가장 최근 후기 날).
 * 10/17 오전엔 손으로 '10건'이라 적었는데 그날 후기가 하나 더 와서 바로 틀렸다 — 후기를 옮겨 넣으면 숫자가 같이 따라간다.
 */
const SMARTSTORE_RATING = smartstoreSummary()

const FAQ: { q: string; a: string }[] = [
  {
    q: '사료랑 같이 줘도 되나요?',
    a: '네, 건사료 위에 올려 주면 돼요. 화식을 준 만큼 건사료를 줄여 주세요. 몸무게별 양은 상품 페이지에서 계산할 수 있어요.',
  },
  {
    q: '언제 보내 주나요?',
    a: `화요일과 목요일에 출고해요. 출고 전날 밤 12시까지 주문하면 그 출고일에 나가요. 배송비는 ${won(SHIPPING_FEE)}원이고, ${FREE_SHIPPING_MIN / 10_000}만 원 이상이면 무료예요.`,
  },
  {
    q: '보관과 해동은 어떻게 해요?',
    a: '받으면 바로 냉동실에 넣어 주세요. 냉동실에서 180일 보관돼요. 먹이기 전날 밤 냉장실로 옮겨 녹이고, 녹인 팩은 3일 안에 주세요.',
  },
  {
    q: '앱 정기배송과 뭐가 달라요?',
    a: `웹에서는 500g 한 봉씩 정가에 사요. 앱 정기배송은 몸무게에 맞춘 양을 2주마다 ${SUBSCRIPTION_DISCOUNT_PCT}% 낮은 가격으로 보내드려요.`,
  },
]

type MagazinePost = { slug: string; title: string; excerpt: string | null; cover_url: string | null }

/** 매거진 최신 공개 글 3편 — 공개 글만(is_published), 쿠키 없는 조회라 이 화면의 캐시(1시간)를 깨지 않는다. 실패하면 칸을 빼고 남긴다. */
async function latestPosts(): Promise<MagazinePost[]> {
  try {
    const { data, error } = await createAdminClient()
      .from('blog_posts')
      .select('slug, title, excerpt, cover_url')
      .eq('is_published', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(3)
    if (error) {
      console.error('[home] magazine query failed', error)
      return []
    }
    return (data ?? []) as MagazinePost[]
  } catch (e) {
    console.error('[home] magazine client failed', e)
    return []
  }
}

/** 진행 중인 행사 — /link 배너 중 지금 기간인 것만(마감 회색·시작 전·스마트스토어 카드는 홈에 안 올린다). */
async function activeEvents(): Promise<LinkBanner[]> {
  const content = await loadLinkContent(todayKstIsoDate())
  return content.banners.filter((b) => b.window === 'active' && b.variant !== 'products')
}

function Chevron({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function H2({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <>
      <h2 className="d" style={{ margin: 0, fontSize: 32, lineHeight: 1.12 }}>
        {children}
      </h2>
      {sub && <p style={{ margin: '8px 0 0', fontSize: 17, lineHeight: 1.5, color: '#595959' }}>{sub}</p>}
    </>
  )
}

/** 증거 네 칸 — 2×2, 위 2px 먹선 · 칸 사이 1px. 색·그림자 없이 글자로만. */
function ProofGrid() {
  const cell = { padding: '16px 14px 16px 0', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 } as const
  const big = { fontSize: 22, lineHeight: 1.1 } as const
  const small = { fontSize: 14, lineHeight: 1.45, color: '#595959' } as const
  return (
    <section aria-label="파머스테일을 믿을 수 있는 이유" className="fts-sec fts-proof-sec" style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <div className="fts-proof" style={{ borderTop: '2px solid #141414', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <a href={SMARTSTORE_URL} target="_blank" rel="noopener noreferrer" style={{ ...cell, color: '#141414', textDecoration: 'none', borderBottom: '1px solid #E5E5E5', borderRight: '1px solid #E5E5E5' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span aria-hidden style={{ fontSize: 18, color: '#141414' }}>
              ★
            </span>
            <span className="n" style={{ fontSize: 26, lineHeight: 1 }}>
              {SMARTSTORE_RATING.stars}
            </span>
          </span>
          <span style={small}>
            스마트스토어 후기 {SMARTSTORE_RATING.reviews}건
            <br />
            {SMARTSTORE_RATING.asOf} 기준
          </span>
        </a>
        <div style={{ ...cell, paddingLeft: 14, borderBottom: '1px solid #E5E5E5' }}>
          <span className="d" style={big}>
            무항생제
          </span>
          <span style={small}>닭가슴살·오리 안심</span>
        </div>
        <div style={{ ...cell, borderRight: '1px solid #E5E5E5' }}>
          <span className="d" style={big}>
            사료 제조업 등록
          </span>
          <span style={small}>등록한 시설에서 만들어요</span>
        </div>
        <div style={{ ...cell, paddingLeft: 14 }}>
          <span className="d" style={big}>
            저온 수비드
          </span>
          <span style={small}>물속에서 천천히 익혀요</span>
        </div>
      </div>
    </section>
  )
}

/**
 * 먹어 본 아이 이야기 — 후기 정본(lib/store/reviews)에서: 크게 한 편(인스타 게시 동의 후기) + 아래 네이버 스마트스토어 후기 작은 카드
 * (레시피마다 다른 것, 출처 딱지·가린 아이디 그대로 — 사장님 10/17). 화면에 뜨는(웹 레시피) 후기만, 없으면 칸을 그리지 않는다.
 */
function ReviewBlock() {
  const r = reviewById(HOME_FEATURED_REVIEW)
  const more = HOME_MORE_REVIEWS.map(reviewById).filter((x) => x !== null)
  if (!r || !r.recipe) return null
  const recipe = r.recipe
  const photo = r.photos[0]!
  return (
    <section aria-labelledby="home-review" className="fts-sec fts-pt fts-rv" style={{ padding: '64px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <h2 id="home-review" className="d" style={{ margin: 0, fontSize: 32, lineHeight: 1.12 }}>
        먹어 본 아이 이야기
      </h2>
      <figure style={{ margin: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="fts-rv-top" style={{ display: 'grid', gridTemplateColumns: '132px minmax(0, 1fr)', columnGap: 16, alignItems: 'start' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.alt} width={440} height={440} loading="lazy" className="fts-rv-photo" style={{ width: 132, height: 132, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
          <blockquote style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span aria-hidden className="d" style={{ fontSize: 44, lineHeight: 0.6, height: 22, color: '#D4A24C' }}>
              &ldquo;
            </span>
            <p className="d" style={{ margin: 0, fontSize: 23, lineHeight: 1.25, textWrap: 'balance' }}>
              {r.title}
            </p>
          </blockquote>
        </div>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7, color: '#3D3D3D' }}>{r.body}</p>
        <figcaption style={{ paddingTop: 12, borderTop: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>
              {reviewerLabel(r)}{r.breed ? <span style={{ fontWeight: 600, color: '#595959' }}> · {r.breed}</span> : null}
            </span>
            <span style={{ fontSize: 14, color: '#595959' }}>{RECIPE_TITLE[recipe]}를 먹었어요</span>
          </span>
          <Link href={`/store/${recipe}#reviews`} style={{ flexShrink: 0, minHeight: 44, display: 'flex', alignItems: 'center', gap: 2, fontSize: 15, fontWeight: 700, color: '#141414' }}>
            사진 더 보기
            <Chevron size={15} />
          </Link>
        </figcaption>
      </figure>
      {more.length > 0 && (
        <div className="fts-rv-more" style={{ marginTop: 24, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
          {more.map((m) => (
            <SmartstoreReviewCard key={m.id} r={m} />
          ))}
          <Link href="/reviews" style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 16, fontWeight: 800, color: '#141414', textDecoration: 'none', borderBottom: '1px solid #E5E5E5' }}>
            후기 전체 보기
            <Chevron />
          </Link>
        </div>
      )}
    </section>
  )
}

/** 진행 중인 행사 띠 — 링크 페이지 배너(어드민 /admin/link)를 그대로 쓴다. 기간이 끝나면 다음 캐시(1시간 안)에 저절로 빠진다. */
function EventStrip({ events }: { events: LinkBanner[] }) {
  if (events.length === 0) return null
  return (
    <section aria-label="진행 중인 행사" className="fts-sec fts-pt fts-event" style={{ padding: '64px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {events.map((e) => {
        const external = /^https?:\/\//.test(e.href)
        const period = periodLabel(e.startsOn, e.endsOn)
        const body = (
          <>
            {e.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.imageUrl} alt="" width={192} height={240} loading="lazy" style={{ width: 96, height: 120, objectFit: 'cover', borderRadius: 2, display: 'block', flexShrink: 0, background: '#2A2A2A' }} />
            ) : null}
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ height: 24, padding: '0 8px', borderRadius: 2, background: '#D4A24C', color: '#141414', fontSize: 13, fontWeight: 800, display: 'inline-flex', alignItems: 'center' }}>{e.badge || '행사'}</span>
                {period && <span style={{ fontSize: 13, fontWeight: 700, color: '#BDBDBD' }}>{period}</span>}
              </span>
              <span className="d" style={{ fontSize: 21, lineHeight: 1.2 }}>
                {e.title}
              </span>
              {e.sub && <span style={{ fontSize: 14, lineHeight: 1.5, color: '#D9D9D9' }}>{e.sub}</span>}
            </span>
            <Chevron />
          </>
        )
        const style = { padding: 14, borderRadius: 4, background: '#141414', color: '#FFFFFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14 } as const
        return external ? (
          <a key={e.id} href={e.href} target="_blank" rel="noopener noreferrer" style={style}>
            {body}
          </a>
        ) : (
          <Link key={e.id} href={e.href || '/link'} style={style}>
            {body}
          </Link>
        )
      })}
    </section>
  )
}

function MagazineList({ posts }: { posts: MagazinePost[] }) {
  if (posts.length === 0) return null
  return (
    <section aria-labelledby="home-magazine" className="fts-sec fts-pt" style={{ padding: '64px 20px 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h2 id="home-magazine" className="d" style={{ margin: 0, fontSize: 32, lineHeight: 1.12 }}>
          매거진
        </h2>
        <Link href="/blog" style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 2, fontSize: 15, fontWeight: 700, color: '#141414' }}>
          전체 보기
          <Chevron size={15} />
        </Link>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 17, lineHeight: 1.5, color: '#595959' }}>화식을 처음 시작할 때 궁금한 것들</p>
      <ul className="fts-mag-list" style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414' }}>
        {posts.map((p) => (
          <li key={p.slug} style={{ borderBottom: '1px solid #E5E5E5' }}>
            <Link href={`/blog/${p.slug}`} className="fts-mag-item" style={{ padding: '14px 0', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px', columnGap: 14, alignItems: 'center', color: '#141414', textDecoration: 'none' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <strong style={{ fontSize: 17, lineHeight: 1.4, fontWeight: 800 }}>{p.title}</strong>
                {p.excerpt && (
                  <span style={{ fontSize: 14, lineHeight: 1.5, color: '#595959', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.excerpt}</span>
                )}
              </span>
              <span className="fts-mag-thumb" style={{ position: 'relative', width: 96, height: 72, borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}>
                {p.cover_url && <Image src={p.cover_url} alt="" fill sizes="(min-width: 1024px) 400px, 96px" style={{ objectFit: 'cover' }} />}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function HomePage() {
  const [events, posts] = await Promise.all([activeEvents(), latestPosts()])
  return (
    <StoreShell wide>
      {/* 첫 화면 — 셸티 사진 + 손글씨 말풍선(홈 한 곳만) + 흰 카드 */}
      <section className="fts-sec fts-hero" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="fts-hero-pic" style={{ position: 'relative', height: 560, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/store/hero-sheltie-table.webp"
            alt="식탁 앞 의자에 앉아 화식 그릇을 기다리는 셸티"
            width={1200}
            height={800}
            fetchPriority="high"
            className="fts-hero-img"
            style={{ width: '100%', height: 560, objectFit: 'cover', objectPosition: '80% 0%', display: 'block' }}
          />
          <p
            className="hand"
            style={{ position: 'absolute', right: 18, top: 44, margin: 0, background: '#FFFFFF', border: '2px solid #141414', borderRadius: 14, padding: '12px 16px 14px', fontSize: 26, lineHeight: 1.15, color: '#141414' }}
          >
            이거 제 밥
            <br />
            맞죠?!
          </p>
        </div>
        <div className="fts-hero-card" style={{ position: 'relative', zIndex: 2, marginTop: -40, background: '#FFFFFF', borderRadius: '12px 12px 0 0', padding: '26px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <h1 className="d" style={{ margin: 0, fontSize: 40, lineHeight: 1.1 }}>
            국내산 고기를
            <br />
            수비드로 익혔어요
          </h1>
          <p className="fts-lead" style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.55, color: '#3D3D3D' }}>사료에 곁들여도, 한 끼로 줘도 돼요.</p>
          <div className="fts-hero-cta">
          <Link
            href="/store"
            style={{ marginTop: 20, height: 60, borderRadius: 4, background: '#141414', color: '#FFFFFF', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 19, fontWeight: 800 }}
          >
            레시피 고르기
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          {/* PC 만 — 버튼 옆 시작 가격(폰은 버튼이 꽉 차 자리가 없다) */}
          <span className="fts-pc-only" style={{ fontSize: 16, color: '#595959', whiteSpace: 'nowrap' }}>
            500g <strong className="n" style={{ fontSize: 24, fontWeight: 400, color: '#141414' }}>{won(FROM_PRICE)}</strong>원부터
          </span>
          </div>
          <ShipLine />
        </div>
      </section>

      <ProofGrid />

      {/* 레시피 4종 + 체험팩 */}
      <section id="recipes" className="fts-sec fts-pt" style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <H2 sub="모두 100g 팩 5개, 500g 한 봉이에요">레시피 4종</H2>
        <div style={{ marginTop: 16 }}>
          <RecipeGrid paused={storeSalesPaused()} />
        </div>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column' }}>
          <TrialCard />
        </div>
      </section>

      <ReviewBlock />

      <EventStrip events={events} />

      {/* 500g 며칠분 + 정기배송 줄(홈에 한 번만 — 매일 먹일 양을 본 자리) */}
      <section className="fts-sec fts-calc" style={{ marginTop: 64, padding: '48px 20px 40px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 className="d" style={{ margin: 0, fontSize: 32, lineHeight: 1.12 }}>
          500g 한 봉,
          <br />
          며칠 먹을까요?
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 17, color: '#595959' }}>닭고기를 건사료에 곁들여 줄 때 기준이에요</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
        <HomeCalculator />
        <Link
          href="/app"
          style={{ marginTop: 20, minHeight: 56, borderTop: '1px solid #DADADA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, color: '#141414', textDecoration: 'none' }}
        >
          <span>
            매일 먹인다면 <strong style={{ fontWeight: 800, color: '#1D3B2F' }}>앱 정기배송 {SUBSCRIPTION_DISCOUNT_PCT}% 할인</strong>
          </span>
          <Chevron />
        </Link>
        </div>
      </section>

      {/* 손질부터 배송까지 */}
      <section className="fts-sec fts-pt fts-make" style={{ padding: '64px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 className="d" style={{ margin: 0, fontSize: 32, lineHeight: 1.12 }}>
          손질부터 배송까지
          <br />
          직접 해요
        </h2>
        <figure style={{ margin: '22px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kitchen-sousvide.jpg" alt="진공 포장한 고기를 수비드 기계로 익히고 있어요" width={1200} height={800} loading="lazy" style={{ width: '100%', aspectRatio: '350 / 236', objectFit: 'cover', borderRadius: 4, display: 'block' }} />
          <figcaption style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong style={{ fontSize: 19, fontWeight: 800 }}>물속에서 천천히 익혀요</strong>
            <span style={{ fontSize: 16, lineHeight: 1.55, color: '#595959' }}>진공 포장한 재료를 정해진 온도의 물에 담가 수비드로 익혀요.</span>
          </figcaption>
        </figure>
        <div className="fts-make-small" style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/prep-hygiene-43.jpg" alt="위생 장갑을 낀 손으로 고기를 손질하고 있어요" width={600} height={700} loading="lazy" style={{ width: '100%', aspectRatio: '170 / 200', objectFit: 'cover', borderRadius: 4, display: 'block' }} />
            <figcaption style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: 17, fontWeight: 800 }}>사람 음식처럼 손질</strong>
              <span style={{ fontSize: 15, color: '#595959' }}>국내산 고기만 써요</span>
            </figcaption>
          </figure>
          <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/box-coldchain-43.jpg" alt="파머스테일 테이프를 두른 보냉 상자" width={600} height={700} loading="lazy" style={{ width: '100%', aspectRatio: '170 / 200', objectFit: 'cover', borderRadius: 4, display: 'block' }} />
            <figcaption style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: 17, fontWeight: 800 }}>얼린 채로 배송</strong>
              <span style={{ fontSize: 15, color: '#595959' }}>보냉 상자에 담아요</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <MagazineList posts={posts} />

      <StoreFaq items={FAQ} className="fts-sec fts-pt" listClassName="fts-faq-list" />
    </StoreShell>
  )
}
