/**
 * CohortLtvTable — 가입 주 코호트별 평균 LTV (D7 / D30 / D90 / 누적).
 *
 * cohort_ltv_weekly RPC 결과 표시.
 *   행 = 가입 주 (최신 → 과거)
 *   열 = D7 / D30 / D90 / 누적
 *   값 = paid orders total_amount 누적 / 코호트 사용자 수 (원 단위)
 *
 * 운영 의미:
 *   - LTV D7 이 낮으면 가입 후 즉시 첫 구매 전환이 약함 (welcome flow)
 *   - LTV D30 vs D7 의 차이 = 첫 한 달 추가 구매 강도
 *   - 누적 LTV - LTV D90 = 90일 이후 잔존 사용자의 추가 매출
 *   - 코호트별 점진 증가 = onboarding/제품 개선 반영
 */

export type LtvRow = {
  cohort_week: string // YYYY-MM-DD (월요일 KST)
  cohort_size: number
  ltv_d7: number | null
  ltv_d30: number | null
  ltv_d90: number | null
  ltv_total: number | null
}

const COLUMNS: { key: keyof LtvRow; label: string }[] = [
  { key: 'ltv_d7', label: 'D7' },
  { key: 'ltv_d30', label: 'D30' },
  { key: 'ltv_d90', label: 'D90' },
  { key: 'ltv_total', label: '누적' },
]

function formatWeekLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00+09:00')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}.${day}~`
}

function formatLtv(value: number | null): string {
  if (value === null || value === undefined || value === 0) return '—'
  // 1원 단위 반올림 + 천 단위 콤마.
  return `${Math.round(value).toLocaleString()}원`
}

function cellTone(value: number | null, peakValue: number): string {
  if (!value) return 'var(--bg-2)'
  // peak 대비 0~1 으로 정규화. 50% 이상이면 진한 terracotta.
  const intensity = Math.min(1, value / peakValue)
  return `rgba(160, 69, 46, ${0.1 + intensity * 0.55})`
}

export default function CohortLtvTable({ rows }: { rows: LtvRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-rule p-5">
        <h3 className="text-[12px] font-bold text-muted uppercase tracking-widest mb-2">
          코호트 LTV
        </h3>
        <p className="text-[12px] text-muted">
          아직 코호트 데이터가 충분하지 않아요. 가입 12주 누적 후 표가 생성돼요.
        </p>
      </section>
    )
  }

  // 색상 정규화용 peak — D90 기준 (가장 안정적인 값).
  const peak = Math.max(
    ...rows.map((r) => r.ltv_d90 ?? 0),
    ...rows.map((r) => r.ltv_total ?? 0),
    1,
  )

  return (
    <section className="bg-white rounded-xl border border-rule overflow-hidden">
      <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
        <h3 className="text-[12px] font-bold text-muted uppercase tracking-widest">
          코호트 LTV (가입 주별 평균)
        </h3>
        <span className="text-[10px] text-muted">최근 12주</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead className="bg-bg-2/40">
            <tr className="text-left text-[10px] uppercase tracking-widest text-muted font-bold">
              <th className="px-4 py-2.5 sticky left-0 bg-bg-2/40">가입 주</th>
              <th className="px-3 py-2.5 text-right">사용자</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2.5 text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cohort_week} className="border-t border-rule">
                <td className="px-4 py-2.5 font-bold text-text font-mono sticky left-0 bg-white">
                  {formatWeekLabel(r.cohort_week)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-text">
                  {r.cohort_size.toLocaleString()}명
                </td>
                {COLUMNS.map((c) => {
                  const value = r[c.key] as number | null
                  return (
                    <td
                      key={c.key}
                      className="px-3 py-2.5 text-right tabular-nums font-bold"
                      style={{
                        backgroundColor: cellTone(value, peak),
                        color: 'var(--ink)',
                      }}
                    >
                      {formatLtv(value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
