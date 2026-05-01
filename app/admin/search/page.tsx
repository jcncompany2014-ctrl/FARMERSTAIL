import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

/**
 * /admin/search — 검색어 인사이트.
 *
 * popular_search_queries RPC 결과를 두 표로 노출:
 *   1) 인기 검색어 Top 30 — 어떤 키워드가 자주 검색되는지
 *   2) 결과 0건 검색어 — 재고가 없거나 카테고리 누락 신호
 *
 * 운영 의미:
 *   - 인기어 = 마케팅 콘텐츠 / SEO 키워드 / 컬렉션 큐레이션 단서
 *   - 0건어 = 신상품 도입 우선순위 / 카테고리 신설 신호
 */

type PopularRow = {
  q: string
  total_count: number
  zero_count: number
  avg_result: number
}

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await isAdmin(supabase, user))) redirect('/')

  const sp = await searchParams
  const days = Math.max(1, Math.min(90, Number(sp.days ?? '7') || 7))

  let popular: PopularRow[] = []
  try {
    const { data } = await supabase.rpc('popular_search_queries', {
      p_days: days,
      p_limit: 30,
    })
    popular = (data ?? []) as PopularRow[]
  } catch {
    /* 마이그레이션 미적용 */
  }

  const zeroResults = popular.filter((r) => r.zero_count > 0)
  const totalSearches = popular.reduce((s, r) => s + Number(r.total_count), 0)

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-['Archivo_Black'] text-2xl text-ink">
            SEARCH INSIGHTS
          </h1>
          <p className="text-sm text-muted mt-1">
            최근 {days}일 인기 검색어 + 0건 검색어
          </p>
        </div>
        <nav className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <a
              key={d}
              href={`/admin/search?days=${d}`}
              className={
                'px-3 py-1.5 rounded-full text-[12px] font-bold transition ' +
                (d === days
                  ? 'bg-ink text-white'
                  : 'bg-white text-text border border-rule hover:border-text')
              }
            >
              {d}일
            </a>
          ))}
        </nav>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <SummaryCard
          label="총 검색"
          value={`${totalSearches.toLocaleString()}건`}
          sub={`${popular.length}개 키워드`}
        />
        <SummaryCard
          label="결과 0건 키워드"
          value={`${zeroResults.length}개`}
          sub="재고/카테고리 신호"
          tone={zeroResults.length > 0 ? 'gold' : 'moss'}
        />
        <SummaryCard
          label="평균 결과 수"
          value={
            popular.length === 0
              ? '—'
              : `${(
                  popular.reduce((s, r) => s + Number(r.avg_result), 0) /
                  popular.length
                ).toFixed(1)}건`
          }
          sub="키워드별 평균"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 인기 검색어 Top 30 */}
        <section className="bg-white rounded-xl border border-rule overflow-hidden">
          <header className="px-5 py-4 border-b border-rule">
            <h2 className="text-[13px] font-bold text-ink">
              인기 검색어 Top {Math.min(30, popular.length)}
            </h2>
            <p className="text-[11px] text-muted mt-0.5">
              검색 횟수 기준 (소문자 정규화)
            </p>
          </header>
          {popular.length === 0 ? (
            <p className="text-center py-12 text-muted text-[13px]">
              아직 검색 데이터가 없어요
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="bg-bg-2 text-muted text-[10.5px] uppercase tracking-widest">
                <tr>
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">검색어</th>
                  <th className="text-right px-4 py-2">횟수</th>
                  <th className="text-right px-4 py-2">평균 결과</th>
                </tr>
              </thead>
              <tbody>
                {popular.map((row, idx) => (
                  <tr
                    key={row.q}
                    className="border-t border-rule hover:bg-bg/40"
                  >
                    <td className="px-4 py-2.5 text-muted tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-text">{row.q}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {Number(row.total_count).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                      {Number(row.avg_result).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 결과 0건 — inventory gap */}
        <section className="bg-white rounded-xl border border-rule overflow-hidden">
          <header className="px-5 py-4 border-b border-rule">
            <h2 className="text-[13px] font-bold text-ink">
              결과 0건 검색어
            </h2>
            <p className="text-[11px] text-muted mt-0.5">
              재고 / 카테고리 / SEO 단서. 우선순위로 보강 검토.
            </p>
          </header>
          {zeroResults.length === 0 ? (
            <p className="text-center py-12 text-moss text-[13px] font-bold">
              모든 검색어에 결과가 있어요 ✓
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {zeroResults.map((row) => (
                <li
                  key={row.q}
                  className="px-5 py-3 flex items-center justify-between"
                >
                  <span className="font-bold text-text">{row.q}</span>
                  <span
                    className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-md"
                    style={{ background: 'var(--gold)', color: 'var(--ink)' }}
                  >
                    {Number(row.zero_count)}회 / {Number(row.total_count)}회
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-6 text-[10.5px] text-muted leading-relaxed">
        검색어 로깅은 사용자 식별자 / IP 를 저장하지 않아요. 운영 통계 목적의
        익명 집계만 보존합니다.
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub: string
  tone?: 'moss' | 'gold' | 'sale'
}) {
  const color =
    tone === 'moss'
      ? 'var(--moss)'
      : tone === 'gold'
        ? 'var(--gold)'
        : tone === 'sale'
          ? 'var(--sale)'
          : 'var(--ink)'
  return (
    <div className="bg-white rounded-xl border border-rule p-4">
      <p className="text-[10.5px] font-bold text-muted uppercase tracking-widest">
        {label}
      </p>
      <p
        className="font-serif text-[20px] font-black mt-1.5 tabular-nums"
        style={{ color, letterSpacing: '-0.02em', lineHeight: 1.1 }}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-muted mt-1">{sub}</p>
    </div>
  )
}
