import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ChevronRight,
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  Building2,
  FileText,
} from 'lucide-react'
import AuthAwareShell from '@/components/AuthAwareShell'
import { business } from '@/lib/business'

/**
 * /help — 고객센터 허브 (토스식, 2026-07-16 사장님).
 *
 * 이전엔 마이페이지 '고객센터' 가 /business(사업자 정보) 로 바로 튀었다. 대신 여기에
 * "무엇을 도와드릴까요?" 허브를 두고 ① 자주 묻는 질문 ② 문의 ③ 사업자 정보를
 * 그 안의 요소로 모은다. AuthAwareShell 로 앱에선 앱 chrome(웹으로 안 넘어감).
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '고객센터',
  robots: { index: false, follow: false },
}

function Row({
  href,
  Icon,
  label,
  sub,
  external,
}: {
  href: string
  Icon: typeof HelpCircle
  label: string
  sub?: string
  external?: boolean
}) {
  const inner = (
    <>
      <span className="w-8 h-8 rounded-full bg-bg flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-terracotta" strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[13.5px] font-bold text-text">{label}</span>
        {sub && <span className="block text-[10.5px] text-muted mt-0.5">{sub}</span>}
      </span>
      <ChevronRight className="w-4 h-4 text-muted shrink-0" strokeWidth={2} />
    </>
  )
  const cls =
    'flex items-center gap-3 w-full px-4 py-3.5 hover:bg-bg/40 transition'
  return external ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  )
}

export default function HelpPage() {
  return (
    <AuthAwareShell>
      <main className="pb-16" style={{ minHeight: '72vh' }}>
        <section className="px-5 pt-8 pb-1">
          <h1
            className="font-sans"
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            무엇을 도와드릴까요?
          </h1>
          <p className="text-[12px] text-muted mt-2">
            평일 영업일 24시간 이내 답변드려요.
          </p>
        </section>

        {/* 상담 없이 해결 */}
        <section className="px-5 mt-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted mb-2 px-1">
            상담 없이 해결할 수 있어요
          </div>
          <div className="rounded-[12px] bg-bg-3 border border-rule overflow-hidden divide-y divide-rule">
            <Row
              href="/faq"
              Icon={HelpCircle}
              label="자주 묻는 질문"
              sub="식단 · 배송 · 결제 · 정기배송"
            />
          </div>
        </section>

        {/* 문의 */}
        <section className="px-5 mt-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted mb-2 px-1">
            직접 문의하기
          </div>
          <div className="rounded-[12px] bg-bg-3 border border-rule overflow-hidden divide-y divide-rule">
            <Row href="/contact" Icon={MessageCircle} label="1:1 문의 남기기" />
            <Row
              href={`tel:${business.phone.replace(/[^0-9]/g, '')}`}
              Icon={Phone}
              label="전화 문의"
              sub={business.phone}
              external
            />
            <Row
              href={`mailto:${business.email}`}
              Icon={Mail}
              label="이메일 문의"
              sub={business.email}
              external
            />
          </div>
        </section>

        {/* 하단 — 사업자정보 · 약관 */}
        <section className="px-5 mt-4">
          <div className="rounded-[12px] bg-bg-3 border border-rule overflow-hidden divide-y divide-rule">
            <Row href="/business" Icon={Building2} label="사업자 정보" />
            <Row href="/legal" Icon={FileText} label="이용약관 · 개인정보처리방침" />
          </div>
        </section>
      </main>
    </AuthAwareShell>
  )
}
