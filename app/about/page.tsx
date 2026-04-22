import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/PublicPageShell'

/**
 * /about — 브랜드 이야기 (public, editorial).
 *
 * 랜딩이 "제품 · 여정 · 매거진"을 한 페이지 안 티저로 요약한다면,
 * /about은 "왜 우리가 존재하는가"를 제대로 풀어내는 장문의 브랜드 서사.
 * 랜딩 헤더의 Story/브랜드 탭에서 이 페이지로 연결한다.
 *
 * 틀은 /blog · /legal과 동일하게 PublicPageShell(max-w-md)로 잡아
 * 읽기 편한 모바일-우선 칼럼 레이아웃을 유지한다. 실사진이 들어오면
 * `.ph` 자리를 교체만 하면 된다.
 */

export const metadata: Metadata = {
  title: '브랜드 이야기 | 파머스테일',
  description:
    '수의영양학 기반의 프리미엄 반려견 식단. 농장에서 꼬리까지, 사람이 먹는 등급의 재료로. 파머스테일이 어떻게 시작되었고 무엇을 약속하는지.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: '브랜드 이야기 | 파머스테일',
    description:
      '수의영양학 기반의 프리미엄 반려견 식단. 농장에서 꼬리까지, 사람이 먹는 등급의 재료로.',
    type: 'article',
    url: '/about',
  },
  robots: { index: true, follow: true },
}

// --- local atoms (no need to extract; this page is self-contained) --------

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

// --- page -----------------------------------------------------------------

export default function AboutPage() {
  return (
    <PublicPageShell backHref="/" backLabel="홈">
      {/* Hero — mission statement.
          .kicker 위에 큰 세리프 헤드라인, 영문 보조 캡션.
          에디토리얼 랜딩과 톤을 맞춘다. */}
      <section style={{ padding: '28px 20px 40px' }}>
        <Kicker>Our Mission · 우리의 약속</Kicker>
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
          사람이 먹는 등급의 재료로,
          <br />
          농장에서 꼬리까지.
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--text)',
            marginTop: 18,
          }}
        >
          파머스테일은 &ldquo;내 강아지한테 먹일 수 있는 것만 만든다&rdquo;는
          원칙에서 시작했습니다. 원료의 출처, 조리 방식, 포장까지 —
          우리는 반려견의 식탁을 사람의 식탁과 같은 기준으로 다룹니다.
        </p>
        <p
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginTop: 22,
          }}
        >
          FARMER&rsquo;S TAIL — EST. 2024, SEOUL
        </p>
      </section>

      <hr className="hr" style={{ margin: '0 20px' }} />

      {/* No.01 Origin */}
      <section style={{ padding: '36px 20px 0' }}>
        <SectionNo n="01" label="Origin" />
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
          한 마리 개에게서 시작된 브랜드
        </h2>
        <div style={{ marginTop: 20 }}>
          <Placeholder label="PHOTO · 설립자와 반려견 / 농장" aspect="4/5" />
        </div>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.75,
            color: 'var(--text)',
            marginTop: 20,
          }}
        >
          열세 살 된 노견 &lsquo;보리&rsquo;의 만성 소화 문제를 해결해 보려고,
          사료 대신 직접 만든 화식을 먹이기 시작했습니다. 수의사와의 대화,
          영양소 계산, 재료 수급을 반복하면서 알게 된 사실은 하나였습니다 —
          <strong style={{ color: 'var(--ink)' }}>
            {' '}대부분의 반려견 식단은 &lsquo;사람 음식 등급&rsquo;으로
            만들어지지 않는다.
          </strong>
        </p>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.75,
            color: 'var(--text)',
            marginTop: 12,
          }}
        >
          파머스테일은 그때 세운 규칙을 그대로 따릅니다. 사람이 먹을 수 있는
          원료만 쓰고, 출처는 농장 단위까지 추적하고, 조리 후 냉동·동결건조로
          영양소를 붙잡습니다.
        </p>
      </section>

      {/* No.02 Farm to Tail */}
      <section style={{ padding: '48px 20px 0' }}>
        <SectionNo n="02" label="Farm to Tail" />
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
          재료는 이름이 있어야 한다
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--text)',
            marginTop: 14,
          }}
        >
          강원 평창의 한우, 전남 완도의 자연산 연어, 제주 구좌의 당근. 우리는
          재료의 원산지를 농장 단위로 표기합니다. 익명의 &lsquo;수입산 육류&rsquo;나
          &lsquo;복합 곡물&rsquo;이 들어가는 일은 없습니다.
        </p>

        <ul
          style={{
            marginTop: 22,
            paddingLeft: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 12,
          }}
        >
          {[
            { k: '한우', v: '강원 평창 · 1++ 안심' },
            { k: '연어', v: '전남 완도 · 자연산' },
            { k: '채소', v: '제주 구좌 · 무농약' },
            { k: '곡물', v: '충북 괴산 · 국내산 귀리' },
          ].map((row) => (
            <li
              key={row.k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--rule)',
                paddingBottom: 10,
              }}
            >
              <span
                className="font-serif"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--ink)',
                }}
              >
                {row.k}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  color: 'var(--muted)',
                }}
              >
                {row.v}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* No.03 Veterinary nutrition */}
      <section style={{ padding: '48px 20px 0' }}>
        <SectionNo n="03" label="Nutrition Science" />
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
          수의영양학이 만든 레시피
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--text)',
            marginTop: 14,
          }}
        >
          모든 레시피는 <strong style={{ color: 'var(--ink)' }}>AAFCO</strong>의 성견·자견
          영양 기준과 <strong style={{ color: 'var(--ink)' }}>WSAVA</strong>의 품질 가이드를
          따르며, 현업 수의영양 전문가의 검수를 거쳐 완성됩니다. 우리는 &lsquo;맛있어
          보이는 음식&rsquo;을 만드는 곳이 아니라, &lsquo;영양 프로파일이 맞는 식단&rsquo;을
          만드는 곳입니다.
        </p>
        <div style={{ marginTop: 20 }}>
          <Placeholder
            label="CHART · 영양 프로파일 매트릭스"
            aspect="16/10"
            variant="dark"
          />
        </div>
      </section>

      {/* No.04 Manufacturing */}
      <section style={{ padding: '48px 20px 0' }}>
        <SectionNo n="04" label="Kitchen" />
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
          소규모 배치, HACCP 주방에서
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--text)',
            marginTop: 14,
          }}
        >
          전용 HACCP 주방에서 주 단위 소규모 배치로 조리합니다. 완성된 식단은
          급속 냉동 또는 저온 동결건조 공정으로 영양소를 포집한 뒤, 산소·빛을
          차단하는 다중 포장으로 포장해 배송합니다.
        </p>
        <ul
          style={{
            marginTop: 20,
            paddingLeft: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 0,
            borderTop: '1px solid var(--rule)',
          }}
        >
          {[
            ['01', '원료 입고 · 농장 단위 로트 번호 기록'],
            ['02', '저온 세척 및 수의영양 기준 계량'],
            ['03', '스팀 조리 또는 저온 동결건조'],
            ['04', '급속 냉동 후 다중 포장 · 품질 검사'],
            ['05', '주 1회 냉동 배송'],
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
        </ul>
      </section>

      {/* No.05 AI 영양사 */}
      <section style={{ padding: '48px 20px 0' }}>
        <SectionNo n="05" label="AI Nutritionist" />
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
          내 강아지만을 위한 분석
        </h2>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: 'var(--text)',
            marginTop: 14,
          }}
        >
          견종·체중·활동량·알러지 이력을 반영해 AI 영양사가 권장 식단과 급여량을
          계산합니다. 결과는 단순 제품 추천이 아니라, 영양 프로파일 요약과 근거를
          함께 제공합니다 — 주치의와 상의할 수 있는 수준으로.
        </p>
        <div style={{ marginTop: 20 }}>
          <Placeholder label="UI · 맞춤 분석 카드 미리보기" aspect="4/3" />
        </div>
      </section>

      {/* No.06 Promises */}
      <section style={{ padding: '48px 20px 0' }}>
        <SectionNo n="06" label="Our Promises" />
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
          파머스테일이 하지 않는 것
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
              k: 'NO',
              t: '익명 원료',
              b: '수입산 육류, 복합 곡물, 미상의 부산물은 쓰지 않습니다.',
            },
            {
              k: 'NO',
              t: '인공 보존료',
              b: 'BHA · BHT · 에톡시퀸 등의 인공 산화방지제를 첨가하지 않습니다.',
            },
            {
              k: 'NO',
              t: '과장 마케팅',
              b: '&ldquo;모든 질병에 효과&rdquo; 같은 문구를 쓰지 않습니다. 우리는 식단을 만듭니다.',
            },
            {
              k: 'NO',
              t: '원가 절감형 부재료',
              b: '글루텐 밀, 값싼 대두 단백, 설탕류로 단가를 맞추지 않습니다.',
            },
          ].map((row) => (
            <li
              key={row.t}
              style={{
                border: '1px solid var(--rule)',
                borderRadius: 4,
                padding: '16px 16px 14px',
                background: 'var(--bg-2)',
              }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  color: 'var(--terracotta)',
                  fontWeight: 700,
                }}
              >
                {row.k}
              </div>
              <div
                className="font-serif"
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                  marginTop: 4,
                }}
              >
                {row.t}
              </div>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'var(--text)',
                  marginTop: 6,
                }}
                // 본문 중 &ldquo; &rdquo; 이스케이프를 안전히 렌더
                dangerouslySetInnerHTML={{ __html: row.b }}
              />
            </li>
          ))}
        </ul>
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
          <span className="kicker kicker-cream">Start · 시작하기</span>
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
            내 강아지에게 맞는
            <br />
            식단을 찾는 데 3분.
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
            견종과 활동량을 입력하면, 수의영양학 기반의 맞춤 식단을 제안합니다.
            언제든 해지 가능한 정기배송부터 단건 구매까지.
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
              href="/plans"
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
              정기배송 플랜 보기
            </Link>
            <Link
              href="/products"
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
              제품 둘러보기
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
