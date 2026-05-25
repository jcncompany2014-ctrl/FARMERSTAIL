/**
 * POST /api/integrations/tractive/disconnect
 *
 * Tractive 연동 해제. user_integrations row 의 status='revoked' + token 삭제.
 * 사용자가 mypage 에서 "연동 해제" 버튼 누를 때 호출.
 *
 * 정책: row 자체는 보존 (감사 / 재연동 추적용). access/refresh token 만 NULL.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const ui = supabase.from('user_integrations' as never) as unknown as {
    update: (v: Record<string, unknown>) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null
        }>
      }
    }
  }
  const { error } = await ui
    .update({
      access_token: null,
      refresh_token: null,
      status: 'revoked',
    })
    .eq('user_id', user.id)
    .eq('provider', 'tractive')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
