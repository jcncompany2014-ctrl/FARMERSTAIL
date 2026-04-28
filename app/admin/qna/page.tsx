import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AdminQnaClient, { type AdminQnaRow } from './AdminQnaClient'

/**
 * /admin/qna — 상품 문의 답변 도구.
 *
 * PDP 의 product_qna 에 사용자가 남긴 문의를 한 화면에 모아 admin 이 답변을
 * 달 수 있게 한다. 미답변 문의를 우선 노출하고, 카테고리/검색은 1차 생략.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '상품 문의 관리 | Admin',
  robots: { index: false, follow: false },
}

export default async function AdminQnaPage() {
  const supabase = await createClient()

  // admin RLS 로 모든 문의가 보인다 (비공개 포함). 미답변 우선 정렬.
  const { data: qna } = await supabase
    .from('product_qna')
    .select(
      'id, product_id, user_id, question, answer, answered_by, answered_at, is_private, created_at, updated_at',
    )
    .order('answer', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false })
    .limit(200)

  // 제품 메타 — id → { name, slug, image_url } 매핑.
  const productIds = Array.from(
    new Set((qna ?? []).map((q) => q.product_id).filter(Boolean)),
  )
  const { data: products } =
    productIds.length === 0
      ? { data: [] }
      : await supabase
          .from('products')
          .select('id, name, slug, image_url')
          .in('id', productIds)

  // user 이메일 일부 — admin 이 누가 남긴건지 구분 가능하게. profiles 에서.
  const userIds = Array.from(
    new Set((qna ?? []).map((q) => q.user_id).filter(Boolean)),
  )
  const { data: profiles } =
    userIds.length === 0
      ? { data: [] }
      : await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds)

  return (
    <AdminQnaClient
      initialQna={(qna ?? []) as AdminQnaRow[]}
      products={products ?? []}
      profiles={profiles ?? []}
    />
  )
}
