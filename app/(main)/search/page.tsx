// B6 — 앱 내 통합 검색.
// 강아지 / 다이어리 / 분석 검색. q 파라미터로 server-side ILIKE.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ChevronLeft,
  Search,
  Dog as DogIcon,
  BookOpen,
  ShoppingBag,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type SP = Promise<{ q?: string }>

function escapeIlike(q: string): string {
  return q.replace(/[\\%_,()]/g, (m) => `\\${m}`)
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SP
}) {
  const { q } = await searchParams
  const query = (q ?? '').trim()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/search${q ? `?q=${encodeURIComponent(q)}` : ''}`)

  let dogs: Array<{ id: string; name: string; breed: string | null }> = []
  let diary: Array<{
    id: string
    dog_id: string
    note: string | null
    created_at: string
  }> = []
  let products: Array<{
    id: string
    name: string
    slug: string
    short_description: string | null
    category: string | null
  }> = []

  if (query) {
    const safe = escapeIlike(query)
    const [dRes, jRes, pRes] = await Promise.all([
      supabase
        .from('dogs')
        .select('id, name, breed')
        .eq('user_id', user.id)
        .or(`name.ilike.%${safe}%,breed.ilike.%${safe}%`)
        .limit(10),
      supabase
        .from('dog_diary')
        .select('id, dog_id, note, created_at')
        .eq('user_id', user.id)
        .ilike('note', `%${safe}%`)
        .order('created_at', { ascending: false })
        .limit(10),
      // R15-C21: 상품 검색 추가 — name + short_description ILIKE.
      supabase
        .from('products')
        .select('id, name, slug, short_description, category')
        .eq('is_active', true)
        .or(
          `name.ilike.%${safe}%,short_description.ilike.%${safe}%`,
        )
        .limit(10),
    ])
    dogs = (dRes.data ?? []) as typeof dogs
    diary = (jRes.data ?? []) as typeof diary
    products = (pRes.data ?? []) as typeof products
  }

  return (
    <div className="pb-10">
      <div className="px-5 pt-6 pb-2">
        <Link
          href="/dashboard"
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          <ChevronLeft className="w-3 h-3" strokeWidth={2.5} />
          홈
        </Link>
        <div className="mt-3">
          <span className="kicker inline-block">Search</span>
          <h1
            className="font-sans mt-1.5"
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            검색
          </h1>
        </div>
      </div>

      <section className="px-5 mt-3">
        <form action="/search" method="get">
          <label
            className="flex items-center gap-2 px-4 py-3 rounded border border-rule bg-bg-3"
            style={{ borderColor: 'var(--rule)' }}
          >
            <Search className="w-4 h-4 text-muted shrink-0" strokeWidth={2} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="강아지 이름, 다이어리 내용..."
              autoComplete="off"
              autoCapitalize="off"
              className="flex-1 bg-transparent text-[13px] text-text placeholder:text-muted focus:outline-none"
            />
          </label>
        </form>
      </section>

      {!query ? (
        <section className="px-5 mt-6">
          <p className="text-[12px] text-muted text-center py-8">
            검색어를 입력해 보세요.
          </p>
        </section>
      ) : (
        <>
          <section className="px-5 mt-4">
            <h2 className="kicker mb-2">강아지 · {dogs.length}건</h2>
            {dogs.length === 0 ? (
              <p className="text-[11px] text-muted">결과가 없어요</p>
            ) : (
              <div className="space-y-2">
                {dogs.map((d) => (
                  <Link
                    key={d.id}
                    href={`/dogs/${d.id}`}
                    className="flex items-center gap-3 rounded border border-rule bg-bg-3 px-4 py-3 active:scale-[0.99] transition"
                  >
                    <DogIcon
                      className="w-4 h-4 text-terracotta shrink-0"
                      strokeWidth={2}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-sans"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--ink)',
                        }}
                      >
                        {d.name}
                      </p>
                      {d.breed && (
                        <p className="text-[11px] text-muted">{d.breed}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="px-5 mt-4">
            <h2 className="kicker mb-2">상품 · {products.length}건</h2>
            {products.length === 0 ? (
              <p className="text-[11px] text-muted">결과가 없어요</p>
            ) : (
              <div className="space-y-2">
                {products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.slug}`}
                    className="flex items-center gap-3 rounded border border-rule bg-bg-3 px-4 py-3 active:scale-[0.99] transition"
                  >
                    <ShoppingBag
                      className="w-4 h-4 text-gold shrink-0"
                      strokeWidth={2}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-sans"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--ink)',
                        }}
                      >
                        {p.name}
                      </p>
                      {p.short_description && (
                        <p className="text-[11px] text-muted line-clamp-1">
                          {p.short_description}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="px-5 mt-4">
            <h2 className="kicker mb-2">다이어리 · {diary.length}건</h2>
            {diary.length === 0 ? (
              <p className="text-[11px] text-muted">결과가 없어요</p>
            ) : (
              <div className="space-y-2">
                {diary.map((j) => (
                  <Link
                    key={j.id}
                    href={`/dogs/${j.dog_id}/diary`}
                    className="block rounded border border-rule bg-bg-3 px-4 py-3 active:scale-[0.99] transition"
                  >
                    <div className="flex items-start gap-3">
                      <BookOpen
                        className="w-4 h-4 text-moss shrink-0 mt-0.5"
                        strokeWidth={2}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[12px] text-text line-clamp-2"
                          style={{ lineHeight: 1.5 }}
                        >
                          {j.note}
                        </p>
                        <p className="text-[10.5px] text-muted mt-1">
                          {new Date(j.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
