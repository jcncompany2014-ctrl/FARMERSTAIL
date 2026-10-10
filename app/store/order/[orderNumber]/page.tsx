import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import StoreShell from '@/components/store/StoreShell'
import CopyOrderNumber from '@/components/store/CopyOrderNumber'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import { kstDateOf } from '@/lib/datetime-kst'
import { shipDateLabel, storeShipDate } from '@/lib/store/shipping'
import { isStoreOrderNumber } from '@/lib/store/order-number'
import { APP_STORE_LINKS } from '@/lib/links'
import { business } from '@/lib/business'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'

/**
 * 주문 완료 — 웹 시안 Done. 앱 다리 #1(기획서 §5.6): "도착하면 하루에 얼마나 줘야 할까요?" → 앱.
 * 출고일 = 주문한 날(KST) 다음의 첫 화·목(lib/store/shipping). 도착 요일은 약속하지 않는다.
 * 자기 주문만 보인다(user_id 로 거른다). 결제 전(pending) 주문이면 결제 화면으로 돌려보낸다.
 */
export const metadata: Metadata = { title: '주문이 완료됐어요', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const won = (n: number) => n.toLocaleString('ko-KR')

export default async function OrderDonePage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params
  if (!isStoreOrderNumber(orderNumber)) notFound()
  const supabase = await createClient()
  const user = await getSafeUser(supabase)
  if (!user) redirect(`/login?next=${encodeURIComponent(`/store/order/${orderNumber}`)}`)

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, order_number, created_at, payment_status, subtotal, shipping_fee, total_amount, recipient_name, zip, address, address_detail, delivery_memo, order_items(product_name, quantity, line_total, variant_name)')
    .eq('order_number', orderNumber)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw new Error('주문을 불러오지 못했어요')
  if (!order) notFound()
  if (order.payment_status === 'pending') redirect('/store/checkout')

  const shipIso = storeShipDate(kstDateOf(order.created_at))
  const ship = shipDateLabel(shipIso)
  // 체험팩은 품목이 레시피 4줄 — 화면엔 한 줄로 묶는다.
  type Item = { product_name: string; quantity: number; line_total: number; variant_name: string | null }
  const items = ((order.order_items ?? []) as Item[]).reduce<{ name: string; qty: number; total: number }[]>((acc, it) => {
    if (it.variant_name === '4종 체험팩') {
      const t = acc.find((a) => a.name === '4종 체험팩')
      if (t) t.total += it.line_total
      else acc.push({ name: '4종 체험팩', qty: it.quantity, total: it.line_total })
    } else acc.push({ name: it.product_name, qty: it.quantity, total: it.line_total })
    return acc
  }, [])

  const steps = [
    { t: '주문 완료', d: '오늘' },
    { t: '출고', d: ship },
    { t: '도착', d: '출고하고 지역에 따라 하루나 이틀' },
    { t: '첫 한 끼', d: '먹이기 전날 밤, 한 팩을 냉장실로' },
  ]

  return (
    <StoreShell header={{ variant: 'title', title: '주문 완료', backHref: '/' }}>
      <section style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-stamp.png" alt="" aria-hidden width={80} height={80} style={{ width: 80, height: 80 }} />
        <h1 className="d" style={{ margin: 0, fontSize: 34 }}>
          주문이 완료됐어요
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
          <span style={{ color: '#595959' }}>주문번호</span>
          <span className="n" style={{ fontSize: 18 }}>
            {order.order_number}
          </span>
          <CopyOrderNumber value={order.order_number} />
        </div>
      </section>

      <section aria-label="출고 일정" style={{ padding: '24px 20px 0' }}>
        <div style={{ border: '2px solid #141414', boxShadow: '4px 4px 0 #141414', borderRadius: 4, padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>냉동 출고</span>
          <span className="d" style={{ fontSize: 36 }}>
            {ship}
          </span>
          <span style={{ fontSize: 15, color: '#3D3D3D' }}>보냉 상자에 얼린 채로 보내요</span>
        </div>
        <ol style={{ margin: '18px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((s, i) => (
            <li key={s.t} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, paddingBottom: i < steps.length - 1 ? 14 : 0, position: 'relative' }}>
              <span aria-hidden style={{ width: 14, height: 14, marginTop: 4, marginLeft: 5, borderRadius: 7, background: i === 0 ? '#141414' : '#FFFFFF', border: '2px solid #141414', boxSizing: 'border-box' }} />
              {i < steps.length - 1 && <span aria-hidden style={{ position: 'absolute', left: 11, top: 20, bottom: 0, width: 2, background: '#E5E5E5' }} />}
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <strong style={{ fontSize: 17 }}>{s.t}</strong>
                <span style={{ fontSize: 15, color: '#595959' }}>{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="check-title" style={{ padding: '40px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 id="check-title" className="d" style={{ margin: 0, fontSize: 26 }}>
          받으면 이것만 확인하세요
        </h2>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65 }}>
          냉매가 녹아 있어도 괜찮아요. <strong>팩이 차갑거나 얼음 알갱이가 남아 있으면 정상이에요.</strong>
        </p>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: '#3D3D3D' }}>미지근하면 먹이지 마시고 사진 한 장을 보내 주세요. 확인하고 다시 보내드리거나 환불해 드려요.</p>
        {business.kakaoChannelUrl && (
          <a href={business.kakaoChannelUrl} target="_blank" rel="noopener noreferrer" style={{ height: 52, borderRadius: 4, background: '#FEE500', color: '#191919', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
            카카오톡으로 사진 보내기
          </a>
        )}
        <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {[
            ['보관', '냉동실'],
            ['해동', '전날 냉장실'],
            ['녹인 팩', '3일 안에'],
          ].map(([k, v]) => (
            <span key={k} style={{ padding: '12px 8px', background: '#F6F4F5', borderRadius: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 13, color: '#595959' }}>{k}</span>
              <strong style={{ fontSize: 16 }}>{v}</strong>
            </span>
          ))}
        </div>
      </section>

      {/* 앱 다리 */}
      <section style={{ margin: '44px 0 0', padding: '36px 20px', background: '#1D3B2F', color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="d" style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>
          도착하면 하루에
          <br />
          얼마나 줘야 할까요?
        </h2>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: '#E6EDE9' }}>
          앱에서는 나이와 체형까지 넣어 우리 아이에게 맞는 양을 알려드려요. 같은 계정이라 이 주문도 앱에 그대로 보여요.
        </p>
        <span style={{ alignSelf: 'flex-start', padding: '6px 10px', background: '#FFFFFF', color: '#1D3B2F', borderRadius: 2, fontSize: 14, fontWeight: 800 }}>
          다음부터 정기배송이면 {SUBSCRIPTION_DISCOUNT_PCT}% 할인
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          <a href={APP_STORE_LINKS.ios} target="_blank" rel="noopener noreferrer" aria-label="App Store에서 받기">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/badge-appstore-ko.svg" alt="App Store에서 다운로드" width={120} height={40} style={{ height: 44, width: 'auto', display: 'block' }} />
          </a>
          <a href={APP_STORE_LINKS.android} target="_blank" rel="noopener noreferrer" aria-label="Google Play에서 받기">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/badge-googleplay-ko.png" alt="Google Play에서 다운로드" width={134} height={52} style={{ height: 56, width: 'auto', display: 'block', margin: '-6px 0' }} />
          </a>
        </div>
        <Link href="/app" style={{ marginTop: 4, fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>
          앱에서 무엇을 할 수 있나요?
        </Link>
      </section>

      <section style={{ padding: '28px 20px 56px' }}>
        <details style={{ borderTop: '2px solid #141414', borderBottom: '1px solid #E5E5E5' }}>
          <summary style={{ minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 17, fontWeight: 800 }}>
            <span>주문 내용 · {won(order.total_amount)}원</span>
            <span aria-hidden className="fts-acc-plus" style={{ fontSize: 24, fontWeight: 300 }}>
              +
            </span>
            <span aria-hidden className="fts-acc-minus" style={{ fontSize: 24, fontWeight: 300 }}>
              −
            </span>
          </summary>
          <dl style={{ margin: 0, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15 }}>
            {items.map((it) => (
              <div key={it.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <dt>
                  {it.name} × {it.qty}
                </dt>
                <dd style={{ margin: 0, fontWeight: 700 }}>{won(it.total)}원</dd>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <dt style={{ color: '#595959' }}>배송비</dt>
              <dd style={{ margin: 0 }}>{won(order.shipping_fee)}원</dd>
            </div>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, color: '#3D3D3D' }}>
              <dt style={{ color: '#595959' }}>받는 곳</dt>
              <dd style={{ margin: 0 }}>
                {order.recipient_name} · ({order.zip}) {order.address} {order.address_detail ?? ''}
              </dd>
              {order.delivery_memo && <dd style={{ margin: 0 }}>{order.delivery_memo}</dd>}
            </div>
          </dl>
        </details>
        <Link href="/mypage/orders" style={{ marginTop: 16, height: 56, borderRadius: 4, border: '1.5px solid #141414', color: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, textDecoration: 'none' }}>
          주문 내역 보기
        </Link>
      </section>
    </StoreShell>
  )
}
