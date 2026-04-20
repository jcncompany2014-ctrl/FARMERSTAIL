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
      <main className="pb-8">
        <div className="px-5 pt-5">
          <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-5">
            <p className="text-[13px] font-bold text-[#B83A2E]">
              장바구니를 불러오지 못했어요
            </p>
            <p className="text-[11px] text-[#8A7668] mt-1.5">{error.message}</p>
          </div>
        </div>
      </main>
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
    <main className="pb-40">
      {/* 헤더 */}
      <section className="px-5 pt-5 pb-1">
        <h1 className="text-lg font-black text-[#3D2B1F] tracking-tight">
          장바구니
        </h1>
        <p className="text-[11px] text-[#8A7668] mt-0.5">
          {validRows.length > 0
            ? `${validRows.length}개의 상품이 담겨 있어요`
            : "담긴 상품이 없어요"}
        </p>
      </section>

      {validRows.length === 0 ? (
        <section className="px-5 mt-14">
          <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#F5F0E6] flex items-center justify-center text-[26px]">
              🛒
            </div>
            <p className="mt-4 text-[13px] font-bold text-[#3D2B1F]">
              장바구니가 비어 있어요
            </p>
            <p className="text-[11px] text-[#8A7668] mt-1">
              우리 아이에게 딱 맞는 제품을 찾아보세요
            </p>
            <Link
              href="/products"
              className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-[#A0452E] text-white text-[12px] font-bold active:scale-[0.98] transition"
            >
              제품 둘러보기
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="px-5 mt-3">
            <CartList initialItems={validRows} />
          </section>

          {/* 합계 카드 */}
          <section className="px-5 mt-4">
            <div className="bg-white rounded-xl border border-[#EDE6D8] px-5 py-4">
              <div className="flex justify-between text-[12px] text-[#5C4A3A]">
                <span>상품 금액</span>
                <span className="font-bold text-[#3D2B1F]">
                  {subtotal.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between text-[12px] text-[#5C4A3A] mt-2">
                <span>배송비</span>
                <span className="font-bold text-[#3D2B1F]">
                  {shipping === 0
                    ? "무료"
                    : `${shipping.toLocaleString()}원`}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-[10px] text-[#8A7668] mt-1.5">
                  {(30000 - subtotal).toLocaleString()}원 더 담으면 무료배송
                </p>
              )}
              <div className="border-t border-[#EDE6D8] my-3" />
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-black text-[#3D2B1F]">
                  총 결제금액
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[18px] font-black text-[#A0452E]">
                    {total.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-[#8A7668]">원</span>
                </div>
              </div>
            </div>
          </section>

          {/* 무료배송 프로그레스 */}
          {shipping > 0 && (
            <section className="px-5 mt-3">
              <div className="bg-[#F5F0E6] rounded-xl border border-[#EDE6D8] px-4 py-3">
                <div className="flex items-center justify-between text-[11px] text-[#5C4A3A]">
                  <span className="font-bold">🚚 무료배송까지</span>
                  <span className="font-black text-[#A0452E]">
                    {(30000 - subtotal).toLocaleString()}원 남음
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#6B7F3A] rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (subtotal / 30000) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </section>
          )}

          {/* 고정 결제 버튼 */}
          <div
            className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] left-0 right-0 z-30"
          >
            <div className="max-w-md mx-auto px-5">
              <Link
                href="/checkout"
                className="block w-full text-center py-4 rounded-xl bg-[#A0452E] text-white text-[14px] font-black shadow-[0_4px_14px_rgba(160,69,46,0.25)] active:scale-[0.98] transition"
              >
                {total.toLocaleString()}원 결제하기
              </Link>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
