import Link from 'next/link'
import { Newspaper } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdminTabs, Hl, Warn, LoadError } from '@/components/admin/ui'
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
  // 실패해도 목록은 보이므로 로그만(규칙1 — 버리진 않는다). 이름은 '-' 폴백.
  const { data: categories, error: categoriesErr } = await supabase
    .from('blog_categories')
    .select('id, name, slug')
    .order('sort_order', { ascending: true })
  if (categoriesErr) {
    console.error('[admin-blog] 카테고리 조회 실패:', categoriesErr.message)
  }
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
  if (error) console.error('[admin-blog] 글 목록 조회 실패:', error.message)
  const rows = (posts ?? []) as PostRow[]
  const hasFilter = Boolean(trimmed || category || status)

  return (
    <div>
      {/* 대개편 v2 T4 — 콘텐츠 그룹 탭 (블로그|FAQ|산지) + 헤더 zinc 통일 */}
      <AdminTabs tabs={CONTENT_TABS} active="/admin/blog" />
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="size-5 text-primary" strokeWidth={2} />
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              블로그
            </h1>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">
            <Hl>웹사이트에 올라가는 블로그 글</Hl>을 쓰고 관리하는 곳이에요.{' '}
            <Warn>발행하면 고객이 보는 /blog 페이지에 바로 노출</Warn>돼요. —{' '}
            {hasFilter ? `검색 결과 ${rows.length}개` : `총 ${rows.length}개`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/blog/categories"
            className="whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
          >
            카테고리 관리
          </Link>
          <Link
            href="/admin/blog/new"
            className="whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            + 새 글 작성
          </Link>
        </div>
      </div>

      {/* 필터 바 — 서버 사이드 GET 링크 기반 */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-sm mb-4">
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
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-secondary text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            name="category"
            defaultValue={category}
            className="px-3 py-2 rounded-lg bg-secondary text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="px-3 py-2 rounded-lg bg-secondary text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">전체 상태</option>
            <option value="published">게시됨</option>
            <option value="draft">임시저장</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition"
          >
            필터
          </button>
          {hasFilter && (
            <Link
              href="/admin/blog"
              className="px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
            >
              초기화
            </Link>
          )}
        </form>
      </div>

      <div className="p-6 rounded-xl bg-card border border-border shadow-sm">
        {error ? (
          // 원시 error.message 노출 대신 사람 말(2026-09-05 개편) — 상세는 서버 로그.
          <LoadError what="글 목록" />
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">
            {hasFilter
              ? '조건에 맞는 글이 없어요'
              : '작성된 글이 없어요. 새 글을 써 보세요.'}
          </p>
        ) : (
          <>
          {/* 모바일: 카드 리스트 — 7열 테이블은 폰에서 가로 스크롤(2026-09-05 개편). */}
          <ul className="space-y-2.5 md:hidden">
            {rows.map((p) => {
              const cat = p.category_id ? categoryById.get(p.category_id) : null
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/blog/${p.id}`}
                    className="block rounded-xl border border-border bg-card p-3.5 transition hover:border-ring"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-[13px] font-bold leading-snug">
                        {p.title}
                      </p>
                      {p.is_published ? (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          게시됨
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          임시저장
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {cat?.name ?? '-'} · 조회 {(p.views ?? 0).toLocaleString()} ·{' '}
                      {formatDate(p.updated_at)}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground border-b border-border">
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
                      className="border-b border-border hover:bg-secondary/50 transition"
                    >
                      <td className="py-3">
                        <div className="w-14 h-10 rounded-md bg-secondary overflow-hidden">
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
                        <p className="text-foreground font-medium">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {p.slug}
                        </p>
                      </td>
                      <td className="py-3 text-foreground text-xs">
                        {cat?.name ?? '-'}
                      </td>
                      <td className="py-3 text-center">
                        {p.is_published ? (
                          <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                            게시됨
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                            임시저장
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right text-xs text-foreground">
                        {(p.views ?? 0).toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-[11px] text-muted-foreground">
                        {formatDate(p.updated_at)}
                      </td>
                      <td className="py-3 text-center">
                        <Link
                          href={`/admin/blog/${p.id}`}
                          className="text-[11px] text-primary hover:underline font-semibold"
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
          </>
        )}
      </div>
    </div>
  )
}
