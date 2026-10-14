'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EXTERNAL_KEYS, describeKeyExpiry, type KeyExpiryState } from '@/lib/admin/key-expiry'

/**
 * 외부 키 만료 — 설정일 적는 칸 (2026-10-14 어드민 B4, 규칙252).
 * 키 값은 여기 없다(받지도 보내지도 않는다) — 날짜만. 만료 7·3·1일 전에 아침 브리핑과 경보함에 뜬다.
 */
export default function KeyExpiryPanel({
  states,
  toss,
  preview = false,
}: {
  states: readonly KeyExpiryState[]
  toss: { live: boolean; title: string }
  preview?: boolean
}) {
  return (
    <div className="grid gap-2.5">
      {states.map((s) => (
        <KeyRow key={s.name} s={s} preview={preview} />
      ))}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-bold">토스 결제 키</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
              toss.live ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {toss.live ? '라이브' : '라이브 전환 안 됨'}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
          {toss.title} — 만료는 없어요. 심사가 끝나 운영 키로 바꾸면 &lsquo;라이브&rsquo;로 바뀌어요(키 값은 화면에 내지 않아요).
        </p>
      </div>
    </div>
  )
}

const TONE: Record<KeyExpiryState['tone'], string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-destructive/10 text-destructive',
  unknown: 'bg-secondary text-muted-foreground',
}

const TONE_LABEL: Record<KeyExpiryState['tone'], string> = {
  ok: '여유',
  warn: '곧 만료',
  bad: '만료',
  unknown: '만료일 모름',
}

function KeyRow({ s, preview }: { s: KeyExpiryState; preview: boolean }) {
  const router = useRouter()
  const def = EXTERNAL_KEYS[s.name]
  const [setOn, setSetOn] = useState(s.setOn ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(setOn)) {
      setMsg({ ok: false, text: '날짜를 골라 주세요' })
      return
    }
    if (preview) {
      setMsg({ ok: false, text: '미리보기 화면이라 저장하지 않아요' })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/key-expiry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: s.name, setOn }),
      })
      const body = (await res.json().catch(() => null)) as { message?: string; expiresOn?: string } | null
      if (!res.ok) {
        setMsg({ ok: false, text: body?.message ?? `저장하지 못했어요(${res.status})` })
        return
      }
      setMsg({ ok: true, text: `저장했어요 — 만료 ${body?.expiresOn ?? ''}` })
      router.refresh()
    } catch {
      setMsg({ ok: false, text: '네트워크 오류 — 다시 시도해 주세요' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-bold">{s.label}</p>
        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${TONE[s.tone]}`}>{TONE_LABEL[s.tone]}</span>
      </div>
      <p className="mt-1 text-[12.5px] font-semibold leading-snug">{describeKeyExpiry(s)}</p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
        들어 있는 곳: {def.where} · 수명 {def.lifetimeDays}일 · {def.renew}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[11.5px] font-semibold text-muted-foreground">
          새로 받은 날(설정일)
          <input
            type="date"
            value={setOn}
            onChange={(e) => setSetOn(e.target.value)}
            className="min-h-9 rounded-md border border-input bg-card px-2 text-[13px] text-foreground outline-none focus:border-ring"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-[12px] font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? '저장 중…' : '설정일 저장'}
        </button>
        {msg && (
          <span role={msg.ok ? 'status' : 'alert'} className={`text-[12px] font-semibold ${msg.ok ? 'text-emerald-700' : 'text-destructive'}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  )
}
