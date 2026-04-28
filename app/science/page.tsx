import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ChevronRight,
  FlaskConical,
  ClipboardList,
  BookOpen,
  Microscope,
  Scale,
  Heart,
  AlertTriangle,
} from 'lucide-react'
import {
  GUIDELINE_CITATIONS,
  CHRONIC_CONDITION_LABELS,
} from '@/lib/nutrition/guidelines'

/**
 * /science — 우리가 어떻게 영양 분석을 하는지 공개하는 권위 페이지.
 *
 * 마케팅 슬로건이 아니라 실제 사용 가이드라인 / 계산식 / 한계를 명시.
 * 보호자가 읽고 "어 진짜 수의영양학 기반이네" 라고 납득할 수 있게 구체적으로.
 */

export const metadata: Metadata = {
  title: '수의영양학 — 분석 방법론 | 파머스테일',
  description:
    'NRC 2006 · AAFCO 2024 · FEDIAF 2021 · WSAVA 가이드라인을 어떻게 적용하는지, RER/MER 계산식, 만성질환 분기, AI 의 역할과 한계까지 공개합니다.',
  alternates: { canonical: '/science' },
  robots: { index: true, follow: true },
}

export default function SciencePage() {
  return (
    <main
      className="pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 1080 }}
    >
      <div className="px-5 md:px-8 pt-4 md:pt-6">
        <nav
          aria-label="현재 위치"
          className="flex items-center gap-1 text-[11px] md:text-[12px]"
          style={{ color: 'var(--muted)' }}
        >
          <Link href="/" className="hover:text-terracotta transition">홈</Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <Link href="/brand" className="hover:text-terracotta transition">브랜드</Link>
          <ChevronRight className="w-3 h-3 opacity-50" strokeWidth={2} />
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>수의영양학</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="px-5 md:px-8 pt-6 md:pt-14 pb-8 md:pb-12">
        <span
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--terracotta)' }}
        >
          Science · 수의영양학
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
          우리가 어떻게
          <br />
          <span style={{ color: 'var(--terracotta)' }}>영양을 설계하는지</span>
        </h1>
        <p
          className="mt-4 md:mt-6 text-[13px] md:text-[16.5px] leading-relaxed max-w-2xl"
          style={{ color: 'var(--text)' }}
        >
          수의영양학(Veterinary Nutrition)은 의료가 아니라 식이로 건강을 유지하는
          학문입니다. 우리는 마케팅 슬로건이 아니라 실제 가이드라인을 코드로
          옮겨 식단을 설계해요. 어떤 출처를 어떻게 쓰는지, AI 가 어디까지 하고
          어디서 멈추는지 — 모두 공개합니다.
        </p>
      </section>

      {/* 4-step 방법론 */}
      <section className="px-5 md:px-8 mb-10 md:mb-14">
        <div className="flex items-center gap-2 mb-5 md:mb-7">
          <span className="kicker">Method · 방법론</span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          <MethodCard
            num="01"
            Icon={ClipboardList}
            title="임상 평가 수준의 설문"
            body="WSAVA 의 9-point Body Condition Score, 4-grade Muscle Condition Score, Bristol Stool 1~7 — 수의 임상에서 실제로 사용하는 평가 척도를 그대로 적용합니다. 더해서 만성질환·복용약·임신/수유 상태까지 8단계로 받아요."
          />
          <MethodCard
            num="02"
            Icon={Scale}
            title="RER · MER 계산식"
            body={`기초대사량 RER = 70 × (체중kg)^0.75 (NRC 2006). 여기에 생애주기 / 활동량 / BCS / 중성화 / 임신·수유 / MCS / 만성질환 보정계수를 곱해 일일 권장 칼로리 MER 을 산출합니다. 모든 계수는 가이드라인 인용.`}
          />
          <MethodCard
            num="03"
            Icon={FlaskConical}
            title="질환별 식이 분기"
            body="당뇨·신장·심장·췌장염·IBD·관절염·간질환·요결석 등 11개 만성질환에 대해 단백질·지방·탄수·식이섬유 비율, 인·나트륨·오메가3 미네랄을 각각 분기. 처방식 환자에게는 식이 변경 전 수의사 상담을 강하게 권장합니다."
          />
          <MethodCard
            num="04"
            Icon={Microscope}
            title="AI 는 해석 도우미"
            body="계산은 결정론적 (같은 입력 = 같은 결과). AI 는 그 결과를 보호자에게 정중체로 풀어 쓰고, 위험 신호와 식단 전환 7일 플랜을 만들어내는 역할만 해요. 의학적 진단·약물 처방은 절대 하지 않습니다."
          />
        </div>
      </section>

      {/* 가이드라인 인용 */}
      <section className="px-5 md:px-8 mb-10 md:mb-14">
        <div className="flex items-center gap-2 mb-5 md:mb-7">
          <span className="kicker">Citations · 출처</span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
        </div>
        <ul
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-2)',
            boxShadow: 'inset 0 0 0 1px var(--rule)',
          }}
        >
          {GUIDELINE_CITATIONS.map((c, i) => (
            <li
              key={c.key}
              className="px-5 md:px-7 py-4 md:py-5 flex items-start gap-4"
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--rule-2)',
              }}
            >
              <BookOpen
                className="w-4 h-4 md:w-5 md:h-5 shrink-0 mt-1"
                strokeWidth={2}
                color="var(--terracotta)"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="font-mono text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'var(--terracotta)',
                      color: 'var(--bg)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {c.label}
                  </span>
                  <h3
                    className="font-serif text-[14px] md:text-[16px]"
                    style={{
                      fontWeight: 800,
                      color: 'var(--ink)',
                      letterSpacing: '-0.015em',
                    }}
                  >
                    {c.title}
                  </h3>
                </div>
                <p
                  className="mt-1.5 text-[11.5px] md:text-[13px] leading-relaxed"
                  style={{ color: 'var(--muted)' }}
                >
                  {c.org}
                </p>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[10.5px] md:text-[11.5px] font-bold underline underline-offset-2"
                  style={{ color: 'var(--terracotta)' }}
                >
                  원문 보러가기 →
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 분기 가능한 만성질환 */}
      <section className="px-5 md:px-8 mb-10 md:mb-14">
        <div className="flex items-center gap-2 mb-5 md:mb-7">
          <span className="kicker">Conditions · 분기 가능한 질환</span>
          <div className="flex-1 h-px" style={{ background: 'var(--rule-2)' }} />
        </div>
        <p
          className="text-[12.5px] md:text-[14px] leading-relaxed mb-4 md:mb-5 max-w-2xl"
          style={{ color: 'var(--text)' }}
        >
          설문에서 진단받은 질환을 표시하면 매크로·미네랄·보충제 권장이 자동으로
          조정돼요. 식이 변경은 반드시 주치 수의사와 상의 후 진행해 주세요.
        </p>
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {(Object.keys(CHRONIC_CONDITION_LABELS) as Array<keyof typeof CHRONIC_CONDITION_LABELS>).map(
            (k) => (
              <span
                key={k}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] md:text-[12.5px] font-bold"
                style={{
                  background: 'var(--bg-2)',
                  color: 'var(--ink)',
                  boxShadow: 'inset 0 0 0 1px var(--rule)',
                }}
              >
                {CHRONIC_CONDITION_LABELS[k]}
              </span>
            ),
          )}
        </div>
      </section>

      {/* 한계 / 면책 */}
      <section className="px-5 md:px-8 mb-10 md:mb-14">
        <div
          className="rounded-2xl px-5 py-6 md:px-8 md:py-8"
          style={{ background: 'var(--ink)', color: 'var(--bg)' }}
        >
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <AlertTriangle
              className="w-4 h-4 md:w-5 md:h-5"
              strokeWidth={2}
              color="var(--gold)"
            />
            <span className="kicker kicker-gold">Limits · 한계와 면책</span>
          </div>
          <h2
            className="font-serif text-[18px] md:text-[24px] mb-3 md:mb-4"
            style={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.3 }}
          >
            우리가 하지 않는 것
          </h2>
          <ul className="space-y-2.5 md:space-y-3 text-[12.5px] md:text-[14px] leading-relaxed" style={{ color: 'rgba(245,240,230,0.85)' }}>
            <li className="flex gap-2.5">
              <span className="shrink-0">•</span>
              <span><strong style={{ color: 'var(--bg)' }}>의학적 진단</strong> — 우리 분석은 식이 권장입니다. 질병 진단·치료를 대체하지 않아요.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">•</span>
              <span><strong style={{ color: 'var(--bg)' }}>약물 처방</strong> — 보충제 권장은 식이 차원이에요. 약물 / 처방식 변경은 반드시 주치 수의사와.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">•</span>
              <span><strong style={{ color: 'var(--bg)' }}>혈액검사 대체</strong> — 6개월 이상 만성질환 보유견은 정기 혈액검사를 함께 진행해 주세요.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="shrink-0">•</span>
              <span><strong style={{ color: 'var(--bg)' }}>품종 영양 표준</strong> — 견종별 미세 분기는 일반화하지 않아요. 동일 품종 안에서도 개체차가 큽니다.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA — 분석 시작 */}
      <section className="px-5 md:px-8">
        <div
          className="rounded-2xl px-5 py-6 md:px-10 md:py-10 text-center"
          style={{
            background: 'var(--bg-2)',
            boxShadow: 'inset 0 0 0 1px var(--rule)',
          }}
        >
          <Heart
            className="w-7 h-7 md:w-9 md:h-9 mx-auto mb-3"
            strokeWidth={1.5}
            color="var(--terracotta)"
          />
          <h2
            className="font-serif text-[19px] md:text-[28px]"
            style={{
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            우리 아이에게 맞춰 분석하기
          </h2>
          <p
            className="mt-2 md:mt-3 text-[12.5px] md:text-[14.5px] leading-relaxed mx-auto max-w-md"
            style={{ color: 'var(--muted)' }}
          >
            8단계 설문 후 30초 안에 NRC/AAFCO 기반 일일 권장 칼로리 + 매크로 비율 + 위험
            신호 + 7일 식단 전환 플랜을 받아요.
          </p>
          <div className="mt-5 md:mt-7 flex items-center justify-center gap-2 flex-wrap">
            <Link
              href="/dogs/new"
              className="inline-flex items-center gap-1.5 px-5 md:px-7 py-2.5 md:py-3 rounded-full text-[12.5px] md:text-[14px] font-bold transition active:scale-[0.97]"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              우리 아이 등록하기
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
            <Link
              href="/dogs"
              className="inline-flex items-center gap-1.5 px-5 md:px-7 py-2.5 md:py-3 rounded-full text-[12.5px] md:text-[14px] font-bold"
              style={{
                background: 'transparent',
                color: 'var(--ink)',
                boxShadow: 'inset 0 0 0 1px var(--rule)',
              }}
            >
              내 아이 보기
            </Link>
          </div>
        </div>
        <p
          className="mt-5 text-[10.5px] md:text-[11.5px] text-center leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          본 페이지는 일반 정보 제공을 목적으로 하며 의료 자문이 아닙니다. 본
          분석을 진료/처방의 대안으로 사용하지 마세요. 응급 시에는 가까운 24시간
          동물병원으로 즉시 연락하시기 바랍니다.
        </p>
      </section>
    </main>
  )
}

function MethodCard({
  num,
  Icon,
  title,
  body,
}: {
  num: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number; color?: string }>
  title: string
  body: string
}) {
  return (
    <article
      className="rounded-2xl p-5 md:p-7"
      style={{
        background: 'var(--bg-2)',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
      }}
    >
      <div className="flex items-baseline justify-between mb-3 md:mb-4">
        <span
          className="font-serif tnum"
          style={{
            color: 'var(--terracotta)',
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}
        >
          {num}
        </span>
        <Icon
          className="w-4 h-4 md:w-5 md:h-5 opacity-60"
          strokeWidth={1.5}
          color="var(--ink)"
        />
      </div>
      <h3
        className="font-serif text-[15px] md:text-[18px]"
        style={{
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h3>
      <p
        className="mt-2 md:mt-3 text-[12px] md:text-[13.5px] leading-relaxed"
        style={{ color: 'var(--text)' }}
      >
        {body}
      </p>
    </article>
  )
}

