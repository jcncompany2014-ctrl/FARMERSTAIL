import type { Metadata } from 'next'
import Link from 'next/link'
import { GUIDELINE_CITATIONS, CHRONIC_CONDITION_LABELS } from '@/lib/nutrition/guidelines'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import StoreShell from '@/components/store/StoreShell'
import { cred } from '@/lib/copy/credibility'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/store/catalog'

/**
 * /science — 영양 근거(수의영양학 방법론). 웹 시안 WEB-C03(2026-10-10 웹 리뉴얼) — 가게 틀 안에서 위에서부터:
 *   머리말·제목·소개 + 숫자 카드(43/43·3·4) → 이렇게 설계해요(4줄) → 참고하는 기준(인용, 회색 띠)
 *   → 말이 아니라 서류로(교차검증표 PDF·품목보고·수입신고) → 질환이 있는 아이라면(질환 칩) → 우리가 하지 않는 것(회색 띠) → 가게·앱.
 * 인용·질환 목록은 lib/nutrition/guidelines 정본에서(이름만 쉬운 우리말로). 계산·설문은 앱에서 한다(웹 설문은 앱으로 옮겼다).
 * 시안과 다른 곳: 서류 두 장(품목보고·수입신고 사진)을 각 글 아래에 그대로 둔다 — "서류를 그대로 공개해요"가 PDF 하나로만
 *   끝나지 않게(2026-09-04 사장님 자료).
 */
export const revalidate = 3600

const SCIENCE_OG = ogImageUrl({
  title: '수의영양학 방법론',
  subtitle: 'NRC · AAFCO · FEDIAF · WSAVA 를 어떻게 적용하는가',
  tag: 'Science',
  variant: 'editorial',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차151).
  title: '수의영양학 — 분석 방법론',
  description:
    'NRC 2006 · AAFCO 2024 · FEDIAF 2024 · WSAVA 가이드라인을 어떻게 적용하는지, 하루 열량 계산식, 만성질환 분기, AI 의 역할과 한계까지 공개합니다.',
  alternates: { canonical: '/science' },
  openGraph: {
    title: '수의영양학 — 분석 방법론 | 파머스테일',
    description: 'NRC 2006 · AAFCO 2024 · FEDIAF 2024 · WSAVA 가이드라인 적용, 하루 열량 계산식, 만성질환 분기, AI 의 역할과 한계까지 공개.',
    type: 'article',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/science',
    images: [{ url: SCIENCE_OG, width: 1200, height: 630, alt: '수의영양학 방법론' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '수의영양학 — 분석 방법론 | 파머스테일',
    description: 'NRC · AAFCO · FEDIAF · WSAVA 적용, 하루 열량 계산식, AI 의 역할과 한계까지 공개.',
    images: [SCIENCE_OG],
  },
  robots: { index: true, follow: true },
}

const METHODS = [
  {
    t: '진료에서 쓰는 평가로 묻는 설문',
    d: '수의 진료에서 쓰는 체형·근육·변 상태 평가를 그대로 써요. 만성질환·복용 중인 약·임신과 수유까지 물어요.',
  },
  {
    t: '하루 열량 계산식',
    d: '쉬는 동안 쓰는 열량(70 × 체중의 0.75제곱)에 나이·활동량·체형·중성화·근육 상태·만성질환을 반영해 하루 열량을 정해요. 모든 계수는 공개된 기준에서 가져와요.',
  },
  {
    t: '질환이 있으면 식단을 따로',
    d: '당뇨·신장·심장·췌장염·장 질환·관절염 같은 만성질환에 맞춰 단백질·지방·식이섬유와 인·나트륨·오메가-3를 조정해요. 치료식을 먹는 아이라면 바꾸기 전에 꼭 수의사와 상의해 주세요.',
  },
  {
    t: 'AI는 풀어 주는 역할만',
    d: '계산은 규칙으로 해요. 같은 답을 넣으면 늘 같은 결과가 나와요. AI는 결과를 쉬운 말로 풀고 바꾸기 7일 계획을 만드는 일만 해요. 진단이나 약은 다루지 않아요.',
  },
] as const

/** 인용 이름·기관을 쉬운 우리말로(시안 C03). 원문 주소는 정본(GUIDELINE_CITATIONS) 그대로. 없는 키는 원문 표기로. */
const CITATION_KO: Partial<Record<(typeof GUIDELINE_CITATIONS)[number]['key'], { t: string; o: string }>> = {
  nrc2006: { t: '개와 고양이의 영양 요구량', o: '미국 국가연구위원회 · 2006' },
  aafco2024: { t: '개 사료 영양 기준', o: '미국사료관리협회 · 2024' },
  fediaf2021: { t: '완전·보조 사료 영양 가이드라인', o: '유럽펫푸드산업연합 · 2024' },
  wsava: { t: '체형·근육 평가 가이드', o: '세계소동물수의사회' },
  iris_ckd: { t: '만성 신장질환 단계 구분', o: '국제신장관심학회 · 2019·2023' },
  acvim_mmvd: { t: '이첨판 질환 합의문', o: '미국수의내과학회 · 2019' },
  kfa: { t: '펫 사료 영양 표시 기준 가이드', o: '한국펫사료협회' },
  rda_kr: { t: '반려동물 사료 가이드', o: '농촌진흥청 국립축산과학원 · 2022' },
  mafra_feed_law: { t: '사료등의 기준 및 규격', o: '농림축산식품부 · 사료관리법 제10조' },
}

/** 질환 칩 — 정본 이름에서 괄호 속 영어 약어를 뺀다. 전문용어가 앞에 붙은 것만 쉬운 말로. */
const CONDITION_SHORT: Partial<Record<keyof typeof CHRONIC_CONDITION_LABELS, string>> = { mmvd: '이첨판 변성' }
const conditionLabel = (k: keyof typeof CHRONIC_CONDITION_LABELS) => CONDITION_SHORT[k] ?? CHRONIC_CONDITION_LABELS[k].replace(/\s*\(.*\)\s*$/, '')

const LIMITS = [
  { t: '진단', d: '우리 분석은 먹는 것에 대한 권장이에요. 질병의 진단이나 치료를 대신하지 않아요.' },
  { t: '약', d: '보충제 권장은 식단 차원이에요. 약이나 치료식을 바꿀 땐 꼭 주치 수의사와 함께 정해 주세요.' },
  { t: '혈액검사', d: '만성질환이 6개월 넘게 이어진 아이는 정기 혈액검사를 함께 받아 주세요.' },
  { t: '품종 일반화', d: '견종별 작은 차이는 일반화하지 않아요. 같은 품종 안에서도 아이마다 달라요.' },
] as const

/** 서류 두 장 — 2026-09-04 사장님 자료. 문서라 잘라내지 않고(contain) 같은 액자에 담는다. */
const EVIDENCE = [
  {
    chip: '식품안전나라 · 품목보고',
    t: '정식 품목보고된 프리믹스',
    d: '비타민·미네랄 프리믹스 ‘파머스테일 뉴트리 코어’는 식품안전나라에 품목보고된 제품이에요.',
    points: [
      '신선 재료의 미량영양소는 계절과 산지에 따라 달라져, 원재료만으로는 43개 항목을 매번 맞추기 어려워요.',
      '그래서 부족한 항목만 채우는 전용 프리믹스를 함께 설계했어요.',
      '그 프리믹스도 품목보고를 마친 제품으로 만들었어요.',
    ],
    src: '/evidence-premix-report.webp',
    alt: '파머스테일 뉴트리 코어 프리믹스 — 식품안전나라 품목보고 조회 화면',
    w: 697,
    h: 385,
  },
  {
    chip: '수입식품 · 수입신고확인증',
    t: '원료까지 신고 서류로',
    d: '프리믹스에 쓰는 원료는 수입식품 안전관리 특별법에 따른 수입신고확인증을 갖춘 것만 써요.',
    points: [],
    src: '/evidence-import-cert.webp',
    alt: '비타민·미네랄 원료의 수입식품 수입신고확인증',
    w: 1200,
    h: 1521,
  },
] as const

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

/** 바깥 창 화살표(↗) — 새 창으로 여는 원문·PDF. */
function External({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17L17 7M9 7h8v8" />
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

export default async function SciencePage() {
  const conditionKeys = Object.keys(CHRONIC_CONDITION_LABELS) as Array<keyof typeof CHRONIC_CONDITION_LABELS>
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    // 라벨은 메뉴와 같은 스위치(실 자문 없을 땐 '영양 근거').
    { name: cred.navVetLabel, path: '/science' },
  ])

  return (
    <StoreShell>
      <JsonLd id="ld-science-crumbs" data={crumbLd} />
      {/* 줄 높이 기본값 = 시안(normal). 여러 줄 글은 각자 값을 준다. */}
      <div style={{ lineHeight: 'normal' }}>
        <section style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#595959' }}>영양 근거</span>
          <h1 className="d" style={{ margin: '8px 0 0', fontSize: 40, lineHeight: 1.1 }}>
            우리가 어떻게
            <br />
            영양을 설계하는지
          </h1>
          <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>
            수의영양학은 먹는 것으로 건강을 지키는 학문이에요. 우리는 공개된 기준을 계산식으로 옮겨 식단을 설계해요. 어떤 출처를 어떻게 쓰는지, AI가 어디까지 하고 어디서
            멈추는지 모두 공개해요.
          </p>
          {/* 숫자 카드 — 아래 교차검증표의 사실 표기를 첫 화면에 다시 적는다. */}
          <div style={{ marginTop: 22, border: '2px solid #141414', boxShadow: '4px 4px 0 #141414', borderRadius: 4, display: 'grid', gridTemplateColumns: '1.25fr 1fr' }}>
            <span style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
              <span className="n" style={{ fontSize: 52, lineHeight: 1 }}>
                43/43
              </span>
              <span style={{ fontSize: 16, fontWeight: 800 }}>영양 항목 충족</span>
            </span>
            <span style={{ borderLeft: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column' }}>
              <span style={{ flex: 1, padding: 14, borderBottom: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="n" style={{ fontSize: 28, lineHeight: 1 }}>
                  3
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#3D3D3D' }}>국제 기준 교차 대조</span>
              </span>
              <span style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="n" style={{ fontSize: 28, lineHeight: 1 }}>
                  4
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#3D3D3D' }}>레시피 전 종 검증</span>
              </span>
            </span>
          </div>
        </section>

        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>이렇게 설계해요</H2>
          <ol style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {METHODS.map((m, i) => (
              <li key={m.t} style={{ padding: '18px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '40px 1fr', columnGap: 8 }}>
                <span className="n" style={{ fontSize: 22, lineHeight: 1.2 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <strong style={{ fontSize: 19, fontWeight: 800 }}>{m.t}</strong>
                  <span style={{ fontSize: 16, lineHeight: 1.65, color: '#3D3D3D' }}>{m.d}</span>
                </span>
              </li>
            ))}
          </ol>
          <span style={{ marginTop: 12, fontSize: 15, color: '#595959' }}>설문과 계산은 앱에서 해요</span>
        </section>

        <section style={{ marginTop: 56, padding: '44px 20px 40px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
          <H2>참고하는 기준</H2>
          <ul style={{ margin: '16px 0 0', padding: 0, listStyle: 'none', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {GUIDELINE_CITATIONS.map((c) => {
              const ko = CITATION_KO[c.key]
              return (
                <li key={c.key} style={{ padding: '14px 0', borderBottom: '1px solid #D9D9D9', display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 12, alignItems: 'center' }}>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <strong style={{ fontSize: 17, fontWeight: 800 }}>{ko?.t ?? c.title}</strong>
                    <span style={{ fontSize: 14, color: '#595959' }}>{ko?.o ?? c.org}</span>
                  </span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${ko?.t ?? c.title} 원문 보기(새 창)`}
                    style={{ height: 44, display: 'flex', alignItems: 'center', gap: 3, fontSize: 15, fontWeight: 700, color: '#141414', whiteSpace: 'nowrap', textDecoration: 'underline', textUnderlineOffset: 3 }}
                  >
                    원문
                    <External size={15} />
                  </a>
                </li>
              )
            })}
          </ul>
        </section>

        {/* id — /about 의 '영양 교차검증표' 줄이 바로 여기로 온다(/science#evidence). */}
        <section id="evidence" style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column', scrollMarginTop: 64 }}>
          <H2>말이 아니라 서류로</H2>
          <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }}>
            레시피 4종의 설계값을 미국·유럽·한국 영양 기준과 항목별로 맞춰 본 표, 그리고 비타민·미네랄 프리믹스의 품목보고·원료 수입신고 서류를 그대로 공개해요.
          </p>
          <div style={{ position: 'relative', marginTop: 22, padding: 18, borderRadius: 4, background: '#F6F4F5' }}>
            <div aria-label="영양 교차검증표 미리보기" style={{ padding: '16px 14px', background: '#FFFFFF', border: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>영양 교차검증표 · 레시피 4종</span>
              <span aria-hidden style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 4 }}>
                {['#D9D9D9', '#E8952F', '#2F8F8B', '#9AA0A6', '#C63D2A'].map((c) => (
                  <span key={c} style={{ height: 9, background: c }} />
                ))}
              </span>
              {[0, 1, 2, 3, 4].map((r) => (
                <span key={r} aria-hidden style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 4 }}>
                  {[0, 1, 2, 3, 4].map((c) => (
                    <span key={c} style={{ height: 7, background: '#EFEDEE' }} />
                  ))}
                </span>
              ))}
            </div>
            <span
              aria-hidden
              style={{
                position: 'absolute',
                right: 10,
                top: -14,
                width: 84,
                height: 84,
                borderRadius: 42,
                background: '#141414',
                color: '#FFFFFF',
                transform: 'rotate(-8deg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <span className="n" style={{ fontSize: 20, lineHeight: 1 }}>
                43/43
              </span>
              <span style={{ fontSize: 12, fontWeight: 800 }}>항목 충족</span>
            </span>
          </div>
          <span style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: '#595959' }}>
            기준치는 메뉴별 칼로리로 환산한 값, 설계값은 넣은 재료의 영양성분 분석으로 낸 추정치예요.
          </span>
          {/* 새 창 PDF — 내부 Link 가 아니라 순수 <a>. */}
          <a
            href="/docs/farmerstail-cross-validation.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 14, height: 56, boxSizing: 'border-box', borderRadius: 4, border: '2px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 17, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
          >
            교차검증표 원문(PDF) 보기
            <External />
          </a>

          {EVIDENCE.map((e, i) => (
            <article
              key={e.chip}
              style={{ marginTop: i === 0 ? 24 : 20, borderTop: i === 0 ? '2px solid #141414' : '1px solid #E5E5E5', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <span style={{ fontSize: 14, fontWeight: 800, color: '#595959' }}>{e.chip}</span>
              <strong style={{ fontSize: 19, fontWeight: 800 }}>{e.t}</strong>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: '#3D3D3D' }}>{e.d}</p>
              {e.points.length > 0 && (
                <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {e.points.map((pt) => (
                    <li key={pt} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', columnGap: 6, fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#141414" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: 3 }}>
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                      {pt}
                    </li>
                  ))}
                </ul>
              )}
              {/* 문서라 잘라내지 않는다 — 같은 비율 액자 안에 contain(이미지는 absolute 로 액자를 못 뚫게, 2026-09-04 제보). */}
              <span style={{ position: 'relative', marginTop: 10, aspectRatio: '16 / 10', borderRadius: 4, background: '#F6F4F5', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.src} alt={e.alt} width={e.w} height={e.h} loading="lazy" style={{ position: 'absolute', inset: 8, width: 'calc(100% - 16px)', height: 'calc(100% - 16px)', objectFit: 'contain' }} />
              </span>
            </article>
          ))}
        </section>

        <section style={{ padding: '56px 20px 0', display: 'flex', flexDirection: 'column' }}>
          <H2>질환이 있는 아이라면</H2>
          <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }}>
            앱 설문에서 진단받은 질환을 고르면 영양 구성과 보충 권장이 함께 조정돼요. 식단을 바꾸기 전에 꼭 주치 수의사와 상의해 주세요.
          </p>
          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {conditionKeys.map((k) => (
              <span key={k} style={{ height: 38, padding: '0 12px', borderRadius: 4, border: '1px solid #BDBDBD', boxSizing: 'border-box', display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 700 }}>
                {conditionLabel(k)}
              </span>
            ))}
          </div>
          <Link
            href="/why-fresh"
            style={{ marginTop: 16, minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
          >
            왜 화식인지 더 알아보기
            <Chevron />
          </Link>
        </section>

        <section style={{ marginTop: 56, padding: '44px 20px 40px', background: '#F6F4F5', display: 'flex', flexDirection: 'column' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#595959' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3.5l9.5 16.5h-19z" />
              <path d="M12 10v4.5M12 17.2v.3" />
            </svg>
            한계도 그대로 말해요
          </span>
          <H2 style={{ marginTop: 6 }}>우리가 하지 않는 것</H2>
          <dl style={{ margin: '16px 0 0', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
            {LIMITS.map((l) => (
              <div key={l.t} style={{ padding: '14px 0', borderBottom: '1px solid #D9D9D9', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <dt style={{ fontSize: 18, fontWeight: 800 }}>{l.t}</dt>
                <dd style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: '#3D3D3D' }}>{l.d}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section style={{ padding: '48px 20px 40px', display: 'flex', flexDirection: 'column' }}>
          <H2 style={{ fontSize: 28, lineHeight: 1.15 }}>직접 먹여 볼까요?</H2>
          <Link
            href="/store"
            style={{ marginTop: 18, height: 60, borderRadius: 4, background: '#141414', color: '#FFFFFF', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 19, fontWeight: 800 }}
          >
            레시피 고르기
            <Arrow />
          </Link>
          <Link
            href="/app"
            style={{ marginTop: 14, minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, color: '#141414', textDecoration: 'none' }}
          >
            <span>
              우리 아이 맞춤 정기배송은 <strong style={{ fontWeight: 800, color: '#1D3B2F' }}>앱에서 {SUBSCRIPTION_DISCOUNT_PCT}% 할인</strong>
            </span>
            <Chevron />
          </Link>
          <p style={{ margin: '28px 0 0', fontSize: 14, lineHeight: 1.65, color: '#595959' }}>
            이 페이지는 일반 정보를 드리기 위한 것으로, 의료 자문이나 진료를 대신하지 않아요. 응급 상황이면 가까운 24시간 동물병원에 바로 연락해 주세요.
          </p>
        </section>
      </div>
    </StoreShell>
  )
}
