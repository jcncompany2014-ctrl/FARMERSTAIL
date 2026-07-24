import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProductForm from '../ProductForm'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function AdminProductEditPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !product) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/products"
          className="text-xs text-muted hover:text-terracotta"
        >
          ← 제품 목록
        </Link>
        <h1 className="text-[22px] font-bold tracking-tight text-zinc-900 leading-tight mt-2">
          상품 수정
        </h1>
        <p className="text-xs text-muted mt-1">{product.name}</p>
        <div className="mt-3 flex gap-3 text-xs flex-wrap">
          <Link
            href={`/admin/products/${id}/nutrients`}
            className="rounded border border-line px-3 py-1.5 hover:border-terracotta hover:text-terracotta"
          >
            38 영양소 편집 →
          </Link>
          <Link
            href={`/admin/products/${id}/insights`}
            className="rounded border border-line px-3 py-1.5 hover:border-terracotta hover:text-terracotta"
          >
            LTV 인사이트 →
          </Link>
          <Link
            href={`/admin/label/${id}`}
            className="rounded border border-line px-3 py-1.5 hover:border-terracotta hover:text-terracotta"
          >
            라벨 PDF →
          </Link>
        </div>
      </div>

      {/* audit #79: generated Product 타입과 ProductData (form schema) 컬럼 nullable
          차이 — admin only 페이지라 cast 우회. ProductForm 내부에서 default 처리. */}
      <ProductForm mode="edit" initialData={product as unknown as Parameters<typeof ProductForm>[0]['initialData']} />
    </div>
  )
}