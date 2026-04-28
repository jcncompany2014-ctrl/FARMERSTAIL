import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AdminCollectionsClient, {
  type AdminCollectionRow,
  type ProductOption,
  type CollectionItemRow,
} from './AdminCollectionsClient'

/**
 * /admin/collections — 큐레이션 컬렉션 CRUD.
 *
 * 패턴은 /admin/events 와 동일한 SSR + 클라이언트 모달. 추가로 컬렉션 안에
 * 제품을 묶고 (collection_items) position 으로 정렬한다. 제품 매핑 UI 는
 * 기존 제품 풀을 dropdown 으로 노출 + 현재 묶인 제품 리스트를 드래그 없이
 * up/down/remove 형태로 노출 (드래그 드롭은 모바일/터치에서 사고 잘 남).
 *
 * 접근 제어: 부모 layout 이 admin role 검증을 이미 끝냈음.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '컬렉션 관리 | Admin',
  robots: { index: false, follow: false },
}

export default async function AdminCollectionsPage() {
  const supabase = await createClient()

  // 관리자는 is_published=false 를 포함한 전체 컬렉션을 본다 (admin RLS).
  const { data: collections } = await supabase
    .from('collections')
    .select(
      'id, slug, title, subtitle, curator_note, hero_image_url, card_image_url, palette, is_published, sort_order, created_at, updated_at',
    )
    .order('sort_order', { ascending: true })

  // 각 컬렉션에 묶인 제품 리스트 — collection_id 기준 grouping 은 클라에서 한다.
  const { data: items } = await supabase
    .from('collection_items')
    .select('collection_id, product_id, position')
    .order('position', { ascending: true })

  // 제품 풀 — slug 기반 add/remove 시 검색용. 비활성 제품도 admin 에는 보여
  // (운영자가 일시 hide 해놓고 다시 게시하는 경우가 있음).
  const { data: products } = await supabase
    .from('products')
    .select('id, slug, name, image_url, is_active')
    .order('name', { ascending: true })

  return (
    <AdminCollectionsClient
      initialCollections={(collections ?? []) as AdminCollectionRow[]}
      initialItems={(items ?? []) as CollectionItemRow[]}
      products={(products ?? []) as ProductOption[]}
    />
  )
}
