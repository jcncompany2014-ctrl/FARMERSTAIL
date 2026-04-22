'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
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
    <footer className="mt-14 border-t border-rule bg-bg text-[#5C4A3A]">
      <div className="px-5 py-5 max-w-md mx-auto">
        {/* 링크 바 — 항상 노출 */}
        <nav
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold"
          aria-label="Legal"
        >
          <Link
            href="/legal/terms"
            className="text-text hover:text-terracotta transition"
          >
            이용약관
          </Link>
          <span className="text-[#D4C8B3]">·</span>
          <Link
            href="/legal/privacy"
            className="text-terracotta hover:underline"
          >
            <b>개인정보처리방침</b>
          </Link>
          <span className="text-[#D4C8B3]">·</span>
          <Link
            href="/business"
            className="text-text hover:text-terracotta transition"
          >
            사업자정보
          </Link>
        </nav>

        {/* 사업자 정보 — 접이식 */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-footer-biz"
          className="mt-4 flex items-center gap-1 text-[11px] font-bold text-text hover:text-terracotta transition"
        >
          {business.companyName}
          <ChevronDown
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
            strokeWidth={2.5}
          />
        </button>

        {open && (
          <dl
            id="site-footer-biz"
            className="mt-2.5 text-[10.5px] leading-relaxed text-[#5C4A3A] space-y-0.5"
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
        )}

        {/* 법적 고지 + 카피라이트 */}
        <p className="mt-4 text-[10px] text-muted leading-relaxed">
          파머스테일은 통신판매중개자가 아닌 통신판매업자로서, 상품
          주문·결제·배송·환불에 대한 책임을 직접 부담합니다. 결제 정보는
          토스페이먼츠를 통해 안전하게 처리되며, 당사는 카드번호 등 민감
          정보를 저장하지 않습니다.
        </p>
        <p className="mt-2 text-[10px] text-muted">
          © {new Date().getFullYear()} {business.brandName}. All rights reserved.
        </p>
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
    <div className="flex gap-2">
      <dt className="shrink-0 w-24 font-semibold text-muted">{label}</dt>
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
