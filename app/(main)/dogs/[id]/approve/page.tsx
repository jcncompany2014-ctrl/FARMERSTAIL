'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Check,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { Formula, FoodLine } from '@/lib/personalization/types'
import { diffFormulas } from '@/lib/personalization/diff'

/**
 * /dogs/[id]/approve?cycle=N
 *
 * cron 이 의미 있는 변화를 감지해 pending_approval 상태로 만든 처방을 보호자가
 * 승인 / 거부하는 화면. push / email deep link 가 진입.
 *
 * # 디자인 (placeholder — 클로드 디자인 핸드오프 받으면 비교 화면 교체)
 * 이전 vs 새 비율 stacked bar 비교 + 변경 사항 칩 + approve / decline CTA.
 */

export default function ApprovePage() {
  const params = useParams()
  const search = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const dogId = params.id as string
  const cycleNumber = Number(search.get('cycle') ?? '0') || 0

  const [loading, setLoading] = useState(true)
  const [dogName, setDogName] = useState('')
  const [pending, setPending] = useState<Formula | null>(null)
  const [previous, setPrevious] = useState<Formula | null>(null)
  const [submitting, setSubmitting] = useState<'approve' | 'decline' | null>(
    null,
  )
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push(
          `/login?next=${encodeURIComponent(
            `/dogs/${dogId}/approve?cycle=${cycleNumber}`,
          )}`,
        )
        return
      }

      type Row = {
        formula: { lineRatios: Formula['lineRatios']; toppers: Formula['toppers'] }
        reasoning: Formula['reasoning']
        transition_strategy: Formula['transitionStrategy']
        algorithm_version: string
        daily_kcal: number
        daily_grams: number
        cycle_number: number
        approval_status: string
        user_adjusted: boolean
      }

      const [{ data: dog }, { data: pendingRow }, { data: prevRow }] =
        await Promise.all([
          supabase
            .from('dogs')
            .select('name')
            .eq('id', dogId)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('dog_formulas')
            .select(
              'formula, reasoning, transition_strategy, algorithm_version, ' +
                'daily_kcal, daily_grams, cycle_number, approval_status, user_adjusted',
            )
            .eq('dog_id', dogId)
            .eq('user_id', user.id)
            .eq('cycle_number', cycleNumber)
            .maybeSingle(),
          cycleNumber > 1
            ? supabase
                .from('dog_formulas')
                .select(
                  'formula, reasoning, transition_strategy, algorithm_version, ' +
                    'daily_kcal, daily_grams, cycle_number, approval_status, user_adjusted',
                )
                .eq('dog_id', dogId)
                .eq('user_id', user.id)
                .eq('cycle_number', cycleNumber - 1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ])

      if (cancelled) return
      if (!dog) {
        router.push('/dogs')
        return
      }
      setDogName((dog as { name: string }).name)

      const toFormula = (row: Row): Formula => ({
        lineRatios: row.formula.lineRatios,
        toppers: row.formula.toppers,
        reasoning: row.reasoning,
        transitionStrategy: row.transition_strategy,
        dailyKcal: row.daily_kcal,
        dailyGrams: row.daily_grams,
        cycleNumber: row.cycle_number,
        algorithmVersion: row.algorithm_version,
        userAdjusted: row.user_adjusted,
      })

      if (pendingRow) setPending(toFormula(pendingRow as unknown as Row))
      if (prevRow) setPrevious(toFormula(prevRow as unknown as Row))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [dogId, cycleNumber, router, supabase])

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
      if (decision === 'approve') {
        toast.success('새 비율 적용됐어요')
      } else {
        toast.success('이전 비율 그대로 유지할게요')
      }
      router.push(`/dogs/${dogId}/analysis`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '네트워크 오류')
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <main className="ap-page">
        <div className="ap-state">
          <Loader2
            size={18}
            strokeWidth={2}
            color="var(--terracotta)"
            className="animate-spin"
          />
          처방 정보 불러오는 중...
        </div>
        <style jsx>{`
          .ap-page { padding: 60px 22px; min-height: 100vh; background: var(--bg); }
          .ap-state {
            display: flex; align-items: center; gap: 10px;
            font-size: 13px; color: var(--muted);
            justify-content: center;
          }
        `}</style>
      </main>
    )
  }

  if (!pending) {
    return (
      <main className="ap-page" style={{ padding: 22 }}>
        <Link href={`/dogs/${dogId}`} style={{ color: 'var(--muted)', fontSize: 12 }}>
          ← 돌아가기
        </Link>
        <div
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
            borderRadius: 16,
            padding: 24,
            marginTop: 24,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
            cycle {cycleNumber} 의 동의 대기 처방을 찾을 수 없어요.
            <br />
            이미 응답했거나 5일이 지나 자동 취소됐을 수 있어요.
          </p>
          <Link
            href={`/dogs/${dogId}/analysis`}
            style={{
              marginTop: 16,
              display: 'inline-block',
              padding: '10px 18px',
              background: 'var(--ink)',
              color: 'var(--bg)',
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            현재 처방 보기
          </Link>
        </div>
      </main>
    )
  }

  const diff = previous ? diffFormulas(previous, pending) : null

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '16px 22px 96px',
        background: 'var(--bg)',
        minHeight: '100vh',
      }}
    >
      <Link
        href={`/dogs/${dogId}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
          textDecoration: 'none',
          marginBottom: 18,
        }}
      >
        <ChevronLeft size={14} strokeWidth={2.2} />
        {dogName}이의 페이지
      </Link>

      <header style={{ marginBottom: 24 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 9.5,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--terracotta)',
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          NEEDS APPROVAL · CYCLE {cycleNumber}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-sans), Pretendard, sans-serif',
            fontWeight: 800,
            fontSize: 24,
            lineHeight: 1.18,
            color: 'var(--ink)',
            letterSpacing: '-0.025em',
            margin: '0 0 12px',
          }}
        >
          {dogName}이 다음 박스
          <br />
          비율을 바꿔봐요
        </h1>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--muted)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          체크인 응답을 분석해서 비율을 조정해봤어요. 마음에 들면{' '}
          <strong>적용</strong>, 그대로 두려면 <strong>유지</strong>.
        </p>
      </header>

      {/* 변경 요약 chips */}
      {diff && diff.changes.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 10,
              letterSpacing: '0.22em',
              fontWeight: 700,
              color: 'var(--ink)',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            바뀌는 부분
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {diff.changes.map((c, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  padding: '5px 11px',
                  background: '#fff',
                  boxShadow: 'inset 0 0 0 1px var(--rule)',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text)',
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 비교 stacked bar — 이전 vs 새 */}
      {previous && (
        <section style={{ marginBottom: 24 }}>
          <CompareBars previous={previous} next={pending} />
        </section>
      )}

      {/* Reasoning */}
      <section style={{ marginBottom: 28 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 10,
            letterSpacing: '0.22em',
            fontWeight: 700,
            color: 'var(--ink)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          왜 이렇게 제안했어요
        </div>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {pending.reasoning.slice(0, 5).map((r, i) => (
            <li
              key={i}
              style={{
                background: '#fff',
                boxShadow: 'inset 0 0 0 1px var(--rule)',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--text)',
              }}
            >
              <strong style={{ color: 'var(--ink)' }}>{r.chipLabel}</strong>
              <br />
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                {r.trigger} → {r.action}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {err && (
        <div
          style={{
            background: '#FFF5F2',
            color: '#8A3923',
            padding: '10px 12px',
            borderRadius: 10,
            fontSize: 11.5,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            marginBottom: 16,
          }}
        >
          <AlertCircle size={14} strokeWidth={2} />
          {err}
        </div>
      )}

      {/* CTAs */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
          paddingTop: 16,
          paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}
      >
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => decide('decline')}
          style={{
            appearance: 'none',
            border: 0,
            cursor: 'pointer',
            background: 'var(--bg-2)',
            color: 'var(--ink)',
            padding: '14px 16px',
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: 'inherit',
          }}
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
          style={{
            appearance: 'none',
            border: 0,
            cursor: 'pointer',
            background: 'var(--terracotta)',
            color: '#fff',
            padding: '14px 16px',
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 8px 22px -8px rgba(160, 69, 46, 0.45)',
            fontFamily: 'inherit',
          }}
        >
          {submitting === 'approve' ? (
            <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <Check size={14} strokeWidth={2.6} color="#fff" />
          )}
          새 비율 적용
        </button>
      </div>

      <p
        style={{
          fontSize: 10,
          color: 'var(--muted)',
          textAlign: 'center',
          marginTop: 14,
          lineHeight: 1.6,
        }}
      >
        <Sparkles
          size={11}
          strokeWidth={2}
          color="var(--terracotta)"
          style={{ verticalAlign: '-2px', marginRight: 4 }}
        />
        5일 안에 응답 안 하시면 자동으로 이전 비율 유지됩니다.
      </p>
    </main>
  )
}

function CompareBars({
  previous,
  next,
}: {
  previous: Formula
  next: Formula
}) {
  return (
    <div
      style={{
        background: '#fff',
        boxShadow: 'inset 0 0 0 1px var(--rule)',
        borderRadius: 16,
        padding: 14,
      }}
    >
      <BarRow label="이전" formula={previous} muted />
      <div
        style={{
          height: 1,
          background: 'var(--rule)',
          margin: '12px 0',
        }}
      />
      <BarRow label="새 제안" formula={next} />
    </div>
  )
}

function BarRow({
  label,
  formula,
  muted,
}: {
  label: string
  formula: Formula
  muted?: boolean
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 10,
            letterSpacing: '0.22em',
            color: muted ? 'var(--muted)' : 'var(--ink)',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono), monospace',
            fontSize: 10,
            color: 'var(--muted)',
          }}
        >
          {formula.dailyKcal} kcal
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          height: 12,
          borderRadius: 99,
          overflow: 'hidden',
          background: 'var(--rule)',
          marginBottom: 6,
          opacity: muted ? 0.65 : 1,
        }}
      >
        {ALL_LINES.filter((l) => formula.lineRatios[l] > 0).map((line) => (
          <span
            key={line}
            style={{
              width: `${Math.round(formula.lineRatios[line] * 100)}%`,
              background: FOOD_LINE_META[line as FoodLine].color,
            }}
            title={`${FOOD_LINE_META[line as FoodLine].name} ${Math.round(formula.lineRatios[line] * 100)}%`}
          />
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          fontSize: 10.5,
          color: muted ? 'var(--muted)' : 'var(--text)',
        }}
      >
        {ALL_LINES.filter((l) => formula.lineRatios[l] > 0)
          .sort((a, b) => formula.lineRatios[b] - formula.lineRatios[a])
          .map((line) => (
            <span key={line} style={{ display: 'inline-flex', gap: 4 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 50,
                  background: FOOD_LINE_META[line as FoodLine].color,
                  display: 'inline-block',
                  alignSelf: 'center',
                }}
              />
              {FOOD_LINE_META[line as FoodLine].name}{' '}
              <strong>{Math.round(formula.lineRatios[line] * 100)}%</strong>
            </span>
          ))}
      </div>
    </>
  )
}
