'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * '처리함' 버튼 + 메모 — 경보 하나를 닫는다(PATCH /api/admin/alerts/[id]).
 * 실패하면 그 자리에 이유를 보인다(조용히 닫힌 것처럼 보이지 않게). 성공하면 목록을 새로 그린다.
 * preview 가 true 면(디자인 점검 화면) 서버로 보내지 않는다.
 */
export default function ResolveAlertButton({ id, preview = false }: { id: string; preview?: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (preview) {
      setErr('미리보기 화면이라 저장하지 않아요')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/alerts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || null }),
      })
      const body = (await res.json().catch(() => null)) as { message?: string } | null
      if (!res.ok) {
        setErr(body?.message ?? `저장하지 못했어요(${res.status})`)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setErr('네트워크 오류 — 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-[12px] font-bold text-primary-foreground transition hover:opacity-90"
      >
        처리함
      </button>
    )
  }
  return (
    <div className="grid w-full gap-1.5">
      <label className="text-[11.5px] font-semibold text-muted-foreground" htmlFor={`note-${id}`}>
        처리 메모(선택) — 무엇을 했는지
      </label>
      <textarea
        id={`note-${id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="예: 토스에서 환불 확인함 · 고객에게 카톡 안내"
        className="w-full rounded-md border border-input bg-card px-2.5 py-2 text-[13px] outline-none focus:border-ring"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-[12px] font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? '저장 중…' : '처리함으로 저장'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="inline-flex min-h-9 items-center rounded-md border border-border bg-card px-3 text-[12px] font-semibold text-muted-foreground"
        >
          취소
        </button>
        {err && (
          <span role="alert" className="text-[12px] font-semibold text-destructive">
            {err}
          </span>
        )}
      </div>
    </div>
  )
}
