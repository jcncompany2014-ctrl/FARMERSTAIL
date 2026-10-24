'use client'

/**
 * 관리자 환불 패널(전액·일부). 화면 이름은 '환불하기(전액·일부)'(2026-10-24 어드민 금액 말 정리 — 예전 '부분 환불'은 전액도 여기서 하는데 이름이 일부만 말했다).
 *
 * 운영 시나리오:
 *   • 3개 품목 중 1개가 품절 → 해당 품목 금액만 환불
 *   • 고객이 배송 전 일부 품목만 취소 요청
 *   • 배송 후 하자 있는 품목 1개만 일부 환불
 *
 * UX:
 *   • 환불할 수 있는 금액(remaining)을 상단에 큼직하게 표시
 *   • 금액 입력 시 "전액" 버튼으로 잔액 전체 채우기
 *   • 가상계좌일 때만 계좌 정보 3필드가 드러남
 *   • 실행 전 한 번 더 confirm — 되돌릴 수 없음
 */
import { useState } from 'react'
import { userFacingError } from '@/lib/error-message'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'

type Props = {
  orderId: string
  paymentMethod: string | null
  totalAmount: number
  refundedAmount: number
  paymentStatus: string
  /**
   * 서포터즈 가격(100원·반값) 박스인가 — 회차를 실제로 쓴 주문만(2026-10-15 F-a, 규칙261).
   * shipped = 이미 나간 박스(전액 환불해도 회차는 돌아오지 않는다) · unshipped = 발송 전(전액 환불하면 회차 1회가 돌아온다).
   */
  supporterBox?: 'shipped' | 'unshipped' | null
  /**
   * 이벤트 할인(50%·최대 5만원 등)으로 결제된 박스인가(2026-10-24 사장님 결정 C, 규칙322).
   * shipped = 이미 나간 박스(전액 환불해도 할인은 돌아오지 않는다) · unshipped = 발송 전(전액 환불하면 다음 결제에 할인이 다시 붙는다).
   * 판정은 DB 트리거(tg_orders_reclaim_promotion — new.shipped_at is null)와 같은 기준.
   */
  eventBox?: 'shipped' | 'unshipped' | null
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
  supporterBox = null,
  eventBox = null,
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
      setError(`환불 금액은 1원부터 ${remaining.toLocaleString()}원까지 넣을 수 있어요.`)
      return
    }
    if (isVirtualAccount && (!bank || !accountNumber || !holderName)) {
      setError('계좌로 돌려주려면 은행·계좌번호·예금주를 모두 넣어 주세요.')
      return
    }

    // 어디로 돌아가는지·되돌릴 수 없다는 걸 확인창에서도 같은 말로(2026-10-24 어드민 금액 말 정리).
    const destination = isVirtualAccount ? '입력한 계좌로' : '카드로'
    const confirmMsg =
      amount === remaining
        ? `${amount.toLocaleString()}원 전액을 ${destination} 돌려줘요. 되돌릴 수 없어요. 계속할까요?`
        : `${amount.toLocaleString()}원을 ${destination} 돌려줘요(일부 환불). 되돌릴 수 없어요. 계속할까요?`
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
            // 이 화면이 본 누적 환불액 — 서버 값과 다르면 토스를 부르기 전에 멈춘다(응답 유실 후 재탭 이중 환불 방지).
            expectedRefundedAmount: refundedAmount,
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
        setError(data?.message ?? '환불하지 못했어요 — 새로고침된 금액을 확인한 뒤 다시 해 주세요.')
        // 실패해도 서버 쪽 상태가 바뀌었을 수 있다 — 누적 환불액을 새로 받아 다음 시도가 옛 값으로 가지 않게.
        router.refresh()
        return
      }
      router.refresh()
      setAmount(0)
      setReason('')
      setBank('')
      setAccountNumber('')
      setHolderName('')
    } catch (e) {
      // 응답이 끊긴 경우 — 환불은 이미 됐을 수 있다. 새로고침으로 실제 누적 환불액을 보여 준다.
      setError(userFacingError(e, '응답을 받지 못했어요 — 환불됐을 수 있으니 새로고침된 금액을 확인해 주세요'))
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">환불하기(전액·일부)</h2>
        {/* 영어 'refunded N/M' 대신 쉬운 말로, 돌려준 적이 있을 때만(2026-10-24 어드민 금액 말 정리). */}
        {refundedAmount > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            환불한 금액 {refundedAmount.toLocaleString()}원
          </span>
        )}
      </div>

      <div className="mb-4 rounded-lg bg-secondary px-4 py-3">
        <div className="text-xs font-semibold text-muted-foreground">
          환불할 수 있는 금액
        </div>
        <div className="mt-0.5 text-lg font-black text-primary tabular-nums">
          {/* 야간점검(2026-07-25): 미결제 취소 주문에도 total 이 '환불 가능'으로
              떠 혼란 — 환불 가능 상태(paid/partially_refunded)일 때만 잔액 표시. */}
          {canRefund ? `${remaining.toLocaleString()}원` : '—'}
        </div>
      </div>

      {!canRefund ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {paymentStatus === 'refunded' || refundedAmount > 0
            ? '이미 전부 돌려준 주문이에요. 더 환불할 돈이 없어요.'
            : '결제가 안 된 주문이라 돌려줄 돈이 없어요.'}
        </p>
      ) : (
        <div className="space-y-3">
          {/* 서포터즈 박스 환불 — 회차·도장에 무슨 일이 생기는지(2026-10-15 F-a, 규칙261). */}
          {supporterBox === 'shipped' && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-amber-900">
              배송까지 끝난 서포터즈 박스예요. 전액 환불해도 서포터즈 회차는 돌아오지 않아요(받은 박스라 한 번 쓴 것으로 봐요).
              전액 환불하면 이 주문의 도장판 도장 1개는 빠져요.
            </p>
          )}
          {supporterBox === 'unshipped' && (
            <p className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-sky-900">
              아직 나가지 않은 서포터즈 박스예요. 전액 환불하면 서포터즈 회차 1회가 돌아와요(도장이 취소된 고객이면 도장을 다시
              찍을 때 돌려줘요).
            </p>
          )}
          {eventBox === 'shipped' && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-semibold leading-relaxed text-amber-900">
              이미 나간 박스예요. 전액 환불해도 이벤트 할인은 다시 생기지 않아요 — 다음 결제부터 정가예요.
            </p>
          )}
          {eventBox === 'unshipped' && (
            <p className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-[13px] font-semibold leading-relaxed text-sky-900">
              아직 나가지 않은 박스예요. 전액 환불하면 이벤트 할인이 다시 생겨서 다음 결제에 한 번 더 붙어요.
            </p>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold">
              환불 금액
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                // 환불 금액 위에서 휠을 굴리면 값이 바뀌는 브라우저 기본 동작
                // 차단 — 실제 돈이 나가는 칸이다(최종감사 #8).
                onWheel={(e) => e.currentTarget.blur()}
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
                className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setAmount(remaining)}
                className="rounded-lg border border-input px-3 py-2 text-xs font-semibold hover:border-primary hover:text-primary"
              >
                전액
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold">
              환불 이유
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 품절 1개, 하자 상품 교환 불가"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {isVirtualAccount && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <AlertTriangle
                  className="mt-0.5 size-3 shrink-0 text-primary"
                  strokeWidth={2}
                />
                <span>
                  가상계좌/계좌이체는 환불받을 계좌를 입력해야 합니다.
                </span>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  은행
                </label>
                <select
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
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
                <label className="mb-1 block text-xs font-semibold">
                  계좌번호
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="숫자만"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">
                  예금주
                </label>
                <input
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || amount <= 0}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-black text-primary-foreground transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '돌려주는 중…' : `${amount.toLocaleString()}원 환불하기`}
          </button>
          {/* 없어진 포인트·쿠폰 안내는 지웠다 — 지금은 해당하는 고객이 없다(2026-10-24 어드민 금액 말 정리). */}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isVirtualAccount
              ? '누르면 바로 입력한 계좌로 돌려줘요. 되돌릴 수 없어요.'
              : '누르면 바로 카드로 돌려줘요. 되돌릴 수 없어요.'}
          </p>
        </div>
      )}
    </section>
  )
}
