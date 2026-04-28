import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AdminPartnersClient, { type AdminPartnerRow } from './AdminPartnersClient'

/**
 * /admin/partners — 산지/공급자 CRUD.
 *
 * /partners 페이지가 이 테이블을 읽고 (DB 가 비어 있으면 hardcoded fallback).
 * 단순한 form-only CRUD — items 관계 없음.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '산지·공급자 관리 | Admin',
  robots: { index: false, follow: false },
}

export default async function AdminPartnersPage() {
  const supabase = await createClient()

  const { data: partners } = await supabase
    .from('partners')
    .select(
      'id, region, name, ingredient, body, cert, image_url, is_published, sort_order, created_at, updated_at',
    )
    .order('sort_order', { ascending: true })

  return (
    <AdminPartnersClient
      initialPartners={(partners ?? []) as AdminPartnerRow[]}
    />
  )
}
