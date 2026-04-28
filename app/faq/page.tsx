import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import JsonLd from '@/components/JsonLd'
import { buildFaqJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld'
import { createClient } from '@/lib/supabase/server'

/**
 * /faq — 자주 묻는 질문.
 *
 * 우선 DB (`faqs` 테이블, /admin/faqs 에서 관리) 에서 published 행을 가져오고,
 * 비어 있으면 hardcoded fallback 을 보여준다. 4개 카테고리 (식단 · 배송 · 결제 ·
 * 정기배송) 가 카테고리 키와 1:1 매칭.
 */
export const revalidate = 300

export const metadata: Metadata = {
  title: '자주 묻는 질문 | 파머스테일',
  description:
    '식단 · 배송 · 결제 · 정기배송 — 파머스테일 이용에 자주 나오는 질문들을 모았어요.',
  alternates: { canonical: '/faq' },
  robots: { index: true, follow: true },
}

type Group = {
  title: string
  items: { q: string; a: string }[]
}

// DB 카테고리는 '식단·영양' (no spaces around middle dot, w/ "영양"). 표시는
// 가독성을 위해 spaced 형태로 변환.
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
        a: '체중과 활동량에 따라 다르며, 패키지에 일일 권장 급여량이 표기돼 있어요. 정밀한 권장량은 마이페이지 → 우리 아이 등록 후 자동 계산됩니다.',
      },
      {
        q: '사료에서 화식으로 바로 바꿔도 되나요?',
        a: '갑작스런 전환은 장에 부담이 될 수 있어요. 7일에 걸쳐 화식 비율을 25% → 50% → 75% → 100% 로 늘려가는 방식을 권장합니다. ‘첫 화식 입문’ 컬렉션이 그 일주일 분량을 묶어 두었어요.',
      },
      {
        q: '알레르기가 있는 아이는 어떻게 해야 하나요?',
        a: '단일 단백질 라인 또는 알레르기 케어 컬렉션을 참고해 주세요. 원재료표에 모든 성분을 표기합니다.',
      },
      {
        q: '냉동 보관 후 해동은 어떻게 하나요?',
        a: '냉장실로 옮겨 12시간 자연해동이 가장 안전합니다. 급할 때는 미온수 중탕 30분. 전자레인지는 영양소 손실이 커 권장하지 않아요.',
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
        q: '배송비는 얼마인가요?',
        a: '3만원 이상 무료배송 / 미만 3,000원. 도서산간 +3,000원. 자세한 정책은 환불 정책 페이지를 참고해 주세요.',
      },
      {
        q: '환불은 언제까지 가능한가요?',
        a: '단순 변심은 수령 후 7일 이내, 미개봉 상태일 때 가능합니다. 식품 특성상 개봉 후 환불은 어려우니 주문 전 옵션을 꼼꼼히 확인해 주세요.',
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
        a: '결제 단계 “포인트 사용” 항목에서 보유한 포인트를 직접 입력하거나 ‘전액 사용’ 버튼으로 한 번에 차감할 수 있어요. 1P = 1원.',
      },
    ],
  },
  {
    title: '정기배송',
    items: [
      {
        q: '정기배송은 어떻게 시작하나요?',
        a: '정기배송 가능 상품 페이지에서 “정기배송으로 시작” 을 누르면 주기를 선택할 수 있어요. 첫 배송은 결제 직후 출고됩니다.',
      },
      {
        q: '정기배송 주기를 변경/일시정지 할 수 있나요?',
        a: '앱 내 마이페이지 → 정기배송 메뉴에서 언제든 변경, 일시정지, 해지가 가능합니다. 배송 출고 24시간 전까지 반영돼요.',
      },
      {
        q: '정기배송 할인은 얼마나 되나요?',
        a: '상품에 따라 5–10% 추가 할인 + 무료배송. 정기배송 페이지에서 상품별 정확한 할인율을 확인할 수 있어요.',
      },
    ],
  },
]

export default async function FaqPage() {
  const supabase = await createClient()
  let groups: Group[] = []
  try {
    const { data, error } = await supabase
      .from('faqs')
      .select('category, question, answer, sort_order')
      .eq('is_published', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
    if (!error && data && data.length > 0) {
      // category → group 으로 묶기. CATEGORY_ORDER 로 정렬.
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
      // CATEGORY_ORDER 에 없는 (예: admin 이 새 category 추가) 도 뒤에 붙임
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
    groups.flatMap((g) => g.items).map((it) => ({
      question: it.q,
      answer: it.a,
    })),
  )
  const crumbLd = buildBreadcrumbJsonLd([
    { name: '홈', path: '/' },
    { name: '자주 묻는 질문', path: '/faq' },
  ])

  return (
    <main
      className="pb-12 md:pb-20 mx-auto"
      style={{ background: 'var(--bg)', maxWidth: 880 }}
    >
      <JsonLd id="ld-faq" data={faqLd} />
      <JsonLd id="ld-faq-crumbs" data={crumbLd} />

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
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>FAQ</span>
        </nav>
      </div>

      <section className="px-5 md:px-8 pt-6 md:pt-12 pb-6 md:pb-10">
        <span
          className="font-mono text-[10px] md:text-[12px] tracking-[0.22em] uppercase"
          style={{ color: 'var(--terracotta)' }}
        >
          FAQ · 자주 묻는 질문
        </span>
        <h1
          className="font-serif mt-3 md:mt-4 text-[26px] md:text-[44px] lg:text-[52px]"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
          }}
        >
          자주 묻는 질문
        </h1>
        <p
          className="mt-3 md:mt-4 text-[12.5px] md:text-[15.5px] leading-relaxed"
          style={{ color: 'var(--muted)' }}
        >
          원하는 답이 없다면{' '}
          <a
            href="mailto:hello@farmerstail.kr?subject=문의"
            className="font-bold underline underline-offset-2"
            style={{ color: 'var(--terracotta)' }}
          >
            고객센터
          </a>
          로 문의해 주세요. 평일 영업일 24시간 이내 답변드립니다.
        </p>
      </section>

      <div className="px-5 md:px-8">
        {groups.map((g) => (
          <section key={g.title} className="mb-6 md:mb-10">
            <h2
              className="font-serif mb-3 md:mb-5 text-[16px] md:text-[22px]"
              style={{
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {g.title}
            </h2>
            <ul
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-2)',
                boxShadow: 'inset 0 0 0 1px var(--rule)',
              }}
            >
              {g.items.map((it, i) => (
                <li
                  key={it.q}
                  className="px-5 py-4 md:px-7 md:py-5"
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid var(--rule-2)',
                  }}
                >
                  <details className="group">
                    <summary
                      className="flex items-start justify-between gap-3 cursor-pointer list-none"
                      style={{ color: 'var(--ink)' }}
                    >
                      <span
                        className="font-serif text-[13.5px] md:text-[16px] flex-1"
                        style={{
                          fontWeight: 700,
                          letterSpacing: '-0.015em',
                        }}
                      >
                        {it.q}
                      </span>
                      <span
                        aria-hidden
                        className="shrink-0 mt-0.5 transition-transform group-open:rotate-45 text-[18px] md:text-[20px] leading-none"
                        style={{ color: 'var(--terracotta)' }}
                      >
                        +
                      </span>
                    </summary>
                    <p
                      className="mt-3 md:mt-4 text-[12.5px] md:text-[14.5px] leading-[1.7]"
                      style={{ color: 'var(--text)' }}
                    >
                      {it.a}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
