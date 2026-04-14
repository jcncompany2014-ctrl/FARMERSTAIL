import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProductRowActions from './ProductRowActions'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-['Archivo_Black'] text-3xl text-[#2A2118]">
            PRODUCTS
          </h1>
          <p className="text-sm text-[#8A7668] mt-1">
            총 {products?.length ?? 0}개 상품
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="px-4 py-2 rounded-full bg-[#A0452E] text-white text-xs font-semibold hover:bg-[#8A3822] transition"
        >
          + 새 상품 등록
        </Link>
      </div>

      <div className="p-6 rounded-2xl bg-white border border-[#EDE6D8]">
        {error ? (
          <p className="text-[#B83A2E] text-sm">에러: {error.message}</p>
        ) : !products || products.length === 0 ? (
          <p className="text-center text-sm text-[#8A7668] py-10">
            등록된 상품이 없어요
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-[#8A7668] border-b border-[#EDE6D8]">
                  <th className="text-left py-2 font-medium w-16">이미지</th>
                  <th className="text-left py-2 font-medium">상품명</th>
                  <th className="text-left py-2 font-medium">카테고리</th>
                  <th className="text-right py-2 font-medium">가격</th>
                  <th className="text-center py-2 font-medium">재고</th>
                  <th className="text-center py-2 font-medium">활성</th>
                  <th className="text-center py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p: any) => (
                  <tr
                    key={p.id}
                    className="border-b border-[#F5F0E6] hover:bg-[#F5F0E6] transition"
                  >
                    <td className="py-3">
                      <div className="w-12 h-12 rounded-lg bg-[#F5F0E6] overflow-hidden flex items-center justify-center">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">🐾</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <p className="text-[#2A2118] font-medium">{p.name}</p>
                      <p className="text-[10px] text-[#8A7668] font-mono mt-0.5">
                        {p.slug}
                      </p>
                    </td>
                    <td className="py-3 text-[#5C4A3A] text-xs">
                      {p.category ?? '-'}
                    </td>
                    <td className="py-3 text-right">
                      {p.sale_price ? (
                        <div>
                          <p className="text-[10px] text-[#8A7668] line-through">
                            {p.price.toLocaleString()}원
                          </p>
                          <p className="font-semibold text-[#A0452E]">
                            {p.sale_price.toLocaleString()}원
                          </p>
                        </div>
                      ) : (
                        <p className="font-semibold text-[#2A2118]">
                          {p.price.toLocaleString()}원
                        </p>
                      )}
                    </td>
                    <td className="py-3">
                      <ProductRowActions
                        productId={p.id}
                        field="stock"
                        initialValue={p.stock}
                      />
                    </td>
                    <td className="py-3">
                      <ProductRowActions
                        productId={p.id}
                        field="is_active"
                        initialValue={p.is_active}
                      />
                    </td>
                    <td className="py-3 text-center">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="text-[11px] text-[#A0452E] hover:underline font-semibold"
                      >
                        편집 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}