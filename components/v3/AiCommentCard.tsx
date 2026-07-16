'use client'

/**
 * AI 코멘트 카드 — "보호자님께" 건네는 한마디 (2026-07-16 연결, 톤 개편).
 *
 * # 숫자는 규칙, 말은 AI — 그리고 이 말은 **보호자에게** 건넨다
 * 급여량 kcal·g·계수는 순수 함수가 낸다(lib/nutrition). 이 카드는 그 숫자를 반복하지
 * 않고, 그 아이 사정을 읽어 **보호자에게 건네는 한마디**를 담는다 — 안심으로 열고
 * 실행 팁 하나로 닫는 톤(사장님 확정 2026-07-16). AI 가 실패해도 급여량은 멀쩡하다.
 * ⚠️ 영양제·보충제는 절대 권하지 않는다(폐지한 제품) — 프롬프트에서 데이터·지시 모두 차단.
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
import { Heart } from 'lucide-react'
import { petName } from '@/lib/korean'

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
  /**
   * true 면 cached 를 즉시 보여주되 서버에 **다시 물어** 갱신 여부를 확인한다.
   * 개요 페이지용 — 2주 쿨다운이 지났으면 새 코멘트로 바뀐다(안 지났으면 서버가
   * 그대로 반환 → 비용 0). 분석 페이지(방금 생성)는 false 로 두면 재호출 안 함.
   */
  revalidate,
}: {
  analysisId: string
  dogName: string
  cached?: AiAnalysisJson | null
  revalidate?: boolean
}) {
  const [state, setState] = useState<State>(
    cached?.summary ? { kind: 'ready', data: cached } : { kind: 'loading' },
  )

  useEffect(() => {
    // cached 있고 revalidate 아니면 호출 안 함(분석 페이지: 방금 생성됨).
    if (cached?.summary && !revalidate) return
    const hasCached = !!cached?.summary
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
          // revalidate 중 실패면 기존 캐시 유지, 캐시 없으면 숨김.
          if (!hasCached) setState({ kind: 'hidden' })
          return
        }
        const json = (await res.json()) as { structured?: AiAnalysisJson }
        if (!alive) return
        if (json.structured?.summary) {
          setState({ kind: 'ready', data: json.structured })
        } else if (!hasCached) {
          setState({ kind: 'hidden' })
        }
      } catch {
        if (alive && !hasCached) setState({ kind: 'hidden' })
      }
    })()
    return () => {
      alive = false
    }
  }, [analysisId, cached, revalidate])

  if (state.kind === 'hidden') return null

  return (
    <section className="px-5 mt-2.5">
      <div
        className="rounded-[14px] overflow-hidden"
        style={{
          background: 'var(--paper-hi, #FFFFFF)',
          border: '1px solid var(--rule)',
          boxShadow: '0 1px 3px rgba(120, 46, 34, 0.05)',
        }}
      >
        {/* 헤더 밴드 — 하트 뱃지 + 라벨. 얇은 테라코타 워시로 편지 느낌. */}
        <div
          className="flex items-center gap-2.5 px-5 pt-4 pb-3.5"
          style={{ background: 'rgba(200, 107, 69, 0.05)' }}
        >
          <span
            className="inline-flex items-center justify-center rounded-full shrink-0"
            style={{ width: 28, height: 28, background: 'var(--terracotta)' }}
          >
            <Heart className="w-3.5 h-3.5" strokeWidth={2.4} color="#fff" fill="#fff" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[12.5px] font-bold text-terracotta tracking-[0.01em]">
              보호자님께
            </span>
            <span className="text-[10px] text-muted mt-0.5">
              {petName(dogName)} 이야기를 담았어요
            </span>
          </div>
        </div>

        <div className="px-5 pt-4 pb-5">
          {state.kind === 'loading' ? (
            <div className="space-y-2 py-1" aria-hidden>
              <div className="h-3 rounded bg-black/5 w-full animate-pulse" />
              <div className="h-3 rounded bg-black/5 w-[85%] animate-pulse" />
              <div className="h-3 rounded bg-black/5 w-[60%] animate-pulse" />
            </div>
          ) : (
            <>
              <p className="text-[13.5px] leading-[1.72] text-text whitespace-pre-line">
                {state.data.summary}
              </p>

              {state.data.nextActions && state.data.nextActions.length > 0 && (
                <div
                  className="mt-4 rounded-[10px] px-4 py-3.5"
                  style={{ background: 'rgba(200, 107, 69, 0.05)' }}
                >
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-terracotta mb-2.5">
                    이렇게 해보세요
                  </div>
                  <ul className="space-y-2.5">
                    {state.data.nextActions.slice(0, 3).map((a, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span
                          className="mt-[6px] shrink-0 rounded-full"
                          style={{
                            width: 5,
                            height: 5,
                            background: 'var(--terracotta)',
                          }}
                        />
                        <span className="text-[12.5px] leading-snug text-text/90">
                          {a}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
