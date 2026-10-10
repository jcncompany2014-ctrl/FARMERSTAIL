import type { Metadata } from 'next'
import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'
import JsonLd from '@/components/JsonLd'
import { ogImageUrl, buildAboutPageJsonLd, buildBreadcrumbJsonLd, SITE_URL } from '@/lib/seo/jsonld'
import { cred } from '@/lib/copy/credibility'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/store/catalog'

/**
 * /brand — 브랜드 이야기. 웹 시안 WEB-C02(2026-10-10 웹 리뉴얼) — 가게 틀(StoreShell) 안에서 위에서부터:
 *   머리말·제목·소개 → 차례 5칸 → 주방 사진 → 01 시작(인용) → 02 약속(4줄 + 숫자 카드) → 03 주방 → 04 농장(회색 띠) → 05 앞으로(버튼).
 * 웹 전용(메뉴 '브랜드 이야기'에서 온다). 옛 설문 버튼(/start)은 가게(/store)·앱 띠로 바뀌었다.
 * ★문구는 시안(사실 확인을 거쳐 줄인 판)대로 — 옛 화면의 "72°C"·"24시간 내 손질"·"강원 평창 한우 농가, 제주 구좌 당근"·
 *   "패키지에 농가를 적는다" 같은 확인 안 된 주장은 되살리지 않는다. 남은 숫자(100%·7일·0·3일)는 사장님 확인 목록 #65 ⑧⑨.
 */
export const revalidate = 3600

const BRAND_OG = ogImageUrl({
  title: '농장에서 꼬리까지',
  subtitle: '사람이 먹는 등급의 재료로, 만드는 방식까지',
  tag: 'Brand',
})

export const metadata: Metadata = {
  // metadata.title 은 layout 의 template "%s | 파머스테일" 가 브랜드명을 붙이므로
  // 페이지명만 둔다(중복 '| 파머스테일' 방지, 회차146). OG/twitter 는 template
  // 미적용이라 풀네임 유지. (/about 과 title 중복도 해소 — 가시 H1 '농장에서 꼬리까지' 정합.)
  title: '농장에서 꼬리까지',
  description: '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
  alternates: { canonical: '/brand' },
  openGraph: {
    type: 'article',
    title: '농장에서 꼬리까지 | 파머스테일',
    description: '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/brand',
    images: [{ url: BRAND_OG, width: 1200, height: 630, alt: '농장에서 꼬리까지' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '농장에서 꼬리까지 | 파머스테일',
    description: '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
    images: [BRAND_OG],
  },
  robots: { index: true, follow: true },
}

const CHAPTERS = [
  { id: 'origin', no: '01', label: '시작' },
  { id: 'pledge', no: '02', label: '약속' },
  { id: 'kitchen', no: '03', label: '주방' },
  { id: 'farm', no: '04', label: '농장' },
  { id: 'next', no: '05', label: '앞으로' },
] as const

const PILLARS = [
  // 원료: 아직 검증된 계약 농가가 없어 구체 수치('30여 곳')는 뺀다(감사 #55 · 사장님 2026-07-22). 원칙(출처 추적)은 사실.
  { k: '원료', t: '국내 농가에서, 직접', d: '출처가 분명한 원료를 원칙으로, 국내 농가와 직접 계약을 넓혀 가고 있어요. 원산지가 분명한 원물만 써요.' },
  // 레시피: 실 자문 없을 땐 '수의영양학 기준'으로 톤다운(lib/copy/credibility 스위치).
  { k: '레시피', t: cred.brandRecipeTitle, d: cred.brandRecipeBody },
  { k: '조리', t: '수비드 저온 조리', d: '정해진 저온에서 천천히 익혀 영양 손실을 줄이고, 익힌 뒤 바로 얼려 풍미를 지켜요.' },
  { k: '돌봄', t: '식단 그 이후까지', d: '앱에서 식사·체중·산책을 기록하고 식단 노트를 받아요. 사고 끝나는 게 아니라 같이 사는 동안 옆에 있을게요.' },
] as const

/** 숫자 카드 — 단위가 있으면 포스터 글꼴로 작게 붙인다(시안). */
const STATS = [
  { n: '100', unit: '%', label: '사람 등급 재료' },
  { n: '7', unit: '일', label: '주 1회 소량 생산' },
  { n: '0', unit: '', label: '인공 보존료 · 향료' },
  // 주말 조리 → 화요일 출고(토요일 조리분은 3일).
  { n: '3', unit: '일', label: '조리에서 출고까지' },
] as const

const P: React.CSSProperties = { margin: '14px 0 0', fontSize: 17, lineHeight: 1.75, color: '#3D3D3D' }
const P2: React.CSSProperties = { ...P, marginTop: 12 }

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** 검은 큰 버튼의 화살표(→) — 시안의 주 버튼. 줄 링크는 꺾쇠(Chevron). */
function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

/** 장 머리 — 번호(Anton) + 이름 + 제목. */
function ChapterHead({ no, label, children }: { no: string; label: string; children: React.ReactNode }) {
  return (
    <>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="n" style={{ fontSize: 18 }}>
          {no}
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>{label}</span>
      </span>
      <h2 className="d" style={{ margin: '6px 0 0', fontSize: 30, lineHeight: 1.12 }}>
        {children}
      </h2>
    </>
  )
}

export default async function BrandPage() {
  const aboutLd = buildAboutPageJsonLd({
    name: '브랜드 이야기 — 파머스테일',
    description: '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
    url: `${SITE_URL}/brand`,
  })
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '브랜드', path: '/brand' },
  ])

  return (
    <StoreShell>
      <JsonLd id="ld-brand-about" data={aboutLd} />
      <JsonLd id="ld-brand-crumbs" data={crumbLd} />
      {/* 줄 높이 기본값 = 시안(normal). 여러 줄 글은 각자 값을 준다. */}
      <div style={{ lineHeight: 'normal' }}>
        <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>브랜드 이야기</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
            농장에서
            <br />
            꼬리까지
          </h1>
          <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            파머스테일은 한 마리의 늙은 보더콜리에게서 시작됐어요. 잘 안 먹는 아이를 위해 매일 부엌에서 정성을 들이던 보호자의 습관을, 우리는 표준으로 옮기려 해요.{' '}
            <strong style={{ fontWeight: 800, color: '#141414' }}>사람이 먹어도 되는 재료로, 사람의 식탁과 같은 기준으로.</strong>
          </p>
          <nav
            aria-label="이야기 차례"
            style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', borderTop: '2px solid #141414', borderBottom: '1px solid #E5E5E5' }}
          >
            {CHAPTERS.map((c, i) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                style={{
                  height: 64,
                  borderLeft: i > 0 ? '1px solid #E5E5E5' : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  color: '#141414',
                  textDecoration: 'none',
                }}
              >
                <span className="n" style={{ fontSize: 16 }}>
                  {c.no}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{c.label}</span>
              </a>
            ))}
          </nav>
        </section>

        {/* ★farm-to-kitchen.jpg 는 가짜 타사 브랜드 포대가 박힌 AI 사진이었다(2026-09-02 실사 검수) — 실촬영 주방 컷. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/kitchen-sousvide.jpg"
          alt="진공 포장한 고기를 수비드 기계로 익히는 파머스테일 주방"
          width={1200}
          height={800}
          fetchPriority="high"
          style={{ marginTop: 24, width: '100%', aspectRatio: '390 / 220', objectFit: 'cover', display: 'block' }}
        />

        <section id="origin" style={{ padding: '52px 20px 0', display: 'flex', flexDirection: 'column', scrollMarginTop: 64 }}>
          <ChapterHead no="01" label="시작">
            한 마리 강아지에게서
            <br />
            시작됐어요
          </ChapterHead>
          <p style={P}>
            열세 살 보더콜리 ‘보리’의 만성 소화 문제로 사료에서 화식으로 식단을 바꾸던 어느 새벽, 부엌에 도마가 일곱 개였어요. 단백질·탄수화물·지방·섬유까지 손으로 맞춰 가며
            끓이고 데치고 식히는 사이, 한 가지가 분명해졌어요.
          </p>
          <p style={P2}>
            반려견 식품 가운데 사람이 먹는 등급의 재료로 만드는 건 손에 꼽았어요. 그래서 직접 만들기로 했어요. 우리 아이에게 줄 수 있어야 다른 아이에게도 줄 수 있다. 그게
            첫 규칙이었어요.
          </p>
          <blockquote style={{ margin: '28px 0 0', padding: '4px 0 4px 18px', borderLeft: '4px solid #141414', fontSize: 24, fontWeight: 900, lineHeight: 1.4, letterSpacing: '-0.03em' }}>
            “사람이 먹는 등급의 재료로 만드는 한 끼, 그게 우리의 시작이었어요.”
          </blockquote>
        </section>

        <section id="pledge" style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column', scrollMarginTop: 64 }}>
          <ChapterHead no="02" label="약속">
            네 가지는
            <br />
            타협하지 않아요
          </ChapterHead>
          <dl style={{ margin: '18px 0 0', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {PILLARS.map((p) => (
              <div key={p.k} style={{ padding: '16px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '64px 1fr', columnGap: 8, alignItems: 'baseline' }}>
                <dt style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>{p.k}</dt>
                <dd style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ fontSize: 19, fontWeight: 800 }}>{p.t}</strong>
                  <span style={{ fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>{p.d}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div style={{ marginTop: 32, border: '2px solid #141414', boxShadow: '4px 4px 0 #141414', borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
            <span style={{ padding: '16px 16px 0', fontSize: 15, fontWeight: 800, color: '#595959' }}>숫자로 보는 우리의 기준</span>
            <div style={{ padding: '10px 0 4px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {STATS.map((s, i) => (
                <span
                  key={s.label}
                  style={{
                    padding: '12px 16px',
                    borderTop: i >= 2 ? '1px solid #E5E5E5' : undefined,
                    borderLeft: i % 2 === 1 ? '1px solid #E5E5E5' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                    <span className="n" style={{ fontSize: 40, lineHeight: 1 }}>
                      {s.n}
                    </span>
                    {s.unit && (
                      <span className="d" style={{ fontSize: 22 }}>
                        {s.unit}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#3D3D3D' }}>{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="kitchen" style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column', scrollMarginTop: 64 }}>
          <ChapterHead no="03" label="주방">
            작업장에도
            <br />
            사람의 부엌과 같은 규칙을
          </ChapterHead>
          <p style={P}>위생을 철저히 관리하는 작업장에서 원료를 손질하고, 수비드 저온으로 익힌 뒤 바로 얼려요. 이 흐름이 영양 손실을 가장 적게 두는 구간이에요.</p>
          <p style={P2}>주 단위로 조금씩 만들어, 무리하게 양을 쌓아 두지 않아요.</p>
        </section>

        <section id="farm" style={{ marginTop: 56, padding: '44px 20px', background: '#F6F4F5', display: 'flex', flexDirection: 'column', scrollMarginTop: 64 }}>
          <ChapterHead no="04" label="농장">
            이름 있는 재료
            <br />
            이름 있는 농가
          </ChapterHead>
          <p style={P}>‘수입산 육류’ 같은 익명 표기를 쓰지 않아요. 원산지가 분명한 국내산 원물을 써요.</p>
          <p style={P2}>
            재료 가격이 지나치게 흔들릴 때는 시세를 따라가는 대신 메뉴를 잠시 빼요. 좋은 재료가 들어가지 않으면 만들지 않는다. 가장 단순한 규칙이에요.
          </p>
        </section>

        <section id="next" style={{ padding: '56px 20px 64px', display: 'flex', flexDirection: 'column', scrollMarginTop: 64 }}>
          <ChapterHead no="05" label="앞으로">
            식단 그 다음의 그릇
          </ChapterHead>
          <p style={P}>
            영양 기록, 돌봄 기록, 식단 노트. 식단이 지나간 자리에 무엇이 남는지를 기록으로 남기려 해요. 알레르기를 살피는 라인과 노령견을 위한 라인도 차례로 준비할 예정이에요.
          </p>
          <Link
            href="/store"
            style={{ marginTop: 24, height: 60, borderRadius: 4, background: '#141414', color: '#FFFFFF', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 19, fontWeight: 800 }}
          >
            레시피 고르기
            <Arrow />
          </Link>
          <Link
            href="/our-food"
            style={{ marginTop: 10, height: 58, boxSizing: 'border-box', borderRadius: 4, border: '2px solid #141414', color: '#141414', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}
          >
            우리 음식 보기
          </Link>
          <Link
            href="/app"
            style={{ marginTop: 16, minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, color: '#141414', textDecoration: 'none' }}
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
