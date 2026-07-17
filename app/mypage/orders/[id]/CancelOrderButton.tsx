'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { useModalA11y } from '@/lib/ui/useModalA11y'

// Phase 3 (2026-05-20): outcome 카테고리 분류 — palatability / digestibility / outcome.
// admin cohort 대시보드에서 환불 사유 분포 → SKU·레시피 개선 신호.
type ReasonCategory =
  | 'not_eating'
  | 'digestion_issue'
  | 'weight_change'
  | 'price'
  | 'lifestyle'
  | 'other'

const REASONS: Array<{ label: string; category: ReasonCategory }> = [
  { label: '아이가 잘 안 먹어요', category: 'not_eating' },
  { label: '변·소화에 문제가 있어요', category: 'digestion_issue' },
  { label: '체중 변화가 신경 쓰여요', category: 'weight_change' },
  { label: '가격이 부담돼요', category: 'price' },
  { label: '배송 / 단순 변심 / 일정', category: 'lifestyle' },
  { label: '기타', category: 'other' },
]

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reasonIdx, setReasonIdx] = useState<number>(0)
  const [extraNote, setExtraNote] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // R91-B F-2 (D7): 가상계좌/계좌이체 결제의 self-cancel 은 환불계좌 정보가
  // 필요해 별도 CS 흐름으로. 사용자가 어디로 가야 할지 명확하게.
  const [vaRefundNeeded, setVaRefundNeeded] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  useModalA11y({
    open,
    onClose: () => !loading && setOpen(false),
    containerRef: dialogRef,
    preventEscape: loading,
  })

  async function submitCancel() {
    setError(null)
    setVaRefundNeeded(false)
    setLoading(true)
    try {
      const selected = REASONS[reasonIdx]!
      const fullReason = extraNote.trim()
        ? `${selected.label} — ${extraNote.trim()}`
        : selected.label
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: fullReason,
          reason_category: selected.category,
        }),
      })
      const data = (await res.json()) as { code?: string; message?: string }
      if (!res.ok) {
        // R91-B F-2 (D7): VA/계좌이체 결제는 환불계좌 정보 입력이 필요한
        // 별도 흐름. 사용자가 막막한 raw 에러 메시지 대신 명확한 CTA로 유도.
        if (data?.code === 'VA_REFUND_NEEDS_CS') {
          setVaRefundNeeded(true)
          return
        }
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
              {vaRefundNeeded ? (
                /* R91-B F-2 (D7): VA 환불 안내 패널 — 1:1 문의로 환불계좌
                   정보 받아 운영자 수동 처리. /contact 에 주제 + 주문번호
                   프리필해서 사용자 입력 부담 ↓. */
                <div
                  className="rounded-xl px-4 py-4"
                  style={{
                    background: 'rgba(217,119,87,0.06)',
                    boxShadow: 'inset 0 0 0 1px rgba(217,119,87,0.25)',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertCircle
                      className="w-4 h-4 shrink-0 mt-0.5 text-terracotta"
                      strokeWidth={2.5}
                    />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-bold text-text leading-relaxed">
                        가상계좌·계좌이체 환불은 환불받으실 계좌 정보가
                        필요해요.
                      </p>
                      <p className="text-[11.5px] text-muted mt-2 leading-relaxed">
                        1:1 문의로 다음 정보를 보내주시면 영업일 기준 1~3일
                        안에 환불해 드릴게요:
                      </p>
                      <ul className="text-[11.5px] text-muted mt-1.5 leading-relaxed list-disc pl-4 space-y-0.5">
                        <li>은행명</li>
                        <li>계좌번호</li>
                        <li>예금주명</li>
                      </ul>
                      <Link
                        href={`/contact?topic=va_refund&order_id=${encodeURIComponent(orderId)}`}
                        className="inline-block mt-3 text-[12px] font-bold underline underline-offset-2 text-terracotta"
                      >
                        1:1 문의로 이동 →
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <>
              <p className="text-[12px] text-text leading-relaxed">
                취소 시 결제 금액은 3-5 영업일 내에 원 결제 수단으로 환불돼요.
              </p>
              <div className="mt-4 space-y-2">
                {REASONS.map((r, i) => (
                  <label
                    key={r.category}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition ${
                      reasonIdx === i
                        ? 'border-terracotta bg-terracotta/5'
                        : 'border-rule hover:border-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel-reason"
                      checked={reasonIdx === i}
                      onChange={() => setReasonIdx(i)}
                      className="accent-terracotta"
                    />
                    <span className="text-[12px] font-bold text-text">
                      {r.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <label className="block text-[11px] text-muted font-bold mb-1.5">
                  더 알려주실 게 있다면 (선택)
                </label>
                <input
                  type="text"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  maxLength={200}
                  placeholder="자유롭게 적어주세요"
                  className="w-full px-3 py-2.5 rounded-lg border border-rule text-[12px] focus:outline-none focus:border-terracotta"
                />
              </div>
              {error && (
                <p className="text-[11px] font-bold text-sale mt-3">
                  {error}
                </p>
              )}
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-rule flex gap-2">
              {vaRefundNeeded ? (
                /* R91-B F-2 (D7): VA 안내 상태 — 단일 "닫기" 버튼만. */
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border border-rule text-[12px] font-bold text-text hover:bg-bg transition"
                >
                  닫기
                </button>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
