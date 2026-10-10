/**
 * 웹 가게 법정 바닥(웹 시안 Main footer) — 먹색 띠. 전화·카카오톡 · 약관·정책 · 사업자 정보.
 * 사업자 정보 항목은 예전 바닥(SiteFooter)과 같은 것을 같은 정본(lib/business)에서 읽는다 — 토스 심사 항목
 * (상호·대표·사업자등록번호·통신판매업 신고·주소·연락처)이 빠지면 안 된다.
 */
import Link from 'next/link'
import { business, ftcLookupUrl } from '@/lib/business'

export default function StoreFooter() {
  const year = new Date().getFullYear()
  return (
    <footer style={{ background: '#141414', color: '#FFFFFF' }}>
      <div className="fts-col" style={{ padding: '48px 20px 52px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-paper.png" alt="파머스테일" width={117} height={20} style={{ height: 20, width: 'auto', alignSelf: 'flex-start', display: 'block' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 15, color: '#BDBDBD' }}>전화나 카카오톡으로도 주문을 도와드려요</span>
          <a href={`tel:${business.phone.replace(/[^\d+]/g, '')}`} className="n" style={{ fontSize: 32, color: '#FFFFFF', textDecoration: 'none' }}>
            {business.phone}
          </a>
          {business.kakaoChannelUrl && (
            <a
              href={business.kakaoChannelUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 8, height: 56, borderRadius: 4, background: '#FEE500', color: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 17, fontWeight: 700, textDecoration: 'none' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20l3.6-2.3c.8.2 1.6.3 2.4.3 5 0 9-3.1 9-7s-4-7-9-7z" />
              </svg>
              카카오톡으로 물어보기
            </a>
          )}
        </div>
        <nav aria-label="약관과 정책" style={{ display: 'flex', flexWrap: 'wrap', columnGap: 18, rowGap: 2 }}>
          <Link href="/legal/terms" style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 15, color: '#D9D9D9', textDecoration: 'none' }}>
            이용약관
          </Link>
          <Link href="/legal/privacy" style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 800, color: '#FFFFFF', textDecoration: 'none' }}>
            개인정보처리방침
          </Link>
          <Link href="/legal/refund" style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 15, color: '#D9D9D9', textDecoration: 'none' }}>
            환불정책
          </Link>
          <a href={ftcLookupUrl()} target="_blank" rel="noopener noreferrer" style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 15, color: '#D9D9D9', textDecoration: 'none' }}>
            사업자정보 확인
          </a>
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 14, lineHeight: 1.65, color: '#BDBDBD' }}>
          <span>
            상호 {business.companyName} · 대표 {business.ceo}
          </span>
          <span>사업자등록번호 {business.businessNumber}</span>
          <span>통신판매업 {business.mailOrderNumber}</span>
          <span>{business.address}</span>
          <span>
            고객센터 {business.phone} · {business.email}
          </span>
          <span>
            개인정보 책임자 {business.privacyOfficer} ({business.privacyOfficerEmail})
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: '#9A9A9A' }}>
          파머스테일은 통신판매중개자가 아닌 통신판매업자로서 상품 주문·결제·배송·환불에 대한 책임을 직접 집니다. 결제 정보는
          토스페이먼츠가 안전하게 처리하며, 카드번호 같은 민감한 정보는 저장하지 않아요.
        </p>
        <span style={{ fontSize: 13, color: '#9A9A9A' }}>
          © {year} {business.brandName}
        </span>
      </div>
    </footer>
  )
}
