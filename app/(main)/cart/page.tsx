import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import CartList from "./CartList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "장바구니",
  description: "파머스테일 장바구니",
  robots: { index: false, follow: false },
};

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
          <div className="bg-white rounded-xl border border-rule px-5 py-5">
            <p className="text-[13px] font-bold text-sale">
              장바구니를 불러오지 못했어요
            </p>
            <p className="text-[11px] text-muted mt-1.5">{error.message}</p>
          </div>
        </div>
      </main>
    );
  }

  // products가 배열로 올 수 있어서 정규화
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      <section className="px-5 pt-6 pb-2">
        <span className="kicker">Cart · 장바구니</span>
        <h1
          className="font-serif mt-1.5"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          장바구니
        </h1>
        <p className="text-[11px] text-muted mt-1">
          {validRows.length > 0
            ? `${validRows.length}개의 상품이 담겨 있어요`
            : "담긴 상품이 없어요"}
        </p>
      </section>

      {validRows.length === 0 ? (
        <section className="px-5 mt-14">
          <div
            className="rounded-2xl border px-5 py-12 text-center"
            style={{
              background: 'var(--bg-2)',
              borderColor: 'var(--rule-2)',
              borderStyle: 'dashed',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--rule-2)',
              }}
            >
              <ShoppingCart
                className="w-6 h-6 text-muted"
                strokeWidth={1.5}
              />
            </div>
            <span className="kicker mt-4 inline-block">Empty · 비어 있음</span>
            <p
              className="font-serif mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              장바구니가 비어 있어요
            </p>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              우리 아이에게 딱 맞는 제품을 찾아보세요
            </p>
            <Link
              href="/products"
              className="mt-5 inline-block px-6 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
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
            <div className="bg-white rounded-xl border border-rule px-5 py-4">
              <div className="flex justify-between text-[12px] text-text">
                <span>상품 금액</span>
                <span className="font-bold text-text">
                  {subtotal.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between text-[12px] text-text mt-2">
                <span>배송비</span>
                <span className="font-bold text-text">
                  {shipping === 0
                    ? "무료"
                    : `${shipping.toLocaleString()}원`}
                </span>
              </div>
              {shipping > 0 && (
                <p className="text-[10px] text-muted mt-1.5">
                  {(30000 - subtotal).toLocaleString()}원 더 담으면 무료배송
                </p>
              )}
              <div className="border-t border-rule my-3" />
              <div className="flex justify-between items-center">
                <span
                  className="font-bold"
                  style={{ fontSize: 13, color: 'var(--ink)' }}
                >
                  총 결제금액
                </span>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-serif"
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: 'var(--terracotta)',
                      letterSpacing: '-0.015em',
                    }}
                  >
                    {total.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-muted">원</span>
                </div>
              </div>
            </div>
          </section>

          {/* 무료배송 프로그레스 */}
          {shipping > 0 && (
            <section className="px-5 mt-3">
              <div className="bg-bg rounded-2xl border border-rule px-4 py-3">
                <div className="flex items-center justify-between text-[11px] text-text">
                  <span className="font-semibold inline-flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" strokeWidth={2} />
                    무료배송까지
                  </span>
                  <span className="font-bold text-terracotta">
                    {(30000 - subtotal).toLocaleString()}원 남음
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className="h-full bg-moss rounded-full transition-all"
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
                className="block w-full text-center py-4 rounded-full text-[14px] font-bold active:scale-[0.98] transition"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
                }}
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
