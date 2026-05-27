'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Ticket, X, ChevronRight, Search, Check } from 'lucide-react'
import CouponCard, {
  type CouponCardData,
} from '@/components/coupons/CouponCard'
import { useModalA11y } from '@/lib/ui/useModalA11y'

/**
 * 체크아웃 쿠폰 선택 시트.
 *
 * 트리거 row 가 항상 보이고 (사용 가능 N장 + 현재 적용된 쿠폰 미리보기), 클릭
 * 시 bottom sheet 가 올라와서 카드 list. 사용자가 카드 1탭으로 적용.
 *
 * 동작:
 *  1. mount + subtotal 변경 시 /api/coupons/applicable?subtotal=N 호출
 *  2. response 의 available 카드 list — 가장 큰 할인은 BEST 뱃지
 *  3. 카드 클릭 → onApply(coupon) — 부모가 lib/coupons validateCoupon 으로
 *     최종 검증 + state 갱신
 *  4. 코드 수동 입력 fallback — 외부 코드 (이메일 / SNS) 받았을 때
 *
 * 부모 props:
 *  - subtotal: 현재 적용 가능한 주문 금액 (포인트 차감 전)
 *  - applied: 현재 적용된 쿠폰 (있으면 row 에 미리보기)
 *  - onApply(code): 적용 트리거. 부모가 server-side validate.
 *  - onRemove(): 적용 해제 트리거.
 */

type ApplicableResponse = {
  available: (CouponCardData & { _expectedDiscount: number })[]
  unavailable: {
    coupon: CouponCardData
    reason: 'min_order' | 'no_discount' | 'limit_reached'
    hint: string | null
  }[]
  bestDealId: string | null
}

export type CheckoutCouponSheetProps = {
  subtotal: number
  applied: { name: string; code: string; discount: number } | null
  onApply: (code: string) => Promise<{ ok: boolean; message?: string }>
  onRemove: () => void
}

export default function CheckoutCouponSheet({
  subtotal,
  applied,
  onApply,
  onRemove,
}: CheckoutCouponSheetProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ApplicableResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')
  const [applying, setApplying] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const lastFetchedSubtotal = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // 모달 a11y — focus trap / Esc / body scroll lock.
  useModalA11y({
    open,
    onClose: () => !applying && setOpen(false),
    containerRef: sheetRef,
    preventEscape: applying,
  })

  // mount + subtotal 변경 시 fetch. 단, sheet 가 안 열려있으면 fetch 보류
  // (불필요한 호출 줄임). 트리거 row 의 N장 카운트만 필요할 때는 첫 1회만.
  useEffect(() => {
    if (lastFetchedSubtotal.current === subtotal) return
    let cancelled = false
    setLoading(true)
    setErrMsg(null)
    ;(async () => {
      try {
        const res = await fetch(
          `/api/coupons/applicable?subtotal=${subtotal}`,
          { cache: 'no-store' },
        )
        if (!res.ok) throw new Error('쿠폰 목록을 불러오지 못했어요')
        const json = (await res.json()) as ApplicableResponse
        if (!cancelled) {
          setData(json)
          lastFetchedSubtotal.current = subtotal
        }
      } catch (err) {
        if (!cancelled) {
          setErrMsg(err instanceof Error ? err.message : '쿠폰을 불러오지 못했어요')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [subtotal])

  const availableCount = data?.available.length ?? 0

  async function handleApply(targetCode: string) {
    setApplying(true)
    setErrMsg(null)
    try {
      const result = await onApply(targetCode.trim().toUpperCase())
      if (result.ok) {
        setOpen(false)
        setCode('')
      } else {
        setErrMsg(result.message ?? '적용하지 못했어요')
      }
    } finally {
      setApplying(false)
    }
  }

  // 정렬 — best 가 위, 그 다음은 할인 내림차순. 이미 정렬돼 오지만 안전.
  const sortedAvailable = useMemo(() => {
    if (!data) return []
    return [...data.available].sort((a, b) => {
      if (a.id === data.bestDealId) return -1
      if (b.id === data.bestDealId) return 1
      return b._expectedDiscount - a._expectedDiscount
    })
  }, [data])

  return (
    <>
      {/* 트리거 row — 항상 보이는 진입점.
          R87-B3 (D12): button-in-button 제거 — 부모 button 안에 role="button"
          + tabIndex=-1 인 X 가 있었음. HTML invalid + 키보드 접근 불가.
          이제 div role="group" 안에 trigger button + remove button 분리. */}
      <div
        role="group"
        aria-label="쿠폰 적용"
        className="w-full flex items-center justify-between rounded-xl bg-white border border-rule pl-4 pr-1 py-1.5 hover:border-text transition"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={applied ? '다른 쿠폰 선택' : '쿠폰 선택 열기'}
          className="flex-1 flex items-center gap-2.5 min-w-0 text-left py-2 active:scale-[0.99] transition"
        >
          <div
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: applied
                ? 'color-mix(in srgb, var(--terracotta) 12%, white)'
                : 'var(--bg-2)',
            }}
          >
            <Ticket
              className="w-4 h-4"
              style={{
                color: applied ? 'var(--terracotta)' : 'var(--ink)',
              }}
              strokeWidth={2}
            />
          </div>
          <div className="flex-1 min-w-0">
            {applied ? (
              <>
                <p className="text-[12px] font-bold text-terracotta truncate">
                  {applied.name}
                </p>
                <p className="text-[10.5px] text-muted truncate">
                  −{applied.discount.toLocaleString()}원 적용 중
                </p>
              </>
            ) : (
              <>
                <p className="text-[12.5px] font-bold text-text">
                  쿠폰 적용
                </p>
                <p className="text-[10.5px] text-muted truncate">
                  {loading
                    ? '불러오는 중…'
                    : availableCount > 0
                      ? `사용 가능한 쿠폰 ${availableCount}장`
                      : '사용 가능한 쿠폰이 없어요'}
                </p>
              </>
            )}
          </div>
        </button>
        {applied ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="쿠폰 제거"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-bg-2 active:scale-95 transition"
            style={{ color: 'var(--muted)' }}
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="쿠폰 선택 열기"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9"
          >
            <ChevronRight className="w-4 h-4 text-muted" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center"
          onClick={() => !applying && setOpen(false)}
        >
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="쿠폰 선택"
            tabIndex={-1}
            className="w-full md:max-w-md bg-bg rounded-t-3xl md:rounded-3xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div>
                <span className="kicker">Coupons</span>
                <h2
                  className="font-serif mt-0.5 leading-tight"
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  쿠폰 선택
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !applying && setOpen(false)}
                aria-label="닫기"
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-rule transition"
              >
                <X className="w-4 h-4 text-text" strokeWidth={2} />
              </button>
            </div>

            {/* 코드 직접 입력 */}
            <div className="px-5 pb-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 32))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && code.trim()) {
                      void handleApply(code)
                    }
                  }}
                  placeholder="쿠폰 코드 직접 입력"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-white border border-rule text-[12px] font-mono font-bold text-text placeholder:text-muted/60 placeholder:font-sans focus:outline-none focus:border-terracotta"
                />
                <button
                  type="button"
                  onClick={() => handleApply(code)}
                  disabled={applying || !code.trim()}
                  className="shrink-0 px-4 py-2.5 rounded-lg text-[12px] font-bold inline-flex items-center gap-1 transition disabled:opacity-50"
                  style={{ background: 'var(--ink)', color: 'var(--bg)' }}
                >
                  <Search className="w-3.5 h-3.5" strokeWidth={2.5} />
                  적용
                </button>
              </div>
              {errMsg && (
                <p className="text-[11px] font-bold text-sale mt-2">
                  {errMsg}
                </p>
              )}
            </div>

            {/* 카드 list — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom))] space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted mt-1">
                사용 가능한 쿠폰
              </div>
              {sortedAvailable.length === 0 ? (
                <p className="text-[12px] text-muted text-center py-8">
                  지금 주문에 적용 가능한 쿠폰이 없어요
                </p>
              ) : (
                sortedAvailable.map((c) => (
                  <CouponCard
                    key={c.id}
                    coupon={c}
                    state="available"
                    recommended={c.id === data?.bestDealId}
                    onApply={() => handleApply(c.code)}
                  />
                ))
              )}

              {data && data.unavailable.length > 0 && (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted mt-4">
                    조건 미충족
                  </div>
                  {data.unavailable.map((u) => (
                    <CouponCard
                      key={u.coupon.id}
                      coupon={u.coupon}
                      state="unavailable"
                      unavailableHint={u.hint ?? undefined}
                    />
                  ))}
                </>
              )}

              {applied && (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted mt-4">
                    현재 적용 중
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onRemove()
                      setOpen(false)
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-rule text-[12px] font-bold text-muted hover:border-sale hover:text-sale transition"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                    적용 해제
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {applied && (
        <span className="sr-only" aria-live="polite">
          쿠폰 적용됨: <Check className="inline w-3 h-3" /> {applied.name}
        </span>
      )}
    </>
  )
}
