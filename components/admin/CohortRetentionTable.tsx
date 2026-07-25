/**
 * CohortRetentionTable — 가입 주 코호트별 재구매 retention 표.
 *
 * 입력: cohort_retention_weekly RPC 결과
 * 동작:
 *   - 행 = 가입 주 (최신 → 과거)
 *   - 열 = W0, W1, W2, W4, W8
 *   - 값 = **N주 이상 결제를 이어간 사람의 비율** (0.0 ~ 1.0). 생존 기준.
 *   - heat-map 색상: 높을수록 진한 moss (오래 함께함). 0% 는 회색.
 *   - 아직 N주가 안 지난 코호트의 칸은 NULL → '—' (0% 아님. "아직 모른다"가 답)
 *
 * # ⚠️ 값의 정의가 바뀜 (2026-07-16)
 * 예전 주석은 "그 코호트 사용자 중 **해당 주차에 결제한 비율**" 이었다. 그건 배송주기가
 * 1주/2주/4주 이던 시절 스펙이다. 지금은 **2주 고정**이라 W1·W3 에 결제하는 사람이
 * **구조적으로 0명**이고, 그 정의면 W1 이 항상 0% 로 찍혀 "첫 구매 후 즉시 이탈" 이라는
 * 거짓 신호를 매번 준다. 그래서 **생존**(마지막 결제가 가입 +N주 이후인가)으로 바꿨다.
 * 이러면 2주 주기와 무관하고, 좌→우로 단조 감소하는 진짜 retention curve 가 된다.
 *
 * # 시인성 (2026-07-25 사장님 제보)
 * 이 표는 원래 admin 홈에 있었는데
 *   ① 주차 컬럼이 7개인 넓은 표라 폰에서 홈 전체가 옆으로 밀렸고
 *   ② 셀 색이 `rgba(moss, 0.15~0.8)` 연속값인데 글자색은 "농도 50% 넘으면 흰색"
 *      이라, 딱 경계인 연한 초록 위에 흰 글씨가 얹혀 **대비 1.6:1** 로 안 보였다.
 * 그래서
 *   - 위치: /admin/cohort (가입 시기별 분석) 로 이동 — 매일 볼 지표가 아니다
 *   - 색: 연속 alpha 대신 **4단계 고정 팔레트**. 각 단계마다 글자색을 짝지어
 *     대비 4.5:1 이상을 보장한다(가장 진한 단계만 흰 글씨 = 5.6:1).
 * 색을 추가·수정할 땐 반드시 글자색과 한 쌍으로 넣을 것. 연속 alpha 로
 * 되돌리면 같은 버그가 그대로 재발한다.
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

/** 배경·글자색 고정 쌍 — 위 docstring 의 대비 보장 규칙. */
const RETENTION_SCALE: { min: number; bg: string; fg: string }[] = [
  { min: 0.75, bg: '#5c6e30', fg: '#ffffff' },
  { min: 0.5, bg: '#b9cc8d', fg: '#2f3a17' },
  { min: 0.25, bg: '#dae5bd', fg: '#3f4a22' },
  { min: 0.0001, bg: '#eef3e2', fg: '#3f4a22' },
]

const EMPTY_CELL = { bg: '#f4f4f5', fg: '#71717a' }

function cellColor(rate: number | null): { bg: string; fg: string } {
  // null(관측 미달) 과 0%(진짜 전멸) 는 둘 다 회색. 구분은 '—' / '0%' 표기로.
  if (rate === null || rate === undefined || rate === 0) return EMPTY_CELL
  return RETENTION_SCALE.find((s) => rate >= s.min) ?? EMPTY_CELL
}

export default function CohortRetentionTable({ rows }: { rows: CohortRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="bg-white rounded-lg border border-zinc-200 p-5">
        <h3 className="text-[13px] font-black text-zinc-800 mb-1.5">
          가입 주별 재구매율
        </h3>
        <p className="text-[12px] text-zinc-500 leading-relaxed">
          데이터가 부족해요. 최소 2주 이상 운영 후 의미 있는 표가 됩니다.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-lg border border-zinc-200 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <h3 className="text-[13px] font-black text-zinc-800">
          가입 주별 재구매율
        </h3>
        <span className="text-[10.5px] text-zinc-500 shrink-0">
          결제 완료 기준
        </span>
      </div>
      <p className="text-[12px] text-zinc-500 leading-snug mb-3">
        <mark className="bg-amber-100 text-zinc-800 rounded px-1 font-bold">
          가입한 시기별로 고객이 계속 사는지
        </mark>
        를 보여줘요. 오른쪽으로 갈수록 오래 남은 사람이고,{' '}
        <b className="text-zinc-800">색이 진할수록</b> 많이 남았다는 뜻이에요.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-zinc-500 text-[11px]">
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
                <td className="px-2 py-2 font-mono text-[11px] text-zinc-800">
                  {formatWeekLabel(row.cohort_week)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-zinc-800">
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
                    <td key={c.key as string} className="text-center px-1 py-2">
                      <div
                        className="px-2 py-1 rounded-md tabular-nums font-bold text-[11px]"
                        style={{ background: bg, color: fg }}
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

      <p className="mt-3 text-[11px] text-zinc-500 leading-relaxed">
        값 = 가입 후{' '}
        <b className="text-zinc-800">N주 이상 결제를 이어간 사람의 비율</b>.
        배송이 2주 고정이라 &ldquo;그 주에 결제했나&rdquo; 대신 &ldquo;그때까지
        살아있나&rdquo;로 셉니다. <b className="text-zinc-800">&mdash;</b> 는 0%가
        아니라 아직 그 주차가 안 지났다는 뜻이에요.{' '}
        <mark className="bg-amber-100 text-zinc-800 rounded px-1 font-bold">
          W2가 크게 꺾이면 두 번째 박스로 못 넘어가는 신호
        </mark>
        예요.
      </p>
    </section>
  )
}
