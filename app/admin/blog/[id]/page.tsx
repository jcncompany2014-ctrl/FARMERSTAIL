import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BlogPostForm from '../BlogPostForm'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function AdminBlogEditPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: post, error }, { data: categories }] = await Promise.all([
    supabase.from('blog_posts').select('*').eq('id', id).single(),
    supabase
      .from('blog_categories')
      .select('id, name, slug')
      .order('sort_order', { ascending: true }),
  ])

  if (error || !post) notFound()

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <Link
            href="/admin/blog"
            className="text-xs text-muted hover:text-terracotta"
          >
            ← 매거진
          </Link>
          <h1 className="font-['Archivo_Black'] text-3xl text-ink mt-2">
            EDIT POST
          </h1>
          <p className="text-xs text-muted mt-1 font-mono">{post.slug}</p>
        </div>
        {post.is_published && (
          <Link
            href={`/blog/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-terracotta hover:underline font-semibold"
          >
            사이트에서 보기 ↗
          </Link>
        )}
      </div>

      <BlogPostForm
        mode="edit"
        categories={categories ?? []}
        initialData={post}
      />
    </div>
  )
}
