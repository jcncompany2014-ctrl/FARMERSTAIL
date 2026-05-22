import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, Clock, Receipt } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AuthAwareShell from '@/components/AuthAwareShell'
import CopyButton from '@/components/ui/CopyButton'
import PurchaseTracker from './PurchaseTracker'
import type { AnalyticsItem } from '@/lib/analytics'
import {
  bankCodeLabel,
  formatDueDate,
  paymentMethodLabel,
} from '@/lib/payments/toss'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '결제 완료',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{
  paymentKey?: string
  orderId?: string
  amount?: string
}>

// 결제 성공/대기 페이지가 한 번에 표시해야 하는 정보.
// 가상계좌는 `payment_status === 'pending'`인 채로 "입금 대기"
// 상태를 UI로 구분해야 한다.
type OrderForSuccess = {
  id: string
  user_id: string
  order_number: string
  total_amount: number
  payment_status: string | null
  payment_method: string | null
  receipt_url: string | null
  shipping_fee: number | null
  coupon_code: string | null
  virtual_account_bank: string | null
  virtual_account_number: string | null
  virtual_account_due_date: string | null
  virtual_account_holder: string | null
}

type OrderItemRow = {
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { paymentKey, orderId, amount } = await searchParams

  if (!paymentKey || !orderId || !amount) {
    redirect('/checkout/fail?code=MISSING_PARAMS&message=필수%20정보가%20없어요')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      'id, user_id, order_number, total_amount, payment_status, payment_method, receipt_url, shipping_fee, coupon_code, virtual_account_bank, virtual_account_number, virtual_account_due_date, virtual_account_holder'
    )
    .eq('order_number', orderId)
    .eq('user_id', user.id)
    .single<OrderForSuccess>()

  if (orderError || !order) {
    redirect('/checkout/fail?code=ORDER_NOT_FOUND&message=주문을%20찾을%20수%20없어요')
  }

  if (order.total_amount !== Number(amount)) {
    redirect('/checkout/fail?code=AMOUNT_MISMATCH&message=결제%20금액이%20맞지%20않아요')
  }

  // 이미 서버에서 상태가 확정된 경우는 confirm을 다시 호출할 필요 없음.
  // 'paid'면 정상 완료, 'pending'이면 가상계좌 입금 대기(confirm API는
  // 이미 첫 콜에서 WAITING_FOR_DEPOSIT을 반환한 상태).
  if (order.payment_status === 'paid' || order.payment_status === 'pending') {
    const items = await loadItems(supabase, order.id)
    return <SuccessView order={order} items={items} />
  }

  // baseUrl 은 결제 confirm fetch + 사용자에게 노출되는 안내(이메일 link 등)
  // 양쪽에 쓰일 수 있어 localhost fallback 은 production 사고 위험.
  // NEXT_PUBLIC_SITE_URL 누락 시 명시적 throw → Vercel 빌드 실패가 더 안전.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!baseUrl) {
    throw new Error(
      '[checkout/success] NEXT_PUBLIC_SITE_URL is not set — production-fatal',
    )
  }
  const confirmRes = await fetch(`${baseUrl}/api/payments/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      paymentKey,
      orderId,
      amount: Number(amount),
    }),
    cache: 'no-store',
  })

  if (!confirmRes.ok) {
    const data = await confirmRes.json().catch(() => ({}))
    const code = data?.code ?? 'CONFIRM_FAILED'
    const message = data?.message ?? '결제 승인 실패'
    redirect(
      `/checkout/fail?code=${encodeURIComponent(code)}&message=${encodeURIComponent(message)}`
    )
  }

  // Confirm 성공 시 최신 order를 다시 읽어서 receipt_url 등을 반영.
  const { data: fresh } = await supabase
    .from('orders')
    .select(
      'id, user_id, order_number, total_amount, payment_status, payment_method, receipt_url, shipping_fee, coupon_code, virtual_account_bank, virtual_account_number, virtual_account_due_date, virtual_account_holder'
    )
    .eq('id', order.id)
    .single<OrderForSuccess>()

  const items = await loadItems(supabase, order.id)
  return <SuccessView order={fresh ?? order} items={items} />
}

async function loadItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string
): Promise<OrderItemRow[]> {
  const { data } = await supabase
    .from('order_items')
    .select('product_id, product_name, unit_price, quantity')
    .eq('order_id', orderId)
  return (data ?? []) as OrderItemRow[]
}

function SuccessView({
  order,
  items,
}: {
  order: OrderForSuccess
  items: OrderItemRow[]
}) {
  // 가상계좌는 결제 "요청"은 성공했지만 실제 "완료"는 입금 후.
  // 화면에서도 이 차이를 명시적으로 보여줘야 사용자가 입금 절차를
  // 빼먹지 않는다.
  const isWaitingDeposit = order.payment_status === 'pending'
  const isPaid = order.payment_status === 'paid'

  const analyticsItems: AnalyticsItem[] = items.map((it) => ({
    item_id: it.product_id,
    item_name: it.product_name,
    price: it.unit_price,
    quantity: it.quantity,
  }))

  return (
    <AuthAwareShell>
    <main className="pb-8 md:pb-16 mx-auto" style={{ maxWidth: 720 }}>
      {/* 전환 이벤트 — 실제 결제 완료(DONE) 시점에만. 가상계좌 입금
          대기 상태에서는 발송하지 않음. */}
      {isPaid && analyticsItems.length > 0 && (
        <PurchaseTracker
          transactionId={order.order_number}
          value={order.total_amount}
          items={analyticsItems}
          shipping={order.shipping_fee ?? undefined}
          coupon={order.coupon_code}
          userId={order.user_id}
        />
      )}
      <section
        className="flex flex-col items-center md:pt-16"
        style={{ padding: '40px 20px 0' }}
      >
        <div
          className="flex items-center justify-center md:w-24 md:h-24"
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            background: isWaitingDeposit ? V3.yellow : V3.sage,
            color: V3.paperHi,
            boxShadow: isWaitingDeposit
              ? '0 8px 24px rgba(230,185,66,0.3)'
              : '0 8px 24px rgba(79,106,72,0.3)',
          }}
        >
          {isWaitingDeposit ? (
            <Clock size={32} strokeWidth={2.5} />
          ) : (
            <Check size={32} strokeWidth={3} />
          )}
        </div>
        <div style={{ marginTop: 24 }}>
          <Mono color={isWaitingDeposit ? 'yellow' : 'sage'} size="xs" weight={600}>
            {isWaitingDeposit
              ? 'Awaiting Deposit · 입금 대기'
              : 'Payment Complete · 결제 완료'}
          </Mono>
        </div>
        <h1
          className="text-center md:text-[36px] lg:text-[42px]"
          style={{
            margin: '8px 0 0',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 26,
            color: V3.ink,
            letterSpacing: V3LetterSpacing.heading,
            lineHeight: 1.15,
          }}
        >
          {isWaitingDeposit ? '입금을 기다리고 있어요' : '결제가 완료됐어요'}
        </h1>
        <p
          className="text-center md:text-[15px] max-w-md"
          style={{
            marginTop: 8,
            fontSize: 12.5,
            color: V3.inkMute,
            lineHeight: 1.55,
          }}
        >
          {isWaitingDeposit
            ? '가상계좌가 발급되었어요. 안내된 계좌로 24시간 내에 입금해 주세요.'
            : '주문이 잘 접수됐어요'}
        </p>
      </section>

      <section style={{ padding: '28px 20px 0' }}>
        <div
          style={{
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            borderRadius: V3Radius.sm,
            padding: '18px 20px',
          }}
        >
          <div
            className="flex justify-between items-center"
            style={{ fontSize: 12 }}
          >
            <span style={{ color: V3.inkMute }}>주문번호</span>
            <span
              style={{
                color: V3.ink,
                fontWeight: V3FontWeight.bold,
                fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
              }}
            >
              {order.order_number}
            </span>
          </div>
          <div
            style={{
              borderTop: `1px solid ${V3.rule}`,
              margin: '14px 0',
            }}
          />
          <div className="flex justify-between items-center">
            <span
              style={{
                fontWeight: V3FontWeight.bold,
                fontSize: 13,
                color: V3.ink,
              }}
            >
              {isWaitingDeposit ? '입금 예정 금액' : '결제금액'}
            </span>
            <div className="flex items-baseline" style={{ gap: 3 }}>
              <span
                className="tabular-nums md:text-[26px]"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 22,
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
          {order.receipt_url && (
            <a
              href={order.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center transition"
              style={{
                marginTop: 16,
                gap: 6,
                padding: '10px 0',
                borderRadius: V3Radius.xs,
                background: V3.paper,
                border: `1px solid ${V3.rule}`,
                fontSize: 12.5,
                fontWeight: V3FontWeight.bold,
                color: V3.accent,
                textDecoration: 'none',
              }}
            >
              <Receipt size={14} strokeWidth={2.25} />
              영수증 보기
            </a>
          )}
        </div>
      </section>

      {isWaitingDeposit ? (
        <section style={{ padding: '16px 20px 0' }}>
          <div
            style={{
              background:
                'color-mix(in srgb, ' + V3.yellow + ' 12%, ' + V3.paperHi + ')',
              border: `1px solid ${V3.yellow}`,
              borderRadius: V3Radius.sm,
              padding: '16px 18px',
            }}
          >
            <Mono color="inkMute" size="xxs" weight={700} letterSpacing="0.16em">
              입금 안내
            </Mono>
            {order.virtual_account_number ? (
              <>
                <dl
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <div className="flex justify-between">
                    <dt style={{ color: V3.inkMute }}>입금 은행</dt>
                    <dd
                      style={{
                        color: V3.ink,
                        fontWeight: V3FontWeight.bold,
                      }}
                    >
                      {bankCodeLabel(order.virtual_account_bank) || '—'}
                    </dd>
                  </div>
                  <div
                    className="flex justify-between items-center"
                    style={{ gap: 8 }}
                  >
                    <dt
                      className="shrink-0"
                      style={{ color: V3.inkMute }}
                    >
                      계좌번호
                    </dt>
                    <dd
                      className="break-all text-right flex-1 min-w-0"
                      style={{
                        color: V3.ink,
                        fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
                        fontWeight: V3FontWeight.bold,
                        fontSize: 13,
                      }}
                    >
                      {order.virtual_account_number}
                    </dd>
                    <CopyButton
                      text={order.virtual_account_number}
                      label="복사"
                      size="xs"
                    />
                  </div>
                  {order.virtual_account_holder && (
                    <div className="flex justify-between">
                      <dt style={{ color: V3.inkMute }}>예금주</dt>
                      <dd style={{ color: V3.ink }}>
                        {order.virtual_account_holder}
                      </dd>
                    </div>
                  )}
                  {order.virtual_account_due_date && (
                    <div className="flex justify-between">
                      <dt style={{ color: V3.inkMute }}>입금 기한</dt>
                      <dd
                        style={{
                          color: V3.sale,
                          fontWeight: V3FontWeight.bold,
                        }}
                      >
                        {formatDueDate(order.virtual_account_due_date)}
                      </dd>
                    </div>
                  )}
                </dl>
                <p
                  style={{
                    fontSize: 11,
                    color: V3.inkMute,
                    marginTop: 12,
                    lineHeight: 1.55,
                  }}
                >
                  입금이 확인되면 상품 준비가 시작되고 알림을 보내드려요.
                  기한까지 입금되지 않으면 주문이 자동 취소됩니다.
                </p>
              </>
            ) : (
              <>
                <p
                  style={{
                    fontSize: 12,
                    color: V3.ink,
                    marginTop: 6,
                    lineHeight: 1.55,
                  }}
                >
                  발급된 가상계좌 정보는 결제 직후 토스페이먼츠에서 보낸
                  안내(이메일/문자)에서 확인하실 수 있어요. 입금이 확인되면
                  상품 준비가 시작되고 알림을 보내드려요.
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: V3.inkMute,
                    marginTop: 8,
                    lineHeight: 1.55,
                  }}
                >
                  * 24시간 내 입금되지 않으면 주문이 자동 취소됩니다.
                </p>
              </>
            )}
          </div>
          {order.payment_method && (
            <p
              className="text-center"
              style={{
                fontSize: 10,
                color: V3.inkMute,
                marginTop: 8,
              }}
            >
              결제 수단 · {paymentMethodLabel(order.payment_method)}
            </p>
          )}
        </section>
      ) : (
        <section style={{ padding: '16px 20px 0' }}>
          <div
            style={{
              background: V3.paperHi,
              border: `1px solid ${V3.rule}`,
              borderRadius: V3Radius.sm,
              padding: '14px 16px',
            }}
          >
            <Mono color="inkMute" size="xxs" weight={700} letterSpacing="0.16em">
              배송 안내
            </Mono>
            <p
              style={{
                fontSize: 13,
                color: V3.ink,
                marginTop: 6,
                lineHeight: 1.55,
              }}
            >
              주문하신 상품은 평일 기준 2~3일 내 출고됩니다.
            </p>
          </div>
        </section>
      )}

      <section
        className="md:flex md:gap-3"
        style={{
          padding: '24px 20px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <Link
          href={`/mypage/orders/${order.id}`}
          className="text-center w-full md:flex-1 active:scale-[0.98] transition"
          style={{
            padding: '15px 0',
            borderRadius: V3Radius.pill,
            fontSize: 14,
            fontWeight: V3FontWeight.bold,
            background: V3.ink,
            color: V3.paperHi,
            letterSpacing: '-0.01em',
            boxShadow: '0 4px 14px rgba(22,20,15,0.2)',
            textDecoration: 'none',
          }}
        >
          주문 상세 보기
        </Link>
        <Link
          href="/products"
          className="text-center w-full md:flex-1 active:scale-[0.98] transition"
          style={{
            padding: '15px 0',
            borderRadius: V3Radius.pill,
            background: V3.paperHi,
            border: `1px solid ${V3.rule}`,
            fontSize: 13,
            fontWeight: V3FontWeight.bold,
            color: V3.inkMute,
            textDecoration: 'none',
          }}
        >
          쇼핑 계속하기
        </Link>
      </section>
    </main>
    </AuthAwareShell>
  )
}
