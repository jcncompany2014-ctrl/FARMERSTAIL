import { Loader2 } from 'lucide-react'

/**
 * 결제 승인 대기 — 절대 새로고침/뒤로가기 누르지 말도록 명시.
 *
 * /checkout/success 의 page.tsx 가 server-side 에서 /api/payments/confirm 을
 * 호출. 토스 응답 대기가 1~3초 걸릴 수 있고, 그 사이에 사용자가 뒤로가기 /
 * 새로고침 누르면 같은 paymentKey 로 confirm 이 재시도되거나 주문이 안
 * 만들어진 채로 끝남. 명시적인 로딩 UI 로 사용자 행동 유도.
 */
export default function CheckoutSuccessLoading() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-sm w-full text-center">
        <div
          className="mx-auto mb-5 w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: 'var(--bg-2)' }}
        >
          <Loader2
            className="w-6 h-6 animate-spin"
            strokeWidth={1.8}
            color="var(--terracotta)"
          />
        </div>
        <h1
          className="font-serif text-[20px] mb-2"
          style={{
            fontWeight: 800,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          결제 승인 중이에요
        </h1>
        <p
          className="text-[12.5px] leading-relaxed mb-6"
          style={{ color: 'var(--muted)' }}
        >
          토스페이먼츠가 결제를 확인하고 있어요.
          <br />
          <strong style={{ color: 'var(--terracotta)' }}>
            새로고침 / 뒤로가기를 누르지 마세요.
          </strong>
          <br />
          잠시만 기다리시면 자동으로 주문 완료 화면으로 이동해요.
        </p>
        <div className="flex justify-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-terracotta rounded-full animate-pulse" />
          <span
            className="w-1.5 h-1.5 bg-terracotta rounded-full animate-pulse"
            style={{ animationDelay: '0.15s' }}
          />
          <span
            className="w-1.5 h-1.5 bg-terracotta rounded-full animate-pulse"
            style={{ animationDelay: '0.3s' }}
          />
        </div>
      </div>
    </main>
  )
}
