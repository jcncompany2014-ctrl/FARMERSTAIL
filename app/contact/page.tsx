import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, MessageCircle, Phone, ArrowRight } from 'lucide-react'
import AuthAwareShell from '@/components/AuthAwareShell'
import { business } from '@/lib/business'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: '문의하기 | 파머스테일',
  description:
    '제품·주문·정기배송·반품 등 어떤 문의든 보내주세요. 평일 영업일 24시간 이내 답변드립니다.',
  alternates: { canonical: '/contact' },
  robots: { index: true, follow: true },
}

/**
 * /contact — 1:1 문의 폼 + 다른 채널 안내.
 *
 * - editorial 톤. /business · /about 과 같은 max-w-880 + paper-tone.
 * - 폼은 client component 로 분리 (state 필요).
 * - POST → /api/contact → Resend 로 story@farmerstail.kr 발송 + 사용자에게
 *   자동 confirm 메일.
 * - rate limit: IP 당 5건 / 1시간 (lib/rate-limit).
 * - honeypot 필드 ("website") 로 봇 차단.
 */
export default function ContactPage() {
  return (
    <AuthAwareShell>
      <main
        className="mx-auto"
        style={{ maxWidth: 880, background: 'var(--bg)' }}
      >
        {/* ── Hero ───────────────────────────────────────── */}
        <section className="px-5 md:px-6 pt-8 md:pt-16 pb-2 md:pb-6 text-center">
          <span className="kicker">Contact · 문의하기</span>
          <h1
            className="font-serif mt-3 md:mt-5 leading-tight text-[26px] md:text-[48px] lg:text-[56px]"
            style={{
              fontWeight: 900,
              color: 'var(--ink)',
              letterSpacing: '-0.025em',
            }}
          >
            궁금한 점이 있다면.
          </h1>
          <p
            className="mx-auto mt-3 md:mt-5 text-[12px] md:text-[15px] leading-relaxed max-w-[320px] md:max-w-[520px]"
            style={{ color: 'var(--muted)' }}
          >
            제품·주문·정기배송·반품 — 무엇이든 적어 보내주세요. 평일
            영업일 24시간 이내, 가능하면 더 빨리 답변드립니다.
          </p>
        </section>

        {/* ── 빠른 채널 ────────────────────────────────────── */}
        <section className="px-5 md:px-6 mt-6 md:mt-8">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <span className="kicker kicker-muted">Quick · 빠른 채널</span>
            <div
              className="flex-1 h-px"
              style={{ background: 'var(--rule-2)' }}
            />
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <Channel
              Icon={Mail}
              label="이메일"
              value={business.email}
              href={`mailto:${business.email}`}
            />
            <Channel
              Icon={Phone}
              label="전화"
              value={business.phone}
              href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}
              note="평일 10:00 – 18:00"
            />
            {/* 카카오 채널은 URL 이 설정된 경우에만 노출 (푸터와 동일 정책).
                미설정 시 "준비 중" disabled 타일을 띄우지 않고 숨긴다 —
                런칭 시점에 미완성 느낌을 주지 않기 위함. */}
            {business.kakaoChannelUrl && (
              <Channel
                Icon={MessageCircle}
                label="카카오 채널"
                value="1:1 채팅"
                href={business.kakaoChannelUrl}
                external
              />
            )}
          </ul>
        </section>

        {/* ── 폼 ───────────────────────────────────────────── */}
        <section className="px-5 md:px-6 mt-8 md:mt-12 pb-6 md:pb-10">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <span
              className="kicker"
              style={{ color: 'var(--terracotta)' }}
            >
              Message · 메시지 보내기
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: 'var(--rule-2)' }}
            />
          </div>
          <div
            className="rounded-2xl px-5 py-6 md:px-8 md:py-8"
            style={{
              background: 'var(--bg-2)',
              boxShadow: 'inset 0 0 0 1px var(--rule)',
            }}
          >
            {/* R91-B F-2 (D7): ContactForm 이 useSearchParams 사용 →
                Next.js 16 의 Suspense boundary 필수. fallback null 로 충분. */}
            <Suspense fallback={null}>
              <ContactForm />
            </Suspense>
          </div>
        </section>

        {/* ── FAQ 안내 ─────────────────────────────────────── */}
        <section className="px-5 md:px-6 pb-16 md:pb-24">
          <div
            className="rounded-2xl px-5 py-4 md:px-6 md:py-5 flex items-center justify-between gap-3"
            style={{
              background:
                'color-mix(in srgb, var(--moss) 8%, transparent)',
              boxShadow:
                'inset 0 0 0 1px color-mix(in srgb, var(--moss) 30%, transparent)',
            }}
          >
            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] md:text-[14px] font-bold leading-tight"
                style={{ color: 'var(--ink)' }}
              >
                먼저 자주 묻는 질문도 확인해 보세요
              </p>
              <p
                className="text-[10.5px] md:text-[12px] mt-1 leading-relaxed"
                style={{ color: 'var(--muted)' }}
              >
                식단·배송·결제·정기배송 관련 답변이 모여 있어요.
              </p>
            </div>
            <Link
              href="/faq"
              className="inline-flex items-center gap-1 text-[12px] md:text-[13px] font-bold shrink-0"
              style={{ color: 'var(--moss)' }}
            >
              FAQ
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </Link>
          </div>
        </section>
      </main>
    </AuthAwareShell>
  )
}

function Channel({
  Icon,
  label,
  value,
  href,
  note,
  external,
  disabled,
}: {
  Icon: typeof Mail
  label: string
  value: string
  href?: string
  note?: string
  external?: boolean
  disabled?: boolean
}) {
  const inner = (
    <div
      className="rounded-2xl px-4 py-4 md:px-5 md:py-5 h-full"
      style={{
        background: 'var(--bg-2)',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon
          className="w-4 h-4 shrink-0"
          strokeWidth={2}
          color="var(--terracotta)"
        />
        <span
          className="font-mono text-[10px] font-bold"
          style={{ color: 'var(--muted)', letterSpacing: '0.16em' }}
        >
          {label.toUpperCase()}
        </span>
      </div>
      <div
        className="font-serif text-[14px] md:text-[16px] font-black mt-2 break-all"
        style={{ color: 'var(--ink)', letterSpacing: '-0.015em' }}
      >
        {value}
      </div>
      {note && (
        <div
          className="text-[10.5px] md:text-[11.5px] mt-1"
          style={{ color: 'var(--muted)' }}
        >
          {note}
        </div>
      )}
    </div>
  )
  if (disabled) {
    return <li>{inner}</li>
  }
  return (
    <li>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="block hover:opacity-95 transition"
      >
        {inner}
      </a>
    </li>
  )
}
