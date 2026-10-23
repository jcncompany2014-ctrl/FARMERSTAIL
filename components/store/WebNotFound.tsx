import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'

/**
 * 웹 '길을 잃으셨나요?' 화면(웹 시안 WEB-A29, 2026-10-10) — 루트 not-found 의 웹 갈래와 /store·/blog 구역 not-found 가 같이 쓴다.
 *
 * ★2026-10-22 /store/xyz·/blog/xyz 가 하얀 빈 화면이었다(디자인 점검). 루트 not-found 는 앱/웹을 가르려고 요청 머리(isAppContextServer)를
 * 읽는데, 미리 만들어 두는 상품·글 페이지(generateStaticParams·revalidate) 안에서 notFound() 가 나면 그 읽기가 실패해 Next 가 본문 없는
 * 오류 껍데기(html#__next_error__)만 보냈다. 이 부품은 요청 머리를 읽지 않는다 — /store 는 store/layout 이 앱을 먼저 걸러 내고,
 * /blog 는 웹 화면이다.
 */
export default function WebNotFound() {
  return (
    <StoreShell>
      <section style={{ padding: '48px 20px 72px', display: 'flex', flexDirection: 'column' }}>
        <span
          aria-hidden
          className="d"
          style={{ width: 72, height: 72, background: '#141414', color: '#FFFFFF', fontSize: 46, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ?
        </span>
        <h1 className="d" style={{ margin: '26px 0 0', fontSize: 42, lineHeight: 1.1 }}>
          길을 잃으셨나요?
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 18, lineHeight: 1.65, color: '#3D3D3D' }}>주소가 바뀌었거나 사라진 페이지일 수 있어요. 아래에서 다시 시작해 보세요.</p>
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link
            href="/store"
            style={{ height: 60, borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 18, fontWeight: 800, textDecoration: 'none' }}
          >
            레시피 고르기
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link
            href="/"
            style={{ height: 58, boxSizing: 'border-box', borderRadius: 4, border: '2px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
          >
            홈으로
          </Link>
        </div>
        <p style={{ margin: '22px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 16, color: '#595959' }}>
          다른 도움이 필요하신가요?
          <Link
            href="/contact"
            style={{ minHeight: 48, padding: '0 4px', display: 'flex', alignItems: 'center', fontWeight: 800, color: '#141414', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            고객센터 문의
          </Link>
        </p>
      </section>
    </StoreShell>
  )
}
