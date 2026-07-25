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
 *
 * # 시인성 (2026-07-25)
 * CohortRetentionTable 과 같은 이유로 admin 홈에서 /admin/cohort 로 옮기고,
 * 연속 alpha 배경(글자색은 고정) 대신 **4단계 고정 팔레트 + 짝지은 글자색**으로
 * 바꿨다. 금액은 자릿수가 길어 배경이 진해질수록 읽기 부담이 커지므로 가장
 * 진한 단계에서만 흰 글씨를 쓴다. sticky 첫 열도 뺐다 — 열이 6개뿐이라 굳이
 * 고정할 필요가 없는데 스크롤 중 겹쳐 보이는 부작용만 있었다.
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

/** peak 대비 비율 → 배경·글자색 쌍. 가장 진한 단계만 흰 글씨(대비 5.9:1). */
const LTV_SCALE: { min: number; bg: string; fg: string }[] = [
  { min: 0.75, bg: '#9c4630', fg: '#ffffff' },
  { min: 0.5, bg: '#e6b7a6', fg: '#4a1d10' },
  { min: 0.25, bg: '#f2d9cf', fg: '#4a1d10' },
  { min: 0.0001, bg: '#faece6', fg: '#4a1d10' },
]

const EMPTY_CELL = { bg: '#f4f4f5', fg: '#71717a' }

function cellStyle(
  value: number | null,
  peakValue: number,
): { bg: string; fg: string } {
  if (!value) return EMPTY_CELL
  const ratio = value / peakValue
  return LTV_SCALE.find((s) => ratio >= s.min) ?? EMPTY_CELL
}

export default function CohortLtvTable({ rows }: { rows: LtvRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <h3 className="text-[13px] font-black text-zinc-800 mb-1.5">
          가입 주별 평균 생애가치
        </h3>
        <p className="text-[12px] text-zinc-500 leading-relaxed">
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
    <section className="bg-white rounded-lg border border-zinc-200 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <h3 className="text-[13px] font-black text-zinc-800">
          가입 주별 평균 생애가치
        </h3>
        <span className="text-[10.5px] text-zinc-500 shrink-0">최근 12주</span>
      </div>
      <p className="text-[12px] text-zinc-500 leading-snug mb-3">
        <mark className="bg-amber-100 text-zinc-800 rounded px-1 font-bold">
          한 고객이 가입 후 평균 얼마를 쓰는지
        </mark>
        를 보여줘요. D7 은 가입 7일 안에 쓴 돈, 누적은 지금까지 전부예요.{' '}
        <b className="text-zinc-800">최근에 가입한 주일수록</b> 아직 쓸 시간이
        없어서 숫자가 작은 게 정상이에요.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="text-left text-[11px] text-zinc-500 font-bold">
              <th className="px-2 py-2">가입 주</th>
              <th className="px-2 py-2 text-right">사용자</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-right">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cohort_week} className="border-t border-zinc-200">
                <td className="px-2 py-2 font-bold text-zinc-800 font-mono text-[11px]">
                  {formatWeekLabel(r.cohort_week)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-800">
                  {r.cohort_size.toLocaleString()}명
                </td>
                {COLUMNS.map((c) => {
                  const value = r[c.key] as number | null
                  const { bg, fg } = cellStyle(value, peak)
                  return (
                    <td key={c.key} className="px-1 py-2 text-right">
                      <div
                        className="px-2 py-1 rounded-md tabular-nums font-bold"
                        style={{ background: bg, color: fg }}
                      >
                        {formatLtv(value)}
                      </div>
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
