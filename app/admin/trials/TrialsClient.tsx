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
    const who = `${c.name ?? '(이름 없음)'} ${c.email ?? ''}`.trim()
    // 찍기는 돈이 걸린 동작 — 대상·조건을 확인받는다(취소에만 있던 확인창, 9차 점검).
    if (!window.confirm(`${who} 님에게 서포터즈 도장을 찍을까요?\n(${candidateMeta(c)})\n\n다음 결제부터 100원 4회 → 반값 4회 → 정상가로 진행돼요.\n찍으면 고객에게 "서포터즈 선정 · 카드 등록" 앱 알림이 바로 가요.`)) return
    setBusy(true)
    setMsg(null)
    try {
      const send = (force: boolean) =>
        fetch('/api/admin/trials', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId: c.id, note: c.name ?? '', force }),
        })
      let r = await send(false)
      let j = await r.json()
      // 결제 이력이 있는 기존 고객 — 서버가 막았다. 정말 맞는지 한 번 더 묻고 force 로만.
      if (r.status === 409 && j.code === 'HAS_PAID_HISTORY') {
        if (!window.confirm(`⚠️ ${who} 님은 이미 결제한 박스가 있는 고객이에요(${candidateMeta(c)}).\n찍으면 다음 결제부터 100원이 돼요. 정말 찍을까요?`)) return
        r = await send(true)
        j = await r.json()
      }
      if (!r.ok) {
        setMsg(j.message ?? '실패했어요')
        return
      }
      setCandidates([])
      setQ('')
      // 도장 알림 결과(보냄 / 조용한 시간 / 기기 없음 …) — 못 갔으면 직접 연락하도록.
      const pushLabel = (j as { push?: { label?: string } }).push?.label ?? ''
      setMsg(`${c.name ?? c.email ?? '고객'} 님에게 도장을 찍었어요. 다음 결제부터 100원이에요. ${pushLabel}`.trim())
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
      if (!r.ok) {
        // 실패가 무반응이면 취소된 줄 안다(9차 점검).
        const j = await r.json().catch(() => ({}))
        setMsg((j as { message?: string }).message ?? '취소하지 못했어요')
        return
      }
      setMsg('도장을 취소했어요. 다음 결제부터 정상 규칙으로 돌아가요.')
      await refresh()
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
                <span className="min-w-0 text-[14px]">
                  {c.name ?? '(이름 없음)'} <span className="text-[color:var(--adminui-mute)]">{c.email ?? '이메일 없음(카카오)'}</span>
                  <span className="block text-[12px] text-[color:var(--adminui-mute)]">{candidateMeta(c)}</span>
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
