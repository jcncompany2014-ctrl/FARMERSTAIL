import Link from 'next/link'

/**
 * AdminPagination — 관리자 리스트 페이지 공용 페이지네이션 (server component).
 *
 * SSR 페이지에서 `?page=N` 쿼리스트링 기반으로 동작. 기존 status/q 등
 * 필터 파라미터는 `params` 로 받아 보존한다. totalPages <= 1 이면 렌더 안 함.
 *
 * @example
 *   <AdminPagination
 *     page={page} totalPages={totalPages} basePath="/admin/orders"
 *     params={{ status: status !== 'all' ? status : undefined, q: q || undefined }}
 *   />
 */
export default function AdminPagination({
  page,
  totalPages,
  basePath,
  params = {},
  total,
}: {
  page: number
  totalPages: number
  basePath: string
  params?: Record<string, string | undefined>
  /** 전체 건수(옵션) — 표시용 "N건 중 …". */
  total?: number
}) {
  if (totalPages <= 1) {
    // 단일 페이지라도 전체 건수는 보여주면 운영자가 규모를 안다.
    if (total != null) {
      return (
        <p className="mt-4 text-center text-[11px] text-muted">
          전체 {total.toLocaleString()}건
        </p>
      )
    }
    return null
  }

  const hrefFor = (p: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') sp.set(k, v)
    }
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `${basePath}${qs ? `?${qs}` : ''}`
  }

  const btn =
    'inline-flex items-center justify-center min-w-[72px] px-3 py-1.5 rounded-full text-xs font-semibold border transition'
  const enabled = 'bg-white border-rule text-ink hover:border-terracotta hover:text-terracotta'
  const disabled = 'bg-bg border-rule text-muted/50 cursor-not-allowed pointer-events-none'

  return (
    <div className="mt-5 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={`${btn} ${enabled}`}>
          ← 이전
        </Link>
      ) : (
        <span className={`${btn} ${disabled}`} aria-disabled>
          ← 이전
        </span>
      )}

      <span className="text-xs text-muted tabular-nums">
        <span className="font-bold text-ink">{page}</span> / {totalPages}
        {total != null && (
          <span className="ml-2 text-muted/80">· 전체 {total.toLocaleString()}건</span>
        )}
      </span>

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={`${btn} ${enabled}`}>
          다음 →
        </Link>
      ) : (
        <span className={`${btn} ${disabled}`} aria-disabled>
          다음 →
        </span>
      )}
    </div>
  )
}
