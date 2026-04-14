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
          className="text-xs text-[#8A7668] hover:text-[#A0452E]"
        >
          ← 제품 목록
        </Link>
        <h1 className="font-['Archivo_Black'] text-3xl text-[#2A2118] mt-2">
          EDIT PRODUCT
        </h1>
        <p className="text-xs text-[#8A7668] mt-1">{product.name}</p>
      </div>

      <ProductForm mode="edit" initialData={product} />
    </div>
  )
}