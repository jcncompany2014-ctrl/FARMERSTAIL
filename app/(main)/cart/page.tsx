import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CartList from "./CartList";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/cart");

  const { data: items, error } = await supabase
    .from("cart_items")
    .select(
      `
      id,
      quantity,
      product_id,
      products (
        id,
        name,
        slug,
        price,
        sale_price,
        image_url,
        stock,
        is_active
      )
    `
    )
    .eq("user_id", user.id)
    .order("id", { ascending: false });

  if (error) {
    return (
      <div className="p-5">
        <p className="text-[#B83A2E]">장바구니를 불러오지 못했어요.</p>
        <p className="text-xs text-[#8A7668] mt-2">{error.message}</p>
      </div>
    );
  }

  // products가 배열로 올 수 있어서 정규화
  const rows = (items ?? []).map((it: any) => ({
    id: it.id as string,
    quantity: it.quantity as number,
    product: Array.isArray(it.products) ? it.products[0] : it.products,
  }));

  const validRows = rows.filter((r) => r.product && r.product.is_active);

  const subtotal = validRows.reduce((sum, r) => {
    const price = r.product.sale_price ?? r.product.price;
    return sum + price * r.quantity;
  }, 0);

  const shipping = subtotal === 0 ? 0 : subtotal >= 30000 ? 0 : 3000;
  const total = subtotal + shipping;

  return (
    <div className="pb-32">
      {/* 헤더 */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-['Archivo_Black'] text-2xl text-[#2A2118]">
          CART
        </h1>
        <p className="text-sm text-[#8A7668] mt-1">
          장바구니에 담긴 상품 {validRows.length}개
        </p>
      </div>

      {validRows.length === 0 ? (
        <div className="px-5 mt-20 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-[#F5F0E6] flex items-center justify-center text-4xl">
            🛒
          </div>
          <p className="mt-5 text-[#5C4A3A]">장바구니가 비어 있어요</p>
          <Link
            href="/products"
            className="mt-6 px-6 py-3 rounded-full bg-[#A0452E] text-white text-sm font-medium"
          >
            제품 둘러보기
          </Link>
        </div>
      ) : (
        <>
          <CartList initialItems={validRows} />

          {/* 합계 카드 */}
          <div className="mx-5 mt-4 p-5 rounded-2xl bg-[#F5F0E6] border border-[#EDE6D8]">
            <div className="flex justify-between text-sm text-[#5C4A3A]">
              <span>상품 금액</span>
              <span>{subtotal.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-sm text-[#5C4A3A] mt-2">
              <span>배송비</span>
              <span>
                {shipping === 0 ? "무료" : `${shipping.toLocaleString()}원`}
              </span>
            </div>
            {shipping > 0 && (
              <p className="text-xs text-[#8A7668] mt-1">
                {(30000 - subtotal).toLocaleString()}원 더 담으면 무료배송
              </p>
            )}
            <div className="border-t border-[#EDE6D8] my-3" />
            <div className="flex justify-between items-center">
              <span className="text-[#2A2118] font-semibold">총 결제금액</span>
              <span className="font-['Archivo_Black'] text-xl text-[#A0452E]">
                {total.toLocaleString()}원
              </span>
            </div>
          </div>

          {/* 고정 결제 버튼 */}
          <div className="fixed bottom-16 left-0 right-0 px-5 py-3 bg-white border-t border-[#EDE6D8] z-40">
            <Link
              href="/checkout"
              className="block w-full text-center py-4 rounded-full bg-[#A0452E] text-white font-semibold hover:bg-[#8A3822] transition"
            >
              {total.toLocaleString()}원 결제하기
            </Link>
          </div>
        </>
      )}
    </div>
  );
}