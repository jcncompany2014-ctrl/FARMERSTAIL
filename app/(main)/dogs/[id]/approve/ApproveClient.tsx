'use client'

// audit #101 — ApproveClient: decide button (approve / decline) 만 client.
// page.tsx (server) 가 auth/dog/pending/previous formula 를 prefetch.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { petName } from '@/lib/korean'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import type { ApprovePricing } from './page'
import { haptic } from '@/lib/haptic'
import { trackBoxDecision } from '@/lib/analytics'
import './approve.css'

type Props = {
  dogId: string
  dogName: string
  cycleNumber: number
  pending: Formula | null
  previous: Formula | null
  /** 2주 청구액 — 서버가 정본 계산으로 재산정. 불확실하면 null(표시 안 함). */
  pricing: ApprovePricing | null
}

export default function ApproveClient({
  dogId,
  dogName,
  cycleNumber,
  pending,
  previous,
  pricing,
}: Props) {
  const router = useRouter()
  const toast = useToast()

  const [submitting, setSubmitting] = useState<'approve' | 'decline' | null>(
    null,
  )
  const [err, setErr] = useState('')

  async function decide(decision: 'approve' | 'decline') {
    setSubmitting(decision)
    setErr('')
    try {
      const res = await fetch('/api/personalization/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dogId, cycleNumber, decision }),
      })
      const json = (await res.json()) as
        | { ok: true; decision: string }
        | { ok?: false; code?: string; message?: string }
      if (!res.ok || !('ok' in json) || json.ok !== true) {
        const msg =
          ('message' in json && json.message) || '저장하지 못했어요'
        setErr(msg)
        return
      }
      haptic('confirm')
      trackBoxDecision({ dogId, cycleNumber, decision })
      if (decision === 'approve') {
        toast.success('새 비율이 적용됐어요')
      } else {
        toast.success('이전 비율 그대로 유지할게요')
      }
      router.push(`/dogs/${dogId}/analysis`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '네트워크가 불안정해요. 다시 시도해 주세요')
    } finally {
      setSubmitting(null)
    }
  }

  if (!pending) {
    return (
      <div className="ap-page">
        <div className="ap-empty">
          <p>
            {cycleNumber}번째 박스의 동의 대기 건을 찾을 수 없어요.
            <br />
            이미 응답했거나 5일이 지나 자동 취소됐을 수 있어요.
          </p>
          <Link href={`/dogs/${dogId}/analysis`} className="ap-empty-cta">
            현재 박스 보기
          </Link>
        </div>
      </div>
    )
  }

  const lineChanges = previous ? computeLineChanges(previous, pending) : []

  return (
    <div className="ap-page">
      <header className="ap-hero">
        <div className="ap-kicker">
          <span className="ap-pill">{cycleNumber}번째 박스</span>
          NEEDS APPROVAL
        </div>
        <h1 className="ap-h1">
          {petName(dogName)} 다음 박스
          <br />
          비율을 바꿔봐요
        </h1>
        <p className="ap-sub">
          체크인 응답을 분석해서 비율을 조정해봤어요. 마음에 들면{' '}
          <strong>적용</strong>, 그대로 두려면 <strong>유지</strong>.
        </p>
      </header>

      {pricing && <PriceChange pricing={pricing} />}

      {lineChanges.length > 0 && (
        <section className="ap-changes">
          <div className="ap-sect-lbl">바뀌는 부분</div>
          <div className="ap-chip-row">
            {lineChanges.map((c, i) => (
              <span
                key={i}
                className={
                  'ap-chip ' +
                  (c.delta > 0 ? 'ap-up' : c.delta < 0 ? 'ap-down' : 'ap-info')
                }
              >
                {c.delta > 0 && <TrendingUp size={11} strokeWidth={2.4} />}
                {c.delta < 0 && <TrendingDown size={11} strokeWidth={2.4} />}
                {c.label}
                <span className="ap-chip-arrow">
                  {c.delta > 0 ? '+' : ''}
                  {c.delta}%
                </span>
              </span>
            ))}
          </div>
        </section>
      )}

      {previous && (
        <section>
          <CompareBars previous={previous} next={pending} />
        </section>
      )}

      <section className="ap-reasoning">
        <div className="ap-sect-lbl">왜 이렇게 제안했어요</div>
        <ul className="ap-reason-list">
          {pending.reasoning.slice(0, 5).map((r, i) => (
            <li key={i} className="ap-reason">
              <span className="ap-reason-num">{i + 1}</span>
              <div className="ap-reason-body">
                <div className="ap-reason-chip">{r.chipLabel}</div>
                <div className="ap-reason-detail">
                  <strong>{r.trigger}</strong>
                  <ArrowRight
                    size={10}
                    strokeWidth={2}
                    style={{ verticalAlign: '-1px', margin: '0 4px' }}
                  />
                  {r.action}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {err && (
        <div className="ap-err" role="alert">
          <AlertCircle size={14} strokeWidth={2} />
          {err}
        </div>
      )}

      <div className="ap-cta">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => decide('decline')}
          className="ap-btn ap-decline"
        >
          {submitting === 'decline' ? (
            <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <X size={14} strokeWidth={2.4} />
          )}
          그대로 유지
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => decide('approve')}
          className="ap-btn ap-approve"
        >
          {submitting === 'approve' ? (
            <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <Check size={14} strokeWidth={2.6} color="#fff" />
          )}
          새 비율 적용
        </button>
      </div>

      <p className="ap-foot">
        <Sparkles size={11} strokeWidth={2} color="var(--terracotta)" />
        5일 안에 응답 안 하시면 자동으로 이전 비율 유지됩니다.
      </p>
    </div>
  )
}

/**
 * 2주 청구액 변화 — **이 화면에서 가장 중요한 정보.**
 *
 * 처방이 바뀌면 박스 분량이 바뀌고 결제 금액도 바뀐다. 이걸 안 보여주고 동의를
 * 받으면 보호자는 **얼마를 내게 되는지 모른 채 승인**하게 된다(2026-07-17 이전
 * 상태). 그래서 히어로 바로 아래 — 승인 버튼에 닿기 전 반드시 지나는 자리에 둔다.
 *
 * 금액이 그대로면 "그대로예요" 로 안심시킨다(침묵하면 오히려 의심스럽다).
 */
function PriceChange({ pricing }: { pricing: ApprovePricing }) {
  const { currentTotal, newTotal } = pricing
  const delta = newTotal - currentTotal
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'
  const won = (n: number) => n.toLocaleString('ko-KR')

  return (
    <section className={'ap-price ap-price-' + dir} aria-live="polite">
      <div className="ap-sect-lbl">2주마다 내시는 금액</div>

      {dir === 'same' ? (
        // 금액이 그대로면 결제 얘기를 더 꺼내지 않는다 — 바뀌는 게 없는데
        // "다음 배송분부터 결제" 를 덧붙이면 없는 불안을 만든다.
        <p className="ap-price-same">
          <b>{won(currentTotal)}원</b> — 비율만 바뀌고 금액은 그대로예요.
        </p>
      ) : (
        <>
          <div className="ap-price-row">
            <span className="ap-price-old">{won(currentTotal)}원</span>
            <ArrowRight size={14} strokeWidth={2.2} className="ap-price-arrow" />
            <span className="ap-price-new">{won(newTotal)}원</span>
            <span className="ap-price-delta">
              {delta > 0 ? (
                <TrendingUp size={11} strokeWidth={2.4} />
              ) : (
                <TrendingDown size={11} strokeWidth={2.4} />
              )}
              {delta > 0 ? '+' : '−'}
              {won(Math.abs(delta))}원
            </span>
          </div>
          <p className="ap-price-why">
            {delta > 0
              ? '필요한 양이 늘어서 박스가 커졌어요. 유지를 고르시면 금액도 그대로예요.'
              : '필요한 양이 줄어서 박스가 작아졌어요.'}
          </p>
          {/* ⚠️ 문구는 실제 동작만 약속한다. 청구는 배송일에 일어나므로
              "이미 확정된 회차는 옛 금액" 을 보장할 수 없다 → 그렇게 쓰지 않는다.
              지킬 수 없는 약속은 금액에선 특히 위험하다. */}
          <p className="ap-price-note">
            적용하면 <b>다음 결제부터</b> 이 금액이에요. 일시정지·해지는 다음
            결제 전까지 바꿀 수 있어요.
          </p>
        </>
      )}
    </section>
  )
}

/**
 * 라인 + 토퍼별 변화량 (%포인트).
 */
function computeLineChanges(
  previous: Formula,
  next: Formula,
): Array<{ label: string; delta: number }> {
  const out: Array<{ label: string; delta: number }> = []
  for (const line of ALL_LINES) {
    const prev = Math.round(previous.lineRatios[line] * 100)
    const cur = Math.round(next.lineRatios[line] * 100)
    if (prev === cur) continue
    out.push({ label: FOOD_LINE_META[line as FoodLine].nameKo, delta: cur - prev })
  }
  const toppers: Array<{ key: 'vegetable' | 'protein'; label: string }> = [
    { key: 'vegetable', label: '야채 토퍼' },
    { key: 'protein', label: '육류 토퍼' },
  ]
  for (const { key, label } of toppers) {
    const prev = Math.round(previous.toppers[key] * 100)
    const cur = Math.round(next.toppers[key] * 100)
    if (prev === cur) continue
    out.push({ label, delta: cur - prev })
  }
  out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return out
}

function CompareBars({
  previous,
  next,
}: {
  previous: Formula
  next: Formula
}) {
  return (
    <div className="ap-compare">
      <BarRow label="이전" formula={previous} prev />
      <div className="ap-divider" />
      <BarRow label="새 제안" formula={next} />
    </div>
  )
}

function BarRow({
  label,
  formula,
  prev,
}: {
  label: string
  formula: Formula
  prev?: boolean
}) {
  const totalKcal = formula.dailyKcal
  return (
    <div className={'ap-bar-row ' + (prev ? 'ap-prev' : 'ap-next')}>
      <div className="ap-bar-head">
        <span className="ap-bar-label">{label}</span>
        <span className="ap-bar-meta">
          <b>{totalKcal}</b> kcal
        </span>
      </div>
      <div className="ap-bar">
        {ALL_LINES.filter((l) => formula.lineRatios[l] > 0).map((line) => (
          <i
            key={line}
            style={{
              width: `${Math.round(formula.lineRatios[line] * 100)}%`,
              background: FOOD_LINE_META[line as FoodLine].color,
            }}
            title={`${FOOD_LINE_META[line as FoodLine].nameKo} ${Math.round(formula.lineRatios[line] * 100)}%`}
          />
        ))}
      </div>
      <div className="ap-legend">
        {ALL_LINES.filter((l) => formula.lineRatios[l] > 0)
          .sort((a, b) => formula.lineRatios[b] - formula.lineRatios[a])
          .map((line) => (
            <span key={line} className="ap-legend-item">
              <span
                className="ap-legend-dot"
                style={{ background: FOOD_LINE_META[line as FoodLine].color }}
              />
              <span className="ap-legend-name">
                {FOOD_LINE_META[line as FoodLine].nameKo}
              </span>
              <span className="ap-legend-pct">
                {Math.round(formula.lineRatios[line] * 100)}%
              </span>
            </span>
          ))}
      </div>
    </div>
  )
}
