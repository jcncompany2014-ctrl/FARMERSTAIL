import type { Metadata } from 'next'
import Link from 'next/link'
import { ogImageUrl, buildBreadcrumbJsonLd, buildFaqJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import StoreShell from '@/components/store/StoreShell'
import { SUBSCRIPTION_DISCOUNT_PCT, TRIAL_PRICE } from '@/lib/store/catalog'

/**
 * /why-fresh — "왜 화식인가" 교육 화면. 웹 시안 WEB-C04(2026-10-10 웹 리뉴얼) — 가게 틀 안에서 위에서부터:
 *   머리말·제목·소개·버튼 2개 → 한우 그릇 사진 → 화식 vs 건사료 비교표 → 사람이 먹는 등급(사진·3줄)
 *   → 촉촉하고 맛있게(회색 띠 3칸) → 자주 묻는 것(5문항, FAQPage 구조화 데이터와 같은 목록) → 체험팩·앱 띠.
 * 정직성 가드 그대로: 효능·질병 단정·가짜 수치 없이 "만드는 법과 들어가는 것"만 비교한다.
 * 옛 설문 버튼(/start)은 가게(/store)·체험팩·앱 띠로 바뀌었다(웹 설문은 앱으로 옮겼다).
 */
export const revalidate = 3600

const WHYFRESH_OG = ogImageUrl({
  title: '왜 신선한 화식인가',
  subtitle: '고온 가공 사료가 아니라, 수비드 신선식',
  tag: 'Why Fresh',
  variant: 'editorial',
})

export const metadata: Metadata = {
  // 루트 layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지).
  title: '왜 신선한 화식인가',
  description:
    '수비드로 조리한 화식과 고온·고압으로 가공한 건사료는 출발부터 달라요. 재료 등급·만드는 방식·그릇에 담기는 모습까지, 무엇이 어떻게 다른지 솔직하게.',
  alternates: { canonical: '/why-fresh' },
  openGraph: {
    title: '왜 신선한 화식인가 | 파머스테일',
    description: '수비드 화식 vs 고온·고압 가공 건사료 — 재료 등급·가공 방식의 차이를 사실 그대로.',
    type: 'article',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/why-fresh',
    images: [{ url: WHYFRESH_OG, width: 1200, height: 630, alt: '왜 신선한 화식인가' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '왜 신선한 화식인가 | 파머스테일',
    description: '수비드 화식 vs 고온·고압 가공 건사료 — 재료·가공의 차이를 사실 그대로.',
    images: [WHYFRESH_OG],
  },
  robots: { index: true, follow: true },
}

/** 화식 vs 일반 건사료 — 만드는 법과 들어가는 것만(효능 비교 아님). */
const COMPARE = [
  { k: '재료', fresh: '사람이 먹을 수 있는 신선한 재료', dry: '건조·분말화한 원료가 중심' },
  { k: '조리', fresh: '수비드로 부드럽게', dry: '고온·고압으로 압출 성형' },
  { k: '상태', fresh: '수분을 머금은 촉촉한 상태', dry: '수분을 날린 바삭한 형태' },
  { k: '보관', fresh: '냉동·냉장으로 보관', dry: '실온에서 오래 보관' },
  { k: '가공', fresh: '만든 그대로, 최소한으로', dry: '보존·기호 첨가가 흔함' },
] as const

const GRADE = ['사람이 먹을 수 있는 등급의 정육·채소', '신선한 상태로 손질해 수비드로 조리', '어떤 원물이 들어가는지 솔직하게 안내'] as const

const TASTE = [
  { t: '수분을 머금은 한 끼', d: '수비드로 익혀 재료의 수분을 그대로 지켜요. 바삭하게 말린 건사료와는 다른 촉촉한 질감이에요.' },
  { t: '향과 식감이 살아 있어요', d: '사람이 먹는 재료를 그대로 익혀 재료 본연의 향과 식감을 지켜요.' },
  { t: '부드럽게, 한 입씩', d: '갈아 굳힌 알갱이가 아니라 결이 살아 있는 부드러운 음식 그대로 담아요.' },
] as const

/**
 * 왜 화식 전용 정직 FAQ — 전환·배탈·알레르기·가격. 효능·질병 단정 금지, 가짜 수치 0, 단정 대신 '수의사 상담' 톤(회차202).
 * 화면과 FAQPage 구조화 데이터가 같은 목록을 쓴다. 가격 답은 가게 기준(곁들임·반반으로 양 조절 · 매일이면 앱 정기배송 할인).
 */
const WHYFRESH_FAQ = [
  {
    q: '화식은 건사료보다 영양이 부족하지 않나요?',
    a: '화식도 하루에 필요한 영양 기준을 채우도록 균형을 맞춰 설계해요. 재료가 신선할 뿐, 영양이 빠지는 게 아니에요.',
  },
  {
    q: '기존 사료에서 어떻게 바꾸나요?',
    a: '한 번에 바꾸기보다 일주일쯤에 걸쳐 기존 사료에 조금씩 섞어 가며 늘려 주세요. 아이마다 속도가 다르니 변 상태를 보며 천천히요.',
  },
  {
    q: '바꾸면 배탈이 나지 않을까요?',
    a: '급하게 바꾸면 잠시 변이 묽어질 수 있어 천천히 섞어 주는 게 좋아요. 평소와 다른 증상이 이어지면 수의사와 상의해 주세요.',
  },
  {
    q: '알레르기가 있는 아이도 먹을 수 있나요?',
    a: '들어간 원물을 모두 적어 두어 피해야 할 재료를 고르기 쉬워요. 다만 알레르기 진단과 식단 관리는 수의사와 함께 정하는 걸 권해요.',
  },
  {
    q: '화식은 더 비싸지 않나요?',
    a: `재료와 보관 방식이 달라 일반 건사료보다 부담이 될 수 있어요. 그래서 건사료에 곁들이거나 반반으로 섞어 양을 조절할 수 있어요. 매일 먹인다면 앱 정기배송이 ${SUBSCRIPTION_DISCOUNT_PCT}% 할인돼요.`,
  },
] as const

const won = (n: number) => n.toLocaleString('ko-KR')

function Chevron({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** 검은 큰 버튼의 화살표(→) — 시안의 주 버튼. */
function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function H2({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <h2 className="d" style={{ margin: 0, fontSize: 30, lineHeight: 1.12, ...style }}>
      {children}
    </h2>
  )
}

const LEAD: React.CSSProperties = { margin: '12px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }

export default async function WhyFreshPage() {
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '왜 화식', path: '/why-fresh' },
  ])

  return (
    <StoreShell>
      <JsonLd id="ld-whyfresh-crumbs" data={crumbLd} />
      <JsonLd id="ld-whyfresh-faq" data={buildFaqJsonLd(WHYFRESH_FAQ.map((f) => ({ question: f.q, answer: f.a })))} />
      {/* 줄 높이 기본값 = 시안(normal). 여러 줄 글은 각자 값을 준다. */}
      <div style={{ lineHeight: 'normal' }}>
        <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>왜 화식인가</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
            사료가 아니라
            <br />
            진짜 음식인 이유
          </h1>
          <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            수비드로 익힌 화식과 고온·고압으로 가공한 건사료는 출발부터 달라요. 재료의 등급, 만드는 방식, 그릇에 담기는 마지막 모습까지 무엇이 어떻게 다른지 솔직하게
            보여드릴게요.
          </p>
          <Link
            href="/store"
            style={{ marginTop: 22, height: 60, borderRadius: 4, background: '#141414', color: '#FFFFFF', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 19, fontWeight: 800 }}
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
        </section>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/store/real-beef.webp"
          alt="나무 식탁 위 한우 화식 한 그릇과 팩"
          width={1200}
          height={800}
          fetchPriority="high"
          style={{ marginTop: 28, width: '100%', aspectRatio: '390 / 260', objectFit: 'cover', objectPosition: '50% 60%', display: 'block' }}
        />

        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>무엇이 다른가요?</H2>
          <p style={LEAD}>건강 효과를 단정하진 않을게요. 다만 어떻게 만들고 무엇이 들어가는지는 분명히 달라요.</p>
          <table style={{ marginTop: 18, width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 16, lineHeight: 1.45, borderTop: '2px solid #141414' }}>
            <thead>
              <tr>
                <th scope="col" style={{ width: 52, padding: '12px 0' }}>
                  <span className="sr-only">항목</span>
                </th>
                <th scope="col" className="d" style={{ padding: '12px 10px', textAlign: 'left', fontSize: 19, fontWeight: 400, color: '#FFFFFF', background: '#141414' }}>
                  화식
                </th>
                <th scope="col" className="d" style={{ padding: '12px 10px', textAlign: 'left', fontSize: 19, fontWeight: 400, color: '#595959' }}>
                  일반 건사료
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r, i) => (
                <tr key={r.k} style={{ borderTop: '1px solid #E5E5E5', borderBottom: i === COMPARE.length - 1 ? '2px solid #141414' : undefined }}>
                  <th scope="row" style={{ padding: '14px 0', textAlign: 'left', fontWeight: 500, color: '#595959' }}>
                    {r.k}
                  </th>
                  <td style={{ padding: '14px 10px', background: '#F6F4F5', fontWeight: 800 }}>{r.fresh}</td>
                  <td style={{ padding: '14px 10px', color: '#3D3D3D' }}>{r.dry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>
            사람이 먹는 등급
            <br />
            그대로
          </H2>
          <p style={LEAD}>특별한 재료가 아니에요. 우리가 먹을 수 있는 신선한 정육·채소를 같은 기준으로 골라 손질하고 익힐 뿐이에요.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/prep-hygiene-43.jpg"
            alt="위생 장갑을 끼고 손질 전 원물을 다루는 모습"
            width={1200}
            height={900}
            loading="lazy"
            style={{ marginTop: 18, width: '100%', aspectRatio: '350 / 230', objectFit: 'cover', borderRadius: 4, display: 'block' }}
          />
          <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {GRADE.map((g) => (
              <li key={g} style={{ minHeight: 60, borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '30px 1fr', alignItems: 'center', fontSize: 17, fontWeight: 700 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                {g}
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: 56, padding: '44px 20px 40px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
          <H2>촉촉하고 맛있게</H2>
          <p style={LEAD}>비밀은 거창하지 않아요. 수분, 향, 그리고 결이에요. 효능을 단정하진 않을게요. 다만 그릇에 담기는 마지막 모습은 분명히 달라요.</p>
          <ol style={{ margin: '18px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TASTE.map((t, i) => (
              <li key={t.t} style={{ padding: 16, background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="n" style={{ fontSize: 18 }}>
                    {i + 1}
                  </span>
                  <strong style={{ fontSize: 18, fontWeight: 800 }}>{t.t}</strong>
                </span>
                <span style={{ fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>{t.d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>
            화식에 대해
            <br />
            자주 묻는 것들
          </H2>
          <div style={{ marginTop: 14, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {WHYFRESH_FAQ.map((f, i) => (
              <details key={f.q} open={i === 0} style={{ borderBottom: '1px solid #E5E5E5' }}>
                <summary style={{ minHeight: 64, padding: '10px 0', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>
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
          <Link
            href="/faq"
            style={{ marginTop: 6, alignSelf: 'flex-start', height: 48, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 700, color: '#141414', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            자주 묻는 질문 더 보기
            <Chevron size={15} />
          </Link>
        </section>

        <section style={{ padding: '48px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <H2 style={{ fontSize: 28, lineHeight: 1.15 }}>
            우리 아이에게
            <br />
            화식이 맞을까요?
          </H2>
          <Link
            href="/store?tab=trial"
            style={{ marginTop: 18, border: '2px solid #141414', borderRadius: 4, overflow: 'hidden', color: '#141414', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
          >
            {/* 4종 색 띠(장식) — 닭·오리·흑돼지·한우 순서. */}
            <span aria-hidden style={{ height: 10, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
              {['#E8952F', '#2F8F8B', '#9AA0A6', '#C63D2A'].map((c) => (
                <span key={c} style={{ background: c }} />
              ))}
            </span>
            <span style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>처음이라면</span>
                <span className="d" style={{ fontSize: 24, lineHeight: 1.1 }}>
                  4종 체험팩
                </span>
                <span style={{ fontSize: 15, color: '#3D3D3D' }}>4종 100g씩 맛보기</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap' }}>
                <span className="n" style={{ fontSize: 28 }}>
                  {won(TRIAL_PRICE)}
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
