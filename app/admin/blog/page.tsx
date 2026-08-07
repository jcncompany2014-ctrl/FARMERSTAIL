import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AdminTabs, Hl, Warn } from '@/components/admin/ui'
import { CONTENT_TABS } from '@/components/admin/tabGroups'
import { safeOrTerm } from '@/lib/supabase/or-filter'

export const dynamic = 'force-dynamic'

type PostRow = {
  id: string
  slug: string
  title: string
  cover_url: string | null
  is_published: boolean
  published_at: string | null
  views: number | null
  updated_at: string
  category_id: string | null
}

type CategoryRow = {
  id: string
  name: string
  slug: string
}

type SearchParams = Promise<{
  q?: string
  category?: string
  status?: 'published' | 'draft'
}>

function formatDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default async function AdminBlogPostsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { q = '', category = '', status = '' } = await searchParams
  const supabase = await createClient()

  // Load categories for the filter chip row + join display.
  const { data: categories } = await supabase
    .from('blog_categories')
    .select('id, name, slug')
    .order('sort_order', { ascending: true })
  const categoriesList = (categories ?? []) as CategoryRow[]
  const categoryById = new Map(categoriesList.map((c) => [c.id, c]))

  let query = supabase
    .from('blog_posts')
    .select(
      'id, slug, title, cover_url, is_published, published_at, views, updated_at, category_id'
    )
    .order('updated_at', { ascending: false })

  const trimmed = q.trim()
  if (trimmed) {
    // 정화는 lib/supabase/or-filter 정본 하나 — 곳마다 다른 정규식을 쓰면
    // 어디는 막고 어디는 새는 상태가 된다(2026-08-08 보안 재감사).
    const safe = safeOrTerm(trimmed)
    // 빈 문자열이면 '%%' 전량 매치 — 검색을 걸지 않는다(정본 계약).
    if (safe) query = query.or(`title.ilike.%${safe}%,slug.ilike.%${safe}%`)
  }
  if (category) {
    query = query.eq('category_id', category)
  }
  if (status === 'published') {
    query = query.eq('is_published', true)
  } else if (status === 'draft') {
    query = query.eq('is_published', false)
  }

  const { data: posts, error } = await query
  const rows = (posts ?? []) as PostRow[]
  const hasFilter = Boolean(trimmed || category || status)

  return (
    <div>
      {/* 대개편 v2 T4 — 콘텐츠 그룹 탭 (블로그|FAQ|산지) + 헤더 zinc 통일 */}
      <AdminTabs tabs={CONTENT_TABS} active="/admin/blog" />
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight">
            블로그
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            <Hl>웹사이트에 올라가는 블로그 글</Hl>을 쓰고 관리하는 곳이에요.{' '}
            <Warn>발행하면 고객이 보는 /blog 페이지에 바로 노출</Warn>돼요. —{' '}
            {hasFilter ? `검색 결과 ${rows.length}개` : `총 ${rows.length}개`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/blog/categories"
            className="px-4 py-2 rounded-full bg-white border border-zinc-200 text-zinc-800 text-xs font-semibold hover:border-terracotta hover:text-terracotta transition"
          >
            카테고리 관리
          </Link>
          <Link
            href="/admin/blog/new"
            className="px-4 py-2 rounded-full bg-terracotta text-white text-xs font-semibold hover:bg-[#8A3822] transition"
          >
            + 새 글 작성
          </Link>
        </div>
      </div>

      {/* 필터 바 — 서버 사이드 GET 링크 기반 */}
      <div className="p-4 rounded-lg bg-white border border-zinc-200 mb-4">
        <form
          method="GET"
          className="flex flex-wrap items-center gap-2"
          action="/admin/blog"
        >
          <input
            type="text"
            name="q"
            defaultValue={trimmed}
            placeholder="제목 / slug 검색"
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-zinc-50 text-xs text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-terracotta"
          />
          <select
            name="category"
            defaultValue={category}
            className="px-3 py-2 rounded-lg bg-zinc-50 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-terracotta"
          >
            <option value="">전체 카테고리</option>
            {categoriesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={status}
            className="px-3 py-2 rounded-lg bg-zinc-50 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-terracotta"
          >
            <option value="">전체 상태</option>
            <option value="published">게시됨</option>
            <option value="draft">임시저장</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-700 transition"
          >
            필터
          </button>
          {hasFilter && (
            <Link
              href="/admin/blog"
              className="px-3 py-2 text-[11px] font-semibold text-zinc-500 hover:text-sale"
            >
              초기화
            </Link>
          )}
        </form>
      </div>

      <div className="p-6 rounded-lg bg-white border border-zinc-200">
        {error ? (
          <p className="text-sale text-sm">에러: {error.message}</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-zinc-500 py-10">
            {hasFilter
              ? '조건에 맞는 글이 없어요'
              : '작성된 글이 없어요. 새 글을 써 보세요.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-zinc-500 border-b border-zinc-200">
                  <th className="text-left py-2 font-medium w-20">커버</th>
                  <th className="text-left py-2 font-medium">제목</th>
                  <th className="text-left py-2 font-medium">카테고리</th>
                  <th className="text-center py-2 font-medium">상태</th>
                  <th className="text-right py-2 font-medium">조회수</th>
                  <th className="text-right py-2 font-medium">업데이트</th>
                  <th className="text-center py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const cat = p.category_id
                    ? categoryById.get(p.category_id)
                    : null
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50 transition"
                    >
                      <td className="py-3">
                        <div className="w-14 h-10 rounded-md bg-zinc-50 overflow-hidden">
                          {p.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.cover_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3">
                        <p className="text-zinc-900 font-medium">{p.title}</p>
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {p.slug}
                        </p>
                      </td>
                      <td className="py-3 text-zinc-800 text-xs">
                        {cat?.name ?? '-'}
                      </td>
                      <td className="py-3 text-center">
                        {p.is_published ? (
                          <span className="inline-block text-[10px] font-bold text-moss bg-moss/10 px-2 py-0.5 rounded-full">
                            게시됨
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-bold text-zinc-500 bg-rule px-2 py-0.5 rounded-full">
                            임시저장
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right text-xs text-zinc-800">
                        {(p.views ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-[11px] text-zinc-500">
                        {formatDate(p.updated_at)}
                      </td>
                      <td className="py-3 text-center">
                        <Link
                          href={`/admin/blog/${p.id}`}
                          className="text-[11px] text-terracotta hover:underline font-semibold"
                        >
                          편집 →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
