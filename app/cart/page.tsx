import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  calculateShipping,
  FREE_SHIPPING_THRESHOLD,
} from "@/lib/commerce/shipping";
import CartList from "./CartList";
import AuthAwareShell from "@/components/AuthAwareShell";
import DeliveryCountdownBanner from "@/components/products/DeliveryCountdownBanner";
import CatalogProductCard, {
  type CatalogProduct,
} from "@/components/products/CatalogProductCard";
import { isAppContextServer } from "@/lib/app-context";
import CartChrome from "@/components/cart/CartChrome";
import CartUpsell from "@/components/cart/CartUpsell";
import CartAddMore from "@/components/cart/CartAddMore";
import CartReceipt from "@/components/cart/CartReceipt";
import CartStickyCTA from "@/components/cart/CartStickyCTA";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "장바구니",
  description: "파머스테일 장바구니",
  robots: { index: false, follow: false },
};

/**
 * 모바일 카트 헤더 카드의 "내일 도착 · 5월 22일 (금) 오전" 라벨 계산.
 * 카토프 시간 14시 이전이면 내일, 이후면 모레로. 주말 보정은 v2.
 */
function nextArrivalLabel(): string {
  const now = new Date();
  // 오후 2시 컷오프 이후면 +2일, 아니면 +1일.
  const cutoffHour = 14;
  const days = now.getHours() >= cutoffHour ? 2 : 1;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const month = target.getMonth() + 1;
  const date = target.getDate();
  const dayKor = ["일", "월", "화", "수", "목", "금", "토"][target.getDay()];
  const lead = days === 1 ? "내일 도착" : "모레 도착";
  return `${lead} · ${month}월 ${date}일 (${dayKor}) 오전`;
}

export default async function CartPage() {
  const supabase = await createClient();
  const isApp = await isAppContextServer();

  // 빈 장바구니용 추천 + 모바일 ADD MORE 횡스크롤 추천 (재활용).
  // 큐레이션 sort_order 상위 6개. 실패해도 빈 배열.
  let recProducts: CatalogProduct[] = [];
  try {
    const { data } = await supabase
      .from("products")
      .select(
        "id, name, slug, short_description, price, sale_price, category, is_subscribable, image_url, stock, created_at",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(6);
    recProducts = (data ?? []) as CatalogProduct[];
  } catch {
    /* noop */
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/cart");

  // 핸드오프 — 카드에 카테고리 tag + short_description + is_subscribable 필요.
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
        is_active,
        category,
        short_description,
        is_subscribable
      )
    `
    )
    .eq("user_id", user.id)
    .order("id", { ascending: false });

  // 모바일 핸드오프 — 기본 배송지 한 줄로 표시.
  const { data: defaultAddr } = await supabase
    .from("addresses")
    .select("address, address_detail")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .maybeSingle();
  const addressLine = defaultAddr
    ? `${defaultAddr.address}${defaultAddr.address_detail ? ` ${defaultAddr.address_detail}` : ""}`
    : null;

  if (error) {
    return (
      <AuthAwareShell>
        <main className="pb-8 mx-auto" style={{ maxWidth: 1200 }}>
          <div className="px-5 pt-5 md:px-6">
            <div className="bg-white rounded-xl border border-rule px-5 py-5">
              <p className="text-[13px] font-bold text-sale">
                장바구니를 불러오지 못했어요
              </p>
              <p className="text-[11px] text-muted mt-1.5">{error.message}</p>
            </div>
          </div>
        </main>
      </AuthAwareShell>
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

  // cart 단계에서는 배송지를 아직 모르니 도서산간 추가금은 계산 못함. 결제 직전
  // (CheckoutForm) 에서 zip이 입력되면 거기서 최종 확정. 여기서는 일반 지역
  // 기준 표시만 한다 — 사용자가 "무료배송까지 얼마 남았나"를 알 수 있으면 충분.
  const shippingBreakdown = calculateShipping({ subtotal });
  const shipping = shippingBreakdown.total;
  const total = subtotal + shipping;

  // 모바일 핸드오프 — receipt 카드 sage 배너 "결제 시 NP 적립 예정".
  // 실제 적립은 결제 후 webhook 에서 확정 — 여기서는 추정치 (1% 자동 적립).
  const pointsEarned = Math.floor(total * 0.01);

  // ADD MORE 추천은 카트에 이미 담긴 상품 제외 — 중복 추천 방지.
  const cartProductIds = new Set(validRows.map((r) => r.product.id));
  const addMoreProducts = recProducts
    .filter((p) => !cartProductIds.has(p.id))
    .slice(0, 4);

  const arrivalLabel = nextArrivalLabel();

  return (
    <AuthAwareShell>
      <main className="pb-40 md:max-w-6xl md:mx-auto md:pt-4 md:pb-16">
        {/* ============= 데스크톱 헤더 (md+) ============= */}
        <section className="hidden md:block px-5 pt-6 md:pt-8 pb-2 md:pb-4 md:px-6">
          <span className="kicker">Cart</span>
          <h1
            className="font-serif mt-1.5 md:mt-3 text-[22px] md:text-[36px] lg:text-[42px]"
            style={{
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
            }}
          >
            장바구니
          </h1>
          <p className="text-[11px] md:text-[13px] text-muted mt-1 md:mt-2">
            {validRows.length > 0
              ? `${validRows.length}개의 상품이 담겨 있어요`
              : '장바구니가 비어 있어요'}
          </p>
        </section>

        {validRows.length === 0 ? (
          <section className="px-5 md:px-6 mt-14 md:mt-20">
            <div
              className="rounded-2xl border px-5 py-12 md:px-10 md:py-20 text-center max-w-2xl mx-auto"
              style={{
                background: 'var(--bg-2)',
                borderColor: 'var(--rule-2)',
                borderStyle: 'dashed',
              }}
            >
              <div
                className="w-14 h-14 md:w-20 md:h-20 mx-auto rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--rule-2)',
                }}
              >
                <ShoppingCart
                  className="w-6 h-6 md:w-8 md:h-8 text-muted"
                  strokeWidth={1.5}
                />
              </div>
              <span className="kicker mt-4 md:mt-6 block">Empty</span>
              <p
                className="font-serif mt-2 md:mt-3 text-[16px] md:text-[26px]"
                style={{
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-0.02em',
                }}
              >
                장바구니가 비어 있어요
              </p>
              <p className="text-[11px] md:text-[13px] text-muted mt-1.5 md:mt-2.5 leading-relaxed">
                우리 아이에게 딱 맞는 제품을 찾아보세요
              </p>
              <Link
                href="/products"
                className="mt-5 md:mt-7 inline-block px-6 py-2.5 md:px-8 md:py-3.5 rounded-full text-[12px] md:text-[14px] font-bold active:scale-[0.98] transition"
                style={{ background: 'var(--ink)', color: 'var(--bg)' }}
              >
                제품 둘러보기
              </Link>
            </div>

            {/* 빈 장바구니 — 추천 상품. 사용자가 카트에서 그냥 이탈하지 않게 */}
            {recProducts.length > 0 && (
              <div className="mt-10 md:mt-16">
                <div className="flex items-baseline justify-between mb-3 md:mb-5 px-1">
                  <h2
                    className="font-serif text-[16px] md:text-[20px]"
                    style={{
                      fontWeight: 800,
                      color: 'var(--ink)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    이런 건 어때요?
                  </h2>
                  <Link
                    href="/products"
                    className="text-[11px] md:text-[12.5px] font-bold underline underline-offset-2"
                    style={{ color: 'var(--terracotta)' }}
                  >
                    전체 보기
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                  {recProducts.slice(0, 4).map((p) => (
                    <CatalogProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <>
            {/* ============= 모바일 핸드오프 (md:hidden, 본 컴포넌트들이 처리) ============= */}
            <CartChrome
              count={validRows.length}
              subtotal={subtotal}
              freeThreshold={FREE_SHIPPING_THRESHOLD}
              remainingToFree={shippingBreakdown.remainingToFree}
              addressLine={addressLine}
              arrivalLabel={arrivalLabel}
            />

            {/* 배송 마감 카운트다운 배너 — 웹 마케팅 톤. 앱 컨텍스트 생략. (데스크톱만) */}
            {!isApp && (
              <section className="hidden md:block px-5 mt-3 md:px-6">
                <DeliveryCountdownBanner />
              </section>
            )}

            {/* 데스크톱 2-column: 좌 아이템 리스트 / 우 sticky 결제 요약.
                모바일은 단일 열 + 하단 고정 결제 버튼 (CartStickyCTA). */}
            <div className="md:flex md:gap-8 md:px-6 md:mt-4">
              <section className="mt-1 md:mt-0 md:px-0 md:flex-1">
                <CartList initialItems={validRows} />
              </section>

              {/* 데스크톱 전용 sticky 합계 */}
              <aside className="hidden md:block md:w-[360px] md:shrink-0">
                <section className="md:px-0 md:mt-3 ft-sticky-product-col">
                  <div className="bg-white rounded-xl border border-rule px-5 py-4 md:px-6 md:py-5">
                    <h2 className="hidden md:block font-serif font-black mb-4 md:mb-5 text-[16px]" style={{ color: 'var(--ink)', letterSpacing: '-0.015em' }}>주문 요약</h2>
                    <div className="flex justify-between text-[12px] md:text-[13px] text-text">
                      <span>상품 금액</span>
                      <span className="font-bold text-text tabular-nums">
                        {subtotal.toLocaleString()}원
                      </span>
                    </div>
                    <div className="flex justify-between text-[12px] md:text-[13px] text-text mt-2">
                      <span>배송비</span>
                      <span className="font-bold text-text tabular-nums">
                        {shipping === 0
                          ? "무료"
                          : `${shipping.toLocaleString()}원`}
                      </span>
                    </div>
                    {shippingBreakdown.remainingToFree > 0 && (
                      <p className="text-[10px] md:text-[11px] text-muted mt-1.5">
                        {shippingBreakdown.remainingToFree.toLocaleString()}원 더 담으면 무료배송
                      </p>
                    )}
                    <div className="border-t border-rule my-3 md:my-4" />
                    <div className="flex justify-between items-center">
                      <span
                        className="font-bold text-[13px] md:text-[14px]"
                        style={{ color: 'var(--ink)' }}
                      >
                        총 결제금액
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className="font-serif text-[18px] md:text-[24px] tabular-nums"
                          style={{
                            fontWeight: 800,
                            color: 'var(--terracotta)',
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {total.toLocaleString()}
                        </span>
                        <span className="text-[11px] md:text-[13px] text-muted">원</span>
                      </div>
                    </div>

                    <Link
                      href="/checkout"
                      className="hidden md:block mt-5 w-full text-center py-3.5 rounded-full text-[14px] font-bold active:scale-[0.98] transition"
                      style={{
                        background: 'var(--ink)',
                        color: 'var(--bg)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {total.toLocaleString()}원 결제하기
                    </Link>
                  </div>
                </section>

                {shippingBreakdown.remainingToFree > 0 && (
                  <section className="md:px-0 mt-3">
                    <div className="bg-bg rounded-2xl border border-rule px-4 py-3">
                      <div className="flex items-center justify-between text-[11px] text-text">
                        <span className="font-semibold inline-flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5" strokeWidth={2} />
                          무료배송까지
                        </span>
                        <span className="font-bold text-terracotta">
                          {shippingBreakdown.remainingToFree.toLocaleString()}원 남음
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 bg-white rounded-full overflow-hidden">
                        <div
                          className="h-full bg-moss rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </section>
                )}
              </aside>
            </div>

            {/* ============= 모바일 핸드오프 — items 아래 sections ============= */}
            <CartUpsell />
            <CartAddMore products={addMoreProducts} />
            <CartReceipt
              subtotal={subtotal}
              shipping={shipping}
              pointsEarned={pointsEarned}
              remainingToFree={shippingBreakdown.remainingToFree}
            />

            {/* 모바일 sticky CTA — 하단 고정 dual-pane pill (handoff) */}
            <CartStickyCTA count={validRows.length} total={total} />
          </>
        )}
      </main>
    </AuthAwareShell>
  );
}
