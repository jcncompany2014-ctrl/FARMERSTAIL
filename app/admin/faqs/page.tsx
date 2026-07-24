import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AdminFaqsClient, { type AdminFaqRow } from './AdminFaqsClient'
import { AdminTabs } from '@/components/admin/ui'
import { CONTENT_TABS } from '@/components/admin/tabGroups'

/**
 * /admin/faqs — FAQ CRUD.
 *
 * /faq 페이지가 이 테이블을 읽고 (DB 비어 있으면 hardcoded fallback).
 * 카테고리는 4개 고정 ('식단·영양' / '배송·환불' / '결제' / '정기배송') —
 * DB CHECK 제약과 일치.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FAQ 관리 | Admin',
  robots: { index: false, follow: false },
}

export default async function AdminFaqsPage() {
  const supabase = await createClient()

  const { data: faqs } = await supabase
    .from('faqs')
    .select(
      'id, category, question, answer, is_published, sort_order, created_at, updated_at',
    )
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  // 대개편 v2 T4 — 콘텐츠 그룹 탭.
  return (
    <div>
      <AdminTabs tabs={CONTENT_TABS} active="/admin/faqs" />
      <AdminFaqsClient initialFaqs={(faqs ?? []) as AdminFaqRow[]} />
    </div>
  )
}
