'use client'

/**
 * 이웃 할인 화면 — 지인·쓰레드 등에서 온 고객을 찾아 첫 박스 할인율을 붙이고, 목록을 본다.
 * (사장님 2026-09-27) 체험단 도장 화면과 같은 동선.
 */
import { useState } from 'react'
import { AdminCard, AdminButton, Badge, SectionTitle } from '@/components/admin/ui'
import { NEIGHBOR_RATES } from '@/lib/payments/neighbor'

export type NeighborRow = {
  user_id: string
  rate: number
  source: string
  note: string
  created_at: string
  redeemed_order_id: string | null
  redeemed_at: string | null
  profile: { name: string | null; email: string | null }
}

type Candidate = {
  id: string
  name: string | null
  email: string | null
  created_at?: string
  paidBoxes?: number
  subscriptionStatus?: string | null
}

const SUB_LABEL: Record<string, string> = { active: '구독 중', paused: '일시정지', cancelled: '해지' }

/** 후보 줄 설명 — 이름만 보고 엉뚱한 사람에게 누르지 않게(2026-09-28 9차 점검). */
function candidateMeta(c: Candidate): string {
  const sub = c.subscriptionStatus ? (SUB_LABEL[c.subscriptionStatus] ?? c.subscriptionStatus) : '구독 없음'
  const paid = c.paidBoxes ? `결제 ${c.paidBoxes}회` : '결제 없음'
  const joined = c.created_at ? `가입 ${c.created_at.slice(0, 10)}` : ''
  return [sub, paid, joined].filter(Boolean).join(' · ')
}

const pct = (r: number) => `${Math.round(r * 100)}%`

export default function NeighborsClient({ initial }: { initial: NeighborRow[] }) {
  const [rows, setRows] = useState(initial)
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [rate, setRate] = useState<number>(0.2)
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function refresh() {
    const r = await fetch('/api/admin/neighbors')
    const j = await r.json()
    if (j.ok) setRows(j.neighbors)
  }

  async function search() {
    if (!q.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch(`/api/admin/neighbors?q=${encodeURIComponent(q.trim())}`)
      const j = await r.json()
      setCandidates(j.ok ? j.candidates : [])
      if (j.ok && j.candidates.length === 0) setMsg('검색 결과가 없어요 — 가입을 먼저 했는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  async function give(c: Candidate) {
    const who = `${c.name ?? '(이름 없음)'} ${c.email ?? ''}`.trim()
    if (!window.confirm(`${who} 님에게 이웃 할인 ${pct(rate)}를 붙일까요?\n(${candidateMeta(c)})\n\n첫 결제 한 번에만 적용돼요.`)) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/neighbors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: c.id, rate, source: source.trim() }),
      })
      const j = await r.json()
      if (!r.ok) {
        setMsg(j.message ?? '실패했어요')
        return
      }
      setCandidates([])
      setQ('')
      setMsg(`${c.name ?? c.email ?? '고객'} 님에게 이웃 할인 ${pct(rate)}를 붙였어요. 첫 결제 한 번에만 적용돼요.`)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function remove(n: NeighborRow) {
    if (!window.confirm(`${n.profile.name ?? n.profile.email ?? n.user_id} 님의 이웃 할인을 뗄까요?`)) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch('/api/admin/neighbors', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: n.user_id }),
      })
      const j = await r.json()
      if (!r.ok) setMsg(j.message ?? '떼지 못했어요')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <AdminCard>
        <SectionTitle title="이웃 할인 붙이기" />
        <p className="text-[13px] text-[color:var(--adminui-mute)]">
          지인이나 쓰레드·인스타 DM 으로 온 분이 <b>가입을 마친 뒤</b>, 이메일이나 이름으로 찾아 붙여 주세요.
          첫 결제 한 번에만 적용되고, 등급 할인·이벤트 코드와 겹치면 더 큰 쪽 하나만 적용돼요. 서포터즈는 서포터즈 가격이 우선이에요.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="이메일 또는 이름"
            className="rounded border border-[color:var(--adminui-line)] bg-[color:var(--adminui-bg)] px-3 py-2 text-[14px]"
          />
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="rounded border border-[color:var(--adminui-line)] bg-[color:var(--adminui-bg)] px-3 py-2 text-[14px]"
            aria-label="할인율"
          >
            {NEIGHBOR_RATES.map((r) => (
              <option key={r} value={r}>
                첫 박스 {pct(r)} 할인
              </option>
            ))}
          </select>
          <AdminButton onClick={search} disabled={busy}>
            검색
          </AdminButton>
        </div>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="출처 메모 (예: 김OO 소개 / 쓰레드 9월 글 / 인스타 DM) — 나중에 어디서 온 분인지 보려고"
          maxLength={60}
          className="mt-2 w-full rounded border border-[color:var(--adminui-line)] bg-[color:var(--adminui-bg)] px-3 py-2 text-[13px]"
        />
        {candidates.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded border border-[color:var(--adminui-line)] px-3 py-2">
                <span className="min-w-0 text-[14px]">
                  {c.name ?? '(이름 없음)'} <span className="text-[color:var(--adminui-mute)]">{c.email ?? '이메일 없음(카카오)'}</span>
                  <span className="block text-[12px] text-[color:var(--adminui-mute)]">{candidateMeta(c)}</span>
                </span>
                {c.paidBoxes ? (
                  // 첫 박스 전용 — 결제 이력이 있으면 서버도 거부한다(9차 점검).
                  <span className="text-[12px] text-[color:var(--adminui-mute)]">첫 박스가 지나서 붙일 수 없어요</span>
                ) : (
                  <AdminButton onClick={() => give(c)} disabled={busy}>
                    이웃 할인 {pct(rate)} 붙이기
                  </AdminButton>
                )}
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="mt-3 text-[13px] text-[color:var(--adminui-mute)]">{msg}</p>}
      </AdminCard>

      <AdminCard>
        <SectionTitle title={`이웃 할인 ${rows.length}명`} />
        {rows.length === 0 ? (
          <p className="text-[13px] text-[color:var(--adminui-mute)]">아직 없어요. 위에서 검색해 붙이면 여기 나와요.</p>
        ) : (
          <ul className="grid gap-2">
            {rows.map((n) => (
              <li key={n.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[color:var(--adminui-line)] px-3 py-2">
                <span className="min-w-0 text-[14px]">
                  {n.profile.name ?? '(이름 없음)'}{' '}
                  <span className="text-[color:var(--adminui-mute)]">{n.profile.email ?? ''}</span>
                  {n.source && <span className="ml-2 text-[12px] text-[color:var(--adminui-mute)]">· {n.source}</span>}
                </span>
                <span className="flex items-center gap-2">
                  {n.redeemed_order_id ? (
                    <Badge tone="neutral">{pct(n.rate)} · 첫 박스에 썼어요</Badge>
                  ) : (
                    <Badge tone="green">{pct(n.rate)} · 첫 결제 대기</Badge>
                  )}
                  {!n.redeemed_order_id && (
                    <AdminButton onClick={() => remove(n)} disabled={busy}>
                      떼기
                    </AdminButton>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  )
}
