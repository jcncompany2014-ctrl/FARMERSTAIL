import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
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

/**
 * 요청 1회당 한 번만 auth 서버를 때리는 `getUser()` (2026-07-25).
 *
 * # 왜
 * `getUser()` 는 세션 쿠키를 읽는 게 아니라 **매번 Supabase auth 서버에 검증
 * 요청**을 보낸다(그래서 getSession 보다 안전하다). 그런데 admin 은 layout 에서
 * 한 번, 각 page 에서 또 한 번 호출해서 **네비게이션마다 왕복 2회**가 나갔다.
 * layout 과 page 는 같은 요청에서 렌더되므로 React `cache()` 로 묶으면 1회로
 * 줄고, 가드는 그대로 두 곳 다 남는다(권한 체크는 약해지지 않는다 —
 * `isAdmin` 은 JWT 만 보는 동기 함수라 애초에 네트워크를 쓰지 않는다).
 *
 * # 주의
 * `cache()` 는 **요청 단위**다. 요청이 끝나면 비워지므로 로그인/로그아웃 직후
 * 다음 요청에는 새 상태가 정상 반영된다. 요청 도중 세션을 바꾸는 코드
 * (`signOut()` 후 같은 요청에서 재조회)에서는 쓰지 말 것 — 그 경우
 * {@link getSafeUser} 를 직접 호출한다.
 */
export const getRequestUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  return getSafeUser(supabase)
})