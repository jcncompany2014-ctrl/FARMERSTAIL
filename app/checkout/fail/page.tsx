import type { Metadata } from 'next'
import Link from 'next/link'
import { X } from 'lucide-react'
import AuthAwareShell from '@/components/AuthAwareShell'
import { V3, V3FontWeight, V3LetterSpacing, V3Radius } from '@/lib/design/tokens'
import { Mono } from '@/components/v3'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '결제 실패',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<{
  code?: string
  message?: string
  orderId?: string
}>

/**
 * /checkout/fail — 결제 실패 페이지 (v3 reskin, 2026-05-22 R9-9).
 */
export default async function CheckoutFailPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { code, message, orderId } = await searchParams

  return (
    <AuthAwareShell>
      <main
        className="mx-auto"
        style={{ maxWidth: 720, paddingBottom: 32 }}
      >
        <section
          className="flex flex-col items-center"
          style={{ padding: '40px 20px 0' }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              background: V3.sale,
              color: V3.paperHi,
              boxShadow: '0 8px 24px rgba(184,58,46,0.3)',
            }}
          >
            <X size={32} strokeWidth={3} />
          </div>
          <div style={{ marginTop: 24 }}>
            <Mono color="sale" size="xs" weight={600}>
              Payment Failed · 결제 실패
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
            결제가 완료되지 않았어요
          </h1>
          <p
            className="text-center"
            style={{
              marginTop: 8,
              fontSize: 12.5,
              color: V3.inkMute,
            }}
          >
            다시 시도하거나 장바구니로 돌아가 확인해 주세요
          </p>
        </section>

        {(orderId || code || message) && (
          <section style={{ padding: '28px 20px 0' }}>
            <div
              style={{
                background: V3.paperHi,
                border: `1px solid ${V3.rule}`,
                borderRadius: V3Radius.sm,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {orderId && (
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
                    {orderId}
                  </span>
                </div>
              )}
              {code && (
                <div
                  className="flex justify-between items-center"
                  style={{ fontSize: 12 }}
                >
                  <span style={{ color: V3.inkMute }}>오류 코드</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono, 'IBM Plex Mono'), monospace",
                      fontSize: 11,
                      color: V3.ink,
                    }}
                  >
                    {code}
                  </span>
                </div>
              )}
              {message && (
                <div
                  style={{
                    fontSize: 12,
                    color: V3.ink,
                    paddingTop: 12,
                    borderTop: `1px solid ${V3.rule}`,
                    lineHeight: 1.55,
                  }}
                >
                  {decodeURIComponent(message)}
                </div>
              )}
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
            href="/cart"
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
            장바구니로 돌아가기
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
