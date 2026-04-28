'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Mail, Phone, MessageCircle } from 'lucide-react'
import { business, ftcLookupUrl } from '@/lib/business'

/**
 * Global site footer.
 *
 * Renders the legally-required business information at the bottom of
 * every page. On mobile the business info is collapsed by default to
 * keep the tail clean — but the links (이용약관, 개인정보처리방침,
 * 사업자정보) are always visible.
 *
 * Placed INSIDE the scrollable content area so the fixed bottom tab
 * bar (in `(main)/layout.tsx`) still sits on top when scrolled to the
 * very bottom.
 */
export default function SiteFooter() {
  const [open, setOpen] = useState(false)

  return (
    <footer className="mt-14 md:mt-20 border-t border-rule bg-bg text-[#5C4A3A]">
      <div className="px-5 py-5 max-w-md mx-auto md:max-w-[1280px] md:px-6 md:py-12">
        {/* 데스크톱 4열 그리드 — 마켓컬리 톤. 모바일은 단일 열 stack. */}
        <div className="md:grid md:grid-cols-4 md:gap-10">
          {/* 고객 문의 — 외부 채팅 위젯 대신 저비용 패턴: mailto / tel / 카카오. */}
          <div className="mb-4 md:mb-0">
            <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-2 md:mb-3">
              고객 문의
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`mailto:${business.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-full bg-white border border-rule text-text text-[11px] md:text-[12px] font-bold hover:border-text transition"
              >
                <Mail className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.25} />
                이메일
              </a>
              {business.phone && business.phone !== '(등록 예정)' && (
                <a
                  href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-full bg-white border border-rule text-text text-[11px] md:text-[12px] font-bold hover:border-text transition"
                >
                  <Phone className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.25} />
                  {business.phone}
                </a>
              )}
              {business.kakaoChannelUrl && (
                <a
                  href={business.kakaoChannelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 md:px-3.5 md:py-2 rounded-full text-[11px] md:text-[12px] font-bold transition"
                  style={{ background: '#FEE500', color: '#1A1A1A' }}
                >
                  <MessageCircle className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.25} />
                  카카오 채널
                </a>
              )}
            </div>
          </div>

          {/* Legal nav — 데스크톱 두번째 컬럼 */}
          <div className="md:col-span-1">
            <div className="hidden md:block text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-3">
              안내
            </div>
            <nav
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:flex-col md:items-start md:gap-2 text-[11px] md:text-[12px] font-semibold"
              aria-label="Legal"
            >
              <Link
                href="/legal/terms"
                className="text-text hover:text-terracotta transition"
              >
                이용약관
              </Link>
              <span className="md:hidden text-[#D4C8B3]">·</span>
              <Link
                href="/legal/privacy"
                className="text-terracotta hover:underline"
              >
                <b>개인정보처리방침</b>
              </Link>
              <span className="md:hidden text-[#D4C8B3]">·</span>
              <Link
                href="/business"
                className="text-text hover:text-terracotta transition"
              >
                사업자정보
              </Link>
              <Link
                href="/legal/refund"
                className="hidden md:inline text-text hover:text-terracotta transition"
              >
                환불정책
              </Link>
            </nav>
          </div>

          {/* 사업자 — 데스크톱은 col-span-2 (정보 양 많아 넉넉히) */}
          <div className="md:col-span-2">
            {/* 모바일은 접이식, 데스크톱은 항상 펼침 */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="site-footer-biz"
              className="md:hidden mt-4 flex items-center gap-1 text-[11px] font-bold text-text hover:text-terracotta transition"
            >
              {business.companyName}
              <ChevronDown
                className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
              />
            </button>

            <div className="hidden md:block text-[11px] font-bold uppercase tracking-[0.2em] text-muted mb-3">
              사업자 정보
            </div>
            <div className="hidden md:block font-serif text-[15px] font-black text-text mb-2" style={{ letterSpacing: '-0.015em' }}>
              {business.companyName}
            </div>

            <dl
              id="site-footer-biz"
              className={`mt-2.5 md:mt-0 text-[10.5px] md:text-[12px] leading-relaxed text-[#5C4A3A] space-y-0.5 md:space-y-1 ${open ? '' : 'hidden md:block'}`}
            >
              <Row label="대표" value={business.ceo} />
              <Row
                label="사업자등록번호"
                value={business.businessNumber}
                link={ftcLookupUrl()}
                linkLabel="사업자정보 확인"
              />
              <Row
                label="통신판매업 신고"
                value={business.mailOrderNumber}
              />
              <Row label="주소" value={business.address} />
              <Row label="고객센터" value={business.phone} />
              <Row label="이메일" value={business.email} />
              <Row
                label="개인정보 책임자"
                value={`${business.privacyOfficer} (${business.privacyOfficerEmail})`}
              />
            </dl>
          </div>
        </div>

        {/* 법적 고지 + 카피라이트 */}
        <div className="md:border-t md:border-rule md:mt-10 md:pt-6">
          <p className="mt-4 md:mt-0 text-[10px] md:text-[11px] text-muted leading-relaxed md:max-w-3xl">
            파머스테일은 통신판매중개자가 아닌 통신판매업자로서, 상품
            주문·결제·배송·환불에 대한 책임을 직접 부담합니다. 결제 정보는
            토스페이먼츠를 통해 안전하게 처리되며, 당사는 카드번호 등 민감
            정보를 저장하지 않습니다.
          </p>
          <p className="mt-2 md:mt-3 text-[10px] md:text-[11px] text-muted">
            © {new Date().getFullYear()} {business.brandName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

function Row({
  label,
  value,
  link,
  linkLabel,
}: {
  label: string
  value: string
  link?: string
  linkLabel?: string
}) {
  return (
    <div className="flex gap-2 md:gap-3">
      <dt className="shrink-0 w-24 md:w-32 font-semibold text-muted">{label}</dt>
      <dd className="flex-1 min-w-0 break-words">
        {value}
        {link && link !== '#' && linkLabel && (
          <>
            {' '}
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terracotta hover:underline"
            >
              [{linkLabel}]
            </a>
          </>
        )}
      </dd>
    </div>
  )
}
