import type { Metadata } from 'next'
import Link from 'next/link'
import StoreShell from '@/components/store/StoreShell'
import { business } from '@/lib/business'

/**
 * 결제창 failUrl — 토스가 code·message 를 붙여 보낸다. 결제는 되지 않았다(돈이 나가지 않음).
 * 만든 주문(결제 대기)은 30분 뒤 order-expire 가 정리한다.
 */
export const metadata: Metadata = { title: '결제가 되지 않았어요', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function OrderFailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const code = typeof sp.code === 'string' ? sp.code : ''
  const raw = typeof sp.message === 'string' ? sp.message : ''
  // 토스 메시지는 그대로 보여 주되 길이만 자른다(주소창에서 온 값 — 화면에 그대로 쓰는 것뿐이라 HTML 은 React 가 막는다).
  const message = code === 'PAY_PROCESS_CANCELED' ? '결제를 취소했어요.' : raw.slice(0, 200) || '결제가 되지 않았어요.'
  return (
    <StoreShell header={{ variant: 'title', title: '결제', backHref: '/store/cart' }} footer={false}>
      <div style={{ padding: '40px 20px 64px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <strong className="d" style={{ fontSize: 28 }}>
          결제가 되지 않았어요
        </strong>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: '#3D3D3D' }}>{message}</p>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: '#595959' }}>돈은 나가지 않았어요. 담은 상품은 장바구니에 그대로 있어요.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Link href="/store/checkout" style={{ height: 56, borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, textDecoration: 'none' }}>
            다시 결제하기
          </Link>
          <Link href="/store/cart" style={{ height: 56, borderRadius: 4, border: '1.5px solid #141414', color: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, textDecoration: 'none' }}>
            장바구니로
          </Link>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#595959' }}>
          계속 안 되면 {business.phone}로 전화 주시거나 카카오톡으로 알려 주세요.
        </p>
      </div>
    </StoreShell>
  )
}
