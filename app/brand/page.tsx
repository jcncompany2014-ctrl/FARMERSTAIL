import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, ArrowUpRight, Leaf, ShieldCheck, Sparkles, Repeat } from 'lucide-react'
import JsonLd from '@/components/JsonLd'
import {
  buildAboutPageJsonLd,
  buildBreadcrumbJsonLd,
  SITE_URL,
} from '@/lib/seo/jsonld'

/**
 * /brand — 웹 전용 브랜드 스토리 (와이드 magazine cover 톤).
 *
 * /about 은 모바일 phone-frame max-w 880 의 narrow column 톤.
 * /brand 는 데스크톱 1280 풀와이드 + 풀블리드 hero + 챕터 인덱스 + 스탯 grid +
 * 큰 인용문 카드 — 웹쇼핑몰의 "About" 섹션 답게 마케팅 임팩트가 더 큰 페이지.
 *
 * 둘 다 sitemap 등록. /about → 모바일/SEO 우선 / /brand → 웹 컨버전 우선.
 */

export const metadata: Metadata = {
  title: '브랜드 이야기 | 파머스테일',
  description:
    '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
  alternates: { canonical: '/brand' },
  openGraph: {
    type: 'article',
    title: '브랜드 이야기 | 파머스테일',
    description:
      '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
    url: '/brand',
  },
  robots: { index: true, follow: true },
}

const CHAPTERS = [
  { id: 'origin', no: '01', label: '시작', en: 'Origin' },
  { id: 'pledge', no: '02', label: '약속', en: 'Pledge' },
  { id: 'kitchen', no: '03', label: '주방', en: 'Kitchen' },
  { id: 'farm', no: '04', label: '농장', en: 'Farm' },
  { id: 'next', no: '05', label: '앞으로', en: 'What’s Next' },
]

const STATS: { n: string; label: string; sub: string }[] = [
  { n: '100%', label: '사람 등급 재료', sub: 'Human-grade Only' },
  { n: '7일', label: '주 1회 소량 생산', sub: 'Weekly · Small Batch' },
  { n: '0', label: '인공 보존료 / 향료', sub: 'No Preservatives' },
  { n: '48h', label: '조리 → 출고 콜드체인', sub: 'Cold Chain · 48h' },
]

const PILLARS = [
  {
    icon: Leaf,
    tone: 'var(--moss)',
    label: 'Sourcing',
    title: '국내 농가에서, 직접',
    body:
      '강원·전남·제주 등 30여 곳의 계약 농가에서 주 2회 입고. 도축 / 수확 24 시간 안에 작업장에 도착하고, 원산지·농가는 패키지에 표기.',
  },
  {
    icon: ShieldCheck,
    tone: 'var(--ink)',
    label: 'Recipe',
    title: '수의영양학 자문 레시피',
    body:
      '서울대 수의영양학 자문으로 단백질 / 지방 / 미네랄 비율을 맞춰 설계. AAFCO 기준 이상의 단일 배합 레시피로 영양 격차 없이.',
  },
  {
    icon: Sparkles,
    tone: 'var(--terracotta)',
    label: 'Cooking',
    title: '저온 스팀 조리',
    body:
      '72°C 저온 스팀으로 단백질 변성·영양 손실을 최소화. 조리 후 즉시 급속 냉동해 효소·풍미를 그대로 유지.',
  },
  {
    icon: Repeat,
    tone: 'var(--gold)',
    label: 'Care',
    title: '식단 그 이후의 케어',
    body:
      '앱에서 매일 식사·체중·산책을 기록하고, 매달 수의사 리뷰가 붙는 식단 노트를 받는다. 식단을 사고 끝나는 게 아니라 같이 사는 동안 옆에 있는 브랜드.',
  },
]

export default function BrandPage() {
  const aboutLd = buildAboutPageJsonLd({
    name: '브랜드 이야기 — 파머스테일',
    description:
      '농장에서 꼬리까지. 사람이 먹는 등급의 재료로 시작된 파머스테일의 약속과 여정.',
    url: `${SITE_URL}/brand`,
  })
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '브랜드', path: '/brand' },
  ])

  return (
    <main
      className="pb-16 md:pb-28"
      style={{ background: 'var(--bg)' }}
    >
      <JsonLd id="ld-brand-about" data={aboutLd} />
      <JsonLd id="ld-brand-crumbs" data={crumbLd} />
      {/* breadcrumb */}
      <div
        className="px-5 md:px-8 pt-4 md:pt-6 mx-auto"
        style={{ maxWidth: 1280 }}
      >
        <nav
          aria-label="현재 위치"
          className="flex items-center gap-1 text-[11px] md:text-[12px]"
          style={{ color: 'var(--muted)' }}
        >
          <Link href="/" className="hover:text-terracotta transition">
            홈
          </Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>
            브랜드
          </span>
        </nav>
      </div>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        className="relative mx-auto px-5 md:px-12 pt-8 md:pt-20 pb-12 md:pb-24 grain grain-soft"
        style={{ maxWidth: 1280 }}
      >
        <div
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--terracotta)' }}
        >
          Vol. 03 · The Farmer&rsquo;s Tail Story
        </div>
        <h1
          className="font-serif mt-4 md:mt-6 text-[44px] md:text-[96px] lg:text-[120px]"
          style={{
            fontWeight: 900,
            color: 'var(--ink)',
            letterSpacing: '-0.045em',
            lineHeight: 0.92,
          }}
        >
          농장에서
          <br />
          <span className="font-serif italic" style={{ fontWeight: 500, color: 'var(--terracotta)' }}>
            꼬리까지
          </span>
          <span style={{ color: 'var(--terracotta)' }}>.</span>
        </h1>

        <p
          className="mt-6 md:mt-10 max-w-2xl text-[14px] md:text-[18px] leading-[1.7]"
          style={{ color: 'var(--text)' }}
        >
          파머스테일은 한 마리의 늙은 보더콜리에게서 시작됐어요. 사료를 넘겨도
          잘 안 먹는 아이를 위해 매일 부엌에서 정성을 들였던 이름 모를 보호자들의
          습관 — 우리는 그 마음을 표준으로 옮기려 합니다.{' '}
          <strong style={{ color: 'var(--ink)' }}>
            사람이 먹어도 되는 재료로, 사람의 식탁과 같은 기준으로.
          </strong>
        </p>

        {/* 챕터 인덱스 */}
        <nav
          aria-label="챕터"
          className="mt-10 md:mt-16 grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4"
        >
          {CHAPTERS.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className="group rounded-xl px-4 py-3 md:px-5 md:py-4 transition active:scale-[0.97] hover:bg-bg-2"
              style={{
                background: 'var(--bg)',
                boxShadow: 'inset 0 0 0 1px var(--rule)',
              }}
            >
              <div
                className="font-mono text-[9px] md:text-[10.5px] tracking-[0.22em] uppercase mb-1"
                style={{ color: 'var(--terracotta)' }}
              >
                Ch · {c.no}
              </div>
              <div
                className="font-serif text-[14px] md:text-[18px]"
                style={{
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                {c.label}
              </div>
              <div
                className="font-mono text-[9px] md:text-[10px] tracking-[0.16em] uppercase mt-0.5"
                style={{ color: 'var(--muted)' }}
              >
                {c.en}
              </div>
            </a>
          ))}
        </nav>
      </section>

      {/* ── Ch 01 · Origin ─────────────────────────────────── */}
      <Chapter
        id="origin"
        no="01"
        label="Origin"
        title="한 마리 강아지에게서 시작된"
        body={[
          '열세 살 보더콜리 ‘보리’의 만성 소화 문제로 사료에서 화식으로 식단을 갈아엎던 어느 새벽, 부엌에 도마가 일곱 개였어요. 단백질·탄수화물·지방·섬유·필수지방산까지 비율을 손으로 맞춰 가며 끓이고 데치고 식히는 사이, 한 가지 사실이 너무 명확해졌습니다.',
          '시중의 “반려견 식품” 중에서 사람이 먹는 등급의 재료로 만들어지는 건 손에 꼽았어요. 그래서 직접 만들기로 했습니다. 우리 아이에게 줄 수 있어야 다른 아이에게도 줄 수 있다 — 그게 첫 규칙이었어요.',
        ]}
      />

      <BigQuote text="시중의 “반려견 식품” 중에서 사람이 먹는 등급의 재료로 만들어지는 건 손에 꼽았어요." />

      {/* ── Ch 02 · Pledge ─────────────────────────────────── */}
      <Chapter
        id="pledge"
        no="02"
        label="Pledge"
        title="네 가지를 절대 타협하지 않아요"
        body={null}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-2">
          {PILLARS.map((p) => {
            const Icon = p.icon
            return (
              <div
                key={p.label}
                className="rounded-2xl p-5 md:p-7"
                style={{
                  background: 'var(--bg-2)',
                  boxShadow: 'inset 0 0 0 1px var(--rule)',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--bg)' }}
                  >
                    <Icon
                      className="w-4 h-4 md:w-5 md:h-5"
                      strokeWidth={2}
                      color={p.tone}
                    />
                  </span>
                  <span
                    className="font-mono text-[10px] md:text-[11px] tracking-[0.2em] uppercase"
                    style={{ color: p.tone, fontWeight: 700 }}
                  >
                    {p.label}
                  </span>
                </div>
                <h3
                  className="font-serif mt-4 md:mt-5 text-[18px] md:text-[22px] lg:text-[26px]"
                  style={{
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {p.title}
                </h3>
                <p
                  className="mt-2 md:mt-3 text-[13px] md:text-[15px] leading-relaxed"
                  style={{ color: 'var(--text)' }}
                >
                  {p.body}
                </p>
              </div>
            )
          })}
        </div>
      </Chapter>

      {/* ── Stats ───────────────────────────────────────── */}
      <section
        className="mx-auto px-5 md:px-12 mt-12 md:mt-20"
        style={{ maxWidth: 1280 }}
      >
        <div
          className="rounded-2xl px-5 py-7 md:px-12 md:py-14"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          <div
            className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
            style={{ color: 'var(--gold)' }}
          >
            By the Numbers
          </div>
          <h2
            className="font-serif mt-3 md:mt-4 text-[24px] md:text-[40px]"
            style={{
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            숫자가 말하는 우리의 기준
          </h2>
          <ul className="mt-7 md:mt-12 grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-8">
            {STATS.map((s) => (
              <li
                key={s.label}
                className="border-l-2 pl-4 md:pl-5"
                style={{ borderColor: 'rgba(212,175,55,0.32)' }}
              >
                <div
                  className="font-serif tabular-nums text-[36px] md:text-[64px] lg:text-[72px]"
                  style={{
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    fontVariantNumeric: 'lining-nums tabular-nums',
                  }}
                >
                  {s.n}
                </div>
                <div
                  className="mt-2 md:mt-3 font-serif text-[13px] md:text-[16px]"
                  style={{ fontWeight: 700, letterSpacing: '-0.015em' }}
                >
                  {s.label}
                </div>
                <div
                  className="font-mono text-[9px] md:text-[10.5px] tracking-[0.2em] uppercase mt-1"
                  style={{ color: 'var(--gold)' }}
                >
                  {s.sub}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Ch 03 · Kitchen ──────────────────────────────── */}
      <Chapter
        id="kitchen"
        no="03"
        label="Kitchen"
        title="작업장에 사람의 부엌과 같은 규칙을"
        body={[
          '경기 이천의 작업장은 식품 안전 인증(HACCP 준비 단계)을 받았고, 도축·수확된 원료는 24 시간 내에 손질이 시작됩니다. 72°C 저온 스팀으로 단백질을 익히고, 조리 직후 급속 냉동 — 이 흐름이 영양 손실을 가장 적게 두는 구간이에요.',
          '주 단위 소량 생산이라 재고가 거의 0 입니다. 무리하게 양을 쌓아 두지 않아도 우리 일정이 돌아가도록, 정기배송과 알림이 한 시스템으로 묶여 있어요.',
        ]}
      />

      {/* ── Ch 04 · Farm ─────────────────────────────────── */}
      <Chapter
        id="farm"
        no="04"
        label="Farm"
        title="이름 있는 재료, 이름 있는 농가"
        body={[
          '강원 평창의 한우 농가, 전남 완도의 자연산 연어, 제주 구좌의 당근 — 우리는 “수입산 육류” 같은 익명 표기를 쓰지 않아요. 시즌마다 농가 라인업은 조금씩 변해도, 어느 농가 / 어느 품목 / 어느 시기인지를 패키지에 그대로 적습니다.',
          '재료 가격이 지나치게 변동성을 보일 때는 시세를 따라가는 게 아니라 메뉴 자체를 잠시 빼요. 좋은 재료가 들어가지 않으면 만들지 않는다 — 그게 우리에겐 가장 단순한 규칙입니다.',
        ]}
      />

      {/* ── Ch 05 · Next ─────────────────────────────────── */}
      <Chapter
        id="next"
        no="05"
        label="What's Next"
        title="식단 그 다음의 그릇"
      >
        <p
          className="text-[14px] md:text-[16.5px] leading-[1.85]"
          style={{ color: 'var(--text)', maxWidth: 760 }}
        >
          영양 데이터, 케어 기록, 매달 식단 노트 — 식단이 지나간 자리에 무엇이
          남는지를 우리는 기록으로 보존하려 해요. 강아지가 가장 잘 먹는 한
          끼는 매번 조금씩 변합니다. 다음 시즌에는 알레르기 케어 라인,
          소형견 토퍼, 그리고 노령견을 위한 저단백·저인 라인이 차례로 추가될
          예정입니다.
        </p>

        <div className="mt-7 md:mt-10 flex flex-col md:flex-row gap-2.5 md:gap-3 md:max-w-md">
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 h-[52px] md:h-[60px] px-6 rounded-xl text-[14px] md:text-[15.5px] font-bold transition active:scale-[0.98]"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              letterSpacing: '-0.01em',
            }}
          >
            오늘 메뉴 보기
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
          <Link
            href="/collections"
            className="inline-flex items-center justify-center gap-2 h-[52px] md:h-[60px] px-6 rounded-xl text-[14px] md:text-[15.5px] font-bold transition active:scale-[0.98]"
            style={{
              background: 'transparent',
              color: 'var(--ink)',
              border: '1px solid var(--ink)',
            }}
          >
            큐레이션 컬렉션
          </Link>
        </div>
      </Chapter>
    </main>
  )
}

// ───────────────────────────── atoms ─────────────────────────────

function Chapter({
  id,
  no,
  label,
  title,
  body,
  children,
}: {
  id: string
  no: string
  label: string
  title: string
  body?: string[] | null
  children?: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 mx-auto px-5 md:px-12 mt-14 md:mt-24"
      style={{ maxWidth: 1280 }}
    >
      <div className="md:grid md:grid-cols-[180px_1fr] md:gap-12">
        <div className="md:sticky md:top-32 self-start mb-4 md:mb-0">
          <div
            className="font-mono text-[10px] md:text-[11px] tracking-[0.22em] uppercase"
            style={{ color: 'var(--terracotta)' }}
          >
            Ch · {no}
          </div>
          <div
            className="mt-1 font-mono text-[10px] md:text-[11px] tracking-[0.18em] uppercase"
            style={{ color: 'var(--muted)' }}
          >
            {label}
          </div>
        </div>
        <div>
          <h2
            className="font-serif text-[26px] md:text-[44px] lg:text-[52px] leading-tight"
            style={{
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.03em',
            }}
          >
            {title}
          </h2>
          {body && (
            <div className="mt-5 md:mt-7 flex flex-col gap-4 md:gap-5">
              {body.map((p, i) => (
                <p
                  key={i}
                  className="text-[14px] md:text-[16.5px] leading-[1.85]"
                  style={{ color: 'var(--text)', maxWidth: 760 }}
                >
                  {p}
                </p>
              ))}
            </div>
          )}
          {children && <div className="mt-5 md:mt-7">{children}</div>}
        </div>
      </div>
    </section>
  )
}

function BigQuote({ text }: { text: string }) {
  return (
    <section
      className="mx-auto px-5 md:px-12 mt-10 md:mt-16"
      style={{ maxWidth: 1280 }}
    >
      <blockquote
        className="font-serif italic text-[20px] md:text-[36px] lg:text-[44px] leading-[1.25] max-w-3xl border-l-2 pl-5 md:pl-8"
        style={{
          color: 'var(--terracotta)',
          fontWeight: 500,
          letterSpacing: '-0.025em',
          borderColor: 'var(--terracotta)',
        }}
      >
        &ldquo;{text}&rdquo;
      </blockquote>
    </section>
  )
}
