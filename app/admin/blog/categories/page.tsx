import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CategoriesManager from './CategoriesManager'

export const dynamic = 'force-dynamic'

type Category = {
  id: string
  slug: string
  name: string
  sort_order: number
}

export default async function AdminBlogCategoriesPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('blog_categories')
    .select('id, slug, name, sort_order')
    .order('sort_order', { ascending: true })

  // Post counts per category so the admin can see which categories are in use
  // (empty ones are safe to delete). A small table, so one full scan is fine.
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('category_id')
  const counts = new Map<string, number>()
  for (const p of posts ?? []) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/blog"
          className="text-xs text-muted hover:text-terracotta"
        >
          ← 매거진
        </Link>
        <h1 className="font-['Archivo_Black'] text-3xl text-ink mt-2">
          CATEGORIES
        </h1>
        <p className="text-xs text-muted mt-1">
          카테고리는 블로그 필터링과 URL에 쓰여요.
        </p>
      </div>

      {error ? (
        <p className="text-sale text-sm">에러: {error.message}</p>
      ) : (
        <CategoriesManager
          initial={(data ?? []) as Category[]}
          postCounts={Object.fromEntries(counts)}
        />
      )}
    </div>
  )
}
