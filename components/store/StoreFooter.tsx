/**
 * 웹 가게 법정 바닥(웹 시안 Main footer) — 먹색 띠. 전화·카카오톡 · 약관·정책 · 사업자 정보.
 * 사업자 정보 항목은 예전 바닥(SiteFooter)과 같은 것을 같은 정본(lib/business)에서 읽는다 — 토스 심사 항목
 * (상호·대표·사업자등록번호·통신판매업 신고·주소·연락처)이 빠지면 안 된다.
 *
 * 2026-10-13 토스 일반결제 심사 준비: 전화·카카오톡은 '물어보는 곳'으로만 말한다(토스 밖 직거래 주문으로 읽히지 않게) ·
 * 호스팅 제공자·고객센터 운영시간(정본 CUSTOMER_CENTER_HOURS) 줄 · 약관 줄에 사업자 정보(/business) · 주소 앞 '주소' 라벨.
 */
import Link from 'next/link'
import { business, CUSTOMER_CENTER_HOURS, ftcLookupUrl } from '@/lib/business'

/**
 * 둘러보기 — 검색엔진이 읽는 글자 링크(2026-10-12 점검). 메뉴(☰)는 닫혀 있으면 HTML 에 링크가 없어(StoreMenu) 홈·스토어·FAQ
 * 어디에도 매거진·우리 음식으로 가는 내부 링크가 0개였다. StoreShell 화면에만 붙는다 — /app 앱 소개(규칙165)엔 이 바닥이 없다.
 */
const BROWSE_LINKS: ReadonlyArray<readonly [href: string, label: string]> = [
  ['/store', '스토어'],
  ['/reviews', '후기'],
  ['/blog', '매거진'],
  ['/our-food', '우리 음식'],
  ['/brand', '브랜드 이야기'],
  ['/faq', '자주 묻는 질문'],
  ['/app', '앱 정기배송'],
]

export default function StoreFooter() {
  const year = new Date().getFullYear()
  return (
    <footer style={{ background: '#141414', color: '#FFFFFF' }}>
      {/* PC(폭 1024 이상)에선 두 단 — 왼쪽 로고·물어보기(.fts-ft-l), 오른쪽 둘러보기·약관·사업자 정보(store.css .fts-ft). */}
      <div className="fts-col fts-ft" style={{ padding: '48px 20px 52px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="fts-ft-l" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-paper.png" alt="파머스테일" width={117} height={20} style={{ height: 20, width: 'auto', alignSelf: 'flex-start', display: 'block' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 15, color: '#BDBDBD' }}>주문이 어렵거나 궁금하면 전화·카카오톡으로 물어보세요</span>
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
        </div>
        <nav aria-label="둘러보기" style={{ display: 'flex', flexWrap: 'wrap', columnGap: 18, rowGap: 2 }}>
          {BROWSE_LINKS.map(([href, label]) => (
            <Link key={href} href={href} style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 16, fontWeight: 700, color: '#FFFFFF', textDecoration: 'none' }}>
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="약관과 정책" style={{ display: 'flex', flexWrap: 'wrap', columnGap: 18, rowGap: 2 }}>
          <Link href="/legal/terms" style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 15, color: '#D9D9D9', textDecoration: 'none' }}>
            이용약관
          </Link>
          <Link href="/legal/privacy" style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 800, color: '#FFFFFF', textDecoration: 'none' }}>
            개인정보처리방침
          </Link>
          <Link href="/legal/refund" style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 15, color: '#D9D9D9', textDecoration: 'none' }}>
            배송·교환·환불 정책
          </Link>
          <Link href="/business" style={{ height: 40, display: 'flex', alignItems: 'center', fontSize: 15, color: '#D9D9D9', textDecoration: 'none' }}>
            사업자 정보
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
          <span>주소 {business.address}</span>
          <span>
            고객센터 {business.phone} ({CUSTOMER_CENTER_HOURS}) · {business.email}
          </span>
          <span>
            개인정보 책임자 {business.privacyOfficer} ({business.privacyOfficerEmail})
          </span>
          <span>호스팅 {business.hostingProvider}</span>
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
