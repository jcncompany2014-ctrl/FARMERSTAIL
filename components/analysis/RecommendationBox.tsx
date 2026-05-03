'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Box, Info, Sparkles } from 'lucide-react'
import { FOOD_LINE_META, ALL_LINES } from '@/lib/personalization/lines'
import type { Formula, FoodLine } from '@/lib/personalization/types'

/**
 * RecommendationBox — analysis 페이지의 "첫 박스 추천" 섹션.
 *
 * 마운트 시 /api/personalization/compute 호출 → dog_formulas (cycle_number=1)
 * 처방을 가져오거나 새로 생성. 결과를 minimal placeholder 디자인으로 표시.
 *
 * # 디자인 — placeholder
 * 이 컴포넌트의 시각 디자인은 의도적으로 minimal. 클로드 디자인 핸드오프
 * (donut chart / stacked bar / 카드 라인업 등) 받으면 이 자리에서 교체하면 됨.
 * 알고리즘 호출 / 데이터 흐름 / 에러 처리는 그대로 유지하면 됨.
 *
 * # 상태
 *  - 'loading'    : API 호출 중
 *  - 'ready'      : Formula 받음 → 정상 노출
 *  - 'no_survey'  : 설문 없음 (이상한 진입). 안내만.
 *  - 'error'      : 네트워크 / 서버 오류. 재시도 안내.
 */
type State =
  | { status: 'loading' }
  | { status: 'ready'; formula: Formula }
  | { status: 'no_survey' }
  | { status: 'error'; message: string }

export default function RecommendationBox({
  dogId,
  dogName,
}: {
  dogId: string
  dogName: string
}) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const fetchedRef = useRef<string | null>(null)

  useEffect(() => {
    if (fetchedRef.current === dogId) return
    fetchedRef.current = dogId
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/personalization/compute', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dogId }),
        })
        const json = (await res.json()) as
          | { ok: true; formula: Formula }
          | { ok?: false; code?: string; message?: string }
        if (cancelled) return
        if (!res.ok || !('ok' in json) || json.ok !== true) {
          if ('code' in json && json.code === 'NO_SURVEY') {
            setState({ status: 'no_survey' })
            return
          }
          setState({
            status: 'error',
            message:
              ('message' in json && json.message) ||
              '추천을 불러오지 못했어요',
          })
          return
        }
        setState({ status: 'ready', formula: json.formula })
      } catch (e) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : '네트워크 오류',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dogId])

  if (state.status === 'loading') {
    return (
      <section className="px-5 mt-6">
        <div className="rounded-2xl bg-white border border-rule p-6 flex items-center gap-3">
          <Loader2
            className="w-5 h-5 animate-spin text-terracotta"
            strokeWidth={2}
          />
          <div>
            <div className="text-[13px] font-bold text-text">
              {dogName} 맞춤 박스 계산 중
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              알고리즘 v1.0 — 30+ 룰 적용
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (state.status === 'no_survey') {
    return (
      <section className="px-5 mt-6">
        <div className="rounded-2xl bg-bg-2 border border-rule p-5 text-[12px] text-muted leading-relaxed">
          박스 추천을 받으려면 설문을 먼저 완료해 주세요.
        </div>
      </section>
    )
  }

  if (state.status === 'error') {
    return (
      <section className="px-5 mt-6">
        <div className="rounded-2xl bg-bg-2 border border-rule p-5 text-[12px] text-muted leading-relaxed">
          박스 추천을 불러오지 못했어요. 잠시 후 페이지를 새로고침해 주세요.
        </div>
      </section>
    )
  }

  const { formula } = state
  const sortedLines = [...ALL_LINES]
    .filter((line) => formula.lineRatios[line] > 0)
    .sort((a, b) => formula.lineRatios[b] - formula.lineRatios[a])

  // Stacked bar 표현 — 비율을 % 로.
  const totalToppers =
    formula.toppers.protein + formula.toppers.vegetable

  const transitionLabel =
    formula.transitionStrategy === 'aggressive'
      ? '즉시 풀비율 적용'
      : formula.transitionStrategy === 'gradual'
        ? '2주 점진 전환'
        : '4주 보수적 전환'

  return (
    <section className="px-5 mt-6">
      {/* placeholder — 클로드 디자인 핸드오프로 교체 예정 */}
      <div className="rounded-2xl bg-white border border-rule overflow-hidden">
        {/* Hero */}
        <div className="px-5 pt-5 pb-4 border-b border-rule">
          <div className="inline-flex items-center gap-1.5 mb-2">
            <Box className="w-3.5 h-3.5 text-terracotta" strokeWidth={2.25} />
            <span className="kicker">First Box · 추천 박스</span>
          </div>
          <h3
            className="font-serif"
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {dogName}이의 첫 박스
          </h3>
          <p className="text-[11.5px] text-muted mt-1.5 leading-relaxed">
            {transitionLabel} · 1일 {formula.dailyKcal.toLocaleString()} kcal ·{' '}
            {formula.dailyGrams}g
          </p>
        </div>

        {/* Stacked ratio bar */}
        <div className="px-5 py-4">
          <div className="flex h-3 rounded-full overflow-hidden bg-rule">
            {sortedLines.map((line) => {
              const pct = formula.lineRatios[line] * 100
              return (
                <div
                  key={line}
                  style={{
                    width: `${pct}%`,
                    background: FOOD_LINE_META[line].color,
                  }}
                  title={`${FOOD_LINE_META[line].name} ${pct}%`}
                />
              )
            })}
          </div>

          {/* Line list */}
          <ul className="mt-4 space-y-2">
            {sortedLines.map((line) => {
              const meta = FOOD_LINE_META[line]
              const pct = Math.round(formula.lineRatios[line] * 100)
              return (
                <li key={line} className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: meta.color }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-[12.5px] font-bold text-text">
                      {meta.name}
                    </span>
                    <span className="text-[10.5px] text-muted ml-1.5">
                      · {meta.subtitle}
                    </span>
                  </span>
                  <span className="text-[13px] font-black text-terracotta font-mono">
                    {pct}%
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Toppers */}
          {totalToppers > 0 && (
            <div className="mt-4 pt-4 border-t border-rule">
              <span className="text-[10px] font-bold text-muted tracking-[0.2em] uppercase">
                Toppers · 토퍼
              </span>
              <ul className="mt-2 space-y-1.5">
                {formula.toppers.vegetable > 0 && (
                  <li className="flex items-center gap-2 text-[11.5px] text-text">
                    <span className="text-muted">동결건조 야채</span>
                    <span className="font-mono font-bold text-moss ml-auto">
                      +{Math.round(formula.toppers.vegetable * 100)}%
                    </span>
                  </li>
                )}
                {formula.toppers.protein > 0 && (
                  <li className="flex items-center gap-2 text-[11.5px] text-text">
                    <span className="text-muted">동결건조 육류</span>
                    <span className="font-mono font-bold text-terracotta ml-auto">
                      +{Math.round(formula.toppers.protein * 100)}%
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Reasoning chips */}
        {formula.reasoning.length > 0 && (
          <div className="px-5 py-4 bg-bg-2 border-t border-rule">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles
                className="w-3 h-3 text-terracotta"
                strokeWidth={2.25}
              />
              <span className="kicker">Reasoning · 결정 근거</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {formula.reasoning.slice(0, 6).map((r, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-white text-text"
                  style={{ boxShadow: 'inset 0 0 0 1px var(--rule)' }}
                  title={`${r.trigger} → ${r.action}`}
                >
                  {r.chipLabel}
                </span>
              ))}
            </div>
            {formula.reasoning.length > 6 && (
              <p className="text-[10px] text-muted mt-2">
                +{formula.reasoning.length - 6}개 룰 더 적용됨
              </p>
            )}
          </div>
        )}

        {/* Footer note */}
        <div className="px-5 py-3.5 border-t border-rule flex items-start gap-2 text-[10.5px] text-muted leading-relaxed">
          <Info
            className="w-3 h-3 shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <span>
            알고리즘 {formula.algorithmVersion} · 매월 체크인 응답 후 비율이
            자동 조정돼요.
          </span>
        </div>
      </div>
    </section>
  )
}

// FoodLine import 가 미사용 — 향후 prop 타입 정교화 시 남길 수 있음.
void ({} as FoodLine)
