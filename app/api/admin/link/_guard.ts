import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'

/**
 * /api/admin/link/* 공통 관리자 관문. 통과하면 null, 아니면 401/403 응답.
 * (다른 어드민 라우트와 같은 판정 — getUser + isAdmin.)
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '로그인이 필요합니다' }, { status: 401 })
  }
  if (!(await isAdmin(supabase, user))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' }, { status: 403 })
  }
  return null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 'YYYY-MM-DD' 또는 null. 그 외는 undefined(거절). */
export function parseDateOrNull(v: unknown): string | null | undefined {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'string' && DATE_RE.test(v)) return v
  return undefined
}

/** 사이트 상대경로('/...') 또는 http(s) URL 만. */
export function isSafeUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > 600) return false
  if (v.startsWith('/') && !v.startsWith('//')) return true
  return /^https?:\/\//i.test(v)
}
