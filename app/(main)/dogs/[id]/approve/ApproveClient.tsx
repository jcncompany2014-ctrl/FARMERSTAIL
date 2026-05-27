'use client'

// audit #101 — ApproveClient: decide button (approve / decline) 만 client.
// page.tsx (server) 가 auth/dog/pending/previous formula 를 prefetch.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
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
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { haptic } from '@/lib/haptic'
import { trackBoxDecision } from '@/lib/analytics'
import './approve.css'

type Props = {
  dogId: string
  dogName: string
  cycleNumber: number
  pending: Formula | null
  previous: Formula | null
}

export default function ApproveClient({
  dogId,
  dogName,
  cycleNumber,
  pending,
  previous,
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
          ('message' in json && json.message) || '저장에 실패했어요'
        setErr(msg)
        return
      }
      haptic('confirm')
      trackBoxDecision({ dogId, cycleNumber, decision })
      if (decision === 'approve') {
        toast.success('새 비율 적용됐어요')
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
      <main className="ap-page">
        <Link href={`/dogs/${dogId}`} className="ap-back">
          <ChevronLeft size={14} strokeWidth={2.2} />
          {dogName ? `${dogName}이의 페이지` : '돌아가기'}
        </Link>
        <div className="ap-empty">
          <p>
            cycle {cycleNumber} 의 동의 대기 박스를 찾을 수 없어요.
            <br />
            이미 응답했거나 5일이 지나 자동 취소됐을 수 있어요.
          </p>
          <Link href={`/dogs/${dogId}/analysis`} className="ap-empty-cta">
            현재 박스 보기
          </Link>
        </div>
      </main>
    )
  }

  const lineChanges = previous ? computeLineChanges(previous, pending) : []

  return (
    <main className="ap-page">
      <Link href={`/dogs/${dogId}`} className="ap-back">
        <ChevronLeft size={14} strokeWidth={2.2} />
        {dogName}이의 페이지
      </Link>

      <header className="ap-hero">
        <div className="ap-kicker">
          <span className="ap-pill">CYCLE {cycleNumber}</span>
          NEEDS APPROVAL
        </div>
        <h1 className="ap-h1">
          {dogName}이 다음 박스
          <br />
          비율을 바꿔봐요
        </h1>
        <p className="ap-sub">
          체크인 응답을 분석해서 비율을 조정해봤어요. 마음에 들면{' '}
          <strong>적용</strong>, 그대로 두려면 <strong>유지</strong>.
        </p>
      </header>

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
        <div className="ap-err">
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
    </main>
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
    out.push({ label: FOOD_LINE_META[line as FoodLine].name, delta: cur - prev })
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
            title={`${FOOD_LINE_META[line as FoodLine].name} ${Math.round(formula.lineRatios[line] * 100)}%`}
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
                {FOOD_LINE_META[line as FoodLine].name}
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
