import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, ExternalLink } from 'lucide-react'
import { business, ftcLookupUrl } from '@/lib/business'
import AuthAwareShell from "@/components/AuthAwareShell"

export const metadata: Metadata = {
  title: '사업자 정보',
  description:
    '파머스테일 사업자 등록 정보, 통신판매업 신고번호, 고객센터 안내.',
  robots: { index: true, follow: true },
}

/**
 * 사업자정보 상세 페이지 — editorial 톤.
 *
 * 전자상거래법 제10조에 따라 상호/대표자/사업장 소재지/전화번호/
 * 전자우편/사업자등록번호/통신판매업 신고번호를 소비자가 쉽게
 * 확인할 수 있도록 이 한 페이지에 모두 모아 둔다.
 *
 * 톤: /blog, /products와 통일 — kicker + serif + paper-tone 카드 + 토큰.
 */
export default function BusinessPage() {
  const ftcLink = ftcLookupUrl()

  return (
    <AuthAwareShell><div className="mx-auto" style={{ maxWidth: 880, background: "var(--bg)" }}>
      {/* ── Hero ───────────────────────────────────────── */}
      <section className="px-5 md:px-6 pt-8 md:pt-16 pb-2 md:pb-6 text-center">
        <span className="kicker">Business · 사업자 정보</span>
        <h1
          className="font-serif mt-3 md:mt-5 leading-tight text-[26px] md:text-[48px] lg:text-[56px]"
          style={{
            fontWeight: 900,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
          }}
        >
          사업자 정보
        </h1>
        <p
          className="mx-auto mt-3 md:mt-5 text-[12px] md:text-[15px] leading-relaxed max-w-[300px] md:max-w-[480px]"
          style={{ color: 'var(--muted)' }}
        >
          전자상거래법 제10조에 따라 파머스테일의 사업자 등록 정보를
          공개합니다.
        </p>
      </section>

      {/* ── Registry Card ─────────────────────────────── */}
      <section className="px-5 md:px-6 mt-6 md:mt-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="kicker kicker-muted">Registry · 등록</span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>

        <div
          className="rounded-2xl px-5 py-5 md:px-8 md:py-7"
          style={{
            background: 'var(--bg-2)',
            boxShadow: 'inset 0 0 0 1px var(--rule)',
          }}
        >
          <div
            className="flex items-center gap-2.5 md:gap-4 pb-3 md:pb-5"
            style={{ borderBottom: '1px solid var(--rule-2)' }}
          >
            <div
              className="w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg)' }}
            >
              <Building2
                className="w-4 h-4 md:w-5 md:h-5"
                strokeWidth={2}
                color="var(--terracotta)"
              />
            </div>
            <div>
              <div
                className="font-serif text-[14px] md:text-[20px] font-black leading-tight"
                style={{
                  color: 'var(--ink)',
                  letterSpacing: '-0.015em',
                }}
              >
                {business.companyName}
              </div>
              <div
                className="text-[10px] md:text-[12px] mt-0.5 md:mt-1"
                style={{ color: 'var(--muted)' }}
              >
                {business.brandName}
              </div>
            </div>
          </div>

          <dl className="mt-4 md:mt-6 text-[12px] md:text-[13.5px] space-y-2.5 md:space-y-3">
            <Row label="대표자" value={business.ceo} />
            <Row
              label="사업자등록번호"
              value={business.businessNumber}
              link={
                ftcLink !== '#'
                  ? { href: ftcLink, label: '공정위 조회' }
                  : undefined
              }
            />
            <Row
              label="통신판매업 신고번호"
              value={business.mailOrderNumber}
            />
            <Row label="사업장 주소" value={business.address} />
            <Row
              label="고객센터"
              value={business.phone}
              link={{ href: `tel:${business.phone}`, label: '전화' }}
            />
            <Row
              label="이메일"
              value={business.email}
              link={{ href: `mailto:${business.email}`, label: '메일' }}
            />
            <Row
              label="개인정보보호 책임자"
              value={`${business.privacyOfficer} (${business.privacyOfficerEmail})`}
            />
            <Row label="호스팅 서비스" value={business.hostingProvider} />
          </dl>
        </div>
      </section>

      {/* ── Payments & Refund ─────────────────────────── */}
      <section className="px-5 md:px-6 mt-6 md:mt-8">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <span
            className="kicker"
            style={{ color: 'var(--moss)' }}
          >
            Payments · 결제와 환불
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>
        <div
          className="rounded-2xl px-5 py-4 md:px-7 md:py-6"
          style={{
            background:
              'color-mix(in srgb, var(--moss) 8%, transparent)',
            boxShadow:
              'inset 0 0 0 1px color-mix(in srgb, var(--moss) 30%, transparent)',
          }}
        >
          <h2
            className="font-serif text-[14px] md:text-[18px] font-black"
            style={{
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            결제 및 환불
          </h2>
          <p
            className="mt-2 md:mt-3 text-[11.5px] md:text-[13.5px] leading-relaxed"
            style={{ color: 'var(--text)' }}
          >
            파머스테일은 토스페이먼츠(주)를 통해 결제를 처리하며, 카드
            정보 등 민감 정보는 당사 서버에 저장하지 않습니다. 구매 후
            7일 이내 단순 변심 환불이 가능하며, 상세 정책은{' '}
            <Link
              href="/legal/terms"
              className="font-bold hover:underline"
              style={{ color: 'var(--terracotta)' }}
            >
              이용약관
            </Link>{' '}
            제8조 및{' '}
            <Link
              href="/legal/refund"
              className="font-bold hover:underline"
              style={{ color: 'var(--terracotta)' }}
            >
              환불 정책
            </Link>
            을 참고해 주세요.
          </p>
        </div>
      </section>

      {/* ── Dispute ────────────────────────────────────── */}
      <section className="px-5 md:px-6 mt-4 md:mt-5 pb-10 md:pb-16">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <span className="kicker kicker-muted">Dispute · 분쟁 해결</span>
          <div
            className="flex-1 h-px"
            style={{ background: 'var(--rule-2)' }}
          />
        </div>
        <div
          className="rounded-2xl px-5 py-4 md:px-7 md:py-6"
          style={{
            background: 'var(--bg-2)',
            boxShadow: 'inset 0 0 0 1px var(--rule)',
          }}
        >
          <h2
            className="font-serif text-[14px] md:text-[18px] font-black"
            style={{
              color: 'var(--ink)',
              letterSpacing: '-0.015em',
            }}
          >
            분쟁 해결
          </h2>
          <p
            className="mt-2 md:mt-3 text-[11.5px] md:text-[13.5px] leading-relaxed"
            style={{ color: 'var(--text)' }}
          >
            고객 불만 및 분쟁 처리는 고객센터({business.email})로 문의해
            주시기 바랍니다. 당사와의 분쟁이 원만히 해결되지 않을 경우,
            소비자는{' '}
            <a
              href="https://ecrb.kca.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold hover:underline inline-flex items-center gap-0.5"
              style={{ color: 'var(--terracotta)' }}
            >
              전자거래분쟁조정위원회
              <ExternalLink className="w-3 h-3" strokeWidth={2} />
            </a>{' '}
            또는{' '}
            <a
              href="https://www.kca.go.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold hover:underline inline-flex items-center gap-0.5"
              style={{ color: 'var(--terracotta)' }}
            >
              한국소비자원
              <ExternalLink className="w-3 h-3" strokeWidth={2} />
            </a>
            의 조정을 신청할 수 있습니다.
          </p>
        </div>
      </section>
    </div></AuthAwareShell>
  )
}

function Row({
  label,
  value,
  link,
}: {
  label: string
  value: string
  link?: { href: string; label: string }
}) {
  return (
    <div className="flex gap-3 md:gap-4">
      <dt
        className="shrink-0 w-[92px] md:w-[140px] text-[11px] md:text-[13px] font-semibold pt-0.5"
        style={{ color: 'var(--muted)' }}
      >
        {label}
      </dt>
      <dd
        className="flex-1 min-w-0 font-semibold break-words"
        style={{ color: 'var(--ink)' }}
      >
        {value}
        {link && (
          <>
            {' '}
            <a
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={
                link.href.startsWith('http')
                  ? 'noopener noreferrer'
                  : undefined
              }
              className="inline-flex items-center gap-0.5 text-[10px] font-bold hover:underline ml-1"
              style={{ color: 'var(--terracotta)' }}
            >
              [{link.label}]
            </a>
          </>
        )}
      </dd>
    </div>
  )
}
