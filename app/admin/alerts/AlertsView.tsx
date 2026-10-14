import Link from 'next/link'
import { formatKstShortDateTime } from '@/lib/datetime-kst'
import type { AlertView } from '@/lib/admin/alert-view'
import ResolveAlertButton from './ResolveAlertButton'

/**
 * 경보 목록 — 안 본 것(처리 전) 위, 처리한 것 아래(접힘). 각 경보에 '무엇을 하면 되나'·바로 가는 링크·'처리함'.
 * 서버 컴포넌트(처리함 버튼만 클라이언트). 색은 adminui 토큰.
 */
export default function AlertsView({ views, preview = false }: { views: readonly AlertView[]; preview?: boolean }) {
  const open = views.filter((v) => !v.resolvedAt)
  const done = views.filter((v) => !!v.resolvedAt)
  return (
    <div className="grid gap-3">
      {open.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-center">
          <p className="text-[14px] font-bold">처리할 경보가 없어요</p>
          <p className="mt-1 text-[12px] text-muted-foreground">사람 손이 필요한 일이 생기면 여기에 쌓여요.</p>
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {open.map((v) => (
            <AlertCard key={v.id} v={v} preview={preview} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details className="rounded-xl border border-border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-bold text-muted-foreground">
            처리한 경보 {done.length}건
          </summary>
          <ul className="grid gap-2 border-t border-border p-3">
            {done.map((v) => (
              <AlertCard key={v.id} v={v} preview={preview} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function AlertCard({ v, preview }: { v: AlertView; preview: boolean }) {
  const resolved = !!v.resolvedAt
  return (
    <li
      className={`rounded-xl border bg-card px-4 py-3.5 shadow-sm ${
        resolved ? 'border-border opacity-80' : v.severity === 'error' ? 'border-destructive/50' : 'border-amber-300'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
            resolved
              ? 'bg-secondary text-muted-foreground'
              : v.severity === 'error'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-100 text-amber-800'
          }`}
        >
          {resolved ? '처리함' : v.severity === 'error' ? '급함' : '확인'}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{v.groupLabel}</span>
        {v.occurrences > 1 && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-bold text-foreground">{v.occurrences}번</span>
        )}
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{formatKstShortDateTime(v.lastSeenAt)}</span>
      </div>
      <p className="mt-1.5 text-[14px] font-bold leading-snug">{v.message}</p>
      {v.action && !resolved && <p className="mt-1 text-[12.5px] leading-snug text-foreground">→ {v.action}</p>}
      {v.occurrences > 1 && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">처음 {formatKstShortDateTime(v.firstSeenAt)} · 24시간 안에 같은 대상으로 {v.occurrences}번</p>
      )}
      {v.facts.length > 0 && (
        <p className="mt-1 break-all font-mono text-[10.5px] leading-relaxed text-muted-foreground">
          {v.facts.map((f) => `${f.key}=${f.value}`).join(' · ')}
        </p>
      )}
      {resolved && (
        <p className="mt-1 text-[12px] text-muted-foreground">
          {formatKstShortDateTime(v.resolvedAt)} 처리{v.resolvedNote ? ` — ${v.resolvedNote}` : ''}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {v.links.map((l) => (
          <Link
            key={l.href + l.label}
            href={l.href}
            className="inline-flex min-h-9 items-center rounded-md border border-border bg-card px-2.5 text-[12px] font-bold text-primary transition hover:bg-secondary"
          >
            {l.label} →
          </Link>
        ))}
        {!resolved && (
          <div className="w-full sm:ml-auto sm:w-auto">
            <ResolveAlertButton id={v.id} preview={preview} />
          </div>
        )}
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">{v.kind}</p>
    </li>
  )
}
