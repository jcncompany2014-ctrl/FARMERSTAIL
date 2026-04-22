import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
    const safe = trimmed.replace(/[,()]/g, '')
    query = query.or(`title.ilike.%${safe}%,slug.ilike.%${safe}%`)
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
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-['Archivo_Black'] text-3xl text-ink">
            MAGAZINE
          </h1>
          <p className="text-sm text-muted mt-1">
            {hasFilter ? `검색 결과 ${rows.length}개` : `총 ${rows.length}개`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/blog/categories"
            className="px-4 py-2 rounded-full bg-white border border-rule text-text text-xs font-semibold hover:border-terracotta hover:text-terracotta transition"
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
      <div className="p-4 rounded-2xl bg-white border border-rule mb-4">
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
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-bg text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-terracotta"
          />
          <select
            name="category"
            defaultValue={category}
            className="px-3 py-2 rounded-lg bg-bg text-xs text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
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
            className="px-3 py-2 rounded-lg bg-bg text-xs text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
          >
            <option value="">전체 상태</option>
            <option value="published">게시됨</option>
            <option value="draft">임시저장</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-text text-white text-xs font-bold hover:bg-[#5C4130] transition"
          >
            필터
          </button>
          {hasFilter && (
            <Link
              href="/admin/blog"
              className="px-3 py-2 text-[11px] font-semibold text-muted hover:text-sale"
            >
              초기화
            </Link>
          )}
        </form>
      </div>

      <div className="p-6 rounded-2xl bg-white border border-rule">
        {error ? (
          <p className="text-sale text-sm">에러: {error.message}</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted py-10">
            {hasFilter
              ? '조건에 맞는 글이 없어요'
              : '작성된 글이 없어요. 새 글을 써 보세요.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted border-b border-rule">
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
                      className="border-b border-bg hover:bg-bg transition"
                    >
                      <td className="py-3">
                        <div className="w-14 h-10 rounded-md bg-bg overflow-hidden">
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
                        <p className="text-ink font-medium">{p.title}</p>
                        <p className="text-[10px] text-muted font-mono mt-0.5">
                          {p.slug}
                        </p>
                      </td>
                      <td className="py-3 text-text text-xs">
                        {cat?.name ?? '-'}
                      </td>
                      <td className="py-3 text-center">
                        {p.is_published ? (
                          <span className="inline-block text-[10px] font-bold text-moss bg-moss/10 px-2 py-0.5 rounded-full">
                            게시됨
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-bold text-muted bg-rule px-2 py-0.5 rounded-full">
                            임시저장
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right text-xs text-text">
                        {(p.views ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-[11px] text-muted">
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
