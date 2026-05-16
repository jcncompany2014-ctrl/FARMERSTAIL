/**
 * Supabase 생성 타입 placeholder (audit #79).
 *
 * # 생성 명령
 *   npx supabase gen types typescript \
 *     --project-id adynmnrzffidoilnxutg \
 *     > lib/supabase/types.ts
 *
 * # 사용
 *   import type { Database } from '@/lib/supabase/types'
 *   const supabase = createClient<Database>()
 *
 * # 영향
 * 현재 8건의 `as any[]` (mypage/coupons, points, reviews, wishlist, orders/...
 * 등) 가 타입 안전 select 가능 → 런타임 undefined 접근 차단.
 *
 * # 이 파일은 placeholder
 * 실제 generation 은 별도 sprint. 그때까지는 호출처가 직접 정의한
 * 도메인 타입 사용 (Coupon, Review 등).
 */

// 빈 Database 스키마 — gen 명령이 덮어쓸 placeholder.
export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
