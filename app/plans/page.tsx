import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/PublicPageShell'
import { ogImageUrl } from '@/lib/seo/jsonld'

/**
 * /plans — 정기배송 마케팅 페이지 (public, editorial).
 *
 * 랜딩의 "식단 분석" 탭이 연결되는 실제 서브루트.
 * 목적: 정기배송이 왜 합리적인지 설명하고 → /signup 또는 /products로 유입.
 * 실제 결제/플랜 선택은 로그인 이후 앱 쪽에서 처리(/dashboard에서 온보딩).
 *
 * 같은 PublicPageShell(max-w-md)을 쓰고, 잡지 조판 언어(kicker · 세리프
 * 헤드라인 · 모노 캡션)로 /about과 톤을 맞춘다.
 */

const PLANS_OG = ogImageUrl({
  title: '정기배송 플랜',
  subtitle: '주 1회 · 2주 1회 · 월 1회 냉동 배송',
  tag: 'Plans',
  variant: 'product',
})

export const metadata: Metadata = {
  title: '정기배송 플랜 | 파머스테일',
  description:
    '주 1회 · 2주 1회 · 월 1회 냉동 배송. 수의영양학 기반의 맞춤 식단을 정기적으로. 언제든 해지 가능.',
  alternates: { canonical: '/plans' },
  openGraph: {
    title: '정기배송 플랜 | 파머스테일',
    description:
      '주 1회 · 2주 1회 · 월 1회 냉동 배송. 수의영양학 기반의 맞춤 식단을 정기적으로.',
    type: 'website',
    url: '/plans',
    images: [{ url: PLANS_OG, width: 1200, height: 630, alt: '정기배송 플랜' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '정기배송 플랜 | 파머스테일',
    description:
      '주 1회 · 2주 1회 · 월 1회 냉동 배송. 수의영양학 기반의 맞춤 식단을 정기적으로.',
    images: [PLANS_OG],
  },
  robots: { index: true, follow: true },
}

// --- plan catalog (presentational only — real pricing lives in DB) --------

type Plan = {
  id: 'weekly' | 'biweekly' | 'monthly'
  badge?: string
  kicker: string
  ko: string
  en: string
  cadence: string
  priceNote: string
  discountPct: number
  lede: string
  bullets: string[]
  tint: string
}

const PLANS: Plan[] = [
  {
    id: 'weekly',
    kicker: 'Plan A · 가장 신선하게',
    ko: '주 1회',
    en: 'WEEKLY',
    cadence: '7일 주기 · 급속냉동 출고',
    priceNote: '월 평균 약 12만 원부터',
    discountPct: 20,
    lede: '매주 목요일 출고. 일주일 치 식단만 보관하면 되어 냉동실 공간을 최소화합니다.',
    bullets: [
      '견종 · 체중 기반 1회분 그램수 자동 계산',
      '출고 48시간 전까지 건너뛰기 · 변경 가능',
      '영양소 손실 최소화 — 조리 후 12시간 내 냉동',
    ],
    tint: '#E8C9B2',
  },
  {
    id: 'biweekly',
    badge: 'MOST POPULAR',
    kicker: 'Plan B · 균형 잡힌 선택',
    ko: '2주 1회',
    en: 'BI-WEEKLY',
    cadence: '14일 주기 · 급속냉동 출고',
    priceNote: '월 평균 약 9만 원부터',
    discountPct: 15,
    lede: '가장 많은 반려인이 선택하는 옵션. 냉동실 한 칸이면 2주 치 식단이 들어갑니다.',
    bullets: [
      '간식 · 토퍼 자유 추가',
      '2주 단위로 급여량 리뷰 · 조정',
      '첫 달 만족 보장 — 100% 환불',
    ],
    tint: '#C9D5B0',
  },
  {
    id: 'monthly',
    kicker: 'Plan C · 합리적으로',
    ko: '월 1회',
    en: 'MONTHLY',
    cadence: '30일 주기 · 급속냉동 + 동결건조 조합',
    priceNote: '월 평균 약 7만 원부터',
    discountPct: 10,
    lede: '동결건조 식단 비중을 올려 보관이 간편합니다. 여행 · 장기 외출이 잦은 가구에 추천.',
    bullets: [
      '보관 걱정 없는 동결건조 중심 구성',
      '월별 시즌 한정 레시피 우선 제공',
      '여행용 소포장 키트 무상 증정',
    ],
    tint: '#D9CFBB',
  },
]

// --- local atoms ----------------------------------------------------------

function Kicker({ children }: { children: React.ReactNode }) {
  return <span className="kicker">{children}</span>
}

function Placeholder({
  label,
  aspect,
  variant = 'light',
}: {
  label: string
  aspect: string
  variant?: 'light' | 'dark'
}) {
  return (
    <div
      className={`ph grain grain-soft ${variant === 'dark' ? 'ph-ink' : ''}`}
      style={{ aspectRatio: aspect, width: '100%' }}
    >
      <div className="ph-label">{label}</div>
    </div>
  )
}

function SectionNo({ n, label }: { n: string; label: string }) {
  // 한 폰트 가족(serif)만 씀. "No."는 기울기로, 번호는 볼드로 변화를 준다.
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span
        className="font-serif"
        style={{
          fontSize: 16,
          color: 'var(--terracotta)',
          fontWeight: 500,
        }}
      >
        No.
      </span>
      <span
        className="font-serif"
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
        }}
      >
        {n}
      </span>
      <span style={{ color: 'var(--rule-2)', fontSize: 14 }}>—</span>
      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        {label}
      </span>
    </div>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article
      style={{
        borderRadius: 4,
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top color band — consistent with editorial product card tints */}
      <div
        className="grain grain-soft"
        style={{
          background: plan.tint,
          padding: '18px 18px 16px',
          position: 'relative',
        }}
      >
        {plan.badge && (
          <span
            className="font-mono"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: 'var(--ink)',
              color: 'var(--bg)',
              fontSize: 9,
              letterSpacing: '0.2em',
              fontWeight: 700,
              padding: '4px 8px',
              borderRadius: 999,
              boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
            }}
          >
            {plan.badge}
          </span>
        )}
        <Kicker>{plan.kicker}</Kicker>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            marginTop: 10,
          }}
        >
          <h3
            className="font-serif"
            style={{
              fontSize: 24,
              lineHeight: 1,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {plan.ko}
          </h3>
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.22em',
              color: 'var(--ink)',
              opacity: 0.75,
            }}
          >
            {plan.en}
          </span>
        </div>
        <p
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ink)',
            opacity: 0.7,
            marginTop: 10,
          }}
        >
          {plan.cadence}
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '18px 18px 22px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 10,
            borderBottom: '1px solid var(--rule)',
            paddingBottom: 12,
          }}
        >
          <span
            className="font-serif tnum"
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--ink)',
            }}
          >
            {plan.priceNote}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.12em',
              color: 'var(--terracotta)',
              fontWeight: 700,
            }}
          >
            − {plan.discountPct}%
          </span>
        </div>

        <p
          style={{
            fontSize: 13,
            lineHeight: 1.7,
            color: 'var(--text)',
            marginTop: 14,
          }}
        >
          {plan.lede}
        </p>

        <ul
          style={{
            marginTop: 14,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 8,
          }}
        >
          {plan.bullets.map((b) => (
            <li
              key={b}
              style={{
                display: 'grid',
                gridTemplateColumns: '14px 1fr',
                gap: 8,
                alignItems: 'baseline',
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'var(--text)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--terracotta)',
                  transform: 'translateY(-2px)',
                }}
              />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <Link
          href="/signup"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            width: '100%',
            background: 'var(--ink)',
            color: 'var(--bg)',
            padding: '12px 16px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            textDecoration: 'none',
            marginTop: 18,
            boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
          }}
        >
          이 플랜으로 시작
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 10 10 2M4 2h6v6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </article>
  )
}

// --- page -----------------------------------------------------------------

export default function PlansPage() {
  return (
    <PublicPageShell backHref="/" backLabel="홈">
      {/* Hero */}
      <section style={{ padding: '28px 20px 40px' }}>
        <Kicker>Subscribe · 정기배송</Kicker>
        <h1
          className="font-serif"
          style={{
            fontSize: 28,
            lineHeight: 1.15,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            marginTop: 14,
          }}
        >
          매번 고민하지 않고,
          <br />
          한결같이 좋은 식단.
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text)',
            marginTop: 18,
          }}
        >
          정기배송은 반려견에게 가장 중요한 두 가지 — &lsquo;일관된 영양&rsquo;과
          &lsquo;신선도&rsquo;를 동시에 잡기 위한 구조입니다. 우리는 제품을 파는 것이
          아니라, 한 해 동안 이어지는 식탁을 제안합니다.
        </p>

        <div style={{ marginTop: 24 }}>
          <Placeholder
            label="PHOTO · 정기배송 박스 오프닝"
            aspect="4/5"
          />
        </div>
      </section>

      <hr className="hr" style={{ margin: '0 20px' }} />

      {/* No.01 — Why subscribe */}
      <section style={{ padding: '36px 20px 0' }}>
        <SectionNo n="01" label="Why Subscribe" />
        <h2
          className="font-serif"
          style={{
            fontSize: 22,
            lineHeight: 1.2,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            marginTop: 14,
          }}
        >
          왜 정기배송인가
        </h2>

        <ul
          style={{
            marginTop: 22,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 14,
          }}
        >
          {[
            {
              n: '01',
              t: '영양소의 일관성',
              b: '같은 수의영양 프로파일이 2주 · 3주 · 4주 이어질 때 장 건강 · 피부 · 체중에 의미 있는 변화가 나타납니다.',
            },
            {
              n: '02',
              t: '신선도',
              b: '주문이 확정된 만큼만 조리 · 냉동 · 출고합니다. 대형 마트의 유통 기한 기반 재고 관리와는 다릅니다.',
            },
            {
              n: '03',
              t: '합리적인 단가',
              b: '출고량이 예측 가능하기 때문에, 같은 품질을 단건 구매보다 10~20% 낮은 가격으로 제공합니다.',
            },
            {
              n: '04',
              t: '관리의 자유',
              b: '언제든 건너뛰기 · 변경 · 해지 가능. 구속하지 않는 구독이 좋은 구독이라고 생각합니다.',
            },
          ].map((row) => (
            <li
              key={row.n}
              style={{
                border: '1px solid var(--rule)',
                background: 'var(--bg-2)',
                borderRadius: 4,
                padding: '16px 16px 14px',
                display: 'grid',
                gridTemplateColumns: '28px 1fr',
                gap: 14,
                alignItems: 'baseline',
              }}
            >
              <span
                className="font-serif"
                style={{
                  fontSize: 18,
                  color: 'var(--terracotta)',
                  fontWeight: 500,
                }}
              >
                {row.n}
              </span>
              <div>
                <div
                  className="font-serif"
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {row.t}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: 'var(--text)',
                    marginTop: 4,
                  }}
                >
                  {row.b}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* No.02 — Plan options */}
      <section style={{ padding: '48px 20px 0' }}>
        <SectionNo n="02" label="Choose Your Cadence" />
        <h2
          className="font-serif"
          style={{
            fontSize: 22,
            lineHeight: 1.2,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            marginTop: 14,
          }}
        >
          세 가지 리듬
        </h2>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.65,
            color: 'var(--muted)',
            marginTop: 10,
          }}
        >
          견종·활동량에 맞춰 분석을 마치면, 화면에서 세부 가격이 확정됩니다.
        </p>

        <div style={{ marginTop: 22, display: 'grid', gap: 18 }}>
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>

        <p
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginTop: 16,
            lineHeight: 1.6,
          }}
        >
          모든 플랜 공통 — 무료 배송, 언제든 해지 가능, 첫 달 만족 보장.
        </p>
      </section>

      {/* No.03 — How it works */}
      <section style={{ padding: '48px 20px 0' }}>
        <SectionNo n="03" label="How It Works" />
        <h2
          className="font-serif"
          style={{
            fontSize: 22,
            lineHeight: 1.2,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            marginTop: 14,
          }}
        >
          시작은 3분, 이후는 자동으로.
        </h2>

        <ol
          style={{
            marginTop: 22,
            paddingLeft: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 0,
            borderTop: '1px solid var(--rule)',
          }}
        >
          {[
            ['01', '견종 · 체중 · 활동량 · 알러지 입력'],
            ['02', 'AI 영양사가 맞춤 식단 · 급여량 계산'],
            ['03', '플랜 선택 후 배송일 지정'],
            ['04', '매 주기 자동 출고 — 건너뛰기 · 변경 자유'],
          ].map(([n, t]) => (
            <li
              key={n}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr',
                gap: 12,
                padding: '14px 0',
                borderBottom: '1px solid var(--rule)',
                alignItems: 'baseline',
              }}
            >
              <span
                className="font-serif"
                style={{
                  fontSize: 15,
                  color: 'var(--terracotta)',
                  fontWeight: 500,
                }}
              >
                {n}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                {t}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* No.04 — FAQ */}
      <section style={{ padding: '48px 20px 0' }}>
        <SectionNo n="04" label="FAQ" />
        <h2
          className="font-serif"
          style={{
            fontSize: 22,
            lineHeight: 1.2,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
            marginTop: 14,
          }}
        >
          자주 묻는 질문
        </h2>

        <div style={{ marginTop: 20, display: 'grid', gap: 0 }}>
          {[
            {
              q: '언제든 해지할 수 있나요?',
              a: '네. 다음 출고 48시간 전까지 마이페이지에서 즉시 해지 · 건너뛰기 · 변경이 가능합니다. 위약금이나 최소 약정은 없습니다.',
            },
            {
              q: '배송은 어떻게 오나요?',
              a: '드라이아이스 + 진공 단열재 박스로 냉동 상태를 유지해 택배 배송됩니다. 수도권은 익일, 그 외 지역은 48시간 이내 도착합니다.',
            },
            {
              q: '알러지가 있는 아이도 먹을 수 있나요?',
              a: '가입 시 알러지 이력을 입력하시면, 해당 원료가 포함된 레시피는 자동으로 제외됩니다. 소고기·닭고기·유제품 등 주요 알러젠 대응 레시피가 준비되어 있습니다.',
            },
            {
              q: '가격은 어떻게 결정되나요?',
              a: '견종 · 체중 · 활동량 기반으로 1일 권장 칼로리를 계산한 뒤, 주기 × 단가로 최종 월 결제액이 산출됩니다. 분석 후 정확한 금액을 확인하실 수 있습니다.',
            },
          ].map((row) => (
            <details
              key={row.q}
              style={{
                borderBottom: '1px solid var(--rule)',
                padding: '14px 0',
              }}
            >
              <summary
                className="font-serif"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 12,
                }}
              >
                <span>{row.q}</span>
                <span
                  aria-hidden="true"
                  className="font-serif"
                  style={{ color: 'var(--terracotta)', fontSize: 18 }}
                >
                  +
                </span>
              </summary>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: 'var(--text)',
                  marginTop: 10,
                }}
              >
                {row.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section style={{ padding: '56px 20px 40px' }}>
        <div
          className="grain grain-soft"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            borderRadius: 4,
            padding: '32px 22px 28px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <span className="kicker kicker-cream">Begin · 시작하기</span>
          <h3
            className="font-serif"
            style={{
              fontSize: 20,
              lineHeight: 1.2,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginTop: 12,
            }}
          >
            먼저 무료 분석부터.
            <br />
            결제는 그 다음에.
          </h3>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: 'var(--bg-2)',
              marginTop: 14,
              opacity: 0.92,
            }}
          >
            3분 만에 끝나는 맞춤 분석이 우선입니다. 결과를 보고 플랜을 골라도
            늦지 않습니다.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 22,
              flexWrap: 'wrap',
            }}
          >
            <Link
              href="/signup"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg)',
                color: 'var(--ink)',
                padding: '11px 16px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
              }}
            >
              무료 분석 시작하기
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 10 10 2M4 2h6v6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link
              href="/about"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                color: 'var(--bg)',
                border: '1px solid var(--rule-2)',
                padding: '11px 16px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                textDecoration: 'none',
              }}
            >
              브랜드 이야기
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
