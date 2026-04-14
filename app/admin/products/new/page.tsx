import Link from 'next/link'
import ProductForm from '../ProductForm'

export default function AdminProductNewPage() {
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
          NEW PRODUCT
        </h1>
        <p className="text-xs text-[#8A7668] mt-1">새 상품을 등록하세요</p>
      </div>

      <ProductForm mode="create" />
    </div>
  )
}