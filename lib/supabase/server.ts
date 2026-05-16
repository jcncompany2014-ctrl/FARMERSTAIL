import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// audit #79: types.ts 의 Database 타입 생성. Generic 활성화는 점진 sprint
// (활성화 시 ~70개 호환 에러 — null 가드 / Json 강타이핑 / 누락 table 등).
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
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