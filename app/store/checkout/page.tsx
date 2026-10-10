import type { Metadata } from 'next'
import StoreShell from '@/components/store/StoreShell'
import CheckoutClient from '@/components/store/CheckoutClient'
import { createClient, getSafeUser } from '@/lib/supabase/server'
import { isStoreItemId } from '@/lib/store/catalog'
import { widgetClientKey, widgetCustomerKey } from '@/lib/store/toss-widget'

/**
 * 주문·결제 — 웹 시안 Checkout. 회원만(사장님 10/10). 로그인 전이면 카카오 로그인부터.
 * ?buy=<상품>&qty=<n> 이면 바로 구매(장바구니를 건드리지 않고 그 상품만), 아니면 장바구니.
 * 받는 분은 기본 배송지(앱과 같은 addresses) → 없으면 프로필로 미리 채운다.
 */
export const metadata: Metadata = {
  title: '주문·결제 | 파머스테일',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const buyId = typeof sp.buy === 'string' && isStoreItemId(sp.buy) ? sp.buy : null
  const buyQty = Math.max(1, Math.min(10, Number(typeof sp.qty === 'string' ? sp.qty : 1) || 1))

  const supabase = await createClient()
  const user = await getSafeUser(supabase)
  let prefill: { name: string; phone: string; zip: string; address: string; addressDetail: string } | null = null
  let displayName: string | null = null
  if (user) {
    const [{ data: addr }, { data: prof }] = await Promise.all([
      supabase.from('addresses').select('recipient_name, phone, zip, address, address_detail').eq('user_id', user.id).order('is_default', { ascending: false }).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('profiles').select('name, phone, zip, address, address_detail').eq('id', user.id).maybeSingle(),
    ])
    // 미리 채우기는 편의일 뿐이다 — 못 읽으면 빈칸으로 둔다(주문은 고객이 확인하고 넣는다).
    displayName = prof?.name ?? null
    if (addr) {
      prefill = { name: addr.recipient_name ?? '', phone: addr.phone ?? '', zip: addr.zip ?? '', address: addr.address ?? '', addressDetail: addr.address_detail ?? '' }
    } else if (prof) {
      prefill = { name: prof.name ?? '', phone: prof.phone ?? '', zip: prof.zip ?? '', address: prof.address ?? '', addressDetail: prof.address_detail ?? '' }
    }
  }

  const backHref = buyId ? `/store/${buyId.split('-')[0] === 'trial' ? '' : buyId.split('-')[0]}` : '/store/cart'
  return (
    <StoreShell header={{ variant: 'title', title: '주문·결제', backHref: backHref.replace(/\/$/, '') || '/store' }} footer={false}>
      <CheckoutClient
        signedIn={!!user}
        displayName={displayName}
        email={user?.email ?? null}
        prefill={prefill}
        buy={buyId ? { id: buyId, qty: buyQty } : null}
        clientKey={widgetClientKey()}
        customerKey={user ? widgetCustomerKey(user.id) : null}
      />
    </StoreShell>
  )
}
