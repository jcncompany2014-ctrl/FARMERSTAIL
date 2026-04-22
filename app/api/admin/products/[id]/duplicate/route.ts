import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

/**
 * Duplicate a product. Copies every merchandising field (including gallery and
 * tags) but:
 *   - suffixes the slug with "-copy-<6chars>" to satisfy the UNIQUE constraint
 *   - prefixes the name with "[복제]"
 *   - forces is_active = false so the duplicate isn't listed until an admin
 *     reviews it
 *   - zeros the stock
 *
 * This flow is much faster than re-typing a near-identical product and avoids
 * the brittle client-side "clone then save" pattern.
 */
export async function POST(_req: Request, { params }: { params: Params }) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: '로그인이 필요합니다' },
      { status: 401 }
    )
  }
  const role = (user.user_metadata as { role?: string } | null)?.role
  if (role !== 'admin') {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' },
      { status: 403 }
    )
  }

  const { data: source, error: fetchError } = await supabase
    .from('products')
    .select(
      'name, slug, description, short_description, meta_description, price, sale_price, image_url, gallery_urls, category, tags, is_subscribable, sort_order'
    )
    .eq('id', id)
    .single()

  if (fetchError || !source) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: '원본 상품을 찾을 수 없어요' },
      { status: 404 }
    )
  }

  const suffix = Math.random().toString(36).slice(2, 8)
  const payload = {
    name: `[복제] ${source.name}`,
    slug: `${source.slug}-copy-${suffix}`,
    description: source.description,
    short_description: source.short_description,
    meta_description: source.meta_description,
    price: source.price,
    sale_price: source.sale_price,
    image_url: source.image_url,
    gallery_urls: source.gallery_urls ?? [],
    category: source.category,
    tags: source.tags ?? [],
    is_subscribable: source.is_subscribable,
    sort_order: source.sort_order,
    // Critical: never auto-publish a duplicate, never pretend to have stock.
    is_active: false,
    stock: 0,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('products')
    .insert(payload)
    .select('id')
    .single()

  if (insertError || !inserted) {
    return NextResponse.json(
      {
        code: 'INSERT_FAILED',
        message: insertError?.message ?? '복제에 실패했어요',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, id: inserted.id })
}
