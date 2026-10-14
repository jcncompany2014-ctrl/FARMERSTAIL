'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquareText, Check, Trash2, CalendarClock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { addDaysKst } from '@/lib/datetime-kst'
import type { NoteView } from './_types'

/**
 * 문의 기록(카톡·전화) — 고객별 시간순 메모 (2026-10-14 C2, 규칙254).
 *
 * 카톡 채널로 온 문의가 어드민에 흔적 0이었다. 날짜·내용·'다시 볼 날'·처리 여부를 한 줄씩 쌓는다.
 * '다시 볼 날'이 오늘 이하이고 처리 안 됐으면 어드민 홈 '오늘 할 일'에 뜬다(표 admin_customer_notes).
 * 쓰기는 /api/admin/users/[id]/notes(관리자 확인 → service_role). 고객은 이 기록을 볼 수 없다.
 */

const CHANNELS: Array<{ value: string; label: string }> = [
  { value: 'kakao', label: '카톡' },
  { value: 'phone', label: '전화' },
  { value: 'instagram', label: '인스타' },
  { value: 'email', label: '메일' },
  { value: 'other', label: '기타' },
]

const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(CHANNELS.map((c) => [c.value, c.label]))

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${y}.${m}.${d}`
}

export default function NotesPanel({
  userId,
  notes,
  today,
  demo = false,
}: {
  userId: string
  notes: NoteView[]
  today: string
  /** 디자인 점검 화면 — 버튼은 보이되 저장하지 않는다. */
  demo?: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [body, setBody] = useState('')
  const [notedOn, setNotedOn] = useState(today)
  const [followUp, setFollowUp] = useState<string>('')
  const [channel, setChannel] = useState('kakao')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function call(method: 'POST' | 'PATCH' | 'DELETE', payload: Record<string, unknown>): Promise<boolean> {
    if (demo) {
      toast.info('점검 화면이라 저장하지 않아요')
      return false
    }
    const res = await fetch(`/api/admin/users/${userId}/notes`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { message?: string } | null
      toast.error(j?.message ?? '저장하지 못했어요')
      return false
    }
    router.refresh()
    return true
  }

  async function add() {
    if (!body.trim()) {
      toast.error('내용을 적어 주세요')
      return
    }
    setSaving(true)
    const ok = await call('POST', {
      body: body.trim(),
      notedOn,
      followUpOn: followUp || null,
      channel,
    })
    setSaving(false)
    if (ok) {
      setBody('')
      setFollowUp('')
      setNotedOn(today)
      toast.success('기록했어요')
    }
  }

  async function toggleDone(n: NoteView) {
    setBusyId(n.id)
    await call('PATCH', { noteId: n.id, done: !n.done })
    setBusyId(null)
  }

  async function moveFollowUp(n: NoteView, days: number | null) {
    setBusyId(n.id)
    await call('PATCH', { noteId: n.id, followUpOn: days == null ? null : addDaysKst(today, days) })
    setBusyId(null)
  }

  async function remove(n: NoteView) {
    if (!window.confirm('이 기록을 지울까요? 되돌릴 수 없어요.')) return
    setBusyId(n.id)
    await call('DELETE', { noteId: n.id })
    setBusyId(null)
  }

  const open = notes.filter((n) => !n.done && n.followUpOn && n.followUpOn <= today).length

  return (
    <div>
      {/* 새 기록 */}
      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setChannel(c.value)}
              aria-pressed={channel === c.value}
              className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${
                channel === c.value
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 2000))}
          rows={3}
          placeholder="예: 땅콩 배송일 문의 — 다음 박스 화요일 발송 안내함"
          className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:border-input focus:outline-none"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[12px] font-semibold text-muted-foreground">
            문의 날짜
            <input
              type="date"
              value={notedOn}
              max={today}
              onChange={(e) => setNotedOn(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-card px-2 py-1.5 text-[14px] text-foreground"
            />
          </label>
          <label className="text-[12px] font-semibold text-muted-foreground">
            다시 볼 날
            <input
              type="date"
              value={followUp}
              min={today}
              onChange={(e) => setFollowUp(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-card px-2 py-1.5 text-[14px] text-foreground"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">빠르게:</span>
          {[1, 3, 7].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFollowUp(addDaysKst(today, d))}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[12px] font-semibold text-foreground"
            >
              {d === 1 ? '내일' : `${d}일 뒤`}
            </button>
          ))}
          {followUp && (
            <button
              type="button"
              onClick={() => setFollowUp('')}
              className="rounded-full px-2 py-1 text-[12px] font-semibold text-muted-foreground underline"
            >
              안 봐도 됨
            </button>
          )}
          <button
            type="button"
            onClick={add}
            disabled={saving}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-1.5 text-[13px] font-bold text-background disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />}
            기록하기
          </button>
        </div>
      </div>

      {/* 시간순 기록 */}
      {open > 0 && (
        <p className="mt-3 text-[13px] font-bold text-amber-700">오늘 다시 볼 기록 {open}건</p>
      )}
      {notes.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">아직 기록이 없어요. 카톡으로 온 문의를 여기에 남겨 두세요.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notes.map((n) => {
            const due = !n.done && !!n.followUpOn && n.followUpOn <= today
            return (
              <li
                key={n.id}
                className={`rounded-lg border p-3 ${
                  n.done ? 'border-border bg-card opacity-60' : due ? 'border-amber-300 bg-amber-50' : 'border-border bg-card'
                }`}
              >
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <MessageSquareText className="size-3.5" strokeWidth={2} />
                  <span className="font-bold text-foreground">{shortDate(n.notedOn)}</span>
                  <span>{CHANNEL_LABEL[n.channel] ?? n.channel}</span>
                  {n.done ? (
                    <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">처리함</span>
                  ) : n.followUpOn ? (
                    <span
                      className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        due ? 'bg-amber-200 text-amber-900' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      <CalendarClock className="size-3" strokeWidth={2.2} />
                      {due ? '오늘 볼 것' : `${shortDate(n.followUpOn)} 다시 보기`}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-keep text-[14px] leading-relaxed text-foreground">{n.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === n.id}
                    onClick={() => toggleDone(n)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[12px] font-bold text-foreground disabled:opacity-50"
                  >
                    <Check className="size-3.5" strokeWidth={2.4} />
                    {n.done ? '다시 열기' : '처리함'}
                  </button>
                  {!n.done && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === n.id}
                        onClick={() => moveFollowUp(n, 3)}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-[12px] font-semibold text-muted-foreground disabled:opacity-50"
                      >
                        3일 뒤 다시
                      </button>
                      {n.followUpOn && (
                        <button
                          type="button"
                          disabled={busyId === n.id}
                          onClick={() => moveFollowUp(n, null)}
                          className="rounded-full px-2 py-1 text-[12px] font-semibold text-muted-foreground underline disabled:opacity-50"
                        >
                          다시 안 봄
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    disabled={busyId === n.id}
                    onClick={() => remove(n)}
                    aria-label="기록 지우기"
                    className="ml-auto rounded-full p-1.5 text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
