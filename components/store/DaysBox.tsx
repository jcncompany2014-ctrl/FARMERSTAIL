/**
 * "500g 한 봉이면 약 6일" 상자(웹 시안 Main·Product) — 도장 그림자(2px 먹선 + 4px 그림자)는 화면에 한 곳.
 * 날 칸은 7칸씩(2주 = 14칸, 날이 많으면 3·4주까지), 먹는 날만 레시피 띠 색.
 */
const won = (n: number) => n.toLocaleString('ko-KR')

export default function DaysBox({
  heading,
  days,
  gramsPerDay,
  costPerDay,
  packLabel,
  color,
}: {
  heading: string
  days: number
  gramsPerDay: number
  costPerDay: number
  /** "100g 팩 ¾쯤" — 상품 상세에만. */
  packLabel?: string
  color: string
}) {
  const cellsN = Math.min(28, Math.max(14, Math.ceil(days / 7) * 7))
  const cells = Array.from({ length: cellsN }, (_, i) => i + 1)
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '2px solid #141414',
        boxShadow: '4px 4px 0 #141414',
        borderRadius: 4,
        padding: '20px 18px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#595959' }}>{heading}</span>
        <span className="d" style={{ fontSize: 48, lineHeight: 1 }} aria-live="polite">
          약 {days}일{days > 28 ? ' 넘게' : ''}
        </span>
      </span>
      <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
        {cells.map((n) => {
          const on = n <= days
          return (
            <span
              key={n}
              style={{
                height: 26,
                borderRadius: 2,
                background: on ? color : '#EFEDEE',
                color: on ? (color === '#2E3338' ? '#FFFFFF' : '#141414') : '#9A9A9A',
                fontSize: 12,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {n}
            </span>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', borderTop: '1px solid #E5E5E5', paddingTop: 14 }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, color: '#595959' }}>하루에</span>
          <span style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap' }}>약 {gramsPerDay}g</span>
          {packLabel && <span style={{ fontSize: 13, color: '#595959' }}>{packLabel}</span>}
        </span>
        <span style={{ paddingLeft: 14, borderLeft: '1px solid #E5E5E5', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 14, color: '#595959' }}>하루에</span>
          <span style={{ fontSize: 20, fontWeight: 800, whiteSpace: 'nowrap' }}>약 {won(costPerDay)}원</span>
        </span>
      </div>
    </div>
  )
}
