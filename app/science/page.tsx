import type { Metadata } from 'next'
import {
  FlaskConical,
  ClipboardList,
  BookOpen,
  Microscope,
  Scale,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import {
  GUIDELINE_CITATIONS,
  CHRONIC_CONDITION_LABELS,
} from '@/lib/nutrition/guidelines'
import { ogImageUrl, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import JsonLd from '@/components/JsonLd'
import WebChrome from '@/components/WebChrome'
import WebMotion from '@/components/web/motion/WebMotion'
import StickyCta from '@/components/web/fd/StickyCta'
import { Button, Container, Display, Eyebrow, PhotoSlot, Section } from '@/components/web/fd/ui'
import Reveal from '@/components/landing/Reveal'
import { cred } from '@/lib/copy/credibility'
import FunnelCta from '@/components/web/FunnelCta'

/**
 * /science — 수의영양학 방법론 권위 페이지 (farm v6 = FD 톤, 2026-06-13).
 * 기존 bare main → WebChrome(web) 래핑 + FD 톤. 가이드라인 인용·계산식·면책·
 * lib 데이터(GUIDELINE_CITATIONS·CHRONIC_CONDITION_LABELS) 보존. CTA → 설문 퍼널.
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
    'NRC 2006 · AAFCO 2024 · FEDIAF 2021 · WSAVA 가이드라인을 어떻게 적용하는지, RER/MER 계산식, 만성질환 분기, AI 의 역할과 한계까지 공개합니다.',
  alternates: { canonical: '/science' },
  openGraph: {
    title: '수의영양학 — 분석 방법론 | 파머스테일',
    description:
      'NRC 2006 · AAFCO 2024 · FEDIAF 2021 · WSAVA 가이드라인 적용, RER/MER 계산식, 만성질환 분기, AI 의 역할과 한계까지 공개.',
    type: 'article',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/science',
    images: [{ url: SCIENCE_OG, width: 1200, height: 630, alt: '수의영양학 방법론' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '수의영양학 — 분석 방법론 | 파머스테일',
    description: 'NRC · AAFCO · FEDIAF · WSAVA 적용, RER/MER 계산식, AI 의 역할과 한계까지 공개.',
    images: [SCIENCE_OG],
  },
  robots: { index: true, follow: true },
}

const METHODS = [
  { num: '01', Icon: ClipboardList, title: '임상 평가 수준의 설문', body: 'WSAVA 의 9-point Body Condition Score, 4-grade Muscle Condition Score, Bristol Stool 1~7 — 수의 임상에서 실제로 쓰는 평가 척도를 그대로 적용합니다. 더해 만성질환·복용약·임신/수유 상태까지 받아요.' },
  { num: '02', Icon: Scale, title: 'RER · MER 계산식', body: '기초대사량 RER = 70 × (체중kg)^0.75 (NRC 2006). 여기에 생애주기·활동량·BCS·중성화·임신/수유·MCS·만성질환 보정계수를 곱해 일일 권장 칼로리 MER 을 산출합니다. 모든 계수는 가이드라인 인용.' },
  { num: '03', Icon: FlaskConical, title: '질환별 식이 분기', body: '당뇨·신장·심장·췌장염·IBD·관절염·간질환·요결석 등 만성질환에 대해 단백질·지방·탄수·식이섬유 비율, 인·나트륨·오메가3 를 각각 분기. 처방식 환자에게는 식이 변경 전 수의사 상담을 강하게 권장합니다.' },
  { num: '04', Icon: Microscope, title: 'AI 는 해석 도우미', body: '계산은 결정론적(같은 입력 = 같은 결과). AI 는 그 결과를 보호자에게 정중히 풀어 쓰고, 위험 신호와 식단 전환 7일 플랜을 만드는 역할만 해요. 의학적 진단·약물 처방은 절대 하지 않습니다.' },
]

const LIMITS = [
  { t: '의학적 진단', b: '우리 분석은 식이 권장입니다. 질병 진단·치료를 대체하지 않아요.' },
  { t: '약물 처방', b: '보충제 권장은 식이 차원이에요. 약물·처방식 변경은 반드시 주치 수의사와.' },
  { t: '혈액검사 대체', b: '6개월 이상 만성질환 보유견은 정기 혈액검사를 함께 진행해 주세요.' },
  { t: '품종 영양 표준', b: '견종별 미세 분기는 일반화하지 않아요. 동일 품종 안에서도 개체차가 큽니다.' },
]

export default async function SciencePage() {

  const conditionKeys = Object.keys(CHRONIC_CONDITION_LABELS) as Array<keyof typeof CHRONIC_CONDITION_LABELS>

  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    // 라벨은 nav/footer 와 동일 토글(실 자문 없을 땐 '영양 근거').
    { name: cred.navVetLabel, path: '/science' },
  ])

  return (
    <WebChrome>
      <WebMotion />
      <main>
        <JsonLd id="ld-science-crumbs" data={crumbLd} />
        {/* Hero */}
        <Section bg="offwhite" pad="md">
          <Container size="lg">
            <Eyebrow>SCIENCE</Eyebrow>
            <Display as="h1" size="xl" className="pt-4" style={{ color: 'var(--fd-pine)' }}>
              {/* 글자 단위 스태거 등장(WebMotion). JS·reduced-motion 실패 시엔
                    이 평문이 그대로 보인다 — 폴백 무손실. */}
              <span data-gsap="hero-title" className="block">
                우리가 어떻게
                <br />
                <span style={{ color: 'var(--fd-coral)' }}>영양을 설계하는지</span>
              </span>
            </Display>
            <p className="pt-5 text-[15px] md:text-[17px]" style={{ color: 'var(--fd-muted)', maxWidth: 680, lineHeight: 1.7 }}>
              수의영양학은 의료가 아니라 식이로 건강을 유지하는 학문입니다. 우리는
              마케팅 슬로건이 아니라 실제 가이드라인을 코드로 옮겨 식단을 설계해요.
              어떤 출처를 어떻게 쓰는지, AI 가 어디까지 하고 어디서 멈추는지 — 모두
              공개합니다.
            </p>
            {/* 스탯 스트립(2026-09-04 디자인 패스) — 페이지의 결론을 첫 화면에서
                숫자로. 수치는 아래 교차검증표의 사실 표기 재인용. */}
            <div className="mt-8 grid grid-cols-3 gap-3" style={{ maxWidth: 620 }}>
              {[
                { n: '43/43', l: '영양 항목 충족' },
                { n: '3', l: '국제 기준 교차 대조' },
                { n: '4', l: '레시피 전 종 검증' },
              ].map((s, i) => (
                <Reveal key={s.l} delay={i * 70}>
                  <div style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 10, padding: '16px 14px 14px' }}>
                    <div className="font-chunky" style={{ color: 'var(--fd-coral)', fontSize: 24, lineHeight: 1 }}>{s.n}</div>
                    <div className="mt-2 text-[11.5px] md:text-[12px]" style={{ color: 'var(--fd-muted)', fontWeight: 700 }}>{s.l}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        {/* Method */}
        <Section bg="cream" pad="md">
          <Container size="lg">
            <Eyebrow>METHOD</Eyebrow>
            <h2 className="sr-only">방법론</h2>
            <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {METHODS.map((m, i) => {
                const Icon = m.Icon
                return (
                  <Reveal key={m.num} delay={i * 70}>
                    <article style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 8, padding: '22px 20px' }}>
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="font-chunky" style={{ color: 'var(--fd-coral)', fontSize: 22 }}>{m.num}</span>
                        <Icon className="w-5 h-5" strokeWidth={1.6} color="var(--fd-green)" />
                      </div>
                      <h3 className="text-[16px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em' }}>{m.title}</h3>
                      <p className="mt-2 text-[12.5px] md:text-[13.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.65 }}>{m.body}</p>
                    </article>
                  </Reveal>
                )
              })}
            </div>
          </Container>
        </Section>

        {/* Citations */}
        <Section bg="white" pad="md">
          <Container size="md">
            <Eyebrow>CITATIONS</Eyebrow>
            <h2 className="sr-only">인용 가이드라인</h2>
            <ul className="mt-6" style={{ borderTop: '1px solid var(--fd-line)' }}>
              {GUIDELINE_CITATIONS.map((c) => (
                <li key={c.key} className="flex items-start gap-3.5 py-5" style={{ borderBottom: '1px solid var(--fd-line)' }}>
                  <BookOpen className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2} color="var(--fd-coral)" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full" style={{ background: 'var(--fd-coral)', color: '#FFFFFF', fontSize: 10.5, fontWeight: 700, padding: '2px 8px', letterSpacing: '0.04em' }}>{c.label}</span>
                      <h3 className="text-[15px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}>{c.title}</h3>
                    </div>
                    <p className="mt-1.5 text-[12.5px] md:text-[13px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.55 }}>{c.org}</p>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] font-bold underline underline-offset-2" style={{ color: 'var(--fd-coral-text)' }}>
                      원문 보러가기 →
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </Section>

        {/* Evidence — 실물 서류 (2026-09-04 사장님 자료: 교차검증표·품목보고·수입신고).
            문서 이미지는 ratio 를 원본 비율로 — cover 크롭되면 표·서류가 잘린다. */}
        <Section bg="cream" pad="md">
          <Container size="lg">
            <Eyebrow>EVIDENCE</Eyebrow>
            <Display size="md" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              말이 아니라 서류로
            </Display>
            <p className="pt-4 text-[13.5px] md:text-[15px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.65, maxWidth: 640 }}>
              레시피 4종의 설계값을 AAFCO·FEDIAF·NRC 3대 기준과 항목별로 교차
              대조한 표, 그리고 비타민·미네랄 프리믹스의 품목보고·원료 수입신고
              서류를 그대로 공개합니다.
            </p>

            {/* 문서 매트 + 도장 배지 — 랜딩과 같은 디자인 언어(2026-09-04 패스). */}
            <Reveal delay={80}>
              <div className="relative mx-auto mt-9" style={{ maxWidth: 820 }}>
                <div style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 16, padding: 14, boxShadow: '0 30px 70px -34px rgba(22,20,15,0.35)' }}>
                  <PhotoSlot
                    src="/nutrition-crossval-landing.webp"
                    alt="AAFCO·FEDIAF·NRC 3대 영양기준 교차검증표 — 레시피 4종 전 항목 검증"
                    label="영양 교차검증표"
                    ratio="3141 / 3010"
                    tone="green"
                    rounded={8}
                    className="w-full"
                  />
                </div>
                <div aria-hidden className="absolute" style={{ top: -16, right: 14, transform: 'rotate(-8deg)', zIndex: 2 }}>
                  <span
                    className="flex flex-col items-center justify-center text-center"
                    style={{ width: 92, height: 92, borderRadius: 999, background: 'var(--fd-coral)', color: '#FFFFFF', border: '3px solid #FFFFFF', boxShadow: '0 10px 24px -10px rgba(22,20,15,0.4)' }}
                  >
                    <span className="font-chunky" style={{ fontSize: 21, lineHeight: 1 }}>43/43</span>
                    <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', marginTop: 4 }}>항목 충족</span>
                  </span>
                </div>
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-6 flex flex-col items-center gap-4 text-center">
                <p className="text-[12px] md:text-[12.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.6, maxWidth: 560 }}>
                  기준치는 메뉴별 칼로리 기반 환산치, 설계값은 투입 재료의
                  영양성분 분석에 기반한 추정치입니다.
                </p>
                {/* FD Button 은 target 을 안 받는다(내부 Link) — 새 탭 PDF 는 순수 <a>. */}
                <a
                  href="/docs/farmerstail-cross-validation.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full text-[14px] md:text-[15px]"
                  style={{ padding: '13px 26px', background: 'var(--fd-pine)', color: '#FFFFFF', fontWeight: 800, letterSpacing: '-0.01em' }}
                >
                  교차검증표 원문(PDF) 보기
                  <ArrowRight size={17} strokeWidth={2.4} />
                </a>
              </div>
            </Reveal>

            {/* 서류 카드 2장 — 이미지 비율이 제각각(가로 스크린샷 vs 세로 증서)이라
                카드 높이가 어긋나던 것을, 같은 높이의 컨테인 액자(16:10, 크림 바닥)
                로 통일. 문서라 cover 크롭 금지 → object-contain. */}
            <div className="pt-10 grid md:grid-cols-2 gap-4 md:gap-6 md:items-stretch">
              {[
                {
                  chip: '식품안전나라 · 품목보고',
                  src: '/evidence-premix-report.webp',
                  alt: '파머스테일 뉴트리 코어 프리믹스 — 식품안전나라 품목보고 조회 화면',
                  t: '정식 품목보고된 프리믹스',
                  b: '비타민·미네랄 프리믹스 ‘파머스테일 뉴트리 코어’는 식품안전나라에 품목보고된 제품입니다.',
                  delay: 60,
                },
                {
                  chip: '수입식품 · 수입신고확인증',
                  src: '/evidence-import-cert.webp',
                  alt: '비타민·미네랄 원료의 수입식품 수입신고확인증 (개인정보 가림)',
                  t: '원료까지 신고 서류로',
                  b: '프리믹스에 쓰이는 원료는 수입식품 안전관리 특별법에 따른 수입신고확인증을 갖춘 것을 사용합니다. 개인정보 보호를 위해 성명·주소는 가렸어요.',
                  delay: 130,
                },
              ].map((d) => (
                <Reveal key={d.t} delay={d.delay} className="h-full">
                  <article className="h-full flex flex-col" style={{ background: '#FFFFFF', border: '1px solid var(--fd-line)', borderRadius: 12, overflow: 'hidden' }}>
                    <div className="relative flex items-center justify-center" style={{ aspectRatio: '16 / 10', background: 'var(--fd-cream)', padding: 14 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- 문서 원장:
                          contain 표시가 필수라 PhotoSlot(cover) 대신 직접 렌더 */}
                      <img src={d.src} alt={d.alt} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }} />
                      <span className="absolute rounded-full text-[10.5px]" style={{ top: 12, left: 12, padding: '4px 10px', background: 'var(--fd-pine)', color: '#FFFFFF', fontWeight: 800, letterSpacing: '0.03em' }}>{d.chip}</span>
                    </div>
                    <div className="flex-1" style={{ padding: '16px 18px 20px' }}>
                      <h3 className="text-[15px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--fd-pine)' }}>{d.t}</h3>
                      <p className="mt-1.5 text-[12.5px] md:text-[13px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.6 }}>{d.b}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        {/* Conditions */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>CONDITIONS</Eyebrow>
            <p className="pt-4 text-[13.5px] md:text-[15px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.65, maxWidth: 640 }}>
              설문에서 진단받은 질환을 표시하면 매크로·미네랄·보충제 권장이 자동으로
              조정돼요. 식이 변경은 반드시 주치 수의사와 상의 후 진행해 주세요.
            </p>
            <div className="pt-5 flex flex-wrap gap-2">
              {conditionKeys.map((k) => (
                <span key={k} className="inline-flex items-center rounded-full text-[12.5px]" style={{ padding: '7px 14px', background: '#FFFFFF', color: 'var(--fd-pine)', border: '1px solid var(--fd-line)', fontWeight: 700 }}>
                  {CHRONIC_CONDITION_LABELS[k]}
                </span>
              ))}
            </div>
            {/* 교육 페이지 딥링크 — 영양/질환 맥락에서 '왜 신선식인가' /why-fresh 로 (FD IA: 과학→교육) */}
            <Reveal delay={120}>
              <div className="pt-8 flex">
                <Button href="/why-fresh" tone="outline" size="sm">
                  왜 신선식인지 더 알아보기
                  <ArrowRight size={15} strokeWidth={2.4} />
                </Button>
              </div>
            </Reveal>
          </Container>
        </Section>

        {/* Limits (dark) */}
        <Section bg="pine" pad="md">
          <Container size="md">
            <div className="flex items-center gap-2">
              {/* 다크 위 텍스트 포인트 = 골드 (색 문법, globals.css 토큰 정의 참조 — 2026-08-01) */}
              <AlertTriangle className="w-5 h-5" strokeWidth={2} color="var(--fd-gold)" />
              <Eyebrow color="var(--fd-green-soft)">LIMITS</Eyebrow>
            </div>
            <Display size="md" className="pt-3" style={{ color: '#FFFFFF' }}>
              우리가 하지 않는 것
            </Display>
            <ul className="pt-6 grid md:grid-cols-2 gap-3">
              {LIMITS.map((l, i) => (
                <Reveal key={l.t} delay={i * 70}>
                  <li style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '16px 18px' }}>
                    <p style={{ fontWeight: 800, color: '#FFFFFF', fontSize: 15 }}>{l.t}</p>
                    <p className="mt-1.5 text-[13px]" style={{ color: 'var(--fd-green-soft)', lineHeight: 1.6 }}>{l.b}</p>
                  </li>
                </Reveal>
              ))}
            </ul>
          </Container>
        </Section>

        {/* CTA */}
        <Section bg="coral" pad="md">
          <Container size="md">
            <div className="text-center">
              <Display size="md" style={{ color: '#FFFFFF' }}>
                우리 아이에게 맞춰 분석하기
              </Display>
              <p className="pt-3 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 460, color: 'rgba(255,255,255,0.92)', lineHeight: 1.6 }}>
                2분 설문 후 표준 영양 기준에 따른 일일 권장 칼로리 + 매크로 비율 + 위험
                신호 + 식단 전환 플랜을 받아요.
              </p>
              <div className="pt-7 flex flex-col sm:flex-row justify-center gap-3">
                <FunnelCta tone="cream" size="lg">
                  2분 설문 시작하기
                  <ArrowRight size={19} strokeWidth={2.4} />
                </FunnelCta>
                <Button href="/our-food" tone="outlineLight" size="lg">
                  우리 음식 보기
                </Button>
              </div>
            </div>
          </Container>
        </Section>

        {/* 면책 */}
        <Section bg="offwhite" pad="sm">
          <Container size="md">
            <p className="text-[11.5px] md:text-[12.5px] text-center" style={{ color: 'var(--fd-muted)', lineHeight: 1.7 }}>
              본 페이지는 일반 정보 제공을 목적으로 하며 의료 자문이 아닙니다. 본
              분석을 진료/처방의 대안으로 사용하지 마세요. 응급 시에는 가까운 24시간
              동물병원으로 즉시 연락하시기 바랍니다.
            </p>
          </Container>
        </Section>
      </main>
      <StickyCta href="/start" />
    </WebChrome>
  )
}
