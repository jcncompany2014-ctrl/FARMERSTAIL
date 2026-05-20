'use client'

/**
 * Round F1 (2026-05-20): Elimination Diet 8주 체크리스트 클라이언트.
 *
 * - LocalStorage 만 사용 (DB 미사용 — 사용자 부담 최소)
 * - 시작일 + 각 주차 체크 상태 보존
 * - 진행률 % + 현재 단계 (적응/단일/도전) 자동 계산
 */

import { useState, useEffect, useMemo } from 'react'
import { Check, Circle, Calendar, Play } from 'lucide-react'

const STORAGE_KEY = 'ft:elimination-diet:v1'

function computeCurrentWeek(startedAtIso: string | null): number {
  if (!startedAtIso) return 0
  const elapsed = Date.now() - new Date(startedAtIso).getTime()
  return Math.min(8, Math.floor(elapsed / (7 * 86_400_000)) + 1)
}

type State = {
  startedAtIso: string | null
  checks: Record<string, boolean> // weekN-itemM
}

type WeekConfig = {
  week: number
  stage: '적응' | '단일' | '도전'
  title: string
  items: string[]
}

const WEEKS: WeekConfig[] = [
  {
    week: 1,
    stage: '적응',
    title: 'Week 1 — 단일 단백 도입 시작',
    items: [
      '신규 protein (오리·돼지·연어 등 처음 먹는 단백) 선택 완료',
      '기존 사료 75% + 신규 25% 비율로 급여',
      '간식·껌·기타 단백 source 모두 중단',
      '변·피부·가려움 메모 시작',
    ],
  },
  {
    week: 2,
    stage: '적응',
    title: 'Week 2 — 신규 protein 비중 ↑',
    items: [
      '기존 사료 25% + 신규 75% 로 전환',
      '간식 완전 중단 유지',
      '변 일관성 / 피부 가려움 일일 메모',
      '인간 음식 (조각 떨어진 거 포함) X',
    ],
  },
  {
    week: 3,
    stage: '단일',
    title: 'Week 3 — 신규 protein 단독 100%',
    items: [
      '기존 사료 완전 중단 — 신규만 100%',
      '4주간 다른 단백 source 절대 금지',
      '실수로 다른 protein 노출 시 → Week 3 부터 다시',
    ],
  },
  {
    week: 4,
    stage: '단일',
    title: 'Week 4 — 단일 유지',
    items: [
      '같은 단백 단독 유지',
      '증상 변화 (가려움 / 변 / 발 핥기) 일일 기록',
      '체중 측정 — 큰 변화 있으면 분석 페이지 재산출',
    ],
  },
  {
    week: 5,
    stage: '단일',
    title: 'Week 5 — 변화 본격',
    items: [
      '대부분 사용자는 이 시점부터 증상 변화 관찰',
      '변·피부 사진 주 1회 (자가 메모용)',
      '단일 유지 계속',
    ],
  },
  {
    week: 6,
    stage: '단일',
    title: 'Week 6 — 안정 단계',
    items: [
      '증상 호전 시 — 단일 protein 안전 protein 으로 확정',
      '미변화 시 — 다른 protein 으로 elimination 재시작 검토',
    ],
  },
  {
    week: 7,
    stage: '단일',
    title: 'Week 7 — 도전 직전',
    items: [
      'baseline 증상 점수 기록 (가려움 NRS 0-10 / 변 1-7)',
      '도전할 의심 protein 1종 선정',
    ],
  },
  {
    week: 8,
    stage: '도전',
    title: 'Week 8 — 도전 (Re-challenge)',
    items: [
      '의심 protein 소량 재도입 (예: 닭 10g)',
      '7-14일간 증상 재발 관찰',
      '재발 시 — 알레르겐 확정. 평생 회피.',
      '재발 없으면 — 다른 의심 protein 으로 재도전',
    ],
  },
]

export default function EliminationDietClient() {
  const [state, setState] = useState<State>({
    startedAtIso: null,
    checks: {},
  })

  // Load from LocalStorage — mount 1회. SSR safe (typeof window check).
  // react-hooks/purity 룰은 effect 내 setState 를 cascade renders 위험으로
  // 잡지만 LS hydration 은 표준 패턴이라 의도된 위반.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as State
      if (parsed && typeof parsed === 'object') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState({
          startedAtIso: parsed.startedAtIso ?? null,
          checks: parsed.checks ?? {},
        })
      }
    } catch {
      /* corrupted — ignore */
    }
  }, [])

  // Save on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* quota — ignore */
    }
  }, [state])

  function start() {
    setState({
      startedAtIso: new Date().toISOString(),
      checks: {},
    })
  }

  function reset() {
    if (!confirm('진행 상황을 모두 삭제할까요?')) return
    setState({ startedAtIso: null, checks: {} })
  }

  function toggleCheck(key: string) {
    setState((s) => ({
      ...s,
      checks: { ...s.checks, [key]: !s.checks[key] },
    }))
  }

  // 현재 주차 계산. Date.now() 는 component body 에서 직접 부르면
  // react-hooks/purity 위반 → useMemo (deps=startedAtIso) 로 격리.
  const currentWeek = useMemo(
    () => computeCurrentWeek(state.startedAtIso),
    [state.startedAtIso],
  )

  const totalChecks = WEEKS.reduce((s, w) => s + w.items.length, 0)
  const doneChecks = Object.values(state.checks).filter(Boolean).length
  const progressPct =
    totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0

  if (!state.startedAtIso) {
    return (
      <section className="mt-5 rounded-2xl border border-rule bg-white p-6 text-center">
        <Play
          className="w-8 h-8 mx-auto text-terracotta"
          strokeWidth={2}
        />
        <h2 className="font-serif mt-3 text-[18px] font-bold text-ink">
          시작 준비됐어요?
        </h2>
        <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
          시작 버튼을 누르면 오늘이 Week 1 의 첫 날이 돼요. 8주 후 도전
          단계까지 진행 상황이 자동 추적돼요.
        </p>
        <button
          type="button"
          onClick={start}
          className="mt-4 inline-flex items-center gap-1.5 px-6 py-3 rounded-full bg-ink text-bg text-[13px] font-bold active:scale-[0.98] transition"
        >
          <Play className="w-3.5 h-3.5" strokeWidth={2.5} />
          오늘부터 시작
        </button>
      </section>
    )
  }

  return (
    <>
      {/* 진행률 + 시작일 */}
      <section className="mt-5 rounded-2xl border border-rule bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-moss" strokeWidth={2} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted">
              Week {currentWeek} / 8
            </span>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-[10.5px] font-bold text-muted hover:text-sale transition underline"
          >
            처음부터
          </button>
        </div>
        <div className="h-2 rounded-full bg-bg overflow-hidden">
          <div
            className="h-full bg-terracotta transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10.5px] font-mono text-muted tabular-nums">
          <span>
            {doneChecks} / {totalChecks} 체크
          </span>
          <span>{progressPct}%</span>
        </div>
      </section>

      {/* 주차별 체크리스트 */}
      <div className="mt-5 space-y-3">
        {WEEKS.map((w) => {
          const isCurrent = w.week === currentWeek
          const isPast = w.week < currentWeek
          return (
            <section
              key={w.week}
              className={`rounded-2xl border p-5 ${
                isCurrent
                  ? 'border-terracotta bg-terracotta/5'
                  : isPast
                    ? 'border-moss/40 bg-moss/5'
                    : 'border-rule bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{
                    background:
                      w.stage === '도전'
                        ? '#C76A4E'
                        : w.stage === '단일'
                          ? '#8BA05A'
                          : '#E0B341',
                    color: 'white',
                  }}
                >
                  {w.stage}
                </span>
                <h3 className="text-[13px] font-bold text-ink">{w.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {w.items.map((item, i) => {
                  const key = `w${w.week}-${i}`
                  const checked = !!state.checks[key]
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => toggleCheck(key)}
                        className="w-full flex items-start gap-2.5 text-left py-1.5 px-2 rounded-lg hover:bg-bg/60 transition"
                      >
                        {checked ? (
                          <Check
                            className="w-4 h-4 text-moss shrink-0 mt-0.5"
                            strokeWidth={2.5}
                          />
                        ) : (
                          <Circle
                            className="w-4 h-4 text-muted shrink-0 mt-0.5"
                            strokeWidth={2}
                          />
                        )}
                        <span
                          className={`text-[12px] leading-relaxed ${
                            checked
                              ? 'text-muted line-through'
                              : 'text-text'
                          }`}
                        >
                          {item}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
