import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import type { Database } from './types'

// audit #79: Database generic 활성화 — 서버 라우트 typed select.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서 호출된 경우 무시
          }
        },
      },
    }
  )
}

/**
 * `auth.getUser()` 안전 래퍼.
 *
 * Supabase SSR 에서 access token 이 만료되면 getUser() 가 refresh token 으로
 * lazy refresh 를 시도한다. 쿠키의 refresh token 이 만료/무효/부재이면
 * `AuthApiError: refresh_token_not_found` 를 **throw** 한다(에러 반환이 아니라
 * 예외). 무보호 호출부에서는 이 예외가 서버 에러로 전파돼 로그인 리다이렉트/
 * 공개뷰 대신 500 이 뜬다.
 *
 * 이 래퍼는 throw 와 `{ error }` 반환을 모두 흡수해 **미로그인(null)** 으로
 * 취급한다 — 호출부는 `if (!user) redirect('/login')` 또는 공개뷰로 흐르면 된다.
 *
 * (2026-07-01: Vercel 프로덕션 runtime error 대응 — `/`·`/dashboard` refresh_token_not_found.)
 */
export async function getSafeUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) return null
    return data.user
  } catch {
    // AuthApiError(stale/invalid refresh token 등) → unauthenticated 취급.
    return null
  }
}