import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * OAuth callback handler.
 *
 * Flow: Kakao → Supabase `/auth/v1/callback` → here (with `code` param)
 * → exchange code for session → redirect to `next` (default: /dashboard).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (errorParam) {
    const msg = encodeURIComponent(errorDescription ?? errorParam)
    return NextResponse.redirect(`${origin}/login?error=${msg}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const msg = encodeURIComponent(error.message)
    return NextResponse.redirect(`${origin}/login?error=${msg}`)
  }

  // Prevent open-redirect: only allow internal paths.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
