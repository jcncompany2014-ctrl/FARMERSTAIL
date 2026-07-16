'use client'

/**
 * AI 코멘트 카드 — "○○를 위한 한마디" (2026-07-16 연결).
 *
 * # 숫자는 규칙, 말은 AI
 * 급여량 kcal·g·계수는 순수 함수가 낸다(lib/nutrition). 이 카드는 **규칙으로 못 푸는
 * 것** — 그 아이의 현재 사료·만성질환·복용 약·변 상태·품종 이력을 읽고 사람 말로 붙인
 * 설명만 담는다. AI 가 실패하거나 비용 한도에 걸려도 **급여량은 멀쩡하다.**
 *
 * # 데이터
 * `/api/analysis/structured` 가 analyses.structured_analysis 에 캐시한 JSON.
 *   - summary     : 1~2 문단 종합 의견 (이 카드의 본문)
 *   - highlights  : warning/info/positive 신호 (아래 위험카드가 이미 그림 — 중복 안 함)
 *   - nextActions : 권장 행동
 * 이 카드는 그중 **summary + nextActions** 만 보여준다. highlights 는 기존 위험 신호
 * 섹션과 겹치므로 여기서 또 그리지 않는다(같은 말 두 번 = 신뢰 하락).
 *
 * # 로딩·실패
 * AI 호출은 몇 초 걸리고 실패할 수 있다. **급여량 카드를 막지 않게** 이 카드만
 * 독립적으로 로딩/스켈레톤/조용한 실패한다. 실패 시 카드 자체를 안 그린다 —
 * 빈 카드나 에러 문구보다 없는 게 낫다(핵심은 위의 숫자다).
 */
import { useEffect, useState } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { withHonorific } from '@/lib/korean'

type AiAnalysisJson = {
  summary?: string
  nextActions?: string[]
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: AiAnalysisJson }
  | { kind: 'hidden' }

export default function AiCommentCard({
  analysisId,
  dogName,
  /** 서버에서 이미 채워져 온 캐시가 있으면 그걸 쓰고 fetch 안 함. */
  cached,
}: {
  analysisId: string
  dogName: string
  cached?: AiAnalysisJson | null
}) {
  const [state, setState] = useState<State>(
    cached?.summary ? { kind: 'ready', data: cached } : { kind: 'loading' },
  )

  useEffect(() => {
    if (cached?.summary) return // 이미 있음 — 호출 안 함
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/analysis/structured', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisId }),
        })
        if (!alive) return
        if (!res.ok) {
          setState({ kind: 'hidden' })
          return
        }
        const json = (await res.json()) as { structured?: AiAnalysisJson }
        if (!alive) return
        if (json.structured?.summary) {
          setState({ kind: 'ready', data: json.structured })
        } else {
          setState({ kind: 'hidden' })
        }
      } catch {
        if (alive) setState({ kind: 'hidden' })
      }
    })()
    return () => {
      alive = false
    }
  }, [analysisId, cached])

  if (state.kind === 'hidden') return null

  return (
    <section className="px-5 mt-2.5">
      <div
        className="rounded-[12px] px-5 py-4"
        style={{
          background: 'var(--paper-hi, #FFFFFF)',
          border: '1.5px solid var(--terracotta)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-terracotta" strokeWidth={2.2} />
          <span className="text-[11px] font-bold tracking-[0.06em] text-terracotta">
            {withHonorific(dogName)}를 위한 한마디
          </span>
        </div>

        {state.kind === 'loading' ? (
          <div className="space-y-2 py-1" aria-hidden>
            <div className="h-3 rounded bg-black/5 w-full animate-pulse" />
            <div className="h-3 rounded bg-black/5 w-[85%] animate-pulse" />
            <div className="h-3 rounded bg-black/5 w-[60%] animate-pulse" />
          </div>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-text whitespace-pre-line">
              {state.data.summary}
            </p>

            {state.data.nextActions && state.data.nextActions.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {state.data.nextActions.slice(0, 3).map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ArrowRight
                      className="w-3 h-3 mt-0.5 shrink-0 text-terracotta"
                      strokeWidth={2.5}
                    />
                    <span className="text-[12px] leading-snug text-text/85">{a}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              급여량 숫자는 규칙으로 계산해요. 이 설명만 그 아이 사정을 읽고 씁니다.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
