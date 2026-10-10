import type { Metadata } from 'next'
import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'
import JsonLd from '@/components/JsonLd'
import { buildBreadcrumbJsonLd, buildFaqJsonLd, ogImageUrl } from '@/lib/seo/jsonld'
import { cred, VET_ADVISOR_ACTIVE } from '@/lib/copy/credibility'
import {
  PACK_G,
  RECIPE_BAND,
  RECIPE_PRODUCT_NAME,
  RECIPE_REAL_IMG,
  RECIPE_STUDIO_IMG,
  SIZE_PACKS,
  STORE_RECIPES,
  SUBSCRIPTION_DISCOUNT_PCT,
  TRIAL_ITEM,
  meatLine,
  storeItem,
} from '@/lib/store/catalog'
import { STORE_SHIP_WEEKDAYS } from '@/lib/store/shipping'

/**
 * /our-food — 우리 음식. 웹 시안 WEB-C05(2026-10-10 웹 리뉴얼) — 가게 틀(StoreShell) 안에서 위에서부터:
 *   머리말·제목·소개 + 레시피 고르기/영양 근거 → 오리 화식 사진 → 원물(사진 + 6칸) → 타협하지 않는 네 가지(2×2)
 *   → 수비드 → 완전한 한 끼(회색 띠) → 그동안의 사료와 비교(표) → 레시피 4종(가게 상품으로) + 앱 띠 → 후기(모으는 중)
 *   → 자주 묻는 것 → 마무리(레시피 고르기).
 * 웹 전용(예전에도 WebChrome 만 썼다). 옛 설문 버튼(/start)은 전부 가게(/store)로 — 그래서 설문 링크를 고르던 로그인 확인
 * (getUser)도 함께 뺐다(다른 쓰임이 없었다). 예전 FD 톤 판은 git 이력.
 * ★문구는 시안(사실 확인을 거쳐 줄인 판)대로 — 옛 화면의 "농가 · 품목 · 시기 표기", "우리 아이 맞춤 정량", 구독 해지 안내는 되살리지 않는다.
 * ★숫자는 정본에서: 가격·팩 수 = lib/store/catalog, 출고 요일 = lib/store/shipping, 앱 할인 % = SUBSCRIPTION_DISCOUNT_PCT.
 */

export const revalidate = 3600

// R99-A 패턴: Next openGraph 는 shallow-merge 라 페이지가 images 미지정 시 layout
// 기본 OG(/og)를 상속 못 함 → 공유 카드 썸네일 0. 명시 OG 추가(회차160).
const OUR_FOOD_OG = ogImageUrl({
  title: '우리 음식',
  subtitle: '사람이 먹는 등급, 수비드 저온 조리 완전·균형 한 끼',
  tag: 'Our Food',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차153).
  // (이전 '우리 음식 — 파머스테일' 은 em-dash 변형이라 회차146 grep '| 파머스테일' 에 안 잡혀 잔존했음.)
  title: '우리 음식',
  description:
    '사람이 먹을 수 있는 신선한 재료를, 수비드로 천천히 조리해 완전·균형 영양으로. 뭐가 들었는지 다 보이는 우리 아이 한 끼. 500g 한 봉부터 시작해요.',
  alternates: { canonical: '/our-food' },
  openGraph: {
    title: '우리 음식 — 파머스테일',
    description:
      '사람이 먹을 수 있는 신선한 재료를, 수비드로 천천히 조리해 완전·균형 영양으로. 뭐가 들었는지 다 보이는 우리 아이 한 끼.',
    type: 'website',
    // Next openGraph shallow-merge: 페이지가 openGraph 설정 시 layout 의
    // locale/siteName 도 상속 못 함 → 명시(회차163). 공유 카드 브랜드명·언어 정보.
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/our-food',
    images: [{ url: OUR_FOOD_OG, width: 1200, height: 630, alt: '우리 음식' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '우리 음식 — 파머스테일',
    description:
      '사람이 먹을 수 있는 신선한 재료를, 수비드로 천천히 조리해 완전·균형 영양으로.',
    images: [OUR_FOOD_OG],
  },
}

const won = (n: number) => n.toLocaleString('ko-KR')

/** 원물 6칸(시안 C05) — 이름 + 한 줄. */
const INGREDIENTS = [
  { label: '닭고기', sub: '담백한 단백질' },
  { label: '오리고기', sub: '부드러운 단백질' },
  { label: '단호박', sub: '천천히 타는 에너지' },
  { label: '당근', sub: '색이 살아 있는 채소' },
  { label: '브로콜리', sub: '한 끼에 더하는 초록' },
  { label: '현미', sub: '든든한 곡물' },
] as const

/**
 * 넷째 약속 — 지금은 시안 문구(공개된 개 영양 기준). 실제 자문 수의사·영양사를 맡기면(VET_ADVISOR_ACTIVE)
 * lib/copy/credibility 의 강한 카피로 한 번에 돌아간다(그 스위치는 그대로 둔다).
 */
const NUTRITION_PILLAR = VET_ADVISOR_ACTIVE
  ? { t: cred.recipeCardTitle, d: cred.recipeCardBodyShort }
  : { t: '영양 기준 설계', d: '공개된 개 영양 기준에 맞춰 영양 비율을 설계.' }

/** 타협하지 않는 네 가지(시안 C05) — 아이콘은 시안의 선 그림 그대로. */
const PILLARS = [
  {
    t: '진짜 음식',
    d: '눈에 보이는 신선한 원물. 정체 모를 첨가물 없이.',
    icon: (
      <>
        <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" />
        <path d="M5 19l7-7" />
      </>
    ),
  },
  {
    t: '사람 등급 안전',
    d: '사람이 먹어도 되는 등급을 식품 안전 기준으로.',
    icon: (
      <>
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    t: '수비드 저온 조리',
    d: '진공 저온으로 천천히 익혀 바로 급속 냉동.',
    icon: (
      <>
        <path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" />
        <path d="M9 4c0 1.5 1 1.5 1 3M13 4c0 1.5 1 1.5 1 3" />
      </>
    ),
  },
  {
    t: NUTRITION_PILLAR.t,
    d: NUTRITION_PILLAR.d,
    icon: (
      <>
        <path d="M8 4h8l1 3H7z" />
        <path d="M6 7h12v13H6z" />
        <path d="M9 13l2 2 4-4" />
      </>
    ),
  },
] as const

/** 완전한 한 끼(시안 C05) — 체크 세 줄. */
const COMPLETE_POINTS = [
  { t: '완전·균형 영양', d: '필요한 영양소를 빠짐없이, 표준 기준에 맞춰' },
  { t: '하루 줄 양 안내', d: '몸무게만 넣으면 하루에 줄 양을 알려드려요' },
  { t: '만든 그대로', d: '신선함을 살려 한 끼로' },
] as const

/** 그동안의 사료와 비교(시안 C05). */
const COMPARE_ROWS = [
  { label: '보관', old: '상온에서 몇 달씩', us: '조금씩 만들어 바로 냉동' },
  { label: '원료', old: '‘수입산 육류’ 같은 익명', us: '원재료 전부 공개' },
  { label: '조리', old: '고온 압출 가공', us: '수비드 저온 조리' },
  { label: '하루 양', old: '한 봉지 일괄 기준', us: '몸무게로 계산' },
] as const

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const
/** 가게 출고 요일(정본 lib/store/shipping) — '화요일과 목요일'. */
const SHIP_DAYS = STORE_SHIP_WEEKDAYS.map((d) => `${WEEKDAY_KO[d]}요일`).join('과 ')

/**
 * 먹이기 전 자주 묻는 것(시안 C05 — 질문 넷, 첫 답은 시안 그대로).
 * 닫힌 셋의 답은 시안에 없어 옛 승인 문구를 웹 가게 사실로 고쳤다: 구독 해지·'첫 박스'·'배송비는 구독료에 포함'은
 * 웹 단품 가게와 맞지 않아 뺐고, 체험팩·출고 요일은 정본(lib/store/catalog·shipping), 해지 마감은 앱 정본 문구
 * ("다음 결제 전까지 … 그만둘 수 있어요. 위약금은 없어요")를 따른다. 보이는 질문 = FAQ 구조화 데이터(아래 faqLd).
 */
const FOOD_FAQ = [
  {
    q: '사람이 먹는 등급이 정말 안전한가요?',
    a: '사람 식품과 같은 위생 기준으로 다루고, 들어간 원재료를 전부 공개해요. 막연한 ‘수입산 육류’ 표기와 달라요.',
  },
  {
    q: '입이 짧은 아이도 잘 먹을까요?',
    a: `신선한 화식은 잘 먹는 편이지만 아이마다 차이가 있어요. 처음이라면 ${STORE_RECIPES.length}종을 ${PACK_G}g씩 맛보는 체험팩(${won(TRIAL_ITEM.price)}원)으로 먼저 반응을 확인해 보세요.`,
  },
  {
    q: '배송과 보관은 어떻게 하나요?',
    a: `${SHIP_DAYS}에 냉동으로 출고해요. 받으면 냉동실에 보관하고, 먹이기 전날 냉장실에서 녹여 주세요. 녹인 팩은 3일 안에 주세요.`,
  },
  {
    q: '정기배송에 약정이 있나요?',
    a: '없어요. 정기배송은 앱에서 신청하고, 다음 결제 전까지 미루거나 그만둘 수 있어요. 위약금은 없어요.',
  },
] as const

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

/** 섹션 제목(시안 C05 — 포스터 글꼴 30px). */
function H2({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 className="d" style={{ margin: 0, fontSize: 30, lineHeight: 1.12, ...style }}>
      {children}
    </h2>
  )
}

/** 주 버튼(먹색 60px) — 레시피 고르기. */
const PRIMARY_BTN: React.CSSProperties = {
  height: 60,
  borderRadius: 4,
  background: '#141414',
  color: '#FFFFFF',
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  fontSize: 19,
  fontWeight: 800,
}

const BODY_P: React.CSSProperties = { margin: '12px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }

export default async function OurFoodPage() {
  // Breadcrumb 구조화 데이터 — 검색결과 "홈 › 우리 음식" 표시(회차117). faq 패턴 일치.
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '우리 음식', path: '/our-food' },
  ])

  // FAQPage 구조화데이터 — 아래 '자주 묻는 것'(보이는 아코디언, 음식 특화 4문항)을 검색 FAQ
  // 리치결과 대상으로(회차138). /faq 와 다른 URL·다른 질문셋이라 별도 FAQPage 정당.
  const faqLd = buildFaqJsonLd(FOOD_FAQ.map((it) => ({ question: it.q, answer: it.a })))

  return (
    <StoreShell>
      <JsonLd id="ld-our-food-crumbs" data={crumbLd} />
      <JsonLd id="ld-our-food-faq" data={faqLd} />
      {/* 줄 높이 기본값 = 시안(normal). 여러 줄 글은 각자 값을 준다. */}
      <div style={{ lineHeight: 'normal' }}>
        {/* ── 머리말 · 제목 · 소개 · 버튼 둘 ── */}
        <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>우리 음식</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
            진짜 음식은
            <br />
            이렇게 달라요
          </h1>
          <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            사람이 먹을 수 있는 재료만 수비드로 천천히 익혀 그대로 담았어요. 보존제 없이, 뭐가 들었는지 다 보이는 한 끼예요.
          </p>
          <span style={{ marginTop: 12, fontSize: 15, fontWeight: 700, color: '#595959' }}>사람이 먹는 등급 원물 · 수비드 저온 조리 · 원재료 전부 공개</span>
          <Link href="/store" style={{ ...PRIMARY_BTN, marginTop: 22 }}>
            레시피 고르기
            <Arrow />
          </Link>
          <Link
            href="/science"
            style={{ marginTop: 10, height: 56, boxSizing: 'border-box', borderRadius: 4, border: '2px solid #141414', color: '#141414', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}
          >
            영양 근거 보기
          </Link>
        </section>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={RECIPE_REAL_IMG.duck}
          alt="나무 식탁 위 오리고기 화식 한 그릇과 봉투"
          width={1200}
          height={800}
          fetchPriority="high"
          style={{ marginTop: 28, width: '100%', aspectRatio: '390 / 300', objectFit: 'cover', objectPosition: '55% 55%', display: 'block' }}
        />

        {/* ── 원물 — 사진 + 6칸 ── */}
        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>
            사람이 먹는 등급
            <br />
            그대로 우리 아이에게
          </H2>
          <p style={BODY_P}>정체 모를 첨가물 대신 눈에 보이는 진짜 재료. 사람이 먹을 수 있는 기준으로 고른 원물만 담아요.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/raw-ingredients.jpg"
            alt="닭가슴살·당근·단호박·브로콜리·현미 같은 원물"
            width={1300}
            height={971}
            loading="lazy"
            style={{ marginTop: 18, width: '100%', aspectRatio: '350 / 220', objectFit: 'cover', borderRadius: 4, display: 'block' }}
          />
          <dl style={{ margin: '14px 0 0', display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '2px solid #141414' }}>
            {INGREDIENTS.map((ing, i) => (
              <div
                key={ing.label}
                style={{
                  padding: i % 2 === 1 ? '12px 0 12px 14px' : '12px 0',
                  borderBottom: '1px solid #E5E5E5',
                  borderLeft: i % 2 === 1 ? '1px solid #E5E5E5' : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <dt className="d" style={{ fontSize: 19 }}>
                  {ing.label}
                </dt>
                <dd style={{ margin: 0, fontSize: 15, color: '#595959' }}>{ing.sub}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── 타협하지 않는 네 가지 ── */}
        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>
            네 가지를
            <br />
            타협하지 않아요
          </H2>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PILLARS.map((p) => (
              <div key={p.t} style={{ padding: '16px 14px', borderRadius: 4, background: '#F6F4F5', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {p.icon}
                </svg>
                <strong style={{ fontSize: 17, fontWeight: 800 }}>{p.t}</strong>
                <span style={{ fontSize: 15, lineHeight: 1.5, color: '#3D3D3D' }}>{p.d}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── 수비드 — 실촬영 주방 컷(2026-09-02) ── */}
        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kitchen-sousvide.jpg"
            alt="진공 포장한 고기를 수비드 기계로 익히고 있어요"
            width={2048}
            height={1365}
            loading="lazy"
            style={{ width: '100%', aspectRatio: '350 / 220', objectFit: 'cover', borderRadius: 4, display: 'block' }}
          />
          <H2 style={{ marginTop: 20 }}>
            높은 불에 태우지 않고
            <br />
            수비드로 천천히
          </H2>
          <p style={BODY_P}>
            영양을 지키려면 조리 방식이 중요해요. 센 불에 빠르게 굽는 대신, 진공 포장한 재료를 알맞은 저온에서 천천히 익혀 영양·수분·풍미 손실을 줄였어요.
          </p>
          <p style={{ ...BODY_P, marginTop: 10 }}>익힌 뒤 바로 식혀 그대로 담고, 보존제는 넣지 않아요.</p>
        </section>

        {/* ── 완전한 한 끼 — 회색 띠 ── */}
        <section style={{ marginTop: 56, padding: '44px 20px 40px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
          <H2>
            간식이 아니라
            <br />
            매일 먹는 완전한 한 끼
          </H2>
          <p style={BODY_P}>매일 먹어도 부족함이 없도록 영양 기준에 맞춰 완전하고 균형 있게 설계했어요.</p>
          <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {COMPLETE_POINTS.map((pt) => (
              <li key={pt.t} style={{ padding: '13px 0', borderBottom: '1px solid #D9D9D9', display: 'grid', gridTemplateColumns: '30px 1fr', alignItems: 'start' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: 2 }}>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <strong style={{ fontSize: 17, fontWeight: 800 }}>{pt.t}</strong>
                  <span style={{ fontSize: 15, color: '#3D3D3D' }}>{pt.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 그동안의 사료와 비교 — 표 ── */}
        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>
            그동안의 사료와는
            <br />
            다르게 만들어요
          </H2>
          <table
            style={{ marginTop: 16, width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 16, lineHeight: 1.45, borderTop: '2px solid #141414' }}
          >
            <thead>
              <tr>
                <th scope="col" style={{ width: 64, padding: '12px 0' }}>
                  <span className="sr-only">항목</span>
                </th>
                <th scope="col" style={{ padding: '12px 8px', textAlign: 'left', fontSize: 15, fontWeight: 700, color: '#595959' }}>
                  그동안의 사료
                </th>
                <th scope="col" className="d" style={{ padding: '12px 8px', textAlign: 'left', fontSize: 18, color: '#FFFFFF', background: '#141414' }}>
                  파머스테일
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((r, i) => (
                <tr key={r.label} style={{ borderTop: '1px solid #E5E5E5', borderBottom: i === COMPARE_ROWS.length - 1 ? '2px solid #141414' : undefined }}>
                  <th scope="row" style={{ padding: '13px 0', textAlign: 'left', fontWeight: 500, color: '#595959' }}>
                    {r.label}
                  </th>
                  <td style={{ padding: '13px 8px', color: '#595959' }}>{r.old}</td>
                  <td style={{ padding: '13px 8px', background: '#F6F4F5', fontWeight: 800 }}>{r.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link
            href="/why-fresh"
            style={{ marginTop: 6, alignSelf: 'flex-start', height: 48, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 700, color: '#141414', textDecoration: 'underline' }}
          >
            왜 화식인지 더 알아보기
            <Chevron size={15} />
          </Link>
        </section>

        {/* ── 레시피 4종 — 가게 상품으로(가격 = 정본 500g 정가) + 앱 띠 ── */}
        <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>레시피 {STORE_RECIPES.length}종</H2>
          <p style={{ margin: '8px 0 6px', fontSize: 16, color: '#595959' }}>
            모두 {PACK_G}g 팩 {SIZE_PACKS['500g']}개, 500g 한 봉이에요
          </p>
          {STORE_RECIPES.map((r) => (
            <Link
              key={r}
              href={`/store/${r}`}
              style={{ minHeight: 80, borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '60px 1fr auto', columnGap: 14, alignItems: 'center', color: '#141414', textDecoration: 'none' }}
            >
              <span style={{ position: 'relative', width: 60, height: 60, borderRadius: 4, overflow: 'hidden', background: '#F6F4F5' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={RECIPE_STUDIO_IMG[r]} alt="" width={120} height={120} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: RECIPE_BAND[r] }} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="d" style={{ fontSize: 19 }}>
                  {RECIPE_PRODUCT_NAME[r]}
                </span>
                <span style={{ fontSize: 15, color: '#595959' }}>{meatLine(r).split('·').join(' · ')}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 1, whiteSpace: 'nowrap' }}>
                <span className="n" style={{ fontSize: 20 }}>
                  {won(storeItem(`${r}-500g`).price)}
                </span>
                <span className="d" style={{ fontSize: 14 }}>
                  원
                </span>
              </span>
            </Link>
          ))}
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

        {/* ── 후기 — 실제 후기가 모이기 전까지는 지어낸 카드 없이 상태만(규칙 28) ── */}
        <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2 style={{ marginBottom: 14 }}>후기</H2>
          <div style={{ padding: 20, borderRadius: 4, border: '2px solid #141414', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong style={{ fontSize: 18, fontWeight: 800 }}>첫 후기를 모으는 중이에요</strong>
            <span style={{ fontSize: 16, lineHeight: 1.55, color: '#3D3D3D' }}>먹여 보신 분들의 이야기가 모이면 고치지 않고 이 자리에 올려요.</span>
          </div>
        </section>

        {/* ── 자주 묻는 것 — details 라 JS 없이 열고 닫는다. 첫 질문만 열어 둔다. ── */}
        <section style={{ padding: '48px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>
            먹이기 전에
            <br />
            자주 묻는 것들
          </H2>
          <div style={{ marginTop: 14, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {FOOD_FAQ.map((f, i) => (
              <details key={f.q} open={i === 0} style={{ borderBottom: '1px solid #E5E5E5' }}>
                <summary
                  style={{ minHeight: 64, padding: '10px 0', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}
                >
                  {f.q}
                  <span aria-hidden className="fts-acc-plus" style={{ fontSize: 26, fontWeight: 300 }}>
                    +
                  </span>
                  <span aria-hidden className="fts-acc-minus" style={{ fontSize: 26, fontWeight: 300 }}>
                    −
                  </span>
                </summary>
                <p style={{ margin: '0 0 20px', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── 마무리 — 가게로 ── */}
        <section style={{ padding: '48px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <H2>
            우리 아이 한 끼
            <br />
            오늘 시작해요
          </H2>
          <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.6, color: '#3D3D3D' }}>500g 한 봉부터 부담 없이 시작해요.</p>
          <Link href="/store" style={{ ...PRIMARY_BTN, marginTop: 18 }}>
            레시피 고르기
            <Arrow />
          </Link>
        </section>
      </div>
    </StoreShell>
  )
}
