/** 자주 묻는 질문 접기 목록(웹 시안 Main) — 위 2px 먹선, 줄마다 1px, 첫 질문만 펼침. */
export default function StoreFaq({
  items,
  title = '자주 묻는 질문',
  className,
  listClassName,
}: {
  items: { q: string; a: string }[]
  title?: string
  /** PC 이름표(store.css) — 예: 구획 'fts-sec fts-pt', 목록 'fts-faq-list'(두 단). 폰 모양엔 영향 없음. */
  className?: string
  listClassName?: string
}) {
  return (
    <section className={className} style={{ padding: '64px 20px 64px', display: 'flex', flexDirection: 'column' }}>
      <h2 className="d" style={{ margin: 0, fontSize: 30, lineHeight: 1.12 }}>
        {title}
      </h2>
      <div className={listClassName} style={{ marginTop: 14, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column' }}>
        {items.map((f, i) => (
          <details key={f.q} open={i === 0} style={{ borderBottom: '1px solid #E5E5E5' }}>
            <summary style={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 18, fontWeight: 700 }}>
              {f.q}
              <span aria-hidden className="fts-acc-plus" style={{ fontSize: 26, fontWeight: 300 }}>
                +
              </span>
              <span aria-hidden className="fts-acc-minus" style={{ fontSize: 26, fontWeight: 300 }}>
                −
              </span>
            </summary>
            <p style={{ margin: '0 0 20px', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D', whiteSpace: 'pre-line' }}>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
