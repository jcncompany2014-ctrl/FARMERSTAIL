import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
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
 * 데이터/기능 보존: faqs 테이블 published → fallback, JSON-LD, native
 * details/summary 아코디언(JS 없이 동작·SEO). **웹 전용**(WebChrome 고정) —
 * 앱/웹 완벽분리(사장님 지시 2026-06-13): 웹 마케팅 페이지는 PWA 에서도 앱
 * chrome 으로 넘어가지 않고 항상 웹. 데이터/JSON-LD/아코디언 로직 보존.
 */
export const revalidate = 300

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
        a: '체중과 활동량에 따라 다르며, 패키지에 일일 권장 급여량이 표기돼 있어요. 정밀한 권장량은 2분 설문으로 우리 아이를 등록하면 자동 계산됩니다.',
      },
      {
        q: '사료에서 화식으로 바로 바꿔도 되나요?',
        a: '갑작스런 전환은 장에 부담이 될 수 있어요. 7일에 걸쳐 화식 비율을 25% → 50% → 75% → 100% 로 늘려가길 권해요. 첫 박스를 시작하면 우리 아이에게 맞춘 7일 전환 플랜도 함께 안내해 드려요.',
      },
      {
        q: '알레르기가 있는 아이는 어떻게 해야 하나요?',
        a: '2분 설문에서 알레르기를 입력하면 해당 원료가 든 레시피는 박스 구성에서 자동으로 제외돼요. 모든 성분은 원재료표에 그대로 표기합니다.',
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
        q: '평일 몇 시까지 결제해야 다음날 받을 수 있나요?',
        a: '평일 오후 1시까지 결제 시 익일 출고, 일반적으로 결제일 + 2 영업일 이내 도착합니다. 도서산간 1일 추가.',
      },
      {
        q: '배송비가 따로 있나요?',
        a: '아니요. 정기배송 배송비는 구독료에 포함돼 있어 추가 배송비 없이 받아보실 수 있어요.',
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
        q: '적립금은 어떻게 사용하나요?',
        a: '결제 단계 ‘포인트 사용’ 항목에서 보유한 포인트를 직접 입력하거나 전액 사용 버튼으로 한 번에 차감할 수 있어요. 1P = 1원.',
      },
      {
        q: '정기배송 결제일을 바꿀 수 있나요?',
        a: '마이페이지 → 정기배송 → 해당 구독 → ‘결제일 변경’ 에서 원하는 날짜로 수정 가능합니다. 다음 회차부터 적용돼요. 출고일 24시간 전까지 반영.',
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
        a: '2분 설문으로 우리 아이 맞춤 식단을 확인한 뒤 ‘정기배송으로 시작’ 을 누르면 주기를 선택할 수 있어요. 첫 배송은 결제 직후 출고됩니다.',
      },
      {
        q: '정기배송 주기를 변경/일시정지 할 수 있나요?',
        a: '마이페이지 → 정기배송 메뉴에서 언제든 변경, 일시정지, 해지가 가능합니다. 배송 출고 24시간 전까지 반영돼요.',
      },
      {
        q: '구독 도중 단백질 종류를 바꿀 수 있나요?',
        a: '가능합니다. 마이페이지 → 정기배송 → ‘상품 변경’ 에서 자유롭게 전환할 수 있어요. 알레르기 정보가 등록돼 있다면 호환되는 구성만 노출됩니다.',
      },
      {
        q: '연휴엔 배송이 어떻게 되나요?',
        a: '추석·설 연휴는 배송이 3-5일 지연될 수 있어요. 마이페이지에서 해당 회차를 연휴 전후로 미리 옮겨두는 걸 추천드려요. 알림으로도 안내드립니다.',
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
