import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, ipFromRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/search/suggest?q=키워드
 *
 * 사용자가 카탈로그 검색창에 타이핑하면 client 가 디바운스 후 호출. 상품
 * 명/카테고리/짧은 설명에서 prefix + substring 일치하는 상위 6개를 반환.
 *
 * # 검색 전략
 * - Postgres `ilike` (case-insensitive substring). 한국어는 사실상 모든 글자가
 *   substring 매칭이라 별도 형태소 분석 안 해도 충분.
 * - 결과 정렬: 인기도 (sort_order ASC = 큐레이터가 정한 우선순위) → name.
 * - is_active = true 필터.
 *
 * # 보호
 * - rate limit 분당 30/IP — 키 입력당 1 호출, 사용자가 한 분에 30번 검색 시도할
 *   리 거의 없음.
 * - q 길이 1~40 제한. 빈 q 는 빈 배열.
 *
 * # 캐시
 * - dynamic + revalidate 0 — 새 상품 등록 즉시 반영. 캐시 헤더로 CDN 캐싱은
 *   허용 (60s) — 인기 검색어는 자연스럽게 hit.
 */

type SuggestItem = {
  id: string
  name: string
  slug: string
  category: string | null
  image_url: string | null
  price: number
  sale_price: number | null
}

const MAX_RESULTS = 6

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 40)

  // 빈 쿼리 — 즉시 빈 응답. rate limit 도 이 경우엔 카운트 안 함.
  if (q.length === 0) {
    return NextResponse.json(
      { items: [] },
      {
        headers: {
          'cache-control': 'public, max-age=60, s-maxage=60',
        },
      },
    )
  }

  const rl = rateLimit({
    bucket: 'search-suggest',
    key: ipFromRequest(req),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', items: [] },
      { status: 429, headers: rl.headers },
    )
  }

  const supabase = await createClient()

  // PostgREST ilike 는 와일드카드 인자 필요. SQL 인젝션 방지는 supabase-js 가
  // 자동 escape — 사용자 입력을 그대로 wrap 해도 안전.
  const pattern = `%${q}%`

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, slug, category, image_url, price, sale_price, sort_order',
    )
    .eq('is_active', true)
    .or(
      `name.ilike.${pattern},short_description.ilike.${pattern},category.ilike.${pattern}`,
    )
    .order('sort_order', { ascending: true })
    .limit(MAX_RESULTS)

  if (error) {
    return NextResponse.json(
      { code: 'DB_ERROR', items: [], message: error.message },
      { status: 500 },
    )
  }

  // sort_order 는 응답에서 제거 (API 노출 불요).
  const items: SuggestItem[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    image_url: p.image_url,
    price: p.price,
    sale_price: p.sale_price,
  }))

  return NextResponse.json(
    { items },
    {
      headers: {
        // 60s CDN 캐시 — 인기 검색어 hit. stale-while-revalidate 로 백그라운드
        // 갱신.
        'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=120',
      },
    },
  )
}
