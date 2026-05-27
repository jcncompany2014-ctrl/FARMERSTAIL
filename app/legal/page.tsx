import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, FileText, RotateCcw, Shield, Building, HelpCircle, Mail } from 'lucide-react'

/**
 * /legal — 약관·정책 hub.
 *
 * 마이페이지 footer 의 4개 텍스트 링크 (환불/이용약관/개인정보/사업자) 를 한
 * 페이지에 묶어 시각 무게 ↓. 각 항목은 sub-route 로 분기 (/legal/refund 등) —
 * SEO 정합 유지.
 */

export const metadata: Metadata = {
  title: '약관 · 정책 | 파머스테일',
  description: '이용약관 · 개인정보처리방침 · 환불 정책 · 사업자 정보',
  alternates: { canonical: '/legal' },
}

const ITEMS = [
  {
    href: '/faq',
    Icon: HelpCircle,
    label: '자주 묻는 질문',
    desc: '식단 · 배송 · 결제 · 정기배송',
  },
  {
    href: '/contact',
    Icon: Mail,
    label: '문의하기',
    desc: '1:1 메시지 · 평일 24시간 이내 답변',
  },
  {
    href: '/legal/terms',
    Icon: FileText,
    label: '이용약관',
    desc: '서비스 이용 시 적용되는 약관',
  },
  {
    href: '/legal/privacy',
    Icon: Shield,
    label: '개인정보처리방침',
    desc: '개인정보 수집 · 이용 · 보호',
  },
  {
    href: '/legal/refund',
    Icon: RotateCcw,
    label: '환불 정책',
    desc: '환불·반품·교환 기준',
  },
  {
    href: '/business',
    Icon: Building,
    label: '사업자 정보',
    desc: '상호 · 사업자번호 · 통신판매업 신고',
  },
] as const

export default function LegalHubPage() {
  return (
    <main className="pb-12 px-5 max-w-md mx-auto">
      <section className="pt-6 pb-2">
        <span className="kicker">Legal& 정책</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          약관 · 정책
        </h1>
        <p className="text-[12px] text-muted mt-2 leading-relaxed">
          전자상거래법·개인정보보호법·정보통신망법에 따른 표시 의무 항목이에요.
        </p>
      </section>

      <section className="mt-4">
        <ul className="bg-white rounded-2xl border border-rule overflow-hidden">
          {ITEMS.map(({ href, Icon, label, desc }, i) => (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-bg transition ${
                  i < ITEMS.length - 1 ? 'border-b border-rule' : ''
                }`}
              >
                <Icon className="w-4 h-4 text-text" strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-text">{label}</div>
                  <div className="text-[11px] text-muted mt-0.5">{desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
