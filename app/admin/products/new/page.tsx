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
        <h1 className="font-['Archivo_Black'] text-3xl text-ink mt-2">
          NEW PRODUCT
        </h1>
        <p className="text-xs text-muted mt-1">새 상품을 등록하세요</p>
      </div>

      <ProductForm mode="create" />
    </div>
  )
}