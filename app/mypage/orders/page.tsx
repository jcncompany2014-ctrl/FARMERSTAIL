import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Package, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

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
  refunded: '환불',
}

type StatusTone = 'sage' | 'accent' | 'yellow' | 'sale' | 'inkMute'

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'paid':
    case 'delivered':
      return 'sage'
    case 'preparing':
    case 'shipping':
      return 'accent'
    case 'pending':
      return 'yellow'
    case 'failed':
    case 'cancelled':
    case 'refunded':
      return 'sale'
    default:
      return 'inkMute'
  }
}

const TONE_COLOR: Record<StatusTone, string> = {
  sage: V3.sage,
  accent: V3.accent,
  yellow: V3.yellow,
  sale: V3.sale,
  inkMute: V3.inkMute,
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * /mypage/orders — 주문 내역 리스트 (v3 reskin, 2026-05-22 R9 Gap-A).
 *
 * 상태별 mini-stat 3-col + 주문 카드 (날짜·상태·아이템·금액).
 */
export default async function OrdersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/mypage/orders')

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
        product_name,
        product_image_url,
        quantity,
        unit_price
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <AuthAwareShell>
        <main
          className="mx-auto"
          style={{ maxWidth: 1024, paddingBottom: 32 }}
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
                주문 내역을 불러오지 못했어요
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
    )
  }

  return (
    <AuthAwareShell>
      <main className="mx-auto" style={{ maxWidth: 1024, paddingBottom: 32 }}>
        {/* 헤더 */}
        <section style={{ padding: '24px 20px 8px' }} className="md:px-6">
          <Link
            href="/mypage"
            style={{
              fontSize: 11,
              fontWeight: V3FontWeight.semibold,
              color: V3.inkMute,
              textDecoration: 'none',
              display: 'inline-block',
              marginBottom: 14,
            }}
          >
            ← 내 정보
          </Link>
          <Mono color="inkMute" size="xs" weight={500}>
            Orders · 주문 내역
          </Mono>
          <h1
            style={{
              margin: '6px 0 0',
              fontFamily: 'var(--font-sans)',
              fontWeight: V3FontWeight.black,
              fontSize: 28,
              lineHeight: 1,
              color: V3.ink,
              letterSpacing: V3LetterSpacing.heading,
            }}
          >
            주문 내역
          </h1>
        </section>

        {/* 상태별 통계 */}
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
            <section style={{ padding: '12px 20px 0' }} className="md:px-6">
              <div
                className="grid grid-cols-3"
                style={{
                  gap: 0,
                  background: V3.paperHi,
                  border: `1px solid ${V3.rule}`,
                  borderRadius: V3Radius.sm,
                  overflow: 'hidden',
                }}
              >
                <StatCell kicker="전체" value={total} tone="ink" isFirst />
                <StatCell
                  kicker="진행 중"
                  value={ongoing}
                  tone="accent"
                  highlight={ongoing > 0}
                />
                <StatCell
                  kicker={cancelled > 0 ? '취소·환불' : '완료'}
                  value={cancelled > 0 ? cancelled : delivered}
                  tone={cancelled > 0 ? 'sale' : 'sage'}
                />
              </div>
            </section>
          )
        })()}

        {!orders || orders.length === 0 ? (
          <section style={{ padding: '56px 20px 0' }}>
            <div
              className="text-center"
              style={{
                borderRadius: V3Radius.sm,
                border: `1.5px dashed ${V3.rule}`,
                padding: '48px 20px',
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
                }}
              >
                <Package size={24} color={V3.inkMute} strokeWidth={1.5} />
              </div>
              <div style={{ marginTop: 14 }}>
                <Mono color="inkMute" size="xxs" weight={600}>
                  Empty
                </Mono>
              </div>
              <p
                style={{
                  margin: '8px 0 0',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: V3FontWeight.black,
                  fontSize: 16,
                  color: V3.ink,
                  letterSpacing: '-0.02em',
                }}
              >
                아직 주문 내역이 없어요
              </p>
              <p
                style={{
                  fontSize: 11.5,
                  color: V3.inkMute,
                  marginTop: 6,
                  lineHeight: 1.55,
                }}
              >
                첫 주문을 시작해 보세요
              </p>
              <Link
                href="/products"
                className="inline-block active:scale-[0.98] transition"
                style={{
                  marginTop: 20,
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
          </section>
        ) : (
          <section style={{ padding: '12px 20px 0' }} className="md:px-6">
            <ul
              className="md:grid md:grid-cols-2"
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {orders.map((order: any) => {
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
                    ? ORDER_STATUS_LABEL[order.order_status] ??
                      order.order_status
                    : PAYMENT_STATUS_LABEL[order.payment_status] ??
                      order.payment_status

                const tone = statusTone(displayStatus)
                const toneColor = TONE_COLOR[tone]

                return (
                  <li key={order.id} className="md:h-full">
                    <Link
                      href={`/mypage/orders/${order.id}`}
                      className="block transition"
                      style={{
                        background: V3.paperHi,
                        border: `1px solid ${V3.rule}`,
                        borderRadius: V3Radius.sm,
                        padding: '14px 16px',
                        textDecoration: 'none',
                        color: V3.ink,
                        height: '100%',
                      }}
                    >
                      <div
                        className="flex items-center justify-between"
                        style={{ marginBottom: 12 }}
                      >
                        <Mono
                          color="inkMute"
                          size="xxs"
                          weight={500}
                          letterSpacing="0.08em"
                        >
                          {formatDate(order.created_at)}
                        </Mono>
                        <span
                          className="inline-flex items-center"
                          style={{
                            gap: 4,
                            padding: '3px 9px',
                            borderRadius: V3Radius.xs,
                            background: toneColor,
                            color: tone === 'yellow' ? V3.ink : V3.paperHi,
                            fontFamily:
                              "var(--font-mono, 'IBM Plex Mono'), monospace",
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
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
                                sizes="(max-width: 768px) 56px, 80px"
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
                                margin: 0,
                                fontFamily: 'var(--font-sans)',
                                fontSize: 13,
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
                            <Mono
                              color="inkMute"
                              size="xxs"
                              weight={500}
                              letterSpacing="0.06em"
                              style={{ marginTop: 4, display: 'inline-block' }}
                            >
                              {order.order_number}
                            </Mono>
                            <div
                              className="flex items-baseline"
                              style={{ marginTop: 4, gap: 3 }}
                            >
                              <span
                                className="tabular-nums"
                                style={{
                                  fontFamily: 'var(--font-sans)',
                                  fontSize: 16,
                                  fontWeight: V3FontWeight.black,
                                  color: V3.accent,
                                  letterSpacing: '-0.02em',
                                }}
                              >
                                {order.total_amount.toLocaleString()}
                              </span>
                              <Mono color="inkMute" size="xxs" weight={500}>
                                원
                              </Mono>
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
      </main>
    </AuthAwareShell>
  )
}

/**
 * StatCell — 3-col 메트릭 strip cell.
 * highlight 이면 액센트 dot 표시 (사용자 액션 필요).
 */
function StatCell({
  kicker,
  value,
  tone,
  highlight,
  isFirst,
}: {
  kicker: string
  value: number
  tone: StatusTone
  highlight?: boolean
  isFirst?: boolean
}) {
  const accent = TONE_COLOR[tone]
  return (
    <div
      className="relative"
      style={{
        padding: '12px 14px',
        borderLeft: isFirst ? 'none' : `1px solid ${V3.rule}`,
        background: highlight
          ? `color-mix(in srgb, ${accent} 6%, ${V3.paperHi})`
          : V3.paperHi,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: accent,
        }}
      >
        {kicker}
      </span>
      <div
        className="flex items-baseline"
        style={{ marginTop: 5, gap: 2 }}
      >
        <span
          className="tabular-nums"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 20,
            color: V3.ink,
            letterSpacing: V3LetterSpacing.heading,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <Mono color="inkMute" size="xxs" weight={500}>
          건
        </Mono>
      </div>
      {highlight && value > 0 && (
        <span
          aria-hidden
          className="absolute"
          style={{
            top: 10,
            right: 10,
            width: 6,
            height: 6,
            borderRadius: 3,
            background: accent,
          }}
        />
      )}
    </div>
  )
}
