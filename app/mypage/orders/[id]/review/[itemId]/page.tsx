import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReviewForm from './ReviewForm'
import AuthAwareShell from '@/components/AuthAwareShell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '리뷰 작성',
  robots: { index: false, follow: false },
}

type Params = Promise<{ id: string; itemId: string }>

export default async function WriteReviewPage({ params }: { params: Params }) {
  const { id, itemId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/mypage/orders/${id}/review/${itemId}`)

  // Verify this order_item belongs to this user's order
  const { data: item } = await supabase
    .from('order_items')
    .select(
      `id, product_id, product_name, product_image_url, unit_price, quantity,
       orders!inner ( id, user_id, order_status, payment_status )`
    )
    .eq('id', itemId)
    .eq('order_id', id)
    .single()

  if (!item) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = (item as any).orders
  if (!order || order.user_id !== user.id) notFound()

  // Only let users review after payment
  if (order.payment_status !== 'paid') {
    redirect(`/mypage/orders/${id}`)
  }

  // Already reviewed?
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('user_id', user.id)
    .eq('order_item_id', itemId)
    .maybeSingle()

  if (existing) {
    redirect(`/mypage/reviews`)
  }

  // Load user's dogs for optional tagging
  const { data: dogs } = await supabase
    .from('dogs')
    .select('id, name')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <AuthAwareShell>
      <ReviewForm
        orderId={id}
        orderItemId={itemId}
        productId={item.product_id}
        productName={item.product_name}
        productImage={item.product_image_url}
        dogs={dogs ?? []}
      />
    </AuthAwareShell>
  )
}
