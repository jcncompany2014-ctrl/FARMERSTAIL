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
 *
 * # 2026-10-09 앱 새 디자인('A 포스터', 캔버스 M07)
 * 거르기 세 칸(고른 칸 = 먹색, 왼쪽 머스타드 띠) + 주문 카드(날짜·상태 칩·사진·이름·주문번호·금액 숫자 글꼴).
 * 거르기 판정·이동 주소는 그대로다. 사진은 레시피 팩 스튜디오 컷(겉봉투 사진 금지 — 주문에 저장된 상품 사진이
 * 옛 겉봉투일 수 있다), 이름은 레시피 이름("닭고기 레시피", lib/design/pouch 의 POUCH_NAME). 모르는 상품은 저장된 값.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { V3 } from '@/lib/design/tokens'
import { pouchLineFromName, POUCH_NAME } from '@/lib/design/pouch'
import { studioPouchImage } from '@/lib/personalization/packageImage'

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

/** 상태 칩 색 — 끝난 것 먹색, 진행 중 머스타드, 대기 회색, 실패·취소·환불 빨강. */
function badgeColors(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'paid':
    case 'delivered':
      return { bg: V3.ink, fg: '#FFFFFF' }
    case 'preparing':
    case 'shipping':
      return { bg: V3.mustard, fg: V3.ink }
    case 'pending':
      return { bg: V3.soft, fg: V3.ink }
    case 'failed':
    case 'cancelled':
    case 'refunded':
      return { bg: V3.sale, fg: '#FFFFFF' }
    default:
      return { bg: V3.soft, fg: V3.ink }
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

/** 주문 상품 줄 → 화면 이름·사진. 레시피면 "닭고기 레시피" + 스튜디오 팩 컷, 아니면 저장된 이름·사진. */
function itemLook(it: OrderItemRow): { name: string; image: string | null } {
  const line = pouchLineFromName(it.product_name)
  if (line) return { name: `${POUCH_NAME[line]} 레시피`, image: studioPouchImage(line) }
  return { name: it.product_name.replace(/\s*\([^)]*\)\s*$/, ''), image: it.product_image_url }
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

const BagIcon = ({ size = 26 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 8h14l-1 12H6z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
)

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
      <section
        style={{
          margin: '24px 20px 0',
          padding: '32px 20px',
          borderRadius: 4,
          background: V3.soft,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          color: V3.ink,
        }}
      >
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: V3.inkMute,
          }}
        >
          <BagIcon />
        </span>
        {/* 제목 글꼴은 앱 틀의 h2 규칙이 준다. */}
        <h2 style={{ margin: '16px 0 0', fontSize: 24, lineHeight: 1.2 }}>아직 주문 내역이 없어요</h2>
        <p style={{ margin: '8px 0 0', fontSize: 16, lineHeight: 1.6, color: V3.inkSoft }}>우리 아이 첫 박스를 시작해 보세요</p>
        {/* ★로그인 상태라 /start(비로그인 설문→가입) 금지 — 우리 아이 허브 /dogs 로. */}
        <Link
          href="/dogs"
          className="active:opacity-80"
          style={{
            marginTop: 20,
            height: 56,
            padding: '0 22px',
            borderRadius: 4,
            background: V3.ink,
            color: '#FFFFFF',
            fontSize: 17,
            fontWeight: 800,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          정기배송 시작하기
        </Link>
      </section>
    )
  }

  const TABS: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: counts.total },
    { key: 'ongoing', label: '진행 중', count: counts.ongoing },
    { key: 'cancelled', label: '취소·환불', count: counts.cancelled },
  ]

  return (
    // 줄 높이 normal — 시안 원본은 기본 줄 높이라, 앱 기본(1.5)이면 카드마다 몇 px 씩 길어진다(여러 줄 문구는 따로 지정).
    <div style={{ color: V3.ink, lineHeight: 'normal' }}>
      {/* '다시 담기' 스트립 제거 (2026-07-16) — cart_items 에 담고 "장바구니에
          담았어요" 토스트까지 띄웠는데, /cart 는 구독 전용 전환(2026-06-26)으로
          /start 리다이렉트라 **담아도 볼 수가 없었다**. 낱개 재구매 자체가 없는
          모델이다(재구매 = 구독이 알아서 보냄). */}

      {/* 거르기 — 죽은 통계 칩 대신 누르면 걸러지는 세 칸(시안 M07). */}
      <div
        role="group"
        aria-label="주문 거르기"
        style={{
          margin: '20px 20px 0',
          borderRadius: 4,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          background: V3.soft,
          borderLeft: `6px solid ${V3.mustard}`,
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
              className="ft-no-press"
              style={{
                minHeight: 72,
                border: 0,
                borderLeft: i === 0 ? 0 : `1.5px solid ${V3.ink}`,
                background: active ? V3.ink : '#FFFFFF',
                color: active ? '#FFFFFF' : V3.ink,
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: active ? 800 : 700, color: active ? '#FFFFFF' : V3.inkSoft }}>{t.label}</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                <span className="ft-num" style={{ fontSize: 26, lineHeight: 1 }}>
                  {t.count}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700 }}> 건</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* 주문 목록 (거르기 적용) */}
      {filtered.length === 0 ? (
        <p style={{ margin: '16px 20px 0', padding: '32px 0', textAlign: 'center', fontSize: 16, color: V3.inkMute }}>
          이 조건의 주문이 없어요
        </p>
      ) : (
        <ul style={{ margin: '16px 20px 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((order) => {
            const items = Array.isArray(order.order_items) ? order.order_items : []
            const firstItem = items[0]
            const extraCount = items.length - 1
            const displayStatus = order.payment_status === 'paid' ? order.order_status : order.payment_status
            const label =
              order.payment_status === 'paid'
                ? ORDER_STATUS_LABEL[order.order_status] ?? order.order_status
                : PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status
            const bc = badgeColors(displayStatus)
            const look = firstItem ? itemLook(firstItem) : null

            return (
              <li key={order.id}>
                <Link
                  href={`/mypage/orders/${order.id}`}
                  className="active:opacity-80"
                  style={{
                    padding: '14px 16px 16px',
                    border: `1px solid ${V3.rule}`,
                    borderRadius: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    color: V3.ink,
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: V3.inkMute }}>{formatDate(order.created_at)}</span>
                    <span
                      style={{
                        height: 26,
                        padding: '0 8px',
                        borderRadius: 4,
                        background: bc.bg,
                        color: bc.fg,
                        fontSize: 13,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </span>
                  </span>

                  {firstItem && look && (
                    <span style={{ display: 'grid', gridTemplateColumns: '60px minmax(0, 1fr) 12px', columnGap: 14, alignItems: 'center' }}>
                      <span
                        style={{
                          position: 'relative',
                          width: 60,
                          height: 60,
                          borderRadius: 4,
                          overflow: 'hidden',
                          background: V3.soft,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: V3.inkMute,
                        }}
                      >
                        {look.image ? (
                          <Image src={look.image} alt="" fill sizes="60px" className="object-cover" />
                        ) : (
                          <BagIcon size={24} />
                        )}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <span className="line-clamp-1" style={{ fontSize: 17, fontWeight: 800 }}>
                          {look.name}
                          {extraCount > 0 && <span style={{ fontWeight: 600, color: V3.inkMute }}> 외 {extraCount}건</span>}
                        </span>
                        <span style={{ fontSize: 13, color: V3.inkMute, letterSpacing: '0.01em' }}>{order.order_number}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>
                          <span className="ft-num" style={{ fontSize: 22 }}>
                            {order.total_amount.toLocaleString('ko-KR')}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800 }}>원</span>
                        </span>
                      </span>
                      <span aria-hidden style={{ fontSize: 20 }}>
                        ›
                      </span>
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
