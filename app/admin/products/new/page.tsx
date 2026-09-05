import Link from 'next/link'
import ProductForm from '../ProductForm'

export default function AdminProductNewPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/products"
          className="text-xs text-muted-foreground hover:text-primary"
        >
          ← 제품 목록
        </Link>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground leading-tight mt-2">
          새 상품 등록
        </h1>
        <p className="text-xs text-muted-foreground mt-1">새 상품을 등록하세요</p>
      </div>

      <ProductForm mode="create" />
    </div>
  )
}