'use client'

/**
 * 관리자 부분 취소 패널.
 *
 * 운영 시나리오:
 *   • 3개 품목 중 1개가 품절 → 해당 품목 금액만 환불
 *   • 고객이 배송 전 일부 품목만 취소 요청
 *   • 배송 후 하자 있는 품목 1개만 부분 환불
 *
 * UX:
 *   • 환불 가능 잔액(remainingAmount)을 상단에 큼직하게 표시
 *   • 금액 입력 시 "전액" 버튼으로 잔액 전체 채우기
 *   • 가상계좌일 때만 계좌 정보 3필드가 드러남
 *   • 실행 전 한 번 더 confirm — 되돌릴 수 없음
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

type Props = {
  orderId: string
  paymentMethod: string | null
  totalAmount: number
  refundedAmount: number
  paymentStatus: string
}

const BANK_OPTIONS: { code: string; name: string }[] = [
  { code: '88', name: '신한' },
  { code: '20', name: '우리' },
  { code: '11', name: '농협' },
  { code: '81', name: '하나' },
  { code: '04', name: 'KB국민' },
  { code: '03', name: 'IBK기업' },
  { code: '23', name: 'SC제일' },
  { code: '39', name: '경남' },
  { code: '34', name: '광주' },
  { code: '32', name: '부산' },
  { code: '31', name: '대구' },
  { code: '37', name: '전북' },
  { code: '35', name: '제주' },
  { code: '02', name: '산업' },
  { code: '71', name: '우체국' },
  { code: '50', name: '저축은행' },
  { code: '89', name: '케이뱅크' },
  { code: '90', name: '카카오뱅크' },
  { code: '92', name: '토스뱅크' },
]

export default function PartialCancelPanel({
  orderId,
  paymentMethod,
  totalAmount,
  refundedAmount,
  paymentStatus,
}: Props) {
  const router = useRouter()
  const remaining = totalAmount - refundedAmount

  const [amount, setAmount] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [bank, setBank] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [holderName, setHolderName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isVirtualAccount =
    paymentMethod === '가상계좌' ||
    paymentMethod === 'VIRTUAL_ACCOUNT' ||
    paymentMethod === '계좌이체' ||
    paymentMethod === 'TRANSFER'

  const canRefund =
    (paymentStatus === 'paid' || paymentStatus === 'partially_refunded') &&
    remaining > 0

  async function onSubmit() {
    setError(null)
    if (amount <= 0 || amount > remaining) {
      setError(`환불 금액은 1원 이상, ${remaining.toLocaleString()}원 이하`)
      return
    }
    if (isVirtualAccount && (!bank || !accountNumber || !holderName)) {
      setError('가상계좌 환불은 은행/계좌번호/예금주가 모두 필요합니다')
      return
    }

    const confirmMsg =
      amount === remaining
        ? `전액 ${amount.toLocaleString()}원을 환불합니다. 계속할까요?`
        : `${amount.toLocaleString()}원을 부분 환불합니다. 계속할까요?`
    if (!confirm(confirmMsg)) return

    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/admin/orders/${orderId}/partial-cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cancelAmount: amount,
            cancelReason: reason || undefined,
            ...(isVirtualAccount
              ? {
                  refundReceiveAccount: {
                    bank,
                    accountNumber: accountNumber.replace(/[^0-9]/g, ''),
                    holderName,
                  },
                }
              : {}),
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data?.message ?? '환불 실패')
        return
      }
      router.refresh()
      setAmount(0)
      setReason('')
      setBank('')
      setAccountNumber('')
      setHolderName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '환불 요청 중 오류')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="p-6 rounded-2xl bg-white border border-rule">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-ink">부분 환불</h2>
        <span className="text-[10px] text-muted font-mono">
          refunded {refundedAmount.toLocaleString()}/{totalAmount.toLocaleString()}
        </span>
      </div>

      <div className="px-4 py-3 rounded-lg bg-bg mb-4">
        <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">
          환불 가능 잔액
        </div>
        <div className="text-lg font-black text-terracotta mt-0.5">
          {remaining.toLocaleString()}원
        </div>
      </div>

      {!canRefund ? (
        <p className="text-xs text-muted leading-relaxed">
          {paymentStatus === 'refunded'
            ? '이미 전액 환불된 주문입니다.'
            : '결제 완료 상태가 아니라 부분 환불이 불가합니다.'}
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-text mb-1">
              환불 금액
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                max={remaining}
                step={1}
                value={amount || ''}
                onChange={(e) => {
                  const v = Math.max(
                    0,
                    Math.min(remaining, Number(e.target.value) || 0)
                  )
                  setAmount(v)
                }}
                placeholder="0"
                className="flex-1 px-3 py-2 rounded-lg border border-rule bg-white text-sm focus:outline-none focus:border-terracotta"
              />
              <button
                type="button"
                onClick={() => setAmount(remaining)}
                className="px-3 py-2 rounded-lg border border-rule text-xs font-semibold text-text hover:border-terracotta hover:text-terracotta"
              >
                전액
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-text mb-1">
              취소 사유
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 품절 1개, 하자 상품 교환 불가"
              className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm focus:outline-none focus:border-terracotta"
            />
          </div>

          {isVirtualAccount && (
            <div className="pt-3 border-t border-rule space-y-2">
              <div className="flex items-start gap-1.5 text-[11px] text-muted leading-relaxed">
                <AlertTriangle
                  className="w-3 h-3 text-terracotta mt-0.5 shrink-0"
                  strokeWidth={2}
                />
                <span>
                  가상계좌/계좌이체는 환불받을 계좌를 입력해야 합니다.
                </span>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text mb-1">
                  은행
                </label>
                <select
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm focus:outline-none focus:border-terracotta"
                >
                  <option value="">선택</option>
                  {BANK_OPTIONS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text mb-1">
                  계좌번호
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="숫자만"
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono focus:outline-none focus:border-terracotta"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text mb-1">
                  예금주
                </label>
                <input
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm focus:outline-none focus:border-terracotta"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-sale/5 border border-sale/30 text-[11px] text-sale font-semibold">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || amount <= 0}
            className="w-full py-2.5 rounded-lg bg-terracotta text-white text-sm font-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#8A3A27] active:scale-[0.98] transition"
          >
            {submitting ? '처리 중…' : `${amount.toLocaleString()}원 환불 실행`}
          </button>
          <p className="text-[10px] text-muted leading-relaxed">
            실행 후 되돌릴 수 없으며, 토스페이먼츠 결제 상태가 즉시 업데이트됩니다.
            포인트/쿠폰은 부분 환불 시 자동 조정되지 않으므로 필요 시 별도 조치해
            주세요.
          </p>
        </div>
      )}
    </section>
  )
}
