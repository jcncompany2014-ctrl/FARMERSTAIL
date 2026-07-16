/**
 * CohortRetentionTable — 가입 주 코호트별 재구매 retention 표.
 *
 * 입력: cohort_retention_weekly RPC 결과
 * 동작:
 *   - 행 = 가입 주 (최신 → 과거)
 *   - 열 = W0, W1, W2, W4, W8
 *   - 값 = **N주 이상 결제를 이어간 사람의 비율** (0.0 ~ 1.0). 생존 기준.
 *   - heat-map 색상: 높을수록 진한 moss (오래 함께함). 0% 는 muted.
 *   - 아직 N주가 안 지난 코호트의 칸은 NULL → '—' (0% 아님. "아직 모른다"가 답)
 *
 * # ⚠️ 값의 정의가 바뀜 (2026-07-16)
 * 예전 주석은 "그 코호트 사용자 중 **해당 주차에 결제한 비율**" 이었다. 그건 배송주기가
 * 1주/2주/4주 이던 시절 스펙이다. 지금은 **2주 고정**이라 W1·W3 에 결제하는 사람이
 * **구조적으로 0명**이고, 그 정의면 W1 이 항상 0% 로 찍혀 "첫 구매 후 즉시 이탈" 이라는
 * 거짓 신호를 매번 준다. 그래서 **생존**(마지막 결제가 가입 +N주 이후인가)으로 바꿨다.
 * 이러면 2주 주기와 무관하고, 좌→우로 단조 감소하는 진짜 retention curve 가 된다.
 *
 * 운영 의미:
 *   - W0 = 가입자 중 한 번이라도 결제한 비율 (활성화율)
 *   - W2 가 크게 꺾이면 **두 번째 박스로 못 넘어간다** — 첫 박스 경험 문제
 *   - W4 / W8 이 떨어지면 정기배송 onboarding 필요
 *   - 같은 코호트 행의 좌→우 흐름이 곧 retention curve
 */

export type CohortRow = {
  cohort_week: string // YYYY-MM-DD (월요일 KST)
  cohort_size: number
  retention_w0: number | null
  retention_w1: number | null
  retention_w2: number | null
  retention_w4: number | null
  retention_w8: number | null
}

const COLUMNS: { key: keyof CohortRow; label: string }[] = [
  { key: 'retention_w0', label: 'W0' },
  { key: 'retention_w1', label: 'W1' },
  { key: 'retention_w2', label: 'W2' },
  { key: 'retention_w4', label: 'W4' },
  { key: 'retention_w8', label: 'W8' },
]

function formatWeekLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00+09:00')
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}.${day}~`
}

function cellColor(rate: number | null): { bg: string; fg: string } {
  if (rate === null || rate === undefined) {
    return { bg: 'var(--bg-2)', fg: 'var(--muted)' }
  }
  if (rate === 0) return { bg: 'var(--bg-2)', fg: 'var(--muted)' }
  // 0 ~ 0.5+ 를 0 ~ 1 로 매핑 (50% 면 풀 saturation).
  const intensity = Math.min(1, rate * 2)
  // moss color rgba — opacity 로 농도.
  return {
    bg: `rgba(107, 127, 58, ${0.15 + intensity * 0.65})`,
    fg: intensity > 0.5 ? 'white' : 'var(--ink)',
  }
}

export default function CohortRetentionTable({ rows }: { rows: CohortRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="bg-white rounded-xl border border-zinc-200 p-5">
        <h3 className="text-[12px] font-bold text-muted uppercase tracking-widest mb-2">
          Cohort Retention · 코호트 재구매율
        </h3>
        <p className="text-[13px] text-muted">
          데이터가 부족해요. 최소 2주 이상 운영 후 의미 있는 차트가 됩니다.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-xl border border-zinc-200 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[12px] font-bold text-muted uppercase tracking-widest">
          Cohort Retention · 가입 주별 재구매율
        </h3>
        <span className="text-[10.5px] text-muted">결제 완료 기준</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-muted text-[11px] uppercase tracking-widest">
              <th className="text-left px-2 py-2 font-bold">가입 주</th>
              <th className="text-right px-2 py-2 font-bold">신규</th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key as string}
                  className="text-center px-2 py-2 font-bold"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cohort_week} className="border-t border-zinc-200">
                <td className="px-2 py-2 font-mono text-[11px] text-text">
                  {formatWeekLabel(row.cohort_week)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text">
                  {row.cohort_size}
                </td>
                {COLUMNS.map((c) => {
                  const rate = row[c.key] as number | null
                  const { bg, fg } = cellColor(rate)
                  const pct =
                    rate !== null && rate !== undefined
                      ? Math.round(rate * 100)
                      : null
                  return (
                    <td
                      key={c.key as string}
                      className="text-center px-1 py-2"
                    >
                      <div
                        className="px-2 py-1 rounded-md tabular-nums font-bold"
                        style={{
                          background: bg,
                          color: fg,
                          fontSize: 11,
                        }}
                      >
                        {/* null = 관측 기간 미달('아직 모른다'). 0% 는 진짜
                            신호(아무도 안 남음)라 숨기면 안 된다 — 2026-07-16. */}
                        {pct === null ? '—' : `${pct}%`}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10.5px] text-muted leading-relaxed">
        값 = 가입 후 <b>N주 이상 결제를 이어간 사람의 비율</b>. 진할수록 오래
        함께한 코호트예요. 배송이 2주 고정이라 &ldquo;그 주에 결제했나&rdquo; 대신
        &ldquo;그때까지 살아있나&rdquo;로 셉니다. <b>—</b> 는 0% 가 아니라 아직 그
        주차가 안 지났다는 뜻이에요. W2 가 크게 꺾이면 두 번째 박스로 못 넘어가는
        신호예요.
      </p>
    </section>
  )
}
