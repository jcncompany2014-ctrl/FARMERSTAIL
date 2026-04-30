import { createBrowserClient } from '@supabase/ssr'

/**
 * 브라우저용 Supabase 클라이언트 — 모듈 스코프 싱글톤.
 *
 * 왜 싱글톤?
 * ─────────
 * `createClient()` 가 매 호출마다 새 인스턴스를 반환하면, 컴포넌트가 이걸
 * useEffect deps 에 넣었을 때 (deps 에 `supabase` 가 있으면) 부모가 리렌더
 * 될 때마다 effect 가 새로 실행됨. 14개 파일에서 같은 패턴이 발견됨 →
 * Auth + DB 라운드트립 폭증. 모듈 스코프 캐싱으로 한 방에 해결.
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
