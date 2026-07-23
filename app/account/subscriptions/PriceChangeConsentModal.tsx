'use client'

/**
 * 다음 박스 금액변경 동의 모달 — /account/subscriptions 배경 위에 뜬다.
 *
 * cron(personalization-progression)이 **금액이 바뀌는 제안**(몸무게·알레르기·
 * 건강)을 pending_approval + formula.priceChange 표식으로 남기면, 페이지가
 * 그걸 감지해 이 모달을 띄운다. 알림 링크가 아니라 **pending 상태**로 뜨므로
 * 구독페이지에 들어올 때마다 뜬다(사장님 2026-07-23).
 *
 * - 동의 → /api/personalization/approve {decision:'approve'} → 새 레시피 적용 +
 *   total_amount 서버 재계산(다음 정기결제부터). 즉시 청구 없음.
 * - 거부 → {decision:'decline'} → 이전 cycle 유지(레시피·금액 그대로).
 *   forced(알레르기·건강)일 땐 거부 전에 안전 경고를 한 번 더 확인시킨다.
 * - 3일 무반응 → 타임아웃 cron 이 자동 declined(=이전 유지).
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ShieldCheck, RefreshCw, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { petName } from '@/lib/korean'

export type PriceChangeProposal = {
  dogId: string
  dogName: string
  cycleNumber: number
  recipeLabel: string
  reason: string
  forced: boolean
  priceFrom: number
  priceTo: number
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

export default function PriceChangeConsentModal({
  proposal,
}: {
  proposal: PriceChangeProposal
}) {
  const router = useRouter()
  const toast = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const [dismissed, setDismissed] = useState(false)
  const [step, setStep] = useState<'main' | 'declineWarn'>('main')
  const [loading, setLoading] = useState<null | 'approve' | 'decline'>(null)

  // Esc / 배경 클릭 = 이번 방문만 닫기(미결정). pending 이 남아 다음 방문에 다시 뜬다.
  useModalA11y({ open: !dismissed, onClose: () => setDismissed(true), containerRef: panelRef })

  if (dismissed) return null

  const name = petName(proposal.dogName)

  async function submit(decision: 'approve' | 'decline') {
    setLoading(decision)
    try {
      const res = await fetch('/api/personalization/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dogId: proposal.dogId,
          cycleNumber: proposal.cycleNumber,
          decision,
        }),
      })
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(b.message ?? '처리하지 못했어요')
      }
      toast.success(
        decision === 'approve'
          ? '새 레시피로 바꿨어요. 다음 정기결제부터 반영돼요.'
          : '이전 그대로 유지할게요.',
      )
      setDismissed(true)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '처리하지 못했어요')
      setLoading(null)
    }
  }

  const busy = loading !== null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="다음 박스 변경 동의"
      style={{ background: 'rgba(22,20,15,0.5)' }}
      onClick={() => !busy && setDismissed(true)}
    >
      <div
        ref={panelRef}
        className="w-full md:max-w-md rounded-t-[18px] md:rounded-[18px] p-6"
        style={{ background: '#FFFFFF' }}
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'main' ? (
          <>
            <div className="flex items-start justify-between">
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: proposal.forced ? 'var(--fd-coral)' : 'var(--fd-cream)',
                  color: proposal.forced ? '#FFFFFF' : 'var(--fd-pine)',
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.5} />
                {proposal.forced ? '동의가 필요해요' : '확인이 필요해요'}
              </span>
              <button
                type="button"
                onClick={() => !busy && setDismissed(true)}
                aria-label="나중에"
                className="p-1 -m-1"
              >
                <X className="w-5 h-5" strokeWidth={2} style={{ color: 'var(--fd-muted)' }} />
              </button>
            </div>

            <h2
              className="mt-3 text-[18px]"
              style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}
            >
              {name} 레시피를 바꿔도 될까요?
            </h2>

            <p className="mt-3 text-[11px] font-bold" style={{ color: 'var(--fd-muted)' }}>
              왜 바꾸나요?
            </p>
            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--fd-pine)' }}>
              {proposal.reason}
            </p>

            <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '0.5px solid var(--fd-line)' }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px]" style={{ color: 'var(--fd-muted)' }}>
                  바뀔 레시피
                </span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--fd-pine)' }}>
                  {proposal.recipeLabel}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12px]" style={{ color: 'var(--fd-muted)' }}>
                  2주 결제
                </span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--fd-pine)' }}>
                  {won(proposal.priceFrom)} → {won(proposal.priceTo)}
                </span>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--fd-muted)' }}>
              동의하면 <b style={{ color: 'var(--fd-pine)' }}>다음 정기결제부터</b> 새 금액이에요(지금
              청구 없음). 3일 안에 안 고르시면 이전 그대로 유지돼요.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => submit('approve')}
                className="h-11 rounded-[10px] text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--fd-pine)', color: '#FFFFFF' }}
              >
                {loading === 'approve' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                ) : (
                  '동의하고 적용'
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => (proposal.forced ? setStep('declineWarn') : submit('decline'))}
                className="h-11 rounded-[10px] text-[13px] font-bold inline-flex items-center justify-center transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: '#FFFFFF', color: 'var(--fd-pine)', border: '0.5px solid var(--fd-line)' }}
              >
                {loading === 'decline' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                ) : (
                  '이전 그대로 유지'
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              className="text-[18px]"
              style={{ fontWeight: 800, color: 'var(--fd-pine)', letterSpacing: '-0.015em' }}
            >
              {name} 레시피를 바꿔도 될까요?
            </h2>
            <div
              className="mt-4 rounded-[10px] p-3.5"
              style={{ background: 'rgba(200,107,69,0.08)', border: '0.5px solid var(--fd-coral)' }}
            >
              <div
                className="flex items-center gap-1.5 text-[13px] font-bold"
                style={{ color: 'var(--fd-coral-ink)' }}
              >
                <AlertTriangle className="w-4 h-4" strokeWidth={2.5} />
                정말 이전 그대로 두시겠어요?
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--fd-coral-ink)' }}>
                새로 등록한 <b>알레르기·건강 상태가 반영되지 않아요.</b> 지난 박스와 같은
                레시피·금액({won(proposal.priceFrom)})이 계속 나가요.
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => submit('decline')}
                className="h-11 rounded-[10px] text-[13px] font-bold inline-flex items-center justify-center transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: '#FFFFFF', color: 'var(--fd-coral-ink)', border: '0.5px solid var(--fd-coral)' }}
              >
                {loading === 'decline' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                ) : (
                  '네, 이전 그대로 둘게요'
                )}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setStep('main')}
                className="h-11 rounded-[10px] text-[13px] font-bold inline-flex items-center justify-center transition active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--fd-pine)', color: '#FFFFFF' }}
              >
                아니요, 바꿀래요
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
