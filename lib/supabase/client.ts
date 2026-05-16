import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

/**
 * 브라우저용 Supabase 클라이언트 — 모듈 스코프 싱글톤.
 *
 * audit #79: Database generic 활성화 — client 단도 typed.
 * 호출처의 useState type 은 generated row type 과 맞추거나 cast 사용.
 */
let _client: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
  if (_client) return _client
  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return _client
}
