import type { Metadata } from 'next'
import Link from 'next/link'
import { X } from 'lucide-react'

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

export default async function CheckoutFailPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { code, message, orderId } = await searchParams

  return (
    <main className="pb-8">
      <section className="px-5 pt-10 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-sale flex items-center justify-center text-white shadow-[0_8px_24px_rgba(184,58,46,0.3)]">
          <X className="w-8 h-8" strokeWidth={3} />
        </div>
        <span className="kicker mt-6" style={{ color: 'var(--sale)' }}>
          Payment Failed · 결제 실패
        </span>
        <h1
          className="font-serif mt-2 text-center"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          결제가 완료되지 않았어요
        </h1>
        <p className="mt-2 text-[12px] text-muted text-center">
          다시 시도하시거나 장바구니로 돌아가 확인해 주세요
        </p>
      </section>

      {(orderId || code || message) && (
        <section className="px-5 mt-7">
          <div className="bg-white rounded-xl border border-rule px-5 py-5 space-y-3">
            {orderId && (
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-muted">주문번호</span>
                <span className="text-text font-bold font-mono">
                  {orderId}
                </span>
              </div>
            )}
            {code && (
              <div className="flex justify-between items-center text-[12px]">
                <span className="text-muted">오류 코드</span>
                <span className="text-text font-mono text-[11px]">
                  {code}
                </span>
              </div>
            )}
            {message && (
              <div className="text-[12px] text-text pt-3 border-t border-rule leading-relaxed">
                {decodeURIComponent(message)}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="px-5 mt-6 space-y-2">
        <Link
          href="/cart"
          className="block w-full text-center py-4 rounded-full text-[14px] font-bold active:scale-[0.98] transition"
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            letterSpacing: '-0.01em',
            boxShadow: '0 4px 14px rgba(30,26,20,0.25)',
          }}
        >
          장바구니로 돌아가기
        </Link>
        <Link
          href="/products"
          className="block w-full text-center py-4 rounded-full bg-white border border-rule text-[13px] font-bold text-muted active:scale-[0.98] transition"
        >
          쇼핑 계속하기
        </Link>
      </section>
    </main>
  )
}
