import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ChevronRight, MessageCircle } from 'lucide-react'
import JsonLd from '@/components/JsonLd'
import { buildFaqJsonLd, buildBreadcrumbJsonLd, ogImageUrl } from '@/lib/seo/jsonld'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { isAppContextServer } from '@/lib/app-context'
import StickyCta from '@/components/web/fd/StickyCta'
import { Button, Container, Display, Eyebrow, Section } from '@/components/web/fd/ui'

/**
 * /faq — 자주 묻는 질문 (farm v6 = FD 톤 리스타일, 2026-06-13).
 *
 * 데이터/기능 보존: faqs 테이블 published → fallback, native details/summary
 * 아코디언(JS 없이 동작).
 *
 * # 앱/웹 분기 (사장님 2026-07-22)
 *  - **웹**: FD 톤 마케팅 페이지(히어로·JSON-LD·하단 전환 CTA·StickyCta).
 *  - **앱**(PWA): `FaqAppView` — 앱 네이티브 톤. AppChrome 헤더가 '자주 묻는 질문'
 *    제목을 이미 보여주므로 본문엔 **중복 제목 없이**, 문의하기는 웹 /contact 가 아니라
 *    앱 고객센터 허브(/help)로. (이전엔 앱에서도 웹 FD 히어로를 그려 제목 중복 +
 *    문의하기가 웹으로 튀는 '반쪽 분기' 였다.)
 * faqs 데이터 로딩은 공유, 렌더만 isApp 으로 분기.
 */
export const revalidate = 3600

const FAQ_OG = ogImageUrl({
  title: '자주 묻는 질문',
  subtitle: '식단 · 배송 · 결제 · 정기배송',
  tag: 'FAQ',
  variant: 'editorial',
})

export const metadata: Metadata = {
  // layout template "%s | 파머스테일" 가 브랜드명 1회 부착 → 페이지명만(중복 방지, 회차148).
  title: '자주 묻는 질문',
  description:
    '식단 · 배송 · 결제 · 정기배송 — 파머스테일 이용에 자주 나오는 질문들을 모았어요.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: '자주 묻는 질문 | 파머스테일',
    description:
      '식단 · 배송 · 결제 · 정기배송 — 파머스테일 이용에 자주 나오는 질문들을 모았어요.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '파머스테일',
    url: '/faq',
    images: [{ url: FAQ_OG, width: 1200, height: 630, alt: '자주 묻는 질문' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '자주 묻는 질문 | 파머스테일',
    description:
      '식단 · 배송 · 결제 · 정기배송 — 파머스테일 이용에 자주 나오는 질문들을 모았어요.',
    images: [FAQ_OG],
  },
  robots: { index: true, follow: true },
}

type Group = {
  title: string
  items: { q: string; a: string }[]
}

const CATEGORY_DISPLAY: Record<string, string> = {
  '식단·영양': '식단 · 영양',
  '배송·환불': '배송 · 환불',
  결제: '결제',
  정기배송: '정기배송',
}
const CATEGORY_ORDER = ['식단·영양', '배송·환불', '결제', '정기배송']

const FALLBACK_GROUPS: Group[] = [
  {
    title: '식단 · 영양',
    items: [
      {
        q: '하루에 얼마나 먹여야 하나요?',
        a: '우리 아이의 체중·나이·활동량·중성화 여부에 따라 하루 필요한 열량이 달라져요. 파머스테일은 이 정보를 바탕으로 일일 권장 급여량(g)을 자동으로 계산해 패키지와 앱에 함께 표시해 드려요. 2분 설문으로 우리 아이를 등록하면 정밀한 맞춤 급여량을 바로 확인할 수 있고, 이후 체중이 바뀌면 급여량도 다시 계산돼 늘 지금 상태에 딱 맞는 양을 챙겨줄 수 있습니다.',
      },
      {
        q: '사료에서 화식으로 바로 바꿔도 되나요?',
        a: '갑작스런 전환은 장에 부담이 될 수 있어요. 7일에 걸쳐 화식 비율을 25% → 50% → 75% → 100% 로 늘려가길 권해요. 첫 박스를 시작하면 우리 아이에게 맞춘 7일 전환 플랜도 함께 안내해 드려요.',
      },
      {
        q: '알레르기가 있는 아이는 어떻게 해야 하나요?',
        a: '안심하고 알려주세요. 2분 설문에서 알레르기나 못 먹는 재료를 입력하면, 그 원료가 들어간 레시피는 우리 아이 박스 구성에서 아예 제외돼요. 사람이 매번 손으로 거르는 게 아니라 시스템이 자동으로 걸러내기 때문에 실수로 섞여 들어갈 일이 없습니다. 모든 레시피의 전체 성분은 원재료표에 가공 없이 그대로 공개하니, 걱정되는 재료가 있다면 주문 전에 직접 하나하나 확인하실 수 있어요.',
      },
      {
        q: '냉동 보관 후 해동은 어떻게 하나요?',
        a: '냉장실로 옮겨 12시간 자연해동이 가장 안전합니다. 급할 때는 미온수 중탕 30분. 전자레인지는 영양소 손실이 커 권장하지 않아요.',
      },
      {
        q: '우리 아이가 잘 안 먹어요. 환불 가능한가요?',
        a: '입맛은 아이마다 다를 수 있어요. 미개봉 상태라면 수령 7일 이내 단순 변심 환불이 가능합니다. 이미 개봉했다면 단백질 종류를 바꿔보는 걸 추천드려요 — 고객센터로 연락 주시면 다음 박스의 레시피 구성 변경을 도와드릴게요.',
      },
      {
        q: '영양 균형은 어떻게 맞추나요?',
        a: '모든 식단은 사료 표시기준 + FEDIAF(유럽 펫푸드 영양 기준)에 따른 38가지 필수 영양소를 점검합니다. 만성질환이 있는 아이는 설문 등록 시 자동으로 권장 구성이 필터링됩니다.',
      },
    ],
  },
  {
    title: '배송 · 환불',
    items: [
      {
        q: '언제 발송되나요?',
        a: '발송은 2주마다 화요일 하루예요(맞춤 소량생산·신선도 때문). 주문 마감은 일요일이라, 그 주 화요일 발송분에 담기려면 일요일까지 시작하시면 돼요. 수도권은 익일, 그 외 지역은 48시간 이내 도착해요.',
      },
      {
        q: '배송비가 따로 있나요?',
        a: '아니요, 배송비는 구독료에 이미 포함돼 있어요. 주문할 때마다 배송비가 따로 붙거나, 일정 금액 이상만 무료가 되는 조건도 없습니다. 화식은 신선도를 지키기 위해 냉동 상태로 보냉 포장해 보내드리는데, 이 포장·택배 비용까지 모두 구독료 안에 담겨 있어요. 결제 화면에 표시된 금액 외에 도착할 때 더 내실 것은 없습니다.',
      },
      {
        q: '환불은 언제까지 가능한가요?',
        a: '단순 변심은 수령 후 7일 이내, 미개봉 상태일 때 가능합니다. 식품 특성상 개봉 후 환불은 어려우니 주문 전 박스 구성을 꼼꼼히 확인해 주세요.',
      },
      {
        q: '포장이 파손되거나 보냉재가 녹아서 왔어요.',
        a: '택배 기사 앞에서 즉시 수령을 거부하시고, 가능하시면 사진을 찍어 story@farmerstail.kr 로 보내주세요. 동일 상품으로 무상 재발송 또는 전액 환불 중 선택하실 수 있습니다.',
      },
      {
        q: '냉동 vs 냉장 — 보관은 어떻게 다른가요?',
        a: '냉동(-18℃ 이하): 12개월 보관 가능. 사용 전날 냉장실로 옮겨 12시간 해동. / 냉장(0~10℃): 수령 후 7일 이내 급여 권장, 개봉 후 3일 이내 소진. 일주일치를 미리 해동해 두면 편해요.',
      },
    ],
  },
  {
    title: '결제',
    items: [
      {
        q: '어떤 결제 수단을 지원하나요?',
        a: '신용/체크카드 · 카카오페이 · 토스페이 · 가상계좌 · 휴대폰 결제. 토스페이먼츠를 통해 처리되며 카드 정보는 당사 서버에 저장되지 않습니다.',
      },
      {
        q: '할인은 어떻게 적용되나요?',
        a: '정기배송은 기본적으로 정가에서 15% 할인된 구독가로 받아보실 수 있어요. 쿠폰 코드를 입력하거나 이벤트를 챙길 필요 없이, 결제 화면에 자동으로 적용된 금액 그대로 결제됩니다. 여기에 멤버십 최종 등급인 ‘나무’에 오르면 모든 주문에 10%가 추가로 자동 할인돼, 오래 함께할수록 더 합리적으로 이용하실 수 있어요.',
      },
      {
        q: '정기배송 결제·배송일을 바꿀 수 있나요?',
        a: '배송은 2주마다 화요일 하루로 고정돼 있어요. 이번 회차를 건너뛰거나 일시정지하면 다음 배송·결제가 그만큼 미뤄집니다. 마이페이지 → 정기배송에서 발송 1주일 전까지 조정할 수 있어요.',
      },
      {
        q: '결제 영수증 / 현금영수증은 어떻게 받나요?',
        a: '카드 결제는 토스페이먼츠에서 자동 매출전표 발급, 마이페이지 → 주문 내역에서 다운로드 가능합니다. 현금영수증은 결제 시 입력한 번호로 자동 발행돼요(가상계좌 결제).',
      },
    ],
  },
  {
    title: '정기배송',
    items: [
      {
        q: '정기배송은 어떻게 시작하나요?',
        a: '2분 설문으로 우리 아이 맞춤 식단을 확인한 뒤 화식 비율(곁들임·반반·완전)을 고르면 시작돼요. 첫 배송은 카드 등록 후 가장 가까운 화요일에 발송됩니다.',
      },
      {
        q: '정기배송을 변경하거나 일시정지할 수 있나요?',
        a: '마이페이지 → 정기배송에서 화식 비율·레시피 변경, 일시정지, 해지가 모두 가능합니다. 발송 1주일 전까지 알려주시면 다음 배송에 반영돼요. 위약금이나 최소 약정은 없습니다.',
      },
      {
        q: '구독 도중 단백질 종류를 바꿀 수 있나요?',
        a: '네, 언제든 가능합니다. 마이페이지 → 정기배송 → ‘상품 변경’에서 원하는 단백질로 자유롭게 바꿀 수 있어요. 바꾸는 데 드는 변경 수수료나 위약금은 없어요. 다만 단백질마다 레시피가 달라 박스 금액은 조금 달라질 수 있어요 — 예를 들어 닭에서 소로 바꾸면 소 레시피 가격으로 적용돼요. 주문 마감인 일요일까지 변경하면 다음 박스부터 새 구성과 새 금액으로 나갑니다. 알레르기 정보가 등록돼 있다면 우리 아이가 안전하게 먹을 수 있는 구성만 골라 보여드려요.',
      },
      {
        q: '연휴엔 배송이 어떻게 되나요?',
        a: '발송일은 화요일이에요. 추석·설 같은 명절 연휴가 껴서 택배가 몰리면 도착이 평소보다 며칠 늦어질 수 있어요. 그 회차를 연휴에 받고 싶지 않으시면, 마이페이지 → 정기배송에서 ‘건너뛰기’로 다음 발송으로 미룰 수 있어요. 발송·지연은 알림으로도 안내드려요.',
      },
    ],
  },
]

function FaqItem({ q, a, last }: { q: string; a: string; last: boolean }) {
  return (
    <details
      className="group"
      style={{
        background: '#FFFFFF',
        borderLeft: '1px solid var(--fd-line)',
        borderRight: '1px solid var(--fd-line)',
        borderTop: '1px solid var(--fd-line)',
        borderBottom: last ? '1px solid var(--fd-line)' : 'none',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        padding: '18px 20px',
      }}
    >
      <summary
        className="flex items-start justify-between gap-3 cursor-pointer list-none"
        style={{ color: 'var(--fd-pine)' }}
      >
        <span className="flex-1 text-[14px] md:text-[16px]" style={{ fontWeight: 700, letterSpacing: '-0.015em' }}>
          {q}
        </span>
        <span
          aria-hidden
          className="shrink-0 mt-0.5 transition-transform group-open:rotate-45 text-[20px] leading-none"
          style={{ color: 'var(--fd-coral)' }}
        >
          +
        </span>
      </summary>
      <p className="mt-3 text-[13px] md:text-[14.5px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.7 }}>
        {a}
      </p>
    </details>
  )
}

/**
 * 앱(PWA) 전용 FAQ 본문 — 앱 chrome(AppChrome) 안에서 앱 네이티브 톤으로.
 *
 * 왜 별도 렌더인가(사장님 2026-07-22):
 *  1. AppChrome 헤더 바가 이미 '자주 묻는 질문' 제목을 보여준다 → 웹 FD 히어로의
 *     `<Display>자주 묻는 질문</Display>` 을 그대로 쓰면 **제목이 두 번** 뜬다. 본문엔
 *     중복 h1 없이 짧은 안내만.
 *  2. 웹 FD 컴포넌트(Section/Container/Eyebrow)는 앱에서 '웹 화면'처럼 보인다 →
 *     앱 토큰(bg-bg-3·rounded-[12px]·text-text/muted)로 /help 와 같은 톤.
 *  3. 문의하기가 웹 /contact 로 튀던 걸 앱 고객센터 허브(/help)로 — 앱 안에서 해결.
 */
function FaqItemApp({ q, a, last }: { q: string; a: string; last: boolean }) {
  return (
    <details className={`group ${last ? '' : 'border-b border-rule'}`}>
      <summary className="flex items-start justify-between gap-3 cursor-pointer list-none px-4 py-3.5">
        <span className="flex-1 text-[13.5px] font-bold text-text leading-snug">
          {q}
        </span>
        <span
          aria-hidden
          className="shrink-0 mt-0.5 transition-transform group-open:rotate-45 text-[18px] leading-none text-terracotta"
        >
          +
        </span>
      </summary>
      <p className="px-4 pb-4 -mt-0.5 text-[12.5px] text-muted leading-relaxed">
        {a}
      </p>
    </details>
  )
}

function FaqAppView({ groups }: { groups: Group[] }) {
  return (
    <AuthAwareShell>
      <main className="pb-16" style={{ minHeight: '72vh' }}>
        {/* AppChrome 헤더가 '자주 묻는 질문'을 이미 보여줘 본문엔 중복 제목 없이 안내만. */}
        <section className="px-5 pt-5">
          <p className="text-[12px] text-muted leading-relaxed">
            식단 · 배송 · 결제 · 정기배송 — 자주 나오는 질문을 모았어요.
          </p>
        </section>

        {groups.map((g) => (
          <section key={g.title} className="px-5 mt-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted mb-2 px-1">
              {g.title}
            </div>
            <div className="rounded-[12px] bg-bg-3 border border-rule overflow-hidden">
              {g.items.map((it, i) => (
                <FaqItemApp
                  key={it.q}
                  q={it.q}
                  a={it.a}
                  last={i === g.items.length - 1}
                />
              ))}
            </div>
          </section>
        ))}

        {/* 문의하기 — 웹 /contact 로 안 튀고 앱 고객센터 허브(/help)로. */}
        <section className="px-5 mt-5">
          <Link
            href="/help"
            className="flex items-center gap-3 w-full rounded-[12px] bg-bg-3 border border-rule px-4 py-3.5 transition hover:bg-bg/40"
          >
            <span className="w-8 h-8 rounded-full bg-bg flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-terracotta" strokeWidth={2} />
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[13.5px] font-bold text-text">
                원하는 답이 없나요?
              </span>
              <span className="block text-[10.5px] text-muted mt-0.5">
                고객센터로 문의하기
              </span>
            </span>
            <ChevronRight className="w-4 h-4 text-muted shrink-0" strokeWidth={2} />
          </Link>
        </section>
      </main>
    </AuthAwareShell>
  )
}

export default async function FaqPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isAuthed = !!user
  // 앱(PWA) 컨텍스트면 앱 chrome 으로 렌더 → FAQ 눌러도 웹으로 안 넘어감(사장님 2026-07-16).
  // 웹 마케팅 전환 요소(하단 CTA·StickyCta)는 앱에선 하단 탭과 겹치고 부적절 → 웹 전용.
  const isApp = await isAppContextServer()

  let groups: Group[] = []
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('category, question, answer, sort_order')
      .eq('is_published', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
    if (!error && data && data.length > 0) {
      const byCat = new Map<string, { q: string; a: string }[]>()
      for (const row of data as Array<{ category: string; question: string; answer: string }>) {
        const arr = byCat.get(row.category) ?? []
        arr.push({ q: row.question, a: row.answer })
        byCat.set(row.category, arr)
      }
      groups = CATEGORY_ORDER.flatMap((cat) => {
        const items = byCat.get(cat)
        if (!items || items.length === 0) return []
        return [{ title: CATEGORY_DISPLAY[cat] ?? cat, items }]
      })
      for (const [cat, items] of byCat.entries()) {
        if (!CATEGORY_ORDER.includes(cat)) {
          groups.push({ title: CATEGORY_DISPLAY[cat] ?? cat, items })
        }
      }
    }
  } catch {
    // table missing — fallback below
  }
  if (groups.length === 0) groups = FALLBACK_GROUPS

  // 앱(PWA) 컨텍스트 → 앱 네이티브 본문(중복 제목 제거·앱 톤·문의는 /help 허브).
  // 웹 마케팅 히어로·JSON-LD·CTA 는 웹 전용(아래).
  if (isApp) return <FaqAppView groups={groups} />

  const faqLd = buildFaqJsonLd(
    groups.flatMap((g) => g.items).map((it) => ({ question: it.q, answer: it.a })),
  )
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '자주 묻는 질문', path: '/faq' },
  ])

  return (
    <AuthAwareShell>
      <main>
        <JsonLd id="ld-faq" data={faqLd} />
        <JsonLd id="ld-faq-crumbs" data={crumbLd} />

        {/* Hero */}
        <Section bg="offwhite" pad="md">
          <Container size="md">
            <Eyebrow>FAQ</Eyebrow>
            <Display as="h1" size="lg" className="pt-3" style={{ color: 'var(--fd-pine)' }}>
              자주 묻는 질문
            </Display>
            <p className="pt-4 text-[14px] md:text-[16px]" style={{ color: 'var(--fd-muted)', lineHeight: 1.65 }}>
              원하는 답이 없다면{' '}
              <Link href="/contact" className="underline underline-offset-2" style={{ color: 'var(--fd-coral-text)', fontWeight: 700 }}>
                문의하기
              </Link>
              로 메시지를 보내주세요. 평일 영업일 24시간 이내 답변드립니다.
            </p>

            {/* 카테고리 바로가기(점프 링크) — FD /faq 패턴. 긴 FAQ 를 카테고리
                섹션으로 빠르게 이동. 그룹이 2개 이상일 때만 노출. */}
            {groups.length > 1 && (
              <nav aria-label="질문 카테고리 바로가기" className="mt-6 flex flex-wrap gap-2">
                {groups.map((g, i) => (
                  <a
                    key={g.title}
                    href={`#faq-${i}`}
                    className="rounded-full text-[12px] md:text-[12.5px] font-bold no-underline transition hover:opacity-80"
                    style={{
                      padding: '7px 14px',
                      background: '#FFFFFF',
                      color: 'var(--fd-pine)',
                      border: '1px solid var(--fd-line)',
                    }}
                  >
                    {g.title}
                  </a>
                ))}
              </nav>
            )}
          </Container>
        </Section>

        {/* Groups */}
        <Section bg="cream" pad="md">
          <Container size="md">
            {groups.map((g, i) => (
              <div key={g.title} id={`faq-${i}`} className="mb-9 md:mb-12 last:mb-0 scroll-mt-24">
                <h2 className="mb-4 text-[18px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.02em' }}>
                  {g.title}
                </h2>
                <div style={{ borderRadius: 8, overflow: 'hidden' }}>
                  {g.items.map((it, i) => (
                    <FaqItem key={it.q} q={it.q} a={it.a} last={i === g.items.length - 1} />
                  ))}
                </div>
              </div>
            ))}
          </Container>
        </Section>

        {/* CTA — 웹 전용(앱엔 하단 탭이 있어 전환 CTA 중복·부적절). */}
        {!isApp && (
          <Section bg="pine" pad="md">
            <Container size="md">
              <div className="text-center">
                <Display size="md" style={{ color: '#FFFFFF' }}>
                  아직 고민 중이신가요?
                </Display>
                <p className="pt-3 mx-auto text-[14px] md:text-[15px]" style={{ maxWidth: 420, color: 'var(--fd-green-soft)', lineHeight: 1.6 }}>
                  2분 설문이면 우리 아이에게 맞는 식단을 바로 확인할 수 있어요.
                </p>
                <div className="pt-7 flex justify-center">
                  <Button href={isAuthed ? '/dogs/new' : '/start'} tone="coral" size="lg">
                    2분 설문 시작하기
                    <ArrowRight size={19} strokeWidth={2.4} />
                  </Button>
                </div>
              </div>
            </Container>
          </Section>
        )}
      </main>
      {!isApp && <StickyCta href={isAuthed ? '/dogs/new' : '/start'} />}
    </AuthAwareShell>
  )
}
