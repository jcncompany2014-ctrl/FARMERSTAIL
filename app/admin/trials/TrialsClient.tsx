'use client'

/**
 * 체험단 도장 화면 — 검색해서 찍고, 진행 상황·회차 일정·가격 인상 동의를 보고, 취소한다.
 * (docs/TRIAL_PROGRAM_2026_10.md v2 · 가격 3단: 100원×N → 반값×N → 정상)
 *
 * ★2026-10-14 A1 — 사람마다 회차 일정표(결제일·금액)·다음 가격 전환일·인상별 동의 상태와 '동의 받음 기록'·'기록 취소'.
 *   일정·금액은 서버가 정본 함수로 펼친 값(lib/payments/charge-projection → lib/admin/trial-plan)을 그대로 그린다.
 *   청구 크론은 인상 회차에 동의 기록이 없으면 청구하지 않고 보류한다 — 기록은 돈이 나가게 하는 스위치라 확인창을 띄운다.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminCard, AdminButton, Badge, SectionTitle } from '@/components/admin/ui'
import { weekdayKo } from '@/lib/shipping-schedule'
import {
  CONSENT_CHANNELS,
  CONSENT_CHANNEL_LABEL,
  CONSENT_RED_DAYS,
  PRICE_PHASE_LABEL,
  type ConsentChannel,
  type PriceRise,
} from '@/lib/payments/price-rise'
import type { RiseView, TrialPlanView } from '@/lib/admin/trial-plan'

export type TrialRow = {
  user_id: string
  cheap_remaining: number
  half_remaining: number
  cheap_price: number
  half_rate: number
  note: string
  created_at: string
  profile: { name: string | null; email: string | null }
  /** 이 사람의 정기배송(진행 중·일시정지) — 강아지 이름 표시용. */
  subs?: Array<{ id: string; status: string; dogName: string | null }>
  /** 회차 일정·동의 상태 — 조회 실패면 null. */
  plan?: TrialPlanView | null
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

/** 'yyyy-mm-dd' → '10/20(화)' · 올해가 아니면 '2027.1.23(토)'. 문자열 그대로 — 기기 시간대를 타지 않는다. */
function day(iso: string, today: string): string {
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  const head = iso.slice(0, 4) === today.slice(0, 4) ? `${m}/${d}` : `${iso.slice(0, 4)}.${m}.${d}`
  return `${head}(${weekdayKo(iso)})`
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

function riseStatusBadge(r: RiseView, today: string) {
  if (r.status === 'recorded' && r.consent) {
    const ch = CONSENT_CHANNEL_LABEL[r.consent.channel as ConsentChannel] ?? r.consent.channel
    return <Badge tone="green">동의 받음 · {day(r.consent.consentedOn, today)} · {ch}</Badge>
  }
  if (r.status === 'urgent') return <Badge tone="red">아직 동의 없음 — 이대로면 청구 보류</Badge>
  if (r.status === 'waiting') return <Badge tone="amber">아직 동의 없음</Badge>
  return <Badge tone="neutral">해당 회차 없음</Badge>
}

export default function TrialsClient({
  initial,
  today,
  planLoaded = true,
  recorderNames = {},
}: {
  initial: TrialRow[]
  today: string
  planLoaded?: boolean
  /** 동의를 기록한 관리자 id → 이름(증빙 표시용). */
  recorderNames?: Record<string, string>
}) {
  const router = useRouter()
  const rows = initial
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  /** 열려 있는 동의 기록 입력 칸 — `${userId}:${rise}`. */
  const [formKey, setFormKey] = useState<string | null>(null)
  const [form, setForm] = useState<{ consentedOn: string; channel: ConsentChannel; memo: string }>({
    consentedOn: today,
    channel: 'instagram_dm',
    memo: '',
  })

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
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function unstamp(t: TrialRow) {
    if (!window.confirm(`${t.profile.name ?? t.profile.email ?? t.user_id} 님의 체험단을 취소할까요?\n다음 결제부터 정상 규칙으로 돌아가요.\n(가격이 바로 오르니, 고객에게 먼저 알리고 동의를 받아 두세요.)`)) return
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
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  function openForm(userId: string, rise: PriceRise) {
    setFormKey(`${userId}:${rise}`)
    setForm({ consentedOn: today, channel: 'instagram_dm', memo: '' })
    setMsg(null)
  }

  async function recordConsent(t: TrialRow, r: RiseView) {
    const who = t.profile.name ?? t.profile.email ?? '이 고객'
    const ch = CONSENT_CHANNEL_LABEL[form.channel]
    const after = r.round
      ? `\n\n기록하면 ${day(r.round.chargeIso, today)} 결제가 ${won(r.round.amount)}으로 진행돼요.`
      : ''
    if (!window.confirm(`${who} 님의 '${r.label}' 가격 인상 동의를 기록할까요?\n동의한 날 ${form.consentedOn} · ${ch}${form.memo ? `\n메모: ${form.memo}` : ''}${after}`)) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/trials/consents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: t.user_id, rise: r.rise, consentedOn: form.consentedOn, channel: form.channel, memo: form.memo }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg((j as { message?: string }).message ?? '기록하지 못했어요')
        return
      }
      setFormKey(null)
      setMsg(`${who} 님의 '${r.label}' 동의를 기록했어요.`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function revokeConsent(t: TrialRow, r: RiseView) {
    if (!r.consent) return
    const who = t.profile.name ?? t.profile.email ?? '이 고객'
    const hold = r.round ? `\n취소하면 ${day(r.round.chargeIso, today)} 인상 회차는 다시 기록할 때까지 청구되지 않고 보류돼요.` : ''
    // prompt 가 확인창을 겸한다 — 취소를 누르면 아무것도 안 한다.
    const reason = window.prompt(`${who} 님의 '${r.label}' 동의 기록을 취소할까요?${hold}\n\n취소 이유(선택):`, '')
    if (reason === null) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/trials/consents', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: r.consent.id, reason }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg((j as { message?: string }).message ?? '취소하지 못했어요')
        return
      }
      setMsg(`${who} 님의 '${r.label}' 동의 기록을 취소했어요.`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <AdminCard>
        <SectionTitle title="도장 찍기" />
        <p className="text-[13px] text-muted-foreground">
          선발자가 <b className="text-foreground">가입을 마친 뒤</b>, 이메일이나 이름으로 찾아 도장을 찍어 주세요. 다음 결제부터 100원×4 → 반값×4 → 정상가로 자동 진행돼요.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="이메일 또는 이름"
            className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-[14px]"
          />
          <AdminButton onClick={search} disabled={busy}>
            검색
          </AdminButton>
        </div>
        {candidates.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {candidates.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="min-w-0 text-[14px]">
                  {c.name ?? '(이름 없음)'} <span className="text-muted-foreground">{c.email ?? '이메일 없음(카카오)'}</span>
                  <span className="block text-[12px] text-muted-foreground">{candidateMeta(c)}</span>
                </span>
                <AdminButton onClick={() => stamp(c)} disabled={busy}>
                  체험단 도장
                </AdminButton>
              </li>
            ))}
          </ul>
        )}
        {msg && (
          <p role="status" className="mt-3 text-[13px] font-semibold text-foreground">
            {msg}
          </p>
        )}
      </AdminCard>

      <AdminCard>
        <SectionTitle
          title={`체험단 ${rows.length}명`}
          desc={`가격이 오르는 회차(100원→반값 첫 회 · 반값→정가 첫 회)는 고객 동의 기록이 있어야 청구돼요. 없으면 그 회차를 청구하지 않고 보류해요. 전환 ${CONSENT_RED_DAYS}일 전부터 빨간색이에요.`}
        />
        {rows.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">아직 없어요. 위에서 검색해 도장을 찍으면 여기 나와요.</p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((t) => {
              const plan = t.plan ?? null
              const dogs = (t.subs ?? []).map((s) => s.dogName).filter(Boolean).join(', ')
              const paused = (t.subs ?? []).some((s) => s.status === 'paused') && !(t.subs ?? []).some((s) => s.status === 'active')
              return (
                <li key={t.user_id} className="rounded-lg border border-border px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 text-[14px]">
                      <b className="text-foreground">{t.profile.name ?? '(이름 없음)'}</b>
                      {dogs && <span className="text-muted-foreground"> · {dogs}</span>}
                      <span className="block truncate text-[12px] text-muted-foreground">{t.profile.email ?? ''}</span>
                    </span>
                    {phaseBadge(t)}
                  </div>

                  {plan && plan.next ? (
                    <p className="mt-2 text-[13px] text-foreground">
                      다음 결제 <b>{day(plan.next.chargeIso, today)}</b> {won(plan.next.chargeAmount)}
                      {plan.next.chargeAmount !== plan.next.listAmount && (
                        <span className="text-muted-foreground"> (정가 {won(plan.next.listAmount)})</span>
                      )}
                      <span className="text-muted-foreground"> · 발송 {day(plan.next.shipIso, today)}</span>
                      {plan.nextRiseIso && (
                        <span className="block text-[12px] text-muted-foreground">
                          다음 가격 전환 <b className="text-foreground">{day(plan.nextRiseIso, today)}</b>
                        </span>
                      )}
                    </p>
                  ) : planLoaded ? (
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      {paused ? '정기배송이 일시정지라 결제 일정이 없어요.' : '아직 정기배송(카드 등록) 전이라 결제 일정이 없어요.'}
                    </p>
                  ) : null}

                  {plan && (
                    <div className="mt-3 grid gap-2">
                      {plan.rises
                        .filter((r) => r.round || r.consent)
                        .map((r) => {
                          const key = `${t.user_id}:${r.rise}`
                          const red = r.status === 'urgent'
                          return (
                            <div
                              key={r.rise}
                              className={`rounded-lg border px-3 py-2 ${red ? 'border-red-300 bg-red-50' : 'border-border bg-secondary'}`}
                            >
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className={`text-[13px] font-bold ${red ? 'text-red-700' : 'text-foreground'}`}>
                                  {r.label}
                                </span>
                                {r.round && (
                                  <span className="text-[12px] text-muted-foreground">
                                    {day(r.round.chargeIso, today)} 결제
                                    {r.round.prevAmount != null ? ` · ${won(r.round.prevAmount)} → ` : ' · '}
                                    <b className="text-foreground">{won(r.round.amount)}</b>
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                {riseStatusBadge(r, today)}
                                {r.consent && (
                                  <span className="text-[12px] text-muted-foreground">
                                    기록 {(r.consent.recordedBy && recorderNames[r.consent.recordedBy]) || '관리자'}
                                  </span>
                                )}
                                {r.consent?.memo && (
                                  <span className="text-[12px] text-muted-foreground">메모: {r.consent.memo}</span>
                                )}
                                <span className="ml-auto flex gap-2">
                                  {r.consent ? (
                                    <AdminButton variant="ghost" onClick={() => revokeConsent(t, r)} disabled={busy}>
                                      기록 취소
                                    </AdminButton>
                                  ) : (
                                    <AdminButton onClick={() => openForm(t.user_id, r.rise)} disabled={busy}>
                                      동의 받음 기록
                                    </AdminButton>
                                  )}
                                </span>
                              </div>
                              {formKey === key && !r.consent && (
                                <div className="mt-2 grid gap-2 rounded-lg border border-border bg-card p-3">
                                  <label className="grid gap-1 text-[12px] font-semibold text-muted-foreground">
                                    동의한 날
                                    <input
                                      type="date"
                                      value={form.consentedOn}
                                      max={today}
                                      onChange={(e) => setForm((f) => ({ ...f, consentedOn: e.target.value }))}
                                      className="rounded-lg border border-input bg-card px-3 py-2 text-[14px] text-foreground"
                                    />
                                  </label>
                                  <label className="grid gap-1 text-[12px] font-semibold text-muted-foreground">
                                    받은 경로
                                    <select
                                      value={form.channel}
                                      onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as ConsentChannel }))}
                                      className="rounded-lg border border-input bg-card px-3 py-2 text-[14px] text-foreground"
                                    >
                                      {CONSENT_CHANNELS.map((c) => (
                                        <option key={c} value={c}>
                                          {CONSENT_CHANNEL_LABEL[c]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="grid gap-1 text-[12px] font-semibold text-muted-foreground">
                                    메모(선택)
                                    <input
                                      value={form.memo}
                                      maxLength={500}
                                      onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                                      placeholder="예: DM 으로 반값 금액 안내 후 '좋아요' 답장"
                                      className="rounded-lg border border-input bg-card px-3 py-2 text-[14px] text-foreground"
                                    />
                                  </label>
                                  <div className="flex gap-2">
                                    <AdminButton onClick={() => recordConsent(t, r)} disabled={busy}>
                                      기록하기
                                    </AdminButton>
                                    <AdminButton variant="ghost" onClick={() => setFormKey(null)} disabled={busy}>
                                      닫기
                                    </AdminButton>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}

                  {plan && plan.schedule.length > 0 && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[12px] font-bold text-foreground">
                        회차 일정표 {plan.schedule.length}회 보기
                      </summary>
                      <ol className="mt-2 grid gap-1">
                        {plan.schedule.map((s) => (
                          <li
                            key={`${s.subId}-${s.shipIso}`}
                            className="flex flex-wrap items-baseline justify-between gap-x-2 border-b border-border py-1 text-[12px] last:border-b-0"
                          >
                            <span className="text-foreground">
                              {day(s.chargeIso, today)} 결제
                              <span className="text-muted-foreground"> · 발송 {day(s.shipIso, today)}</span>
                            </span>
                            <span className="flex items-baseline gap-1.5">
                              {s.rise && (
                                <span className={`font-bold ${s.held ? 'text-red-700' : 'text-emerald-700'}`}>
                                  {s.held ? '인상 · 동의 필요' : '인상 · 동의 받음'}
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                {s.phase === 'full' ? PRICE_PHASE_LABEL.full : `${PRICE_PHASE_LABEL[s.phase]} 구간`}
                              </span>
                              <b className="tabular-nums text-foreground">{won(s.chargeAmount)}</b>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}

                  <div className="mt-3 flex justify-end">
                    <AdminButton variant="ghost" onClick={() => unstamp(t)} disabled={busy}>
                      도장 취소
                    </AdminButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </AdminCard>
    </div>
  )
}
