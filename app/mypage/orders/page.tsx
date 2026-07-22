import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Package, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { isAppContextServer } from '@/lib/app-context'
import OrdersAppView, {
  type OrderRow as AppOrderRow,
} from './OrdersAppView'

// (cache-bust: Turbopack 가 편집 중간 파스 실패 청크를 캐시해 강제 재컴파일)
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '주문 내역',
  description: '내 주문 내역',
  robots: { index: false, follow: false },
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  preparing: '상품 준비 중',
  shipping: '배송 중',
  delivered: '배송 완료',
  cancelled: '취소됨',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  failed: '결제 실패',
  cancelled: '결제 취소',
  partially_refunded: '부분 환불',
  refunded: '환불',
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid':
    case 'delivered':
      return 'bg-moss text-white'
    case 'preparing':
    case 'shipping':
      return 'bg-terracotta text-white'
    case 'pending':
      return 'bg-gold text-text'
    case 'failed':
    case 'cancelled':
    case 'refunded':
      return 'bg-sale text-white'
    default:
      return 'bg-rule text-text'
  }
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    // 서버 컴포넌트 기본 UTC → 자정 직후 주문이 전날로 보이는 off-by-one 방지.
    timeZone: 'Asia/Seoul',
  })
}

export default async function OrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/mypage/orders')

  // 앱: 상단 헤더(← 주문 내역)가 제목/뒤로가기를 담당 → 본문 중복 헤더 제거.
  // 웹: per-screen 헤더가 없으므로 editorial 뒤로가기 + serif 제목 유지.
  const isApp = await isAppContextServer()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_number,
      total_amount,
      payment_status,
      order_status,
      created_at,
      order_items (
        id,
        product_id,
        product_name,
        product_image_url,
        quantity,
        unit_price
      )
    `
    )
    .eq('user_id', user.id)
    // ★ '결제 완료한 것만' 노출 (사장님 2026-07-22). 결제된 적 없는 유령 주문
    //   (체크아웃하다 만 것·실패·미결제 취소 = paid_at NULL)은 숨긴다 — 사용자가
    //   "결제한 적 없는 주문이 뜬다"고 반복해서 답답해한 부분. paid_at 은 결제가
    //   실제로 완료돼야 세팅되고 환불돼도 유지되므로, paid/부분환불/환불(=결제 후
    //   이력)은 남고 pending·failed·미결제 cancelled 만 빠진다. payment_status enum
    //   ('cancelled'가 미결제인지 결제후취소인지)보다 견고한 정본 신호.
    .not('paid_at', 'is', null)
    .order('created_at', { ascending: false })
    // 최근 50건만 — 장기 구독 고객의 전체 주문+아이템 무제한 로드로 목록 진입이
    // 점점 느려지던 것 방지(2026-07-17 perf). 2주 배송 기준 ~2년치. 더 필요하면
    // range 페이지네이션은 후속.
    .limit(50)

  if (error) {
    return (
      <AuthAwareShell>
        <main className="pb-8 mx-auto" style={{ maxWidth: 1024 }}>
          <div className="px-5 pt-5 md:px-6">
            <div className="bg-white rounded-xl border border-rule px-5 py-5">
              <p className="text-[13px] font-bold text-sale">
                주문 내역을 불러오지 못했어요
              </p>
              <p className="text-[11px] text-muted mt-1.5">{error.message}</p>
            </div>
          </div>
        </main>
      </AuthAwareShell>
    )
  }

  // '다시 주문' 스트립 제거 (2026-07-16) — 담을 장바구니가 없다(/cart 는 구독 전용
  // 전환으로 /start 리다이렉트). 이 블록은 그 스트립 하나 때문에 products 를 한 번 더
  // 조회하던 추가 쿼리였다.

  return (
    <AuthAwareShell>
    <main className="pb-8 mx-auto" style={{ maxWidth: 1024 }}>
      {/* 헤더 */}
      <section className="px-5 pt-6 pb-2 md:px-6">
        {isApp ? (
          // 앱: 헤더 ← 가 '주문 내역' 제목/뒤로가기를 이미 담당 → 본문은
          // kicker 만. 아래 상태 통계(전체/진행 중/취소·환불)가 공간을 채운다.
          <span className="kicker block">Orders</span>
        ) : (
          <>
            <Link
              href="/mypage"
              className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
            >
              ← 내 정보
            </Link>
            <span className="kicker mt-3 block">Orders</span>
            <h1
              className="font-serif mt-1.5"
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              주문 내역
            </h1>
          </>
        )}
      </section>

      {/* 앱: 필터 탭 + 다시주문 스트립 + 목록을 OrdersAppView 가 담당.
          웹: 아래 기존 통계 + 목록 그대로(에디토리얼 톤 불변). */}
      {isApp ? (
        <OrdersAppView
          orders={(orders ?? []) as unknown as AppOrderRow[]}
        />
      ) : (
      <>
      {/* 상태별 통계 — 진행 중 (preparing/shipping) / 완료 / 취소
          0건 카드는 자동 숨김. 모두 0 이면 섹션 비표시. */}
      {(() => {
        const ongoing = (orders ?? []).filter(
          (o) =>
            o.payment_status === 'paid' &&
            (o.order_status === 'preparing' || o.order_status === 'shipping'),
        ).length
        const delivered = (orders ?? []).filter(
          (o) => o.order_status === 'delivered',
        ).length
        const cancelled = (orders ?? []).filter(
          (o) =>
            o.order_status === 'cancelled' ||
            o.payment_status === 'cancelled' ||
            o.payment_status === 'refunded',
        ).length
        const total = orders?.length ?? 0
        if (total === 0) return null
        return (
          <section className="px-5 mt-3 md:px-6">
            <div className="grid grid-cols-3 gap-2">
              <StatChip
                kicker="전체"
                value={total}
                tone="ink"
              />
              <StatChip
                kicker="진행 중"
                value={ongoing}
                tone="terracotta"
                highlight={ongoing > 0}
              />
              <StatChip
                kicker={cancelled > 0 ? '취소·환불' : '완료'}
                value={cancelled > 0 ? cancelled : delivered}
                tone={cancelled > 0 ? 'sale' : 'moss'}
              />
            </div>
          </section>
        )
      })()}

      {!orders || orders.length === 0 ? (
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
              <Package
                className="w-6 h-6 text-muted"
                strokeWidth={1.5}
              />
            </div>
            <span className="kicker mt-4 block">Empty</span>
            <p
              className="font-serif mt-2"
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-0.015em',
              }}
            >
              아직 주문 내역이 없어요
            </p>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              첫 주문을 시작해 보세요
            </p>
            {/* ★로그인 상태라 /start(비로그인 설문→가입) 금지 — 우리 아이 허브 /dogs 로. */}
            <Link
              href="/dogs"
              className="mt-5 inline-block px-6 py-2.5 rounded-full text-[12px] font-bold active:scale-[0.98] transition"
              style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            >
              정기배송 시작하기
            </Link>
          </div>
        </section>
      ) : (
        <section className="px-5 md:px-6 mt-3">
          <ul className="space-y-2.5 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {orders.map((order) => {
              type OrderItemRow = {
                id: string
                product_name: string
                product_image_url: string | null
                quantity: number
                unit_price: number
              }
              const items: OrderItemRow[] = Array.isArray(order.order_items)
                ? (order.order_items as OrderItemRow[])
                : []
              const firstItem = items[0]
              const extraCount = items.length - 1

              const displayStatus =
                order.payment_status === 'paid'
                  ? order.order_status
                  : order.payment_status
              const label =
                order.payment_status === 'paid'
                  ? ORDER_STATUS_LABEL[order.order_status] ??
                    order.order_status
                  : PAYMENT_STATUS_LABEL[order.payment_status] ??
                    order.payment_status

              return (
                <li key={order.id} className="md:h-full">
                  {/* UI audit #2: grid 자식 h-full + flex-col 으로 row 높이 통일.
                      짧은 카드 / 긴 카드 (외 N건) 가 같은 행에서 baseline 어긋남 차단. */}
                  <Link
                    href={`/mypage/orders/${order.id}`}
                    className="block md:h-full bg-white rounded-xl border border-rule px-4 py-4 md:px-5 md:py-5 hover:border-text transition-all"
                  >
                    <div className="flex items-center justify-between mb-3 md:mb-4">
                      <span className="text-[11px] md:text-[12.5px] text-muted font-bold">
                        {formatDate(order.created_at)}
                      </span>
                      <span
                        className={`text-[10px] md:text-[11px] font-black px-2 py-0.5 md:px-2.5 md:py-1 rounded-md ${statusBadge(
                          displayStatus
                        )}`}
                      >
                        {label}
                      </span>
                    </div>

                    {firstItem && (
                      <div className="flex gap-3 md:gap-4">
                        <div className="relative shrink-0 w-14 h-14 md:w-20 md:h-20 rounded-lg bg-bg overflow-hidden flex items-center justify-center">
                          {firstItem.product_image_url ? (
                            <Image
                              src={firstItem.product_image_url}
                              alt={firstItem.product_name}
                              fill
                              sizes="(max-width: 768px) 56px, 80px"
                              className="object-cover"
                            />
                          ) : (
                            <ShoppingBag
                              className="w-6 h-6 md:w-8 md:h-8 text-muted"
                              strokeWidth={1.5}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] md:text-[14px] font-bold text-text line-clamp-1">
                            {firstItem.product_name}
                            {extraCount > 0 && (
                              <span className="text-muted">
                                {' '}외 {extraCount}건
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] md:text-[11px] text-muted mt-0.5 md:mt-1 font-mono">
                            {order.order_number}
                          </p>
                          <div className="mt-1 md:mt-2 flex items-baseline gap-1">
                            <span
                              className="font-serif text-[14px] md:text-[18px] tabular-nums"
                              style={{
                                fontWeight: 800,
                                color: 'var(--terracotta)',
                                letterSpacing: '-0.015em',
                              }}
                            >
                              {order.total_amount.toLocaleString()}
                            </span>
                            <span className="text-[10px] md:text-[12px] text-muted">
                              원
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      </>
      )}
    </main>
    </AuthAwareShell>
  )
}

/**
 * StatChip — 헤더 상태 통계 카드. 0 도 표시 (전체 한 번에 보기 좋음).
 * tone 'terracotta' + highlight 이면 sale 색 강조 + 도트 (사용자 액션 필요).
 */
function StatChip({
  kicker,
  value,
  tone,
  highlight,
}: {
  kicker: string
  value: number
  tone: 'ink' | 'terracotta' | 'moss' | 'sale'
  highlight?: boolean
}) {
  const colorMap = {
    ink: 'var(--ink)',
    terracotta: 'var(--terracotta)',
    moss: 'var(--moss)',
    sale: 'var(--sale)',
  }
  const accent = colorMap[tone]
  return (
    <div
      className="rounded-xl border px-3 py-2.5 transition relative"
      style={{
        background: highlight
          ? `color-mix(in srgb, ${accent} 6%, white)`
          : 'white',
        borderColor: highlight ? accent : 'var(--rule)',
      }}
    >
      <div
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: accent }}
      >
        {kicker}
      </div>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span
          className="font-serif tabular-nums leading-none"
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.015em',
          }}
        >
          {value}
        </span>
        <span className="text-[10px] text-muted">건</span>
      </div>
      {highlight && value > 0 && (
        <span
          aria-hidden
          className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
          style={{ background: accent }}
        />
      )}
    </div>
  )
}
