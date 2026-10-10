import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import StoreShell from '@/components/store/StoreShell'

/**
 * /partners — 농장 파트너 소개 페이지.
 *
 * 우선 DB (`partners` 테이블, /admin/partners 에서 관리) 에서 published 행을
 * 가져오고, 비어 있거나 fetch 가 실패하면 hardcoded fallback (FALLBACK_PARTNERS)
 * 을 그대로 보여줘서 페이지가 절대 빈 채로 노출되지 않도록 한다.
 *
 * # 2026-10-10 웹 리뉴얼 — 웹 시안 WEB-C14
 * 가게 틀(StoreShell) 안에서 위에서부터: 현재 위치(홈 › 브랜드 › 농장 파트너) → 머리말·제목·소개
 *   → [공개된 농가가 있으면] 농가 목록(위 2px 먹선 · 줄마다 1px 선 — 지역 · 이름 · 재료 · 인증 · 소개)
 *     [없으면] 시안의 "이런 농가와 함께하고 싶어요" 회색 상자(지키려는 기준 셋)
 *   → 농가 제안(메일).
 * 조회 코드는 그대로다. 시안은 빈 상태만 그렸으므로 목록 모양은 같은 화면의 선·글자 크기에 맞췄다.
 * 웹 전용(예전에도 WebChrome 만 썼다 — layout 은 pass-through 그대로). 옛 설문 바닥 버튼(StickyCta → /start)은 없앴고,
 * 그 링크를 고르던 로그인 확인(getUser)도 함께 뺐다(다른 쓰임이 없었다). 예전 FD 톤 판은 git 이력.
 */
export const revalidate = 3600

// R99-A (D7): openGraph images 누락 → 공유 카드 썸네일 0 (shallow merge).
const PARTNERS_OG = ogImageUrl({
  title: '농장 파트너',
  subtitle: '재료의 출처를 농가 단위까지',
  tag: 'Partners',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차149).
  title: '농장 파트너',
  description:
    '재료의 출처를 농가 단위까지 밝히는 것을 원칙으로 삼습니다. 그 원칙에 맞는 농가를 한 곳씩 찾아가고 있어요.',
  alternates: { canonical: '/partners' },
  openGraph: {
    title: '농장 파트너 | 파머스테일',
    description:
      '재료의 출처를 농가 단위까지 추적합니다. 익명의 “수입산”은 들어가지 않아요.',
    type: 'article',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/partners',
    images: [{ url: PARTNERS_OG, width: 1200, height: 630, alt: '농장 파트너' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '농장 파트너 | 파머스테일',
    description:
      '재료의 출처를 농가 단위까지 추적합니다. 익명의 “수입산”은 들어가지 않아요.',
    images: [PARTNERS_OG],
  },
  robots: { index: true, follow: true },
}

type Partner = {
  region: string
  name: string
  ingredient: string
  body: string
  cert?: string | null
  image_url?: string | null
}

// 아직 공개할 수 있는 실제 계약 농가가 없으므로 fallback 은 비워 둔다.
// DB(partners 테이블, /admin/partners)에 실제 계약 농가가 등록되면 그 데이터가
// 목록으로 표시되고, 비어 있는 동안에는 "이런 농가와 함께하고 싶어요" 기준 상자가 노출된다.
// (실 계약·인증 확보 시 위 형태로 데이터만 채우면 자동 복원 — 회차 정리 2026-06)
const FALLBACK_PARTNERS: Partner[] = []

/** 함께할 농가를 고르는 기준(시안 C14 — 빈 상태에서만). */
const CRITERIA = [
  { t: '출처가 분명한 곳', b: '원산지를 농가 단위까지 밝힐 수 있는 곳. 익명의 ‘수입산’에 기대지 않아요.' },
  { t: '정직하게 기르는 곳', b: '기르고 키우는 과정을 그대로 보여줄 수 있는 곳. 숨길 게 없는 원료만 써요.' },
  { t: '신선하게 닿는 곳', b: '수확·도축에서 조리까지 짧게. 가까운 곳에서 빠르게.' },
] as const

/** 농가 제안 받는 메일(예전 화면과 같은 주소). */
const PARTNER_EMAIL = 'b2b@farmerstail.kr'

/** 현재 위치 줄 꺾쇠(시안 C14 — 14px, 선 2). */
function CrumbChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export default async function PartnersPage() {
  const supabase = await createClient()
  let partners: Partner[] = []
  try {
    const { data, error } = await supabase
      .from('partners')
      .select('region, name, ingredient, body, cert, image_url')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
    if (!error && data && data.length > 0) {
      partners = data as Partner[]
    }
  } catch {
    // table missing — fallback below
  }
  if (partners.length === 0) partners = FALLBACK_PARTNERS

  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '농장 파트너', path: '/partners' },
  ])

  return (
    <StoreShell>
      <JsonLd id="ld-partners-crumbs" data={crumbLd} />
      {/* 줄 높이 기본값 = 시안(normal). 여러 줄 글은 각자 값을 준다. */}
      <div style={{ lineHeight: 'normal' }}>
        {/* ── 현재 위치 ── */}
        <nav aria-label="현재 위치" style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', gap: 4, fontSize: 15, color: '#595959' }}>
          <Link href="/" style={{ height: 40, display: 'flex', alignItems: 'center', color: '#595959', textDecoration: 'none' }}>
            홈
          </Link>
          <CrumbChevron />
          <Link href="/brand" style={{ height: 40, display: 'flex', alignItems: 'center', color: '#595959', textDecoration: 'none' }}>
            브랜드
          </Link>
          <CrumbChevron />
          <span aria-current="page" style={{ fontWeight: 800, color: '#141414' }}>
            농장 파트너
          </span>
        </nav>

        {/* ── 머리말 · 제목 · 소개 ── */}
        <section style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>농장 파트너</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
            재료에는
            <br />
            이름이 있어야 해요
          </h1>
          <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            재료의 원산지를 농가 단위까지 밝히는 것을 원칙으로 삼아요. 익명의 <span style={{ whiteSpace: 'nowrap' }}>‘수입산 육류’나</span>{' '}
            <span style={{ whiteSpace: 'nowrap' }}>‘복합 곡물’에</span> 기대지 않고, 출처가 분명한 원료를 한 곳씩 찾아가고 있어요.
          </p>
        </section>

        {partners.length > 0 ? (
          /* ── 공개된 농가 목록 — DB 글은 그대로 보여 준다(고치지 않는다) ── */
          <section aria-label="함께하는 농가" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
              {partners.map((p) => (
                <li key={p.name} style={{ padding: '20px 0', borderBottom: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column' }}>
                  {p.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.image_url}
                      alt={p.name}
                      width={700}
                      height={440}
                      loading="lazy"
                      style={{ marginBottom: 16, width: '100%', aspectRatio: '350 / 220', objectFit: 'cover', borderRadius: 4, display: 'block' }}
                    />
                  )}
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>{p.region}</span>
                  <h2 className="d" style={{ margin: '6px 0 0', fontSize: 26, lineHeight: 1.2 }}>
                    {p.name}
                  </h2>
                  <span style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: '#3D3D3D' }}>{p.ingredient}</span>
                  {p.cert && (
                    <span
                      style={{ marginTop: 12, alignSelf: 'flex-start', height: 36, padding: '0 12px', borderRadius: 4, border: '1px solid #BDBDBD', boxSizing: 'border-box', display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 700 }}
                    >
                      {p.cert}
                    </span>
                  )}
                  <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }}>{p.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          /* ── 빈 상태 — 함께할 농가를 고르는 기준 ── */
          <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px 20px', borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
              <h2 className="d" style={{ margin: 0, fontSize: 26, lineHeight: 1.2 }}>
                이런 농가와
                <br />
                함께하고 싶어요
              </h2>
              <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }}>
                아직 공개할 수 있는 계약 농가는 없어요. 대신 함께할 농가를 고를 때 지키려는 기준을 먼저 약속드려요. 이 기준에 맞는 곳을 한 곳씩 찾아가고 있어요.
              </p>
              <ol style={{ margin: '18px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CRITERIA.map((c, i) => (
                  <li key={c.t} style={{ padding: 16, background: '#FFFFFF', display: 'grid', gridTemplateColumns: '32px 1fr', columnGap: 6 }}>
                    <span className="n" style={{ fontSize: 20, lineHeight: 1.3 }}>
                      {i + 1}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <strong style={{ fontSize: 18, fontWeight: 800 }}>{c.t}</strong>
                      <span style={{ fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>{c.b}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* ── 농가 제안 — 메일 ── */}
        <section style={{ padding: '48px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <h2 className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>
            농장과 함께 키우는 식탁
          </h2>
          <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }}>함께할 농가를 늘 찾고 있어요. 함께 일하고 싶은 농가는 메일로 제안해 주세요.</p>
          <a
            href={`mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent('농가 파트너 제안')}`}
            style={{ marginTop: 18, height: 58, boxSizing: 'border-box', borderRadius: 4, border: '2px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 18, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            농가 제안 보내기
          </a>
          <span style={{ marginTop: 10, alignSelf: 'center', fontSize: 15, color: '#595959' }}>{PARTNER_EMAIL}</span>
        </section>
      </div>
    </StoreShell>
  )
}
