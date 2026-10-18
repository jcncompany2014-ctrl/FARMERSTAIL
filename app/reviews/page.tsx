import type { Metadata } from 'next'
import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'
import JsonLd from '@/components/JsonLd'
import TrialCard from '@/components/store/TrialCard'
import RecipeName from '@/components/store/RecipeName'
import { FeaturedReview, SmartstoreReview } from '@/components/store/ReviewMedia'
import { buildBreadcrumbJsonLd, ogImageUrl } from '@/lib/seo/jsonld'
import { SMARTSTORE_URL } from '@/lib/links'
import { RECIPE_TITLE, STORE_RECIPES, SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/store/catalog'
import { reviewsFor, smartstoreSummary } from '@/lib/store/reviews'

/**
 * 웹 후기 — /reviews. 2026-10-18 다시 열었다(사장님 "이 외에 전부 진행" — 9/5 부터 후기가 없어 홈으로 돌려보내 두었다).
 * 정본 lib/store/reviews: 인스타 게시 동의 후기(큰 카드) + 네이버 스마트스토어 후기(출처 딱지·가린 아이디 그대로, 규칙294).
 * 위에서부터 머리말·제목·소개 → 별점 한 줄(옮긴 후기에서 셈) → 레시피 바로가기 → 레시피마다 후기 → 직접 먹여 보세요(체험팩·앱 띠).
 * ⚠️ 정직 원칙(규칙 28): 지어낸 후기·평점·숫자 금지. 웹에서 후기를 쓰는 기능은 없다(2026-07-16 폐기) — 쓸 수 있다고 말하지 않는다
 *   (예전 '후기 원칙 세 줄 — 구매하신 분만·사진과 별점'은 없는 기능 기준이라 뺐다). 웹 상세가 없는 상품(큐브·케이크) 후기는 여기도 안 뜬다.
 */

export const revalidate = 3600

const SUM = smartstoreSummary()
const TOTAL = STORE_RECIPES.reduce((n, r) => n + reviewsFor(r).length, 0)

const REVIEWS_OG = ogImageUrl({
  title: '먹어 본 아이들의 이야기',
  subtitle: `네이버 스마트스토어 후기 ${SUM.reviews}건 · 별점 ${SUM.stars}`,
  tag: 'Reviews',
})
const DESCRIPTION = `네이버 스마트스토어와 인스타그램에 남겨 주신 파머스테일 화식 후기 ${TOTAL}편을 그대로 옮겼어요. 스마트스토어 별점 ${SUM.stars}.`

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차150).
  title: '후기 — 먹어 본 아이들의 이야기',
  description: DESCRIPTION,
  alternates: { canonical: '/reviews' },
  openGraph: {
    title: '후기 — 먹어 본 아이들의 이야기 | 파머스테일',
    description: DESCRIPTION,
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/reviews',
    images: [{ url: REVIEWS_OG, width: 1200, height: 630, alt: '후기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '후기 — 먹어 본 아이들의 이야기 | 파머스테일',
    description: DESCRIPTION,
    images: [REVIEWS_OG],
  },
}

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** 새 창(바깥 주소) — ↗. */
function External() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  )
}

export default function ReviewsPage() {
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '후기', path: '/reviews' },
  ])
  const byRecipe = STORE_RECIPES.map((r) => ({ recipe: r, list: reviewsFor(r) }))

  return (
    <StoreShell wide>
      <JsonLd id="ld-reviews-crumbs" data={crumbLd} />
      <div style={{ lineHeight: 'normal' }}>
        {/* ── 머리말 · 제목 · 소개 ── */}
        <section className="fts-sec fts-narrow" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>후기</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
            먹어 본 아이들의
            <br />
            이야기
          </h1>
          <p style={{ margin: '16px 0 0', fontSize: 17, lineHeight: 1.65, color: '#3D3D3D' }}>
            네이버 스마트스토어와 인스타그램에 남겨 주신 후기를 옮겼어요. 스마트스토어 후기는 글도 아이디도 네이버에 보이는 그대로예요.
          </p>
        </section>

        {/* ── 별점 한 줄(옮긴 후기에서 셈) + 네이버에서 보기 ── */}
        <section className="fts-sec fts-narrow" style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <a
            href={SMARTSTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="스마트스토어에서 후기 보기(새 창)"
            style={{ padding: '16px 16px', borderRadius: 4, border: '2px solid #141414', display: 'grid', gridTemplateColumns: '1fr 18px', alignItems: 'center', columnGap: 10, color: '#141414', textDecoration: 'none' }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span className="n" style={{ fontSize: 34, lineHeight: 1 }}>
                ★ {SUM.stars}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>네이버 스마트스토어 후기 {SUM.reviews}건</span>
                <span style={{ fontSize: 14, color: '#595959' }}>{SUM.asOf} 기준 · 네이버에서 보기</span>
              </span>
            </span>
            <External />
          </a>
          <nav aria-label="레시피별 후기 바로가기" style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
            {byRecipe.map(({ recipe, list }) => (
              <a key={recipe} href={`#reviews-${recipe}`} style={{ minHeight: 48, padding: '0 12px', borderRadius: 4, border: '1px solid #BDBDBD', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 15, fontWeight: 700, color: '#141414', textDecoration: 'none' }}>
                <span className="d" style={{ fontSize: 16, fontWeight: 400 }}>
                  {RECIPE_TITLE[recipe]}
                </span>
                <span style={{ color: '#595959' }}>{list.length}편</span>
              </a>
            ))}
          </nav>
        </section>

        {/* ── 레시피마다 후기 — 인스타 동의 후기(큰 카드) → 스마트스토어 후기(한 줄 목록) ── */}
        {byRecipe.map(({ recipe, list }) => (
          <section key={recipe} id={`reviews-${recipe}`} aria-label={`${RECIPE_TITLE[recipe]} 후기`} className="fts-sec fts-narrow" style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column', gap: 12, scrollMarginTop: 64 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <RecipeName recipe={recipe} size={26} as="h2" />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#595959', whiteSpace: 'nowrap' }}>{list.length}편</span>
            </div>
            {list.length === 0 ? (
              <div style={{ padding: '18px 18px', borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong style={{ fontSize: 16 }}>아직 옮긴 후기가 없어요</strong>
                <span style={{ fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>먹여 보신 분들의 이야기가 오면 이 자리에 옮겨요.</span>
              </div>
            ) : (
              <>
                {list.filter((r) => r.source === 'instagram').map((r) => (
                  <FeaturedReview key={r.id} r={r} />
                ))}
                {list.some((r) => r.source === 'smartstore') && (
                  <div style={{ borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
                    {list.filter((r) => r.source === 'smartstore').map((r) => (
                      <SmartstoreReview key={r.id} r={r} />
                    ))}
                  </div>
                )}
              </>
            )}
            <Link href={`/store/${recipe}`} style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 16, fontWeight: 800, color: '#141414', textDecoration: 'none', borderBottom: '1px solid #E5E5E5' }}>
              이 레시피 보러 가기
              <Chevron />
            </Link>
          </section>
        ))}

        {/* ── 직접 먹여 보세요 — 체험팩(가게) · 앱 띠 ── */}
        <section className="fts-sec fts-narrow" style={{ padding: '56px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <h2 className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>
            직접 먹여 보세요
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.65, color: '#3D3D3D' }}>어떤 고기를 좋아할지 모르겠다면 네 가지를 조금씩 먼저 맛보세요.</p>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column' }}>
            <TrialCard />
          </div>
          <Link
            href="/app"
            style={{ marginTop: 12, minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, color: '#141414', textDecoration: 'none' }}
          >
            <span>
              매일 먹인다면 <strong style={{ fontWeight: 800, color: '#1D3B2F' }}>앱 정기배송 {SUBSCRIPTION_DISCOUNT_PCT}% 할인</strong>
            </span>
            <Chevron />
          </Link>
        </section>
      </div>
    </StoreShell>
  )
}
