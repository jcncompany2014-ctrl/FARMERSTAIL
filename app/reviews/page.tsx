import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import StoreShell from '@/components/store/StoreShell'
import JsonLd from '@/components/JsonLd'
import { buildBreadcrumbJsonLd, ogImageUrl } from '@/lib/seo/jsonld'
import { SMARTSTORE_URL } from '@/lib/links'
import { PACK_G, RECIPE_BAND, STORE_RECIPES, SUBSCRIPTION_DISCOUNT_PCT, TRIAL_ITEM } from '@/lib/store/catalog'

/**
 * 웹 후기 — /reviews. 웹 시안 WEB-C07(2026-10-10 웹 리뉴얼) — 가게 틀(StoreShell) 안에서 위에서부터:
 *   머리말·제목·소개 → 첫 후기를 기다려요(회색 상자 · 빈 평점 동그라미) + 후기 원칙 세 줄
 *   → 네이버에서 남겨 주신 후기(스마트스토어, 새 창) → 직접 먹여 보세요(4종 체험팩 카드 · 앱 띠).
 * ⚠️ 정직 원칙: 가짜 후기·평점·숫자·보증 절대 금지(규칙 28). 후기가 없으면 빈 상태만 보여 준다.
 * 옛 FD 판의 자리표시 카드·필터 탭·전문가 보증 자리·숫자 띠와 설문 버튼(/start)은 시안대로 뺐다 — 설문 링크를 고르던
 * 로그인 확인(getUser)도 함께 뺐다. 예전 FD 톤 판은 git 이력.
 * ⚠️ '후기 원칙 세 줄'(구매하신 분만·주문 한 건에 하나·사진과 별점)은 기획서 §7 의 **새로 만들 구매자 후기**(2단계) 기준이다 —
 *   고객이 후기를 쓰는 기능은 2026-07-16 에 폐기됐고(마이그 20260716070000) 아직 새로 만들지 않았다. 이 화면을 다시 열 때 그 기능이
 *   실제로 있는지 먼저 확인한다.
 */

export const revalidate = 3600

// R99-A 패턴: Next openGraph shallow-merge 라 페이지가 images 미지정 시 layout
// 기본 OG 상속 못 함 → 공유 카드 썸네일 0. 명시 OG 추가(회차161).
const REVIEWS_OG = ogImageUrl({
  title: '보호자들의 진짜 이야기',
  subtitle: '지어낸 후기 없이, 실제 경험만',
  tag: 'Reviews',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차150).
  title: '후기 — 보호자들의 진짜 이야기',
  description:
    '파머스테일을 먹은 아이와 보호자의 실제 후기가 이 자리에 모입니다. 지어낸 후기 대신 진짜 경험만. 직접 먹여 보고 확인해 보세요.',
  alternates: { canonical: '/reviews' },
  openGraph: {
    title: '후기 — 보호자들의 진짜 이야기 | 파머스테일',
    description:
      '파머스테일을 먹은 아이와 보호자의 실제 후기가 이 자리에 모입니다. 지어낸 후기 대신 진짜 경험만.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/reviews',
    images: [{ url: REVIEWS_OG, width: 1200, height: 630, alt: '후기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '후기 — 보호자들의 진짜 이야기 | 파머스테일',
    description: '지어낸 후기 대신 진짜 경험만.',
    images: [REVIEWS_OG],
  },
}

const won = (n: number) => n.toLocaleString('ko-KR')

/** 후기 원칙(시안 C07) — 체크 세 줄. */
const REVIEW_RULES = ['구매하신 분만, 주문 한 건에 하나씩', '사진과 별점을 함께 남길 수 있어요', '받은 그대로, 고치지 않고 올려요'] as const

/** 체험팩 4색 띠(시안 C07) — 레시피 띠 색. 흑돼지 먹색은 얇은 띠에선 너무 무거워 회색(앱 RECIPE_CHIP 과 같은 규칙). */
const TRIAL_BAND = STORE_RECIPES.map((r) => (r === 'pork' ? '#9AA0A6' : RECIPE_BAND[r]))

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

export default async function ReviewsPage() {
  // ★2026-09-05 사장님: 실제 제품 후기가 쌓이기 전까지 후기 페이지 숨김.
  //   페이지 코드는 보존(빈 상태만 그려 삭제할 이유 없음) — 후기가
  //   모이면 이 redirect 한 줄과 sitemap 의 링크 주석을 함께 되살린다
  //   (예전 WebChrome·FdFooter 의 링크 주석은 새 웹 틀(StoreShell) 로 바뀌었으니 가게 메뉴에 줄을 새로 단다).
  //   북마크·외부 링크는 홈으로 안내.
  //
  // ⚠️ 여기는 **307(`redirect`)이 정답**이다 — 되살릴 페이지이므로.
  //   폐지된 낱개커머스 경로들은 2026-09-08 에 308(`permanentRedirect`)로
  //   바꿨지만(검색 색인 이전 목적), 임시 숨김에 308 을 쓰면 브라우저가
  //   영구 캐시해서 부활시켜도 방문자가 계속 홈으로 튕긴다.
  redirect('/')

  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '후기', path: '/reviews' },
  ])

  return (
    <StoreShell>
      <JsonLd id="ld-reviews-crumbs" data={crumbLd} />
      {/* 줄 높이 기본값 = 시안(normal). 여러 줄 글은 각자 값을 준다. */}
      <div style={{ lineHeight: 'normal' }}>
        {/* ── 머리말 · 제목 · 소개 ── */}
        <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>후기</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
            보호자들의
            <br />
            진짜 이야기
          </h1>
          <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>지어낸 후기는 한 줄도 싣지 않아요. 구매하신 분이 남긴 후기만, 받은 그대로 올려요.</p>
        </section>

        {/* ── 첫 후기를 기다려요 — 빈 상태(채운 별 = 평점 암시 금지, 빈 동그라미만) + 후기 원칙 ── */}
        <section style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '28px 20px 24px', borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
            <span aria-hidden style={{ width: 64, height: 64, borderRadius: 32, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5h14v10H9l-4 4z" />
                <path d="M9 9.5h6M9 12h4" />
              </svg>
            </span>
            <strong className="d" style={{ fontSize: 26, fontWeight: 400, lineHeight: 1.2 }}>
              첫 후기를 기다려요
            </strong>
            <span style={{ fontSize: 17, lineHeight: 1.6, color: '#3D3D3D' }}>
              아직 등록된 후기가 없어요.
              <br />
              먹어 본 아이의 이야기가 이 자리에 차례로 올라와요.
            </span>
            <span style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: '#595959' }}>
              <span aria-hidden style={{ display: 'flex', gap: 3 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} style={{ width: 12, height: 12, boxSizing: 'content-box', borderRadius: 6, border: '1.5px solid #BDBDBD' }} />
                ))}
              </span>
              평점은 후기가 쌓이면 보여드려요
            </span>
          </div>
          <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {REVIEW_RULES.map((t) => (
              <li key={t} style={{ minHeight: 60, borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '30px 1fr', alignItems: 'center', fontSize: 17, fontWeight: 700 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* ── 네이버에서 남겨 주신 후기 — 스마트스토어(바깥 주소, 새 창) ── */}
        <section style={{ padding: '52px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <h2 className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>
            네이버에서 남겨 주신 후기
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.65, color: '#3D3D3D' }}>스마트스토어에서 사신 분들의 후기는 네이버에서 그대로 볼 수 있어요.</p>
          <a
            href={SMARTSTORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="스마트스토어 후기 보기(새 창)"
            style={{ marginTop: 16, minHeight: 64, padding: '0 16px', borderRadius: 4, border: '2px solid #141414', display: 'grid', gridTemplateColumns: '1fr 18px', alignItems: 'center', color: '#141414', textDecoration: 'none' }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 17, fontWeight: 800 }}>스마트스토어 후기 보기</span>
              <span style={{ fontSize: 15, color: '#595959' }}>네이버로 이동해요</span>
            </span>
            <External />
          </a>
        </section>

        {/* ── 직접 먹여 보세요 — 체험팩(가게) · 앱 띠 ── */}
        <section style={{ padding: '52px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <h2 className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>
            직접 먹여 보세요
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.65, color: '#3D3D3D' }}>남의 후기보다 우리 아이의 한 끼가 가장 정확한 후기예요.</p>
          <Link
            href="/store?tab=trial"
            style={{ marginTop: 18, border: '2px solid #141414', borderRadius: 4, overflow: 'hidden', color: '#141414', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
          >
            {/* 4종 색 띠(장식) — 닭·오리·흑돼지·한우 순서. */}
            <span aria-hidden style={{ height: 10, display: 'grid', gridTemplateColumns: `repeat(${TRIAL_BAND.length}, minmax(0, 1fr))` }}>
              {TRIAL_BAND.map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </span>
            <span style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>처음이라면</span>
                <span className="d" style={{ fontSize: 24, lineHeight: 1.1 }}>
                  {TRIAL_ITEM.name}
                </span>
                <span style={{ fontSize: 15, color: '#3D3D3D' }}>
                  {STORE_RECIPES.length}종 {PACK_G}g씩 맛보기
                </span>
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
      </div>
    </StoreShell>
  )
}
