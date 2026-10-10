import type { Metadata } from 'next'
import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'
import JsonLd from '@/components/JsonLd'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import { STORE_RECIPES, SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/store/catalog'

/**
 * /about — 우리 이야기. 웹 시안 WEB-C06(2026-10-10 웹 리뉴얼) — 가게 틀(StoreShell) 안에서 위에서부터:
 *   머리말·제목·소개(2026 인천 송도) → 01 시작(눈밭 셸티) → 02 재료(기준 4줄) → 03 영양(회색 띠 + 교차검증표 줄)
 *   → 04 주방(만드는 순서 5줄) → 05 분석(앱에서) → 06 약속(회색 띠, 하지 않는 것 4줄) → 함께하는 보호자들(모으는 중)
 *   → 마무리(레시피 고르기 · 우리 음식 보기 · 앱 띠).
 * 웹 전용(예전에도 WebChrome 만 썼다). 옛 설문 버튼(/start)은 가게(/store)로 — 설문 링크를 고르던 로그인 확인(getUser)도
 * 함께 뺐다(다른 쓰임이 없었다). 예전 FD 톤 판은 git 이력.
 * ★문구는 시안(사실 확인을 거쳐 줄인 판)대로 — 옛 화면의 AAFCO·WSAVA 약어, "BHA·BHT·에톡시퀸", "저온 동결건조",
 *   "2주마다 냉동 배송", "첫 박스부터 부담 없이" 같은 구독 안내는 되살리지 않는다.
 * 교차검증표 줄은 시안이 꺾쇠(안쪽 링크)라 표 미리보기·원문 PDF 가 있는 /science 로 보낸다.
 */
export const revalidate = 3600

const ABOUT_OG = ogImageUrl({
  title: '브랜드 이야기',
  subtitle: '농장에서 꼬리까지, 사람이 먹는 등급의 재료로',
  tag: 'About',
  variant: 'editorial',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명을 1회 붙이므로 페이지명만
  // (중복 '| 파머스테일' 방지, 회차147). OG/twitter 는 template 미적용=풀네임 유지.
  title: '브랜드 이야기',
  description:
    '수의영양학 기반의 프리미엄 반려견 식단. 농장에서 꼬리까지, 사람이 먹는 등급의 재료로. 파머스테일이 어떻게 시작되었고 무엇을 약속하는지.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: '브랜드 이야기 | 파머스테일',
    description:
      '수의영양학 기반의 프리미엄 반려견 식단. 농장에서 꼬리까지, 사람이 먹는 등급의 재료로.',
    type: 'article',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/about',
    images: [{ url: ABOUT_OG, width: 1200, height: 630, alt: '브랜드 이야기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '브랜드 이야기 | 파머스테일',
    description:
      '수의영양학 기반의 프리미엄 반려견 식단. 농장에서 꼬리까지, 사람이 먹는 등급의 재료로.',
    images: [ABOUT_OG],
  },
  robots: { index: true, follow: true },
}

// 실제 계약 농가·인증 확보 전까지는 구체 출처 대신 "원료를 고르는 기준"을 표기.
// (실 계약 시 '재료 → 농가·등급' 형태로 복원 — partners 페이지와 동일 정책, 2026-06)
const SOURCING = [
  { k: '육류', v: '사람이 먹는 등급을 기준으로' },
  { k: '생선', v: '출처를 밝힐 수 있는 것만' },
  { k: '채소', v: '제철 · 신선한 것 먼저' },
  { k: '곡물', v: '정제보다 통곡물' },
] as const

/** 만드는 순서(시안 C06) — 실제 순서라 번호가 정보다. */
const STEPS = [
  '원료 입고 · 출처 기록',
  '저온 세척 · 영양 기준에 맞춰 계량',
  '수비드 저온 조리',
  '급속 냉동 · 포장 · 품질 검사',
  '얼린 채로 보냉 상자에 담아 배송',
] as const

const PROMISES = [
  { t: '익명 원료', b: '수입산 육류, 복합 곡물, 출처를 모르는 부산물은 쓰지 않아요.' },
  { t: '인공 보존료', b: '인공 산화방지제를 넣지 않아요.' },
  { t: '과장 광고', b: '“모든 질병에 효과” 같은 말을 쓰지 않아요. 우리는 식단을 만들어요.' },
  { t: '값싼 부재료', b: '밀 글루텐, 값싼 콩 단백, 설탕류로 단가를 맞추지 않아요.' },
] as const

const P: React.CSSProperties = { margin: '14px 0 0', fontSize: 17, lineHeight: 1.75, color: '#3D3D3D' }

function Chevron({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

/** 장 머리 — 번호(Anton) + 이름 + 제목(시안 C06). */
function ChapterHead({ no, label, top, children }: { no: string; label: string; top?: number; children: React.ReactNode }) {
  return (
    <>
      <span style={{ marginTop: top, display: 'flex', alignItems: 'baseline', gap: 8 }}>
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

export default async function AboutPage() {
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '브랜드 이야기', path: '/about' },
  ])

  return (
    <StoreShell>
      <JsonLd id="ld-about-crumbs" data={crumbLd} />
      {/* 줄 높이 기본값 = 시안(normal). 여러 줄 글은 각자 값을 준다. */}
      <div style={{ lineHeight: 'normal' }}>
        {/* ── 머리말 · 제목 · 소개 ── */}
        <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>우리 이야기</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
            사람이 먹는 등급으로
            <br />
            농장에서 꼬리까지
          </h1>
          <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            파머스테일은 “내 강아지한테 먹일 수 있는 것만 만든다”는 원칙에서 시작했어요. 원료의 출처, 조리 방식, 포장까지 반려견의 식탁을 사람의 식탁과 같은 기준으로 다뤄요.
          </p>
          <span style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#595959' }}>
            <span className="n" style={{ fontSize: 16, color: '#141414' }}>
              2026
            </span>
            인천 송도에서 시작했어요
          </span>
        </section>

        {/* ── 01 시작 — 2026-09-05 사장님: 눈밭의 셸티 실사('한 마리 개에게서 시작된 브랜드' 옆엔 그 개의 얼굴) ── */}
        <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sheltie-snow-45.jpg"
            alt="눈밭에서 눈을 뒤집어쓴 셰틀랜드 시프도그"
            width={1000}
            height={1250}
            fetchPriority="high"
            style={{ width: '100%', aspectRatio: '350 / 320', objectFit: 'cover', objectPosition: '50% 35%', borderRadius: 4, display: 'block' }}
          />
          <ChapterHead no="01" label="시작" top={24}>
            한 마리 개에게서
            <br />
            시작된 브랜드
          </ChapterHead>
          <p style={P}>
            열세 살 노견 ‘보리’의 만성 소화 문제로 사료 대신 직접 만든 화식을 먹이기 시작했어요. 수의사와 이야기하고, 영양을 계산하고, 재료를 구하는 일을 되풀이하며 알게 된 건
            하나였어요. <strong style={{ fontWeight: 800, color: '#141414' }}>대부분의 반려견 식단은 ‘사람 음식 등급’으로 만들어지지 않는다는 것.</strong>
          </p>
          <p style={{ ...P, marginTop: 12 }}>
            파머스테일은 그때 세운 규칙을 그대로 따라요. 사람이 먹을 수 있는 원료만 쓰고, 출처를 끝까지 확인하고, 익힌 뒤 바로 얼려 영양을 붙잡아요.
          </p>
        </section>

        {/* ── 02 재료 — 원료를 고르는 기준 4줄 ── */}
        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <ChapterHead no="02" label="재료">
            재료는 이름이
            <br />
            있어야 해요
          </ChapterHead>
          <p style={P}>
            원산지를 농장 단위까지 밝히는 것을 원칙으로 삼아요. 익명의 ‘수입산 육류’나 ‘복합 곡물’에 기대지 않고, 출처가 분명한 원료를 한 곳씩 찾아가고 있어요.
          </p>
          <dl style={{ margin: '16px 0 0', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {SOURCING.map((row) => (
              <div key={row.k} style={{ minHeight: 56, borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <dt className="d" style={{ fontSize: 19 }}>
                  {row.k}
                </dt>
                <dd style={{ margin: 0, fontSize: 16, color: '#3D3D3D' }}>{row.v}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── 03 영양 — 회색 띠 + 교차검증표(표 미리보기·원문 PDF 는 /science) ── */}
        <section style={{ marginTop: 56, padding: '44px 20px 40px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
          <ChapterHead no="03" label="영양">
            수의영양학으로
            <br />
            만든 레시피
          </ChapterHead>
          <p style={P}>
            모든 레시피는 공개된 개 영양 기준과 수의 단체의 품질 가이드를 기준으로 설계해요. ‘맛있어 보이는 음식’이 아니라 ‘영양이 맞는 식단’을 만드는 곳이에요.
          </p>
          <Link
            href="/science#evidence"
            style={{ marginTop: 18, padding: 16, borderRadius: 4, background: '#FFFFFF', display: 'grid', gridTemplateColumns: '44px 1fr 18px', columnGap: 12, alignItems: 'center', color: '#141414', textDecoration: 'none' }}
          >
            <span aria-hidden style={{ width: 44, height: 54, boxSizing: 'border-box', border: '1.5px solid #141414', padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ height: 4, background: '#141414' }} />
              <span style={{ height: 3, background: '#CFCFCF' }} />
              <span style={{ height: 3, background: '#CFCFCF' }} />
              <span style={{ height: 3, background: '#CFCFCF' }} />
              <span style={{ height: 3, background: '#CFCFCF' }} />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong style={{ fontSize: 17, fontWeight: 800 }}>영양 교차검증표</strong>
              <span style={{ fontSize: 15, color: '#595959' }}>레시피 {STORE_RECIPES.length}종을 기준과 항목별로 대조했어요</span>
            </span>
            <Chevron />
          </Link>
        </section>

        {/* ── 04 주방 — 만드는 순서 ── */}
        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <ChapterHead no="04" label="주방">
            조금씩 정성껏
          </ChapterHead>
          <p style={P}>
            위생을 철저히 관리하는 주방에서 주 단위로 조금씩 조리해요. 완성된 식단은 바로 얼려 영양을 붙잡고, 빛과 공기를 막는 포장으로 보내드려요.
          </p>
          <ol style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {STEPS.map((s, i) => (
              <li key={s} style={{ minHeight: 56, borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '40px 1fr', alignItems: 'center', fontSize: 17, fontWeight: 700 }}>
                <span className="n" style={{ fontSize: 18 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <Link
            href="/why-fresh"
            style={{ marginTop: 6, alignSelf: 'flex-start', height: 48, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 700, color: '#141414', textDecoration: 'underline' }}
          >
            왜 화식인지 더 알아보기
            <Chevron size={15} />
          </Link>
        </section>

        {/* ── 05 분석 — 분석은 앱에서(웹엔 분석 화면이 없다) ── */}
        <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/store/sheltie-face.webp"
            alt="웃고 있는 셰틀랜드 시프도그"
            width={480}
            height={480}
            loading="lazy"
            style={{ width: '100%', aspectRatio: '350 / 250', objectFit: 'cover', objectPosition: '50% 30%', borderRadius: 4, display: 'block' }}
          />
          <ChapterHead no="05" label="분석" top={24}>
            내 강아지만을 위한 분석
          </ChapterHead>
          <p style={P}>견종·체중·활동량·못 먹는 음식을 반영해 권장 식단과 하루 양을 계산해요. 결과와 근거를 함께 보여드려, 주치의와 상의할 때도 쓸 수 있어요.</p>
          <span style={{ marginTop: 10, fontSize: 15, fontWeight: 700, color: '#1D3B2F' }}>분석은 파머스테일 앱에서 해요</span>
        </section>

        {/* ── 06 약속 — 회색 띠, 하지 않는 것 ── */}
        <section style={{ marginTop: 56, padding: '44px 20px 40px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
          <ChapterHead no="06" label="약속">
            파머스테일이
            <br />
            하지 않는 것
          </ChapterHead>
          <dl style={{ margin: '16px 0 0', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {PROMISES.map((row) => (
              <div key={row.t} style={{ padding: '14px 0', borderBottom: '1px solid #D9D9D9', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <dt style={{ fontSize: 18, fontWeight: 800 }}>{row.t}</dt>
                <dd style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>{row.b}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── 함께하는 보호자들 — 실제 후기가 모이기 전까지는 지어낸 카드 없이 상태만(규칙 28) ── */}
        <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <h2 className="d" style={{ margin: '0 0 14px', fontSize: 30, lineHeight: 1.12 }}>
            함께하는 보호자들
          </h2>
          <div style={{ padding: 20, borderRadius: 4, border: '2px solid #141414', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong style={{ fontSize: 18, fontWeight: 800 }}>첫 후기를 모으는 중이에요</strong>
            <span style={{ fontSize: 16, lineHeight: 1.55, color: '#3D3D3D' }}>먹여 보신 분들의 이야기가 모이면 고치지 않고 이 자리에 올려요.</span>
          </div>
        </section>

        {/* ── 마무리 — 가게 · 우리 음식 · 앱 띠 ── */}
        <section style={{ padding: '48px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <h2 className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>
            내 강아지에게 줄 한 끼
          </h2>
          <Link
            href="/store"
            style={{ marginTop: 18, height: 60, borderRadius: 4, background: '#141414', color: '#FFFFFF', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 19, fontWeight: 800 }}
          >
            레시피 고르기
            <Arrow />
          </Link>
          <Link
            href="/our-food"
            style={{ marginTop: 10, height: 56, boxSizing: 'border-box', borderRadius: 4, border: '2px solid #141414', color: '#141414', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}
          >
            우리 음식 보기
          </Link>
          <Link
            href="/app"
            style={{ marginTop: 16, minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, color: '#141414', textDecoration: 'none' }}
          >
            <span>
              우리 아이 맞춤 정기배송은 <strong style={{ fontWeight: 800, color: '#1D3B2F' }}>앱에서 {SUBSCRIPTION_DISCOUNT_PCT}% 할인</strong>
            </span>
            <Chevron />
          </Link>
        </section>
      </div>
    </StoreShell>
  )
}
