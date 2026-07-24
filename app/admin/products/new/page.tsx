import Link from 'next/link'
import ProductForm from '../ProductForm'

export default function AdminProductNewPage() {
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
          새 상품 등록
        </h1>
        <p className="text-xs text-muted mt-1">새 상품을 등록하세요</p>
      </div>

      <ProductForm mode="create" />
    </div>
  )
}