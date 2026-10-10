/**
 * DeleteWebView — /mypage/delete(회원 탈퇴)의 **웹** 화면(웹 시안 WEB-A17 · A18 진행 중 주문, 2026-10-10 웹 리뉴얼).
 *
 * 조회(진행 중 주문·주문 수·강아지 수)는 page.tsx 가 하고 여기는 그리기만 한다(앱은 DeleteAppView — 같은 값·같은 말).
 * 탈퇴 이유·확인·탈퇴 버튼은 앱과 같은 폼(DeleteAccountForm variant='app') — 처리(/api/account/delete)도 하나다.
 * '해지' 줄은 사실이다: 탈퇴 API 가 정기배송을 모두 cancelled 로 바꾸고 카드 토큰을 지운다(DeleteAppView 머리말).
 * 없는 기능('찜'·'초대 코드'·'적립금'·'리뷰')은 지운다고 약속하지 않는다(2026-07-16).
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import StoreShell from '@/components/store/StoreShell'
import DeleteAccountForm from './DeleteAccountForm'

export default function DeleteWebView({
  hasOpen,
  openOrders,
  orderCount,
  dogCount,
}: {
  /** 진행 중 주문이 있나(조회 실패도 true — 모르면 막는다, page.tsx 규칙1 주석). */
  hasOpen: boolean
  openOrders: Array<{ id: string; order_number: string; order_status: string }>
  orderCount: number
  dogCount: number
}) {
  return (
    <StoreShell>
      <section style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <Link
          href="/account/profile"
          style={{ alignSelf: 'flex-start', minHeight: 48, marginLeft: -6, paddingRight: 8, display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, fontWeight: 700, color: '#3D3D3D', textDecoration: 'none' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          내 프로필
        </Link>
        <h1 className="d" style={{ margin: '4px 0 0', fontSize: 36, lineHeight: 1.1 }}>
          회원 탈퇴
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.6, color: '#3D3D3D' }}>탈퇴하면 계정을 되살릴 수 없어요. 아래 내용을 꼭 확인해 주세요.</p>
      </section>

      {/* 진행 중 주문이 있으면 막는다(시안 A18) */}
      {hasOpen && (
        <section style={{ padding: '24px 20px 0' }}>
          <div role="alert" style={{ padding: 18, border: '2px solid #B3261E', borderRadius: 4, display: 'grid', gridTemplateColumns: '24px 1fr', columnGap: 12, alignItems: 'start' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B3261E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ marginTop: 2 }}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5M12 16.5h.01" />
            </svg>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <strong style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.35 }}>진행 중인 주문이 있어요</strong>
              <span style={{ fontSize: 17, lineHeight: 1.55, color: '#3D3D3D' }}>배송이 진행 중인 주문이 있으면 탈퇴할 수 없어요. 배송이 끝난 뒤 다시 시도해 주세요.</span>
              {openOrders.map((o) => (
                <span
                  key={o.id}
                  style={{ marginTop: 6, padding: '12px 14px', borderRadius: 4, background: '#F6F4F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                >
                  <span style={{ fontSize: 16, fontWeight: 800, overflowWrap: 'anywhere' }}>{o.order_number}</span>
                  <span style={{ fontSize: 15, color: '#595959', whiteSpace: 'nowrap' }}>{o.order_status === 'preparing' ? '상품 준비 중' : '배송 중'}</span>
                </span>
              ))}
              <Link href="/mypage/orders" style={{ alignSelf: 'flex-start', minHeight: 48, display: 'flex', alignItems: 'center', gap: 2, fontSize: 17, fontWeight: 800, color: '#141414' }}>
                주문 내역 보기
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </span>
          </div>
        </section>
      )}

      <section aria-labelledby="what-title" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <h2 id="what-title" className="d" style={{ margin: 0, fontSize: 24 }}>
          탈퇴하면 이렇게 돼요
        </h2>
        <dl style={{ margin: '12px 0 0', borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column', fontSize: 17 }}>
          <Row tag="삭제" tone="dark">
            이름·연락처·주소, 반려견 프로필 <strong style={{ fontWeight: 800 }}>{dogCount}건</strong>, 알림 구독, 건강 일지·분석 기록
          </Row>
          <Row tag="해지">진행 중인 정기배송도 함께 해지돼요</Row>
          <Row tag="보관">
            주문 내역 <strong style={{ fontWeight: 800 }}>{orderCount}건</strong>은 전자상거래법에 따라 5년 동안 이름 없이 보관돼요
          </Row>
          <Row tag="차단" tone="muted">
            같은 계정으로 다시 로그인할 수 없어요. 다시 가입하면 새 계정이 만들어져요.
          </Row>
        </dl>
      </section>

      {hasOpen ? (
        <section style={{ padding: '28px 20px 64px', display: 'flex', flexDirection: 'column' }}>
          <Link
            href="/account/profile"
            style={{ height: 58, boxSizing: 'border-box', borderRadius: 4, border: '2px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#141414', textDecoration: 'none' }}
          >
            돌아가기
          </Link>
        </section>
      ) : (
        <div style={{ paddingBottom: 64 }}>
          <DeleteAccountForm variant="app" />
        </div>
      )}
    </StoreShell>
  )
}

function Row({ tag, tone, children }: { tag: string; tone?: 'dark' | 'muted'; children: ReactNode }) {
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid #E5E5E5', display: 'grid', gridTemplateColumns: '56px 1fr', columnGap: 12, alignItems: 'baseline' }}>
      <dt>
        <span
          style={{
            display: 'inline-flex',
            height: 26,
            padding: '0 8px',
            boxSizing: 'border-box',
            borderRadius: 4,
            background: tone === 'dark' ? '#141414' : 'transparent',
            color: tone === 'dark' ? '#FFFFFF' : tone === 'muted' ? '#3D3D3D' : '#141414',
            border: tone === 'dark' ? 0 : `1.5px solid ${tone === 'muted' ? '#8A8A8A' : '#141414'}`,
            fontSize: 14,
            fontWeight: 800,
            alignItems: 'center',
          }}
        >
          {tag}
        </span>
      </dt>
      <dd style={{ margin: 0, lineHeight: 1.55 }}>{children}</dd>
    </div>
  )
}
