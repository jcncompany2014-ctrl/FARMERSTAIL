/**
 * XL-1 (#19) — /admin/products/[id]/nutrients
 *
 * 38 영양소 raw 입력 폼 (AAFCO Adult Maintenance 기준).
 * products.nutrition_facts jsonb 에 저장.
 */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NutrientsForm from './NutrientsForm'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function AdminProductNutrientsPage({
  params,
}: {
  params: Params
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, nutrition_facts')
    .eq('id', id)
    .single()

  if (error || !product) notFound()

  const initial =
    (product.nutrition_facts as Record<string, number | string | null> | null) ??
    {}

  return (
    <div>
      <div className="mb-5">
        <Link
          href={`/admin/products/${id}`}
          className="text-xs text-mute hover:text-terracotta"
        >
          ← 제품 편집
        </Link>
        <h1 className="font-bold tracking-tight text-3xl text-ink mt-2">
          영양 정보
        </h1>
        <p className="text-xs text-mute mt-1">
          {product.name} · 38 영양소 (AAFCO Adult Maintenance 기준)
        </p>
      </div>

      <NutrientsForm productId={id} initial={initial} />
    </div>
  )
}
