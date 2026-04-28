import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, MapPin, Sprout, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

/**
 * /partners — 농장 파트너 소개 페이지.
 *
 * 우선 DB (`partners` 테이블, /admin/partners 에서 관리) 에서 published 행을
 * 가져오고, 비어 있거나 fetch 가 실패하면 hardcoded fallback (FALLBACK_PARTNERS)
 * 을 그대로 보여줘서 페이지가 절대 빈 채로 노출되지 않도록 한다.
 */
export const revalidate = 300

export const metadata: Metadata = {
  title: '농장 파트너 | 파머스테일',
  description:
    '강원 평창의 한우, 전남 완도의 자연산 연어, 제주 구좌의 당근 — 파머스테일이 직접 계약한 농가와 작업장.',
  alternates: { canonical: '/partners' },
  openGraph: {
    title: '농장 파트너 | 파머스테일',
    description:
      '재료의 출처를 농가 단위까지 추적합니다. 익명의 “수입산”은 들어가지 않아요.',
    type: 'article',
    url: '/partners',
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

// Fallback — DB 가 비어 있거나 fetch 가 실패한 환경 (개발/프리뷰) 에서 그대로 사용.
const FALLBACK_PARTNERS: Partner[] = [
  {
    region: '강원 평창',
    name: '평창 청옥 한우농가',
    ingredient: '한우 안심 / 양지',
    body:
      '해발 700m 이상 청정 목초지에서 방목·곡물 병행 사육. 도축 24시간 내 작업장 도착, 익일 조리.',
    cert: '1++ / HACCP',
  },
  {
    region: '전남 완도',
    name: '완도 청해진수산',
    ingredient: '자연산 연어 / 황태',
    body:
      '양식이 아닌 자연산만 입고. 수은·중금속 검사 매 배치 외부기관 의뢰.',
    cert: '수산물 위생증명',
  },
  {
    region: '제주 구좌',
    name: '구좌 무농약 당근밭',
    ingredient: '당근 / 비트',
    body:
      '4년 윤작·무농약 인증. 화학 비료 / 제초제 일체 미사용. 수확 후 24시간 내 입고.',
    cert: '무농약 인증',
  },
  {
    region: '충북 괴산',
    name: '괴산 유기 귀리',
    ingredient: '귀리 / 현미',
    body:
      '국내 1세대 유기 곡물 농가. 잔류 농약 제로. 도정 후 1주 안에 사용.',
    cert: '유기농 인증',
  },
  {
    region: '경기 이천',
    name: '이천 작업장 (자체)',
    ingredient: '조리 · 소분 · 냉동',
    body:
      'HACCP 준비 단계 시설. 72°C 저온 스팀 조리 → 급속 냉동 (−40°C) 콜드체인.',
    cert: 'HACCP 준비',
  },
  {
    region: '전국',
    name: 'CJ대한통운 콜드체인',
    ingredient: '드라이아이스 배송',
    body:
      '조리 후 48시간 내 도착 보증. 도서산간 추가 1일. 재배송 시 신선도 보증.',
  },
]

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
  return (
    <main
      className="pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 1280 }}
    >
      {/* breadcrumb */}
      <div className="px-5 md:px-8 pt-4 md:pt-6">
        <nav
          aria-label="현재 위치"
          className="flex items-center gap-1 text-[11px] md:text-[12px]"
          style={{ color: 'var(--muted)' }}
        >
          <Link href="/" className="hover:text-terracotta transition">
            홈
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <Link href="/brand" className="hover:text-terracotta transition">
            브랜드
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>
            농장 파트너
          </span>
        </nav>
      </div>

      <section className="px-5 md:px-12 pt-6 md:pt-14 pb-8 md:pb-12">
        <span
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--terracotta)' }}
        >
          Partners · 농장 파트너
        </span>
        <h1
          className="font-serif mt-3 md:mt-5 text-[28px] md:text-[52px] lg:text-[64px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
          }}
        >
          재료에는
          <br />
          <span style={{ color: 'var(--terracotta)' }}>이름이 있어야 해요</span>
        </h1>
        <p
          className="mt-4 md:mt-6 text-[13px] md:text-[16.5px] leading-relaxed max-w-xl"
          style={{ color: 'var(--text)' }}
        >
          강원 평창의 한우, 전남 완도의 자연산 연어, 제주 구좌의 당근. 우리는
          재료의 원산지를 농가 단위까지 표기합니다. 익명의 ‘수입산 육류’나
          ‘복합 곡물’이 들어가는 일은 없습니다.
        </p>
      </section>

      <section className="px-5 md:px-12 pb-12">
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {partners.map((p) => (
            <li
              key={p.name}
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-2)',
                boxShadow: 'inset 0 0 0 1px var(--rule)',
              }}
            >
              {p.image_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-full h-44 md:h-56 object-cover"
                  loading="lazy"
                />
              )}
              <div className="p-5 md:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-1.5 mb-2 md:mb-3">
                      <MapPin
                        className="w-3.5 h-3.5"
                        strokeWidth={2}
                        color="var(--terracotta)"
                      />
                      <span
                        className="font-mono text-[10px] md:text-[11px] tracking-[0.18em] uppercase"
                        style={{ color: 'var(--terracotta)', fontWeight: 700 }}
                      >
                        {p.region}
                      </span>
                    </div>
                    <h2
                      className="font-serif text-[18px] md:text-[22px]"
                      style={{
                        fontWeight: 800,
                        color: 'var(--ink)',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                      }}
                    >
                      {p.name}
                    </h2>
                    <div
                      className="mt-1 md:mt-1.5 text-[12px] md:text-[13.5px]"
                      style={{ color: 'var(--muted)' }}
                    >
                      {p.ingredient}
                    </div>
                  </div>
                  {p.cert && (
                    <span
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] md:text-[10.5px] font-bold"
                      style={{
                        background: 'color-mix(in srgb, var(--moss) 12%, var(--bg))',
                        color: 'var(--moss)',
                      }}
                    >
                      <Award className="w-3 h-3" strokeWidth={2.25} />
                      {p.cert}
                    </span>
                  )}
                </div>

                <p
                  className="mt-3 md:mt-5 text-[13px] md:text-[15px] leading-relaxed"
                  style={{ color: 'var(--text)' }}
                >
                  {p.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-5 md:px-12">
        <div
          className="rounded-2xl px-5 py-6 md:px-10 md:py-10 text-center"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          <Sprout
            className="w-7 h-7 md:w-9 md:h-9 mx-auto"
            strokeWidth={1.6}
            color="var(--gold)"
          />
          <h2
            className="font-serif mt-3 md:mt-4 text-[19px] md:text-[28px]"
            style={{ fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            농장과 함께 키우는 식탁
          </h2>
          <p
            className="mt-2 md:mt-4 text-[12.5px] md:text-[15px] leading-relaxed mx-auto max-w-xl"
            style={{ color: 'rgba(245,240,230,0.78)' }}
          >
            새 파트너는 매년 분기별로 합류합니다. 함께 작업하고 싶은 농가는
            아래 메일로 제안해 주세요.
          </p>
          <a
            href="mailto:b2b@farmerstail.kr?subject=농가 파트너 제안"
            className="inline-flex items-center gap-1.5 mt-5 md:mt-7 px-5 md:px-7 py-2.5 md:py-3 rounded-full text-[12.5px] md:text-[14px] font-bold"
            style={{ background: 'var(--gold)', color: 'var(--ink)' }}
          >
            농가 제안 보내기
          </a>
        </div>
      </section>
    </main>
  )
}
