// audit #101 — /subscribe/[slug] server wrapper. auth + product fetch
// (is_subscribable + is_active) + profile prefill 을 server side 로. product
// 없으면 client 에서 안내 노출 (redirect 안 함 — 기존 흐름 유지).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SubscribeClient, {
  type SubscribeProduct,
  type SubscribeProfileInitial,
} from './SubscribeClient'

export default async function SubscribePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // product (subscribable + active) + profile 병렬 prefetch.
  const [{ data: prod }, { data: prof }] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, name, slug, price, sale_price, image_url, category, short_description',
      )
      .eq('slug', slug)
      .eq('is_active', true)
      .eq('is_subscribable', true)
      .maybeSingle(),
    // 신규 회원의 profile row 미존재 케이스 방어 — maybeSingle.
    supabase
      .from('profiles')
      .select('name, phone, zip, address, address_detail')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (!prod) {
    // 정기배송 불가 안내 — 기존 client fallback 과 동일 UI. server-rendered 면
    // 깜빡임 없이 즉시 노출.
    return (
      <div className="px-5 py-10 max-w-md mx-auto text-center">
        <p className="text-[12px] text-muted">
          정기배송이 가능한 제품이 아니에요
        </p>
        <Link
          href="/products"
          className="mt-4 inline-block text-[13.5px] text-text font-bold underline"
        >
          ← 제품 목록
        </Link>
      </div>
    )
  }

  const product = prod as SubscribeProduct

  const profile: SubscribeProfileInitial = (() => {
    if (!prof) {
      return {
        name: '',
        phone: '',
        zip: '',
        address: '',
        address_detail: '',
      }
    }
    const p = prof as {
      name: string | null
      phone: string | null
      zip: string | null
      address: string | null
      address_detail: string | null
    }
    return {
      name: p.name ?? '',
      phone: p.phone ?? '',
      zip: p.zip ?? '',
      address: p.address ?? '',
      address_detail: p.address_detail ?? '',
    }
  })()

  return (
    <SubscribeClient
      slug={slug}
      userId={user.id}
      product={product}
      profile={profile}
    />
  )
}
