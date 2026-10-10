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
import { isCustomerSafeAiLine } from '@/lib/nutrition/ai-safe-line'
import { V3 } from '@/lib/design/tokens'

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

  // ── 앱 새 디자인('A 포스터', 2026-10-09 캔버스 AppDog·D08) — 옅은 주황 면 한 장 + 흰 칸 '이렇게 해보세요'.
  //    우리 아이 개요와 분석 화면이 같이 쓴다. 불러오기·숨김 규칙(위)은 그대로다.
  const actions = state.kind === 'ready' ? (state.data.nextActions ?? []).filter(isCustomerSafeAiLine).slice(0, 3) : []
  return (
    <section
      aria-label="보호자님께"
      style={{
        margin: '26px 20px 0',
        padding: 18,
        borderRadius: 4,
        background: V3.cream,
        color: V3.ink,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800 }}>
        <Heart size={16} strokeWidth={2.4} fill="currentColor" aria-hidden />
        보호자님께
      </span>
      <span className="ft-poster" style={{ fontSize: 22, lineHeight: 1.2 }}>
        {petName(dogName)} 이야기를 담았어요
      </span>
      {state.kind === 'loading' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 0' }} aria-hidden>
          <div className="animate-pulse" style={{ height: 12, borderRadius: 2, background: 'rgba(20,20,20,0.08)', width: '100%' }} />
          <div className="animate-pulse" style={{ height: 12, borderRadius: 2, background: 'rgba(20,20,20,0.08)', width: '85%' }} />
          <div className="animate-pulse" style={{ height: 12, borderRadius: 2, background: 'rgba(20,20,20,0.08)', width: '60%' }} />
        </div>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: V3.inkSoft, whiteSpace: 'pre-line', wordBreak: 'keep-all' }}>
            {state.data.summary}
          </p>
          {actions.length > 0 && (
            <div style={{ marginTop: 2, padding: 14, borderRadius: 4, background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong style={{ fontSize: 15, fontWeight: 800 }}>이렇게 해보세요</strong>
              {actions.map((a, i) => (
                <span key={i} style={{ display: 'flex', gap: 8, fontSize: 15, lineHeight: 1.5, wordBreak: 'keep-all' }}>
                  <span aria-hidden style={{ flexShrink: 0, width: 6, height: 6, marginTop: 8, background: V3.mustard }} />
                  {a}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

