// Tier S F1-1 (2026-05-20): 예산 4-옵션 질문 step.
// 위치: status step 다음, loading 직전 — 분석 결과 직전 "jab" 효과
// (마지막에 가격 충격 차단 + anchor 형성). 모든 카피는 lib/copy-strings.ts.
import { Check } from 'lucide-react'
import { SURVEY_COPY, withDogName, type BudgetTier } from '@/lib/copy-strings'

export type BudgetProps = {
  dogName: string
  budgetTier: BudgetTier | null
  setBudgetTier: (v: BudgetTier | null) => void
}

export default function Budget({
  dogName,
  budgetTier,
  setBudgetTier,
}: BudgetProps) {
  return (
    <div className="s-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span className="s-kicker">
          BUDGET <span className="s-dot">·</span> 식비 예산
        </span>
      </div>
      <h1 className="s-title">
        {withDogName(SURVEY_COPY.budget.question, dogName)}
      </h1>
      <p className="s-sub">{SURVEY_COPY.budget.subtitle}</p>

      {/* 정돈 P1(2026-07-12) — 예산 전용 s-card 폐기, 다른 스텝(케어목표·MCS)과
          같은 s-listbtn 문법으로 통일. UI 그래머 1종 제거. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
        {SURVEY_COPY.budget.options.map((opt) => {
          const selected = budgetTier === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              className="s-listbtn"
              aria-pressed={selected}
              onClick={() => setBudgetTier(selected ? null : opt.value)}
            >
              <span className="s-lb-body">
                <span className="s-lb-title">{opt.label}</span>
                <span className="s-lb-sub">{opt.sub}</span>
              </span>
              {selected && (
                <Check
                  size={16}
                  strokeWidth={2.5}
                  color="var(--bg)"
                  style={{ flex: '0 0 auto' }}
                />
              )}
            </button>
          )
        })}
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
        {withDogName(SURVEY_COPY.budget.footer, dogName)}
      </p>
    </div>
  )
}
