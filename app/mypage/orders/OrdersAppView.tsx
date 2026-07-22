'use client'

/**
 * OrdersAppView — 주문 내역 '앱' 전용 뷰 (2026-06-11).
 *
 * /mypage/orders 는 web/app 공유 라우트라, 웹 에디토리얼 톤은 page.tsx 가
 * 그대로 렌더하고(=!isApp 분기), 앱 컨텍스트에서만 이 컴포넌트로 교체된다.
 * 사장님 피드백: 통계 칩만 덩그러니라 비어 보임 → (1) 칩을 '필터 탭'으로
 * 기능화 + (2) 최근 주문 '다시 담기' 스트립으로 재구매 유도 + 공간 채움.
 *
 * 데이터는 서버(page.tsx)에서 받아 props 로만 받는다(추가 쿼리 없음).
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag } from 'lucide-react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

export type OrderItemRow = {
  id: string
  product_name: string
  product_image_url: string | null
  quantity: number
  unit_price: number
}
export type OrderRow = {
  id: string
  order_number: string
  total_amount: number
  payment_status: string
  order_status: string
  created_at: string
  order_items: OrderItemRow[]
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

function badgeColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'paid':
    case 'delivered':
      return { bg: 'var(--moss, #6f7d52)', fg: '#fff' }
    case 'preparing':
    case 'shipping':
      return { bg: 'var(--accent)', fg: '#fff' }
    case 'pending':
      return { bg: 'var(--gold, #d8a531)', fg: 'var(--ink)' }
    case 'failed':
    case 'cancelled':
    case 'refunded':
      return { bg: 'var(--sale, #b5453a)', fg: '#fff' }
    default:
      return { bg: 'var(--rule)', fg: 'var(--ink)' }
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  })
}

type FilterKey = 'all' | 'ongoing' | 'cancelled'

function isOngoing(o: OrderRow): boolean {
  return (
    o.payment_status === 'paid' &&
    (o.order_status === 'preparing' || o.order_status === 'shipping')
  )
}
function isCancelled(o: OrderRow): boolean {
  return (
    o.order_status === 'cancelled' ||
    o.payment_status === 'cancelled' ||
    o.payment_status === 'refunded'
  )
}

export default function OrdersAppView({
  orders,
}: {
  orders: OrderRow[]
}) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const counts = useMemo(() => {
    let ongoing = 0
    let cancelled = 0
    for (const o of orders) {
      if (isOngoing(o)) ongoing++
      if (isCancelled(o)) cancelled++
    }
    return { total: orders.length, ongoing, cancelled }
  }, [orders])

  const filtered = useMemo(() => {
    if (filter === 'ongoing') return orders.filter(isOngoing)
    if (filter === 'cancelled') return orders.filter(isCancelled)
    return orders
  }, [orders, filter])

  // 빈 주문 — 페이지가 자체 empty 를 처리하지 않고 이 뷰가 담당.
  if (orders.length === 0) {
    return (
      <section style={{ padding: '24px 20px 0' }}>
        <div
          className="text-center"
          style={{
            borderRadius: V3Radius.sm,
            border: `1.5px dashed ${V3.rule}`,
            padding: '44px 24px',
            background: V3.paperHi,
          }}
        >
          <div
            className="mx-auto flex items-center justify-center"
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              background: V3.paper,
              border: `1px solid ${V3.rule}`,
              marginBottom: 14,
            }}
          >
            <ShoppingBag size={24} color={V3.accent} strokeWidth={1.5} />
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              fontSize: 16,
              color: V3.ink,
              letterSpacing: '-0.02em',
            }}
          >
            아직 주문 내역이 없어요
          </h3>
          <p
            style={{
              fontSize: 12,
              color: V3.inkMute,
              marginTop: 8,
              lineHeight: 1.55,
            }}
          >
            우리 아이 첫 한 끼를 골라보세요
          </p>
          {/* ★로그인 상태라 /start(비로그인 설문→가입) 금지 — 우리 아이 허브 /dogs 로. */}
          <Link
            href="/dogs"
            className="inline-flex items-center active:scale-[0.98] transition"
            style={{
              marginTop: 20,
              padding: '12px 22px',
              fontSize: 12,
              fontWeight: V3FontWeight.bold,
              borderRadius: V3Radius.pill,
              background: V3.ink,
              color: V3.paperHi,
              textDecoration: 'none',
            }}
          >
            정기배송 시작하기
          </Link>
        </div>
      </section>
    )
  }

  const TABS: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: counts.total },
    { key: 'ongoing', label: '진행 중', count: counts.ongoing },
    { key: 'cancelled', label: '취소·환불', count: counts.cancelled },
  ]

  return (
    <div>
      {/* '다시 담기' 스트립 제거 (2026-07-16) — cart_items 에 담고 "장바구니에
          담았어요" 토스트까지 띄웠는데, /cart 는 구독 전용 전환(2026-06-26)으로
          /start 리다이렉트라 **담아도 볼 수가 없었다**. 낱개 재구매 자체가 없는
          모델이다(재구매 = 구독이 알아서 보냄). */}

      {/* 2) 필터 탭 — 죽은 통계 칩 대신 누르면 걸러지는 세그먼트. */}
      <section style={{ padding: '14px 20px 0' }}>
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 0,
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: V3Radius.sm,
            overflow: 'hidden',
          }}
        >
          {TABS.map((t, i) => {
            const active = filter === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                aria-pressed={active}
                className="transition"
                style={{
                  padding: '11px 8px',
                  borderLeft: i === 0 ? 'none' : `1px solid ${V3.rule}`,
                  background: active
                    ? 'color-mix(in srgb, var(--accent) 9%, transparent)'
                    : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div
                  className="font-mono uppercase"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: active ? V3.accent : V3.inkMute,
                  }}
                >
                  {t.label}
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    marginTop: 4,
                    fontFamily: 'var(--font-sans)',
                    fontSize: 22,
                    fontWeight: V3FontWeight.black,
                    lineHeight: 1,
                    color: active ? V3.ink : 'var(--ink-mute)',
                    letterSpacing: '-0.025em',
                  }}
                >
                  {t.count}
                  <span
                    style={{ fontSize: 11, fontWeight: 600, marginLeft: 2, color: V3.inkMute }}
                  >
                    건
                  </span>
                </div>
                {/* 활성 탭 하단 accent 막대 */}
                <div
                  aria-hidden
                  style={{
                    width: 16,
                    height: 2,
                    margin: '6px auto 0',
                    background: active ? V3.accent : 'transparent',
                  }}
                />
              </button>
            )
          })}
        </div>
      </section>

      {/* 3) 주문 목록 (필터 적용) */}
      <section style={{ padding: '12px 20px 0' }}>
        {filtered.length === 0 ? (
          <p
            className="text-center"
            style={{
              padding: '32px 0',
              fontSize: 13,
              color: V3.inkMute,
            }}
          >
            이 조건의 주문이 없어요
          </p>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((order) => {
              const items = Array.isArray(order.order_items)
                ? order.order_items
                : []
              const firstItem = items[0]
              const extraCount = items.length - 1
              const displayStatus =
                order.payment_status === 'paid'
                  ? order.order_status
                  : order.payment_status
              const label =
                order.payment_status === 'paid'
                  ? ORDER_STATUS_LABEL[order.order_status] ?? order.order_status
                  : PAYMENT_STATUS_LABEL[order.payment_status] ??
                    order.payment_status
              const bc = badgeColors(displayStatus)

              return (
                <li key={order.id}>
                  <Link
                    href={`/mypage/orders/${order.id}`}
                    className="block transition active:scale-[0.99]"
                    style={{
                      background: V3.paperHi,
                      border: `1px solid ${V3.rule}`,
                      borderRadius: V3Radius.sm,
                      padding: '14px 16px',
                      textDecoration: 'none',
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: V3FontWeight.bold,
                          color: V3.inkMute,
                        }}
                      >
                        {formatDate(order.created_at)}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: V3FontWeight.black,
                          padding: '2px 8px',
                          borderRadius: V3Radius.xs,
                          background: bc.bg,
                          color: bc.fg,
                        }}
                      >
                        {label}
                      </span>
                    </div>

                    {firstItem && (
                      <div className="flex" style={{ gap: 12 }}>
                        <div
                          className="relative shrink-0 overflow-hidden flex items-center justify-center"
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: V3Radius.xs,
                            background: V3.paper,
                            border: `1px solid ${V3.rule}`,
                          }}
                        >
                          {firstItem.product_image_url ? (
                            <Image
                              src={firstItem.product_image_url}
                              alt={firstItem.product_name}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <ShoppingBag
                              size={24}
                              color={V3.inkMute}
                              strokeWidth={1.5}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="line-clamp-1"
                            style={{
                              fontSize: 13.5,
                              fontWeight: V3FontWeight.bold,
                              color: V3.ink,
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {firstItem.product_name}
                            {extraCount > 0 && (
                              <span style={{ color: V3.inkMute }}>
                                {' '}외 {extraCount}건
                              </span>
                            )}
                          </p>
                          <p
                            className="font-mono"
                            style={{
                              fontSize: 10.5,
                              color: V3.inkMute,
                              marginTop: 3,
                            }}
                          >
                            {order.order_number}
                          </p>
                          <div className="flex items-baseline" style={{ marginTop: 6, gap: 2 }}>
                            <span
                              className="tabular-nums"
                              style={{
                                fontFamily: 'var(--font-sans)',
                                fontSize: 15,
                                fontWeight: V3FontWeight.black,
                                color: V3.accent,
                                letterSpacing: '-0.02em',
                              }}
                            >
                              {order.total_amount.toLocaleString()}
                            </span>
                            <span style={{ fontSize: 11, color: V3.inkMute }}>원</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

