import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AdminCouponsClient from './AdminCouponsClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '쿠폰 관리 | Admin',
  robots: { index: false, follow: false },
}

export default async function AdminCouponsPage() {
  const supabase = await createClient()
  const { data: coupons } = await supabase
    .from('coupons')
    .select(
      'id, code, name, description, discount_type, discount_value, min_order_amount, max_discount, starts_at, expires_at, usage_limit, used_count, per_user_limit, is_active, created_at'
    )
    .order('created_at', { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <AdminCouponsClient initialCoupons={(coupons ?? []) as any[]} />
}
