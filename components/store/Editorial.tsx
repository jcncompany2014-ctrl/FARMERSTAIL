import Link from 'next/link'
import { magazineRecipeCard } from '@/lib/magazine/recipe-card'
import type { MagazineRecipeKey } from '@/lib/magazine/recipe-block'
import { SUBSCRIPTION_DISCOUNT_PCT } from '@/lib/pricing'

/**
 * 웹 읽을거리 화면(우리 음식·우리 이야기·브랜드·왜 화식·매거진 끝)의 공통 부품 — 매거진 본문 모양(lib/magazine/post-css,
 * 2026-10-11 사장님 승인)과 같은 결: 위 굵은 선 + 회색 Anton 번호 + 포스터 제목, 번호 동그라미 요약, 세로선 단계, Q 칸.
 * 가게 틀(.fts) 안에서만 쓴다 — .d(포스터)·.n(숫자) 글꼴과 details 표시(fts-acc-plus/minus)는 store.css 가 준다.
 */

/** 무항생제 표시는 닭가슴살·오리 안심만(사장님 2026-10-11) — 흑돼지·한우·간·염통에는 붙이지 않는다. */
export const ANTIBIOTIC_FREE_TAG: Partial<Record<MagazineRecipeKey, string>> = {
  chicken: '무항생제 닭가슴살',
  duck: '무항생제 오리 안심',
}

export function SecHead({ n, children, sub, style }: { n: number; children: React.ReactNode; sub?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ paddingTop: 24, borderTop: '2px solid #141414', display: 'flex', flexDirection: 'column', ...style }}>
      <span className="n" style={{ fontSize: 16, letterSpacing: '0.06em', color: '#8C8C8C' }}>
        {String(n).padStart(2, '0')}
      </span>
      <h2 className="d" style={{ margin: '8px 0 0', fontSize: 30, lineHeight: 1.12 }}>
        {children}
      </h2>
      {sub && <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.7, color: '#3D3D3D' }}>{sub}</p>}
    </div>
  )
}

export function SummaryBox({ title = '한눈에 보기', items, style }: { title?: string; items: React.ReactNode[]; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: 18, borderRadius: 4, border: '2px solid #141414', display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      <strong className="d" style={{ fontSize: 19, fontWeight: 400 }}>
        {title}
      </strong>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it, i) => (
          <li key={i} style={{ padding: '6px 0', display: 'grid', gridTemplateColumns: '34px 1fr', alignItems: 'start', fontSize: 17, lineHeight: 1.55 }}>
            <span
              className="n"
              aria-hidden
              style={{ width: 24, height: 24, marginTop: 2, borderRadius: '50%', background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}
            >
              {i + 1}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function StepList({ steps, style }: { steps: { t: React.ReactNode; d?: React.ReactNode }[]; style?: React.CSSProperties }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none', ...style }}>
      {steps.map((st, i) => {
        const last = i === steps.length - 1
        return (
          <li key={i} style={{ position: 'relative', display: 'grid', gridTemplateColumns: '50px 1fr', paddingBottom: last ? 0 : 22 }}>
            <span
              className="n"
              aria-hidden
              style={{ width: 34, height: 34, borderRadius: '50%', background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}
            >
              {i + 1}
            </span>
            {!last && <span aria-hidden style={{ position: 'absolute', left: 16, top: 38, bottom: 6, width: 2, background: '#E5E5E5' }} />}
            <span style={{ paddingTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <strong style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.45 }}>{st.t}</strong>
              {st.d && <span style={{ fontSize: 15, lineHeight: 1.6, color: '#3D3D3D' }}>{st.d}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function NoteBox({ tone, title, children, style }: { tone: 'tip' | 'warn'; title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const c = tone === 'tip' ? { bg: '#EDF4F0', fg: '#1D3B2F' } : { bg: '#FBEDEA', fg: '#A8321F' }
  return (
    <div style={{ padding: 18, borderRadius: 4, background: c.bg, display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      <strong className="d" style={{ fontSize: 19, fontWeight: 400, color: c.fg }}>
        {title}
      </strong>
      <div style={{ fontSize: 16, lineHeight: 1.7, color: '#262626' }}>{children}</div>
    </div>
  )
}

/** 형광펜 — 매거진 ==강조== 와 같은 색. */
export function Mark({ children }: { children: React.ReactNode }) {
  return <mark style={{ background: 'linear-gradient(transparent 56%, #FBDDB0 56%)', color: 'inherit', padding: '0 1px' }}>{children}</mark>
}

export function QaList({ items, style }: { items: { q: string; a: React.ReactNode }[]; style?: React.CSSProperties }) {
  return (
    <div style={{ borderTop: '2px solid #141414', ...style }}>
      {items.map((f) => (
        <details key={f.q} style={{ borderBottom: '1px solid #E5E5E5' }}>
          <summary style={{ minHeight: 62, padding: '14px 0', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, fontSize: 17, fontWeight: 800, lineHeight: 1.45 }}>
            <span
              className="n"
              aria-hidden
              style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 4, background: '#141414', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}
            >
              Q
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>{f.q}</span>
            <span aria-hidden className="fts-acc-plus" style={{ fontSize: 26, fontWeight: 300 }}>
              +
            </span>
            <span aria-hidden className="fts-acc-minus" style={{ fontSize: 26, fontWeight: 300 }}>
              −
            </span>
          </summary>
          <div style={{ padding: '0 0 18px 38px', fontSize: 16, lineHeight: 1.7, color: '#3D3D3D' }}>{f.a}</div>
        </details>
      ))}
    </div>
  )
}

/** 레시피 카드 2칸(가게 상품으로) — 이름·부위·가격·사진은 가게 정본, 닭·오리는 무항생제 꼬리표. */
export function RecipeCards({ order = ['chicken', 'duck', 'pork', 'beef'], style }: { order?: readonly MagazineRecipeKey[]; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 10, rowGap: 18, ...style }}>
      {order.map((k) => {
        const c = magazineRecipeCard(k)
        const tag = ANTIBIOTIC_FREE_TAG[k]
        return (
          <Link key={k} href={c.href} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, color: '#141414', textDecoration: 'none' }}>
            <span style={{ position: 'relative', display: 'block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.img} alt="" width={400} height={400} loading="lazy" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 4, background: '#F6F4F5', display: 'block' }} />
              {tag && (
                <span style={{ position: 'absolute', left: 8, top: 8, padding: '4px 8px', borderRadius: 2, background: '#1D3B2F', color: '#FFFFFF', fontSize: 12, fontWeight: 800 }}>{tag}</span>
              )}
            </span>
            <strong className="d" style={{ marginTop: 10, fontSize: 19, fontWeight: 400, lineHeight: 1.2 }}>
              {c.name}
            </strong>
            <span style={{ marginTop: 4, fontSize: 14, lineHeight: 1.4, color: '#595959' }}>{c.sub}</span>
            <span style={{ marginTop: 6, fontSize: 16, fontWeight: 800 }}>{c.price}</span>
          </Link>
        )
      })}
    </div>
  )
}

/** 앱 정기배송 한 줄 — 가게 목록의 AppLine 과 같은 말(웹엔 '맞춤'을 쓰지 않는다). */
export function AppLine({ style }: { style?: React.CSSProperties }) {
  return (
    <Link
      href="/app"
      style={{ minHeight: 56, borderTop: '1px solid #E5E5E5', borderBottom: '1px solid #E5E5E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 17, color: '#141414', textDecoration: 'none', ...style }}
    >
      <span>
        매일 먹인다면 <strong style={{ fontWeight: 800, color: '#1D3B2F' }}>앱 정기배송 {SUBSCRIPTION_DISCOUNT_PCT}% 할인</strong>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  )
}
