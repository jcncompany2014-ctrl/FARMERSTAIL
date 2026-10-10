import type { Metadata } from 'next'
import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'
import ShipLine from '@/components/store/ShipLine'
import RecipeGrid from '@/components/store/RecipeGrid'
import HomeCalculator from '@/components/store/HomeCalculator'
import StoreFaq from '@/components/store/StoreFaq'
import { ogImageUrl } from '@/lib/seo/jsonld'
import { RECIPE_BAND, STORE_RECIPES, TRIAL_ITEM, storeItem } from '@/lib/store/catalog'
import { FREE_SHIPPING_MIN, SHIPPING_FEE } from '@/lib/store/shipping'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'

/**
 * 홈 — 웹 리뉴얼(2026-10-10, 사장님 "웹 = 단품 가게"·"시안 숫자 그대로"). 웹 시안 Main 그대로:
 * 셸티 첫 화면("이거 제 밥 맞죠?!") → 레시피 4종(가격·담기) → 체험팩 → 앱 정기배송 한 줄 → 500g 며칠분 계산기 →
 * 손질부터 배송까지 → 자주 묻는 질문 → 법정 바닥.
 * 예전 홈(설문 퍼널 — 모든 버튼이 /start)은 git 이력에 있다. 웹 설문·웹 정기배송 신청은 앱으로 옮겼다(기획서 D1·D2).
 * 출고일은 브라우저 시계로(ShipLine) — 이 화면은 캐시해 두므로 서버에서 날짜를 박지 않는다.
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
  alternates: { canonical: '/' },
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

function Chevron({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export default function HomePage() {
  return (
    <StoreShell>
      {/* 첫 화면 — 셸티 사진 + 손글씨 말풍선(홈 한 곳만) + 흰 카드 */}
      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative', height: 560, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/store/hero-sheltie-table.webp"
            alt="식탁 앞 의자에 앉아 화식 그릇을 기다리는 셸티"
            width={1200}
            height={800}
            fetchPriority="high"
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
        <div style={{ position: 'relative', zIndex: 2, marginTop: -40, background: '#FFFFFF', borderRadius: '12px 12px 0 0', padding: '26px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <h1 className="d" style={{ margin: 0, fontSize: 40, lineHeight: 1.1 }}>
            국내산 고기를
            <br />
            수비드로 익혔어요
          </h1>
          <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.55, color: '#3D3D3D' }}>사료에 곁들여도, 한 끼로 줘도 돼요.</p>
          <Link
            href="/store"
            style={{ marginTop: 20, height: 60, borderRadius: 4, background: '#141414', color: '#FFFFFF', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 19, fontWeight: 800 }}
          >
            레시피 고르기
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <ShipLine />
        </div>
      </section>

      {/* 레시피 4종 */}
      <section id="recipes" style={{ padding: '64px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 className="d" style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>
          레시피 4종
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 17, color: '#595959' }}>모두 100g 팩 5개, 500g 한 봉이에요</p>
        <div style={{ marginTop: 20 }}>
          <RecipeGrid />
        </div>

        <Link
          href="/store?tab=trial"
          style={{ marginTop: 28, border: '2px solid #141414', borderRadius: 4, overflow: 'hidden', color: '#141414', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
        >
          <span aria-hidden style={{ height: 10, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {STORE_RECIPES.map((r) => (
              <span key={r} style={{ background: RECIPE_BAND[r] }} />
            ))}
          </span>
          <span style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>처음이라면</span>
              <span className="d" style={{ fontSize: 24, lineHeight: 1.1 }}>
                {TRIAL_ITEM.name}
              </span>
              <span style={{ fontSize: 15, color: '#3D3D3D' }}>4종 100g씩 맛보기</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
              <span className="n" style={{ fontSize: 28 }}>
                {won(TRIAL_ITEM.price)}
              </span>
              <span className="d" style={{ fontSize: 17 }}>
                원
              </span>
            </span>
          </span>
        </Link>

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

      {/* 500g 며칠분 */}
      <section style={{ marginTop: 64, padding: '48px 20px 44px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
        <h2 className="d" style={{ margin: 0, fontSize: 32, lineHeight: 1.12 }}>
          500g 한 봉,
          <br />
          며칠 먹을까요?
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 17, color: '#595959' }}>닭고기를 건사료에 곁들여 줄 때 기준이에요</p>
        <HomeCalculator />
      </section>

      {/* 손질부터 배송까지 */}
      <section style={{ padding: '64px 20px 0', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
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

      <StoreFaq items={FAQ} />
    </StoreShell>
  )
}
