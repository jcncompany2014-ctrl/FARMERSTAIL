import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BlogPostForm from '../BlogPostForm'

export const dynamic = 'force-dynamic'

export default async function AdminBlogNewPage() {
  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('blog_categories')
    .select('id, name, slug')
    .order('sort_order', { ascending: true })

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
          NEW POST
        </h1>
      </div>

      <BlogPostForm mode="create" categories={categories ?? []} />
    </div>
  )
}
