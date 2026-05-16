import { createBrowserClient } from '@supabase/ssr'

/**
 * 브라우저용 Supabase 클라이언트 — 모듈 스코프 싱글톤.
 *
 * audit #79: server + admin client 는 Database generic 활성화 완료. client 는
 * setState type 충돌 30+ 개 (사용자 페이지 useState 가 generated row type 과
 * 미스매치) → 별도 sprint 에서 마이그. 그때까지 untyped 유지.
 */
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return _client
}
