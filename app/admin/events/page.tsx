import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AdminEventsClient, { type AdminEventRow } from './AdminEventsClient'

/**
 * /admin/events — 이벤트 CRUD.
 *
 * 패턴
 * ────
 * `/admin/coupons` 와 동일. 서버 컴포넌트가 최초 리스트를 SSR 로 로드해
 * 클라이언트 컴포넌트 (인터랙티브 CRUD) 로 넘긴다. 이후 변경은 router.refresh
 * 로 RSC 재실행을 트리거.
 *
 * 관리자 범위 RLS — `is_admin()` policy 가 전체 조회/쓰기를 허용하므로
 * is_active=false 이벤트도 여기서 보인다.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '이벤트 관리 | Admin',
  robots: { index: false, follow: false },
}

export default async function AdminEventsPage() {
  const supabase = await createClient()

  // 관리자 조회는 admin RLS 로 전체 이벤트를 내려받는다 (is_active=false 포함).
  const { data: events } = await supabase
    .from('events')
    .select(
      'id, slug, kicker, en_title, ko_subtitle, tagline, highlight, starts_at, ends_at, status_label, palette, kind, cta_variant, coupon_code, detail_lede, perks, terms, cta_secondary, sort_priority, is_active, image_url, image_alt, created_at, updated_at'
    )
    .order('sort_priority', { ascending: false })
    .order('starts_at', { ascending: false })

  // 쿠폰 드롭다운용 — 'coupon-claim' 이벤트에서 코드를 매핑할 때 오타 방지.
  const { data: coupons } = await supabase
    .from('coupons')
    .select('code, name, discount_type, discount_value, is_active')
    .order('created_at', { ascending: false })

  return (
    <AdminEventsClient
      initialEvents={(events ?? []) as AdminEventRow[]}
      coupons={(coupons ?? []) as Array<{
        code: string
        name: string
        discount_type: 'percent' | 'fixed'
        discount_value: number
        is_active: boolean
      }>}
    />
  )
}
