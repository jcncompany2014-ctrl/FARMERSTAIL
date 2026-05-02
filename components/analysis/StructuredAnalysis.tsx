'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Info,
  Sparkles,
  Stethoscope,
  CalendarClock,
  CheckCircle2,
  Loader2,
  BookOpen,
} from 'lucide-react'
import type { AiAnalysisJson } from '@/lib/nutrition/ai-prompt'
import { GUIDELINE_CITATIONS } from '@/lib/nutrition/guidelines'

/**
 * StructuredAnalysis — /dogs/[id]/analysis 의 AI v2 분석 카드.
 *
 * 진입 시 /api/analysis/structured 를 호출. 이미 캐시되어 있으면 즉시 반환.
 * 응답:
 *   { structured: AiAnalysisJson, cached }
 *
 * 표시 영역:
 *   1. summary 헤드 + 정중체 본문
 *   2. highlights 카드 — warning(빨간) → info → positive 순서
 *   3. (있으면) 7일 전환 플랜 stepper
 *   4. nextActions 체크리스트
 *   5. vetConsult 권고 배너 (recommended=true 일 때)
 *   6. citations 칩 + 출처 footer
 */
export default function StructuredAnalysis({
  analysisId,
  vetConsultFromCalc,
  riskFlagsFromCalc,
  nextReviewDate,
}: {
  analysisId: string
  /** 계산 단계에서 이미 vet consult 권장 여부 (AI 호출 전 표시) */
  vetConsultFromCalc?: boolean
  riskFlagsFromCalc?: string[]
  nextReviewDate?: string | null
}) {
  const [data, setData] = useState<AiAnalysisJson | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'unavailable' | 'error'>('idle')
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (fetchedRef.current === analysisId) return
    fetchedRef.current = analysisId
    let cancelled = false
    // React 19 `react-hooks/set-state-in-effect` 룰은 effect body 의 동기
    // setState 를 cascading render 위험으로 본다. async IIFE 안으로 옮기면
    // setState 가 microtask 로 미뤄져 한 번의 commit 으로 묶이고 룰도 만족.
    ;(async () => {
      setState('loading')
      try {
        const res = await fetch('/api/analysis/structured', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ analysisId }),
        })
        const json = await res.json()
        if (cancelled) return
        if (res.status === 503 || json?.code === 'API_KEY_MISSING') {
          setState('unavailable')
          return
        }
        if (!res.ok || !json?.structured) {
          setState('error')
          return
        }
        setData(json.structured as AiAnalysisJson)
        setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [analysisId])

  // AI 가 vetConsult 안 줬어도 계산기가 권장 했으면 배너 강제
  const showVetBanner =
    (data?.vetConsult.recommended ?? false) || vetConsultFromCalc === true

  if (state === 'loading') {
    return (
      <section className="px-5 mt-6">
        <div className="rounded-2xl bg-white border border-rule p-6 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-terracotta" strokeWidth={2} />
          <div>
            <div className="text-[13px] font-bold text-text">AI 분석 작성 중</div>
            <div className="text-[11px] text-muted mt-0.5">NRC · AAFCO · FEDIAF 가이드라인 적용 중...</div>
          </div>
        </div>
      </section>
    )
  }

  if (state === 'unavailable') {
    return (
      <section className="px-5 mt-6">
        <div className="rounded-2xl bg-bg-2 border border-rule p-5 text-[12px] text-muted leading-relaxed">
          AI 분석은 현재 환경에서 비활성화되어 있어요. 위 영양 계산 결과는 그대로
          사용 가능합니다.
        </div>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section className="px-5 mt-6">
        <div className="rounded-2xl bg-bg-2 border border-rule p-5 text-[12px] text-muted leading-relaxed">
          AI 분석 생성 중 오류가 발생했어요. 잠시 후 페이지를 새로고침해 주세요.
        </div>
      </section>
    )
  }

  if (!data) return null

  return (
    <section className="px-5 mt-6 space-y-5">
      {/* 수의사 상담 배너 */}
      {showVetBanner && (
        <div
          className="rounded-2xl px-5 py-4 flex items-start gap-3"
          style={{
            background: 'color-mix(in srgb, #A0452E 10%, white)',
            boxShadow: 'inset 0 0 0 1px var(--terracotta)',
          }}
        >
          <Stethoscope
            className="w-5 h-5 shrink-0 mt-0.5"
            strokeWidth={2}
            color="var(--terracotta)"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-black text-terracotta">
              주치 수의사 상담을 권합니다
            </div>
            <p className="text-[11.5px] text-text mt-1 leading-relaxed">
              {data.vetConsult.reason ??
                '시스템이 위험 신호를 감지했어요. 식이 변경 전 진료를 받아주세요.'}
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-2xl bg-white border border-rule p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-terracotta" strokeWidth={2.25} />
          <span className="kicker">AI Analysis · 종합 의견</span>
        </div>
        <p
          className="text-[13.5px] leading-[1.85]"
          style={{ color: 'var(--ink)' }}
        >
          {data.summary}
        </p>
      </div>

      {/* Highlights */}
      {data.highlights.length > 0 && (
        <div className="space-y-2">
          {[...data.highlights]
            .sort((a, b) => {
              const order = { warning: 0, info: 1, positive: 2 }
              return order[a.type] - order[b.type]
            })
            .map((h, i) => (
              <HighlightCard key={i} highlight={h} />
            ))}
        </div>
      )}

      {/* 7-day transition plan */}
      {data.transition && data.transition.days.length > 0 && (
        <div className="rounded-2xl bg-white border border-rule p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <CalendarClock className="w-3.5 h-3.5 text-moss" strokeWidth={2.25} />
            <span className="kicker">Transition · 7일 식단 전환</span>
          </div>
          <p className="text-[11.5px] text-muted mb-4 leading-relaxed">
            장 적응을 위해 7일에 걸쳐 비율을 조정해 주세요.
          </p>
          <ol className="space-y-2.5">
            {data.transition.days.map((d) => (
              <li key={d.day} className="flex items-start gap-3">
                <span
                  className="shrink-0 w-7 h-7 rounded-full bg-bg flex items-center justify-center text-[10px] font-bold text-terracotta font-mono"
                >
                  D{d.day}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[11px] text-muted font-mono">
                    <span>현재 {d.oldPct}%</span>
                    <span>→</span>
                    <span className="text-terracotta font-bold">새 {d.newPct}%</span>
                  </div>
                  {d.note && (
                    <div className="text-[11.5px] text-text mt-0.5 leading-relaxed">{d.note}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {data.transition.finalNote && (
            <p
              className="text-[11.5px] text-text mt-4 leading-relaxed pt-3"
              style={{ borderTop: '1px solid var(--rule)' }}
            >
              {data.transition.finalNote}
            </p>
          )}
        </div>
      )}

      {/* Next actions */}
      {data.nextActions.length > 0 && (
        <div className="rounded-2xl bg-white border border-rule p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-moss" strokeWidth={2.25} />
            <span className="kicker">Next · 다음 행동</span>
          </div>
          <ul className="space-y-2">
            {data.nextActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-text leading-relaxed">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-terracotta mt-2" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
          {nextReviewDate && (
            <div
              className="mt-4 pt-3 text-[11px] text-muted"
              style={{ borderTop: '1px solid var(--rule)' }}
            >
              다음 재분석 권장:{' '}
              <span className="font-mono font-bold text-text">{nextReviewDate}</span>
            </div>
          )}
        </div>
      )}

      {/* 위험 플래그 (서버 계산) */}
      {(riskFlagsFromCalc ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {riskFlagsFromCalc!.map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono"
              style={{
                background: 'color-mix(in srgb, var(--terracotta) 8%, transparent)',
                color: 'var(--terracotta)',
              }}
            >
              <AlertTriangle className="w-2.5 h-2.5" strokeWidth={2.5} />
              {flag}
            </span>
          ))}
        </div>
      )}

      {/* Citations */}
      {data.citations.length > 0 && (
        <div className="rounded-2xl bg-bg-2 border border-rule p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <BookOpen className="w-3 h-3 text-muted" strokeWidth={2.25} />
            <span className="kicker">Citations · 출처</span>
          </div>
          <ul className="space-y-1.5">
            {data.citations
              .map((key) => GUIDELINE_CITATIONS.find((c) => c.key === key))
              .filter((c): c is (typeof GUIDELINE_CITATIONS)[number] => !!c)
              .map((c) => (
                <li key={c.key} className="text-[10.5px] text-text leading-relaxed">
                  <span className="font-mono font-bold text-terracotta">{c.label}</span>
                  <span className="text-muted"> · {c.title} · {c.org}</span>
                </li>
              ))}
          </ul>
          <p className="text-[10px] text-muted mt-3 leading-relaxed">
            본 분석은 위 가이드라인에 기반한 권장이며, 의료 진단을 대체하지 않아요.
            만성질환 관리 / 처방식 변경은 반드시 주치 수의사와 상담해 주세요.
          </p>
        </div>
      )}
    </section>
  )
}

function HighlightCard({
  highlight,
}: {
  highlight: AiAnalysisJson['highlights'][number]
}) {
  const palette =
    highlight.type === 'warning'
      ? {
          icon: AlertTriangle,
          color: 'var(--terracotta)',
          bg: 'color-mix(in srgb, var(--terracotta) 8%, white)',
        }
      : highlight.type === 'positive'
        ? {
            icon: CheckCircle2,
            color: 'var(--moss)',
            bg: 'color-mix(in srgb, var(--moss) 8%, white)',
          }
        : {
            icon: Info,
            color: 'var(--ink)',
            bg: 'var(--bg-2)',
          }
  const Icon = palette.icon
  return (
    <div
      className="rounded-2xl px-4 py-3.5 flex items-start gap-3 border border-rule"
      style={{ background: palette.bg }}
    >
      <Icon
        className="w-4 h-4 shrink-0 mt-0.5"
        strokeWidth={2.25}
        color={palette.color}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-black" style={{ color: palette.color }}>
          {highlight.title}
        </div>
        <p className="text-[11.5px] text-text mt-1 leading-relaxed">{highlight.body}</p>
      </div>
    </div>
  )
}
