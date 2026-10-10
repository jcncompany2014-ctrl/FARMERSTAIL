'use client'

/**
 * 다음 박스 금액변경 동의 모달.
 *
 * # ★ 두 화면이 함께 쓴다 (2026-07-30) — 한쪽만 보고 고치지 말 것
 *  · `/account/subscriptions`  — 웹
 *  · `/mypage/subscriptions`   — 앱 (앱 전용 요약 화면 신설 시 이관)
 * 이건 **금액 변경 동의 게이트**라 한쪽에서 빠지면 그 플랫폼 사용자는 금액이
 * 바뀌는데 동의를 못 받은 상태가 된다. 그래서 복제하지 않고 이 컴포넌트를
 * 공유한다. 시각은 웹 FD 토큰(`--fd-*`)을 쓰고, 앱 화면이 자기 쪽에서 앱 톤으로
 * 스코프 스왑해 감싼다 — 여기 색을 앱 기준으로 바꾸면 **웹이 깨진다**.
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
 *
 * # 앱 모양(variant="app", 2026-10-09 앱 새 디자인 'A 포스터', 캔버스 S16·S17)
 * 같은 상태·같은 API 호출·같은 판정 — **그리는 것만** 갈린다(R14 variant 패턴). 웹은 기본값('web') 그대로라
 * 한 픽셀도 바뀌지 않는다. 앱은 아래에서 올라오는 창(손잡이 · '나중에' 글자 버튼 · 큰 제목 · 금액은 숫자 글꼴).
 */

import { useId, useRef, useState } from 'react'
import { userFacingError } from '@/lib/error-message'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ShieldCheck, RefreshCw, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { petName } from '@/lib/korean'
import { V3 } from '@/lib/design/tokens'
import { RECIPE_COLOR } from '@/components/analysis/display'
import { pouchLineFromName, type PouchLine } from '@/lib/design/pouch'

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

/** 앱 창 — 고르지 않은 칸 테두리·손잡이 색(시안). */
const APP_IDLE = '#D5D3D4'
/** 앱 창 — 경고 바탕(정기배송 화면 결제 실패 경고와 같은 값). */
const APP_RED_SOFT = '#FBF1EF'

/** "닭고기·흑돼지 레시피"(recipeName) → 파우치 색 네모 순서. 모르는 이름은 뺀다. */
function linesOfLabel(label: string): PouchLine[] {
  return label
    .replace(/\s*레시피$/, '')
    .split('·')
    .map((x) => pouchLineFromName(x.trim()))
    .filter((l): l is PouchLine => l !== null)
}

export default function PriceChangeConsentModal({
  proposal,
  variant = 'web',
}: {
  proposal: PriceChangeProposal
  /** 'app' = 앱 새 디자인 모양(시안 S16·S17). 기본 'web' — 웹 모양은 손대지 않는다. */
  variant?: 'web' | 'app'
}) {
  const router = useRouter()
  const toast = useToast()
  const titleId = useId()
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
      const b = (await res.json().catch(() => ({}))) as {
        message?: string
        amountMismatch?: boolean
      }
      // ★이미 처리된 제안(409 — 타임아웃 크론이 먼저 마감 등)이면 안내하고 닫는다. 예전엔 토스트만
      //   띄우고 모달이 그대로 남아 같은 버튼을 계속 누르게 됐다(2026-09-26 점검 7차).
      if (res.status === 409) {
        toast.info(b.message ?? '이미 처리된 제안이에요.')
        setDismissed(true)
        router.refresh()
        return
      }
      if (!res.ok) {
        throw new Error(b.message ?? '처리하지 못했어요')
      }
      // ★서버가 200 이어도 금액 검산이 어긋나면 amountMismatch 를 준다
      //  (2026-08-08 diff 재검증 — 전엔 이 응답을 안 읽어서, 금액이 그대로인데
      //  "다음 정기결제부터 반영돼요"라고 말하는 화면이 됐다).
      //  처방은 확정됐으니 성공이 맞지만, 금액 안내는 서버 문구로 바꾼다.
      if (decision === 'approve' && b.amountMismatch) {
        toast.info(
          b.message ??
            '이번 변경은 보류했어요. 확인 후 다시 안내드릴게요.',
        )
      } else {
        toast.success(
          decision === 'approve'
            ? '새 레시피로 바꿨어요. 다음 정기결제부터 반영돼요.'
            : '이전 그대로 유지할게요.',
        )
      }
      setDismissed(true)
      router.refresh()
    } catch (e) {
      toast.error(userFacingError(e, '처리하지 못했어요'))
      setLoading(null)
    }
  }

  const busy = loading !== null

  if (variant === 'app') {
    const spin = <RefreshCw className="w-5 h-5 animate-spin" strokeWidth={2.5} aria-label="처리하고 있어요" />
    const lines = linesOfLabel(proposal.recipeLabel)
    const btn = (solid: boolean, danger = false): React.CSSProperties => ({
      height: solid ? 58 : 56,
      borderRadius: 4,
      border: solid ? 0 : `1.5px solid ${danger ? V3.sale : V3.ink}`,
      background: solid ? V3.ink : '#FFFFFF',
      color: solid ? '#FFFFFF' : danger ? V3.sale : V3.ink,
      fontFamily: 'inherit',
      fontSize: 17,
      fontWeight: 800,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: busy ? 'default' : 'pointer',
      opacity: busy ? 0.6 : 1,
    })
    return (
      <div
        className="fixed inset-0 flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // 층 순서: 앱 윗줄·탭바 40 < 이 창 50 < 토스트 60.
        style={{ zIndex: 50, background: 'rgba(20,20,20,0.42)' }}
        onClick={() => !busy && setDismissed(true)}
      >
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(520px, 100%)',
            boxSizing: 'border-box',
            maxHeight: 'calc(100dvh - 24px)',
            overflowY: 'auto',
            padding: '10px 20px calc(26px + env(safe-area-inset-bottom))',
            background: '#FFFFFF',
            color: V3.ink,
            borderRadius: '12px 12px 0 0',
            boxShadow: '0 -8px 30px rgba(20,20,20,0.12)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span aria-hidden style={{ alignSelf: 'center', flexShrink: 0, width: 40, height: 4, borderRadius: 2, background: APP_IDLE }} />
          {step === 'main' ? (
            <>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    height: 28,
                    boxSizing: 'border-box',
                    padding: '0 9px',
                    borderRadius: 4,
                    background: proposal.forced ? APP_RED_SOFT : V3.soft,
                    border: `1px solid ${proposal.forced ? V3.sale : APP_IDLE}`,
                    fontSize: 14,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.4} aria-hidden />
                  {proposal.forced ? '동의가 필요해요' : '확인이 필요해요'}
                </span>
                {/* Esc·바깥 누르기와 같다 — 이번 방문만 닫는다(미결정). 다음에 들어오면 다시 뜬다. */}
                <button
                  type="button"
                  onClick={() => !busy && setDismissed(true)}
                  style={{ height: 48, padding: '0 4px', border: 0, background: 'transparent', color: V3.ink, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
                >
                  나중에
                </button>
              </div>
              {/* 제목 글꼴은 앱 틀의 h2 규칙이 준다 — fontFamily·fontWeight 를 여기서 주지 않는다. */}
              <h2 id={titleId} style={{ margin: '8px 0 0', fontSize: 26, lineHeight: 1.2, wordBreak: 'keep-all' }}>
                {name} 레시피를
                <br />
                바꿔도 될까요?
              </h2>
              <span style={{ marginTop: 14, fontSize: 14, fontWeight: 700, color: V3.inkMute }}>왜 바꾸나요?</span>
              <p style={{ margin: '4px 0 0', fontSize: 17, lineHeight: 1.55, wordBreak: 'keep-all' }}>{proposal.reason}</p>
              <dl style={{ margin: '16px 0 0', borderTop: `2px solid ${V3.ink}`, display: 'flex', flexDirection: 'column' }}>
                <div style={{ minHeight: 56, borderBottom: `1px solid ${V3.rule}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <dt style={{ fontSize: 15, color: V3.inkMute, flexShrink: 0 }}>바뀔 레시피</dt>
                  <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 17, fontWeight: 800, textAlign: 'right' }}>
                    {lines.length > 0 && (
                      <span aria-hidden style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        {lines.map((l) => (
                          <span key={l} style={{ width: 10, height: 10, background: RECIPE_COLOR[l] }} />
                        ))}
                      </span>
                    )}
                    {proposal.recipeLabel}
                  </dd>
                </div>
                <div style={{ padding: '12px 0', borderBottom: `1px solid ${V3.rule}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <dt style={{ fontSize: 15, color: V3.inkMute }}>2주 상품 금액 (할인 전)</dt>
                  <dd style={{ margin: 0, display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, color: V3.inkMute, textDecoration: 'line-through', whiteSpace: 'nowrap' }}>
                      {won(proposal.priceFrom)}
                    </span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={V3.ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ alignSelf: 'center' }}>
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                    <span className="sr-only">에서</span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <span className="ft-num" style={{ fontSize: 30 }}>
                        {proposal.priceTo.toLocaleString('ko-KR')}
                      </span>
                      <span style={{ fontSize: 17, fontWeight: 800 }}>원</span>
                    </span>
                  </dd>
                </div>
              </dl>
              <p style={{ margin: '12px 0 0', fontSize: 15, lineHeight: 1.55, color: V3.inkSoft, wordBreak: 'keep-all' }}>
                동의하면 <strong style={{ fontWeight: 800, color: V3.ink }}>다음 정기결제부터</strong> 새 금액이에요. 지금 결제되지
                않아요. 3일 안에 안 고르시면 이전 그대로 유지돼요.
              </p>
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => submit('approve')} style={btn(true)}>
                  {loading === 'approve' ? spin : '동의하고 적용'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (proposal.forced ? setStep('declineWarn') : submit('decline'))}
                  style={btn(false)}
                >
                  {loading === 'decline' ? spin : '이전 그대로 유지'}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 id={titleId} style={{ margin: '20px 0 0', fontSize: 26, lineHeight: 1.2, wordBreak: 'keep-all' }}>
                {name} 레시피를
                <br />
                바꿔도 될까요?
              </h2>
              <div
                role="alert"
                style={{
                  marginTop: 16,
                  padding: 16,
                  border: `1.5px solid ${V3.sale}`,
                  borderRadius: 4,
                  background: APP_RED_SOFT,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <strong style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 800 }}>
                  <AlertTriangle className="w-5 h-5 shrink-0" strokeWidth={2.4} style={{ color: V3.sale }} aria-hidden />
                  정말 이전 그대로 두시겠어요?
                </strong>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: V3.inkSoft, wordBreak: 'keep-all' }}>
                  새로 등록한 <strong style={{ fontWeight: 800, color: V3.ink }}>알레르기·건강 상태가 반영되지 않아요.</strong> 지난
                  박스와 같은 레시피·금액({won(proposal.priceFrom)})이 계속 나가요.
                </p>
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" disabled={busy} onClick={() => submit('decline')} style={btn(false, true)}>
                  {loading === 'decline' ? spin : '네, 이전 그대로 둘게요'}
                </button>
                <button type="button" disabled={busy} onClick={() => setStep('main')} style={btn(true)}>
                  아니요, 바꿀래요
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

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
        className="w-full md:max-w-md rounded-t-[var(--fd-r-sheet)] md:rounded-[var(--fd-r-sheet)] p-6"
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
                  2주 상품 금액(할인 전)
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
                className="h-11 rounded-[var(--fd-r-row)] text-[13px] font-bold inline-flex items-center justify-center gap-1.5 transition active:scale-[0.98] disabled:opacity-60"
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
                className="h-11 rounded-[var(--fd-r-row)] text-[13px] font-bold inline-flex items-center justify-center transition active:scale-[0.98] disabled:opacity-60"
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
              className="mt-4 rounded-[var(--fd-r-row)] p-3.5"
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
                className="h-11 rounded-[var(--fd-r-row)] text-[13px] font-bold inline-flex items-center justify-center transition active:scale-[0.98] disabled:opacity-60"
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
                className="h-11 rounded-[var(--fd-r-row)] text-[13px] font-bold inline-flex items-center justify-center transition active:scale-[0.98] disabled:opacity-60"
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
