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
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from "@/lib/design/tokens";
import { Mono } from "@/components/v3";

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
        <main
          className="mx-auto"
          style={{ maxWidth: 1200, paddingBottom: 32 }}
        >
          <div style={{ padding: '20px' }}>
            <div
              style={{
                background: V3.paperHi,
                border: `1px solid ${V3.sale}`,
                borderRadius: V3Radius.sm,
                padding: '18px 20px',
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  fontWeight: V3FontWeight.bold,
                  color: V3.sale,
                  margin: 0,
                }}
              >
                장바구니를 불러오지 못했어요
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: V3.inkMute,
                  marginTop: 6,
                }}
              >
                {error.message}
              </p>
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
        {/* ============= 데스크톱 헤더 (md+) — v3 톤 ============= */}
        <section className="hidden md:block" style={{ padding: '32px 24px 16px' }}>
          <Mono color="inkMute" size="xs" weight={500}>
            Cart · 장바구니
          </Mono>
          <h1
            className="md:text-[36px] lg:text-[42px]"
            style={{
              margin: '8px 0 0',
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              fontSize: 28,
              color: V3.ink,
              letterSpacing: V3LetterSpacing.heading,
              lineHeight: 1.1,
            }}
          >
            장바구니
          </h1>
          <p
            className="md:text-[13px]"
            style={{
              fontSize: 11.5,
              color: V3.inkMute,
              marginTop: 6,
            }}
          >
            {validRows.length > 0
              ? `${validRows.length}개의 상품이 담겨 있어요`
              : '장바구니가 비어 있어요'}
          </p>
        </section>

        {validRows.length === 0 ? (
          <section
            className="md:px-6"
            style={{ padding: '56px 20px 0' }}
          >
            <div
              className="text-center max-w-2xl mx-auto"
              style={{
                borderRadius: V3Radius.sm,
                border: `1.5px dashed ${V3.rule}`,
                padding: '48px 20px',
                background: V3.paperHi,
              }}
            >
              <div
                className="mx-auto flex items-center justify-center md:w-20 md:h-20"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  background: V3.paper,
                  border: `1px solid ${V3.rule}`,
                }}
              >
                <ShoppingCart
                  size={24}
                  color={V3.inkMute}
                  strokeWidth={1.5}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <Mono color="inkMute" size="xxs" weight={600}>
                  Empty
                </Mono>
              </div>
              <p
                className="md:text-[26px]"
                style={{
                  margin: '8px 0 0',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.black,
                  fontSize: 18,
                  color: V3.ink,
                  letterSpacing: '-0.02em',
                }}
              >
                장바구니가 비어 있어요
              </p>
              <p
                className="md:text-[13px]"
                style={{
                  fontSize: 11.5,
                  color: V3.inkMute,
                  marginTop: 8,
                  lineHeight: 1.55,
                }}
              >
                우리 아이에게 딱 맞는 제품을 찾아보세요
              </p>
              <Link
                href="/products"
                className="inline-block active:scale-[0.98] transition md:text-[14px]"
                style={{
                  marginTop: 24,
                  padding: '12px 24px',
                  borderRadius: V3Radius.pill,
                  fontSize: 12,
                  fontWeight: V3FontWeight.bold,
                  background: V3.ink,
                  color: V3.paperHi,
                  textDecoration: 'none',
                }}
              >
                제품 둘러보기
              </Link>
            </div>

            {/* 빈 장바구니 — 추천 상품. 사용자가 카트에서 그냥 이탈하지 않게 */}
            {recProducts.length > 0 && (
              <div className="md:mt-16" style={{ marginTop: 40 }}>
                <div
                  className="flex items-baseline justify-between"
                  style={{ marginBottom: 14, paddingInline: 2 }}
                >
                  <h2
                    className="md:text-[22px]"
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-sans)',
                      fontWeight: V3FontWeight.black,
                      fontSize: 18,
                      color: V3.ink,
                      letterSpacing: V3LetterSpacing.heading,
                    }}
                  >
                    이런 건 어때요?
                  </h2>
                  <Link
                    href="/products"
                    className="md:text-[12.5px]"
                    style={{
                      fontSize: 11,
                      fontWeight: V3FontWeight.bold,
                      color: V3.accent,
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    전체 보기
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 12 }}>
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

              {/* 데스크톱 전용 sticky 합계 — v3 톤 */}
              <aside className="hidden md:block md:w-[360px] md:shrink-0">
                <section
                  className="md:mt-3 ft-sticky-product-col"
                  style={{ padding: 0 }}
                >
                  <div
                    style={{
                      background: V3.paperHi,
                      border: `1px solid ${V3.rule}`,
                      borderRadius: V3Radius.sm,
                      padding: '18px 22px',
                    }}
                  >
                    <Mono color="inkMute" size="xs" weight={500}>
                      Order Summary · 주문 요약
                    </Mono>
                    <h2
                      style={{
                        margin: '6px 0 18px',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: V3FontWeight.black,
                        fontSize: 17,
                        color: V3.ink,
                        letterSpacing: '-0.015em',
                      }}
                    >
                      주문 요약
                    </h2>
                    <div className="flex justify-between" style={{ fontSize: 13 }}>
                      <span style={{ color: V3.inkSoft }}>상품 금액</span>
                      <span
                        className="tabular-nums"
                        style={{ fontWeight: V3FontWeight.bold, color: V3.ink }}
                      >
                        {subtotal.toLocaleString()}원
                      </span>
                    </div>
                    <div
                      className="flex justify-between"
                      style={{ fontSize: 13, marginTop: 8 }}
                    >
                      <span style={{ color: V3.inkSoft }}>배송비</span>
                      <span
                        className="tabular-nums"
                        style={{ fontWeight: V3FontWeight.bold, color: V3.ink }}
                      >
                        {shipping === 0
                          ? '무료'
                          : `${shipping.toLocaleString()}원`}
                      </span>
                    </div>
                    {shippingBreakdown.remainingToFree > 0 && (
                      <Mono
                        color="inkMute"
                        size="xxs"
                        weight={500}
                        letterSpacing="0.04em"
                        upper={false}
                        style={{ marginTop: 6, display: 'inline-block' }}
                      >
                        {shippingBreakdown.remainingToFree.toLocaleString()}원 더
                        담으면 무료배송
                      </Mono>
                    )}
                    <div
                      style={{
                        borderTop: `1px solid ${V3.rule}`,
                        margin: '16px 0',
                      }}
                    />
                    <div className="flex justify-between items-center">
                      <span
                        style={{
                          fontWeight: V3FontWeight.bold,
                          fontSize: 14,
                          color: V3.ink,
                        }}
                      >
                        총 결제금액
                      </span>
                      <div className="flex items-baseline" style={{ gap: 3 }}>
                        <span
                          className="tabular-nums"
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 24,
                            fontWeight: V3FontWeight.black,
                            color: V3.accent,
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {total.toLocaleString()}
                        </span>
                        <Mono color="inkMute" size="xs" weight={500}>
                          원
                        </Mono>
                      </div>
                    </div>

                    <Link
                      href="/checkout"
                      className="hidden md:block w-full text-center active:scale-[0.98] transition"
                      style={{
                        marginTop: 20,
                        padding: '14px 0',
                        borderRadius: V3Radius.pill,
                        fontSize: 14,
                        fontWeight: V3FontWeight.bold,
                        background: V3.ink,
                        color: V3.paperHi,
                        letterSpacing: '-0.01em',
                        textDecoration: 'none',
                      }}
                    >
                      {total.toLocaleString()}원 결제하기
                    </Link>
                  </div>
                </section>

                {shippingBreakdown.remainingToFree > 0 && (
                  <section style={{ marginTop: 12 }}>
                    <div
                      style={{
                        background: V3.paper,
                        border: `1px solid ${V3.rule}`,
                        borderRadius: V3Radius.sm,
                        padding: '12px 16px',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="inline-flex items-center"
                          style={{
                            fontSize: 11,
                            color: V3.ink,
                            fontWeight: V3FontWeight.semibold,
                            gap: 6,
                          }}
                        >
                          <Truck size={14} strokeWidth={2} />
                          무료배송까지
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: V3FontWeight.bold,
                            color: V3.accent,
                          }}
                        >
                          {shippingBreakdown.remainingToFree.toLocaleString()}원 남음
                        </span>
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          height: 6,
                          background: V3.paperHi,
                          borderRadius: V3Radius.pill,
                          overflow: 'hidden',
                          border: `1px solid ${V3.rule}`,
                        }}
                      >
                        <div
                          className="transition-all"
                          style={{
                            height: '100%',
                            background: V3.sage,
                            borderRadius: V3Radius.pill,
                            width: `${Math.min(
                              100,
                              (subtotal / FREE_SHIPPING_THRESHOLD) * 100,
                            )}%`,
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
