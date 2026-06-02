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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        {SURVEY_COPY.budget.options.map((opt) => {
          const selected = budgetTier === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setBudgetTier(selected ? null : opt.value)}
              className="s-card"
              style={{
                // R26 v3 polish: selected fill ink → terracotta + radius 14 → 12
                // (다른 모든 step 큰 카드 selected 와 grammar 통일).
                background: selected ? 'var(--terracotta)' : 'var(--bg-2)',
                color: selected ? '#fff' : 'var(--ink)',
                border: '1px solid',
                borderColor: selected ? 'var(--terracotta)' : 'var(--rule)',
                borderRadius: 12,
                padding: '14px 16px',
                textAlign: 'left',
                cursor: 'pointer',
                boxShadow: selected
                  ? '0 6px 20px -8px rgba(220, 83, 42, 0.45)'
                  : 'none',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: '1.5px solid',
                    borderColor: selected ? '#fff' : 'var(--rule)',
                    background: selected ? '#fff' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {selected && (
                    <Check
                      className="w-3 h-3"
                      style={{ color: 'var(--terracotta)' }}
                      strokeWidth={3}
                    />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                    {opt.sub}
                  </div>
                </div>
              </div>
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
