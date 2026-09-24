'use client'

/**
 * 체험단 도장 화면 — 검색해서 찍고, 진행 상황 보고, 취소한다.
 * (docs/TRIAL_PROGRAM_2026_10.md v2 · 가격 3단: 100원×N → 반값×N → 정상)
 */
import { useState } from 'react'
import { AdminCard, AdminButton, Badge, SectionTitle } from '@/components/admin/ui'

export type TrialRow = {
  user_id: string
  cheap_remaining: number
  half_remaining: number
  cheap_price: number
  half_rate: number
  note: string
  created_at: string
  profile: { name: string | null; email: string | null }
}

type Candidate = { id: string; name: string | null; email: string | null }

function phaseBadge(t: TrialRow) {
  if (t.cheap_remaining > 0) return <Badge tone="green">100원 구간 · {t.cheap_remaining}회 남음</Badge>
  if (t.half_remaining > 0) return <Badge tone="blue">반값 구간 · {t.half_remaining}회 남음</Badge>
  return <Badge tone="neutral">완료(정상가)</Badge>
}

export default function TrialsClient({ initial }: { initial: TrialRow[] }) {
  const [rows, setRows] = useState(initial)
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function refresh() {
    const r = await fetch('/api/admin/trials')
    const j = await r.json()
    if (j.ok) setRows(j.trials)
  }

  async function search() {
    if (!q.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/admin/trials?q=${encodeURIComponent(q.trim())}`)
      const j = await r.json()
      setCandidates(j.ok ? j.candidates : [])
      if (j.ok && j.candidates.length === 0) setMsg('검색 결과가 없어요 — 가입을 먼저 했는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  async function stamp(c: Candidate) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/trials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: c.id, note: c.name ?? '' }),
      })
      const j = await r.json()
      if (!r.ok) {
        setMsg(j.message ?? '실패했어요')
        return
      }
      setCandidates([])
      setQ('')
      setMsg(`${c.name ?? c.email ?? '고객'} 님에게 도장을 찍었어요. 다음 결제부터 100원이에요.`)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function unstamp(t: TrialRow) {
    if (!window.confirm(`${t.profile.name ?? t.profile.email ?? t.user_id} 님의 체험단을 취소할까요?\n다음 결제부터 정상 규칙으로 돌아가요.`)) return
    setBusy(true)
    try {
      const r = await fetch('/api/admin/trials', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: t.user_id }),
      })
      if (r.ok) await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <AdminCard>
        <SectionTitle title="도장 찍기" />
        <p className="text-[13px] text-[color:var(--adminui-mute)]">
          선발자가 <b>가입을 마친 뒤</b>, 이메일이나 이름으로 찾아 도장을 찍어 주세요. 다음 결제부터 100원×4 → 반값×4 → 정상가로 자동 진행돼요.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="이메일 또는 이름"
            className="flex-1 rounded border border-[color:var(--adminui-line)] bg-[color:var(--adminui-bg)] px-3 py-2 text-[14px]"
          />
          <AdminButton onClick={search} disabled={busy}>
            검색
          </AdminButton>
        </div>
        {candidates.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded border border-[color:var(--adminui-line)] px-3 py-2">
                <span className="text-[14px]">
                  {c.name ?? '(이름 없음)'} <span className="text-[color:var(--adminui-mute)]">{c.email ?? '이메일 없음(카카오)'}</span>
                </span>
                <AdminButton onClick={() => stamp(c)} disabled={busy}>
                  체험단 도장
                </AdminButton>
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="mt-3 text-[13px] text-[color:var(--adminui-mute)]">{msg}</p>}
      </AdminCard>

      <AdminCard>
        <SectionTitle title={`체험단 ${rows.length}명`} />
        {rows.length === 0 ? (
          <p className="text-[13px] text-[color:var(--adminui-mute)]">아직 없어요. 위에서 검색해 도장을 찍으면 여기 나와요.</p>
        ) : (
          <ul className="grid gap-2">
            {rows.map((t) => (
              <li key={t.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[color:var(--adminui-line)] px-3 py-2">
                <span className="text-[14px]">
                  {t.profile.name ?? '(이름 없음)'}{' '}
                  <span className="text-[color:var(--adminui-mute)]">{t.profile.email ?? ''}</span>
                </span>
                <span className="flex items-center gap-2">
                  {phaseBadge(t)}
                  <AdminButton onClick={() => unstamp(t)} disabled={busy}>
                    취소
                  </AdminButton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  )
}
