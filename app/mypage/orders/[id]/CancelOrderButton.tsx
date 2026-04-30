'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2 } from 'lucide-react'
import { useModalA11y } from '@/lib/ui/useModalA11y'

const REASONS = [
  '단순 변심',
  '배송이 너무 늦어요',
  '다른 상품으로 변경하고 싶어요',
  '결제 정보를 잘못 입력했어요',
  '기타',
]

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(REASONS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)
  useModalA11y({
    open,
    onClose: () => !loading && setOpen(false),
    containerRef: dialogRef,
    preventEscape: loading,
  })

  async function submitCancel() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.message ?? '취소 실패')
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '취소 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full py-3 rounded-xl border border-rule bg-white text-[12px] font-bold text-muted hover:text-sale hover:border-sale transition active:scale-[0.98]"
      >
        주문 취소
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            tabIndex={-1}
            className="bg-white rounded-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
              <h2 id="cancel-order-title" className="text-[15px] font-black text-text">
                주문 취소
              </h2>
              <button
                onClick={() => !loading && setOpen(false)}
                aria-label="닫기"
                className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-muted hover:bg-bg"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-[12px] text-text leading-relaxed">
                취소 시 사용한 포인트와 쿠폰은 환원되고, 결제 금액은 3-5
                영업일 내에 환불돼요.
              </p>
              <div className="mt-4 space-y-2">
                {REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition ${
                      reason === r
                        ? 'border-terracotta bg-terracotta/5'
                        : 'border-rule hover:border-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel-reason"
                      value={r}
                      checked={reason === r}
                      onChange={(e) => setReason(e.target.value)}
                      className="accent-terracotta"
                    />
                    <span className="text-[12px] font-bold text-text">
                      {r}
                    </span>
                  </label>
                ))}
              </div>
              {error && (
                <p className="text-[11px] font-bold text-sale mt-3">
                  {error}
                </p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-rule flex gap-2">
              <button
                onClick={() => !loading && setOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-rule text-[12px] font-bold text-text hover:bg-bg transition"
              >
                유지
              </button>
              <button
                onClick={submitCancel}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg bg-sale text-white text-[12px] font-bold active:scale-[0.98] disabled:opacity-50 transition inline-flex items-center justify-center gap-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                    처리 중...
                  </>
                ) : (
                  '취소 확정'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
