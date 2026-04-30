'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Syringe,
  Pill,
  Stethoscope,
  Scissors,
  Bell,
  Plus,
  Check,
  Trash2,
  X,
  Loader2,
  Calendar,
  AlarmClock,
  Pause,
  Play,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

export type ReminderType =
  | 'vaccine'
  | 'medication'
  | 'checkup'
  | 'grooming'
  | 'custom'

export type Reminder = {
  id: string
  type: ReminderType
  title: string
  notes: string | null
  next_date: string // YYYY-MM-DD
  recur_interval_days: number | null
  last_done_date: string | null
  enabled: boolean
  created_at: string
}

const TYPE_META: Record<
  ReminderType,
  {
    label: string
    Icon: LucideIcon
    color: string
    bg: string
  }
> = {
  vaccine: {
    label: '예방접종',
    Icon: Syringe,
    color: 'var(--terracotta)',
    bg: '#A0452E15',
  },
  medication: {
    label: '투약',
    Icon: Pill,
    color: 'var(--sale)',
    bg: '#B83A2E15',
  },
  checkup: {
    label: '건강검진',
    Icon: Stethoscope,
    color: 'var(--moss)',
    bg: '#6B7F3A15',
  },
  grooming: {
    label: '미용/목욕',
    Icon: Scissors,
    color: 'var(--gold)',
    bg: '#D4B87220',
  },
  custom: {
    label: '기타',
    Icon: Bell,
    color: 'var(--muted)',
    bg: '#8A766815',
  },
}

const RECUR_PRESETS: { label: string; days: number | null }[] = [
  { label: '반복 없음', days: null },
  { label: '1주', days: 7 },
  { label: '2주', days: 14 },
  { label: '한 달', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '1년', days: 365 },
]

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function daysUntil(iso: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / (24 * 3600 * 1000))
}

function formatNextDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function RemindersClient({
  dogId,
  dogName,
  initial,
}: {
  dogId: string
  dogName: string
  initial: Reminder[]
}) {
  const supabase = createClient()
  const toast = useToast()
  const [reminders, setReminders] = useState<Reminder[]>(initial)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [type, setType] = useState<ReminderType>('vaccine')
  const [title, setTitle] = useState('')
  const [nextDate, setNextDate] = useState(todayIso())
  const [recurDays, setRecurDays] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const { upcoming, overdue, paused } = useMemo(() => {
    const overdue: Reminder[] = []
    const upcoming: Reminder[] = []
    const paused: Reminder[] = []
    for (const r of reminders) {
      if (!r.enabled) paused.push(r)
      else if (daysUntil(r.next_date) < 0) overdue.push(r)
      else upcoming.push(r)
    }
    return { overdue, upcoming, paused }
  }, [reminders])

  function reset() {
    setType('vaccine')
    setTitle('')
    setNextDate(todayIso())
    setRecurDays(null)
    setNotes('')
    setErr(null)
  }

  async function add() {
    setErr(null)
    if (!title.trim()) {
      setErr('제목을 입력해 주세요')
      return
    }
    if (!nextDate) {
      setErr('날짜를 선택해 주세요')
      return
    }
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setErr('로그인이 필요합니다')
        return
      }
      const payload = {
        dog_id: dogId,
        user_id: user.id,
        type,
        title: title.trim(),
        notes: notes.trim() || null,
        next_date: nextDate,
        recur_interval_days: recurDays,
        enabled: true,
      }
      const { data, error } = await supabase
        .from('dog_reminders')
        .insert(payload)
        .select(
          'id, type, title, notes, next_date, recur_interval_days, last_done_date, enabled, created_at'
        )
        .single()
      if (error || !data) {
        setErr(error?.message ?? '저장 실패')
        return
      }
      setReminders((prev) =>
        [...prev, data as Reminder].sort((a, b) =>
          a.next_date.localeCompare(b.next_date)
        )
      )
      reset()
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  /** Mark a reminder as completed today. If recurring, bump next_date forward. */
  async function markDone(r: Reminder) {
    const today = todayIso()
    const nextNext = r.recur_interval_days
      ? addDaysIso(today, r.recur_interval_days)
      : r.next_date
    const nextEnabled = r.recur_interval_days ? true : false
    const { data, error } = await supabase
      .from('dog_reminders')
      .update({
        last_done_date: today,
        next_date: nextNext,
        enabled: nextEnabled,
      })
      .eq('id', r.id)
      .select(
        'id, type, title, notes, next_date, recur_interval_days, last_done_date, enabled, created_at'
      )
      .single()
    if (error || !data) {
      toast.error('업데이트 실패: ' + (error?.message ?? '알 수 없음'))
      return
    }
    setReminders((prev) =>
      prev
        .map((x) => (x.id === r.id ? (data as Reminder) : x))
        .sort((a, b) => a.next_date.localeCompare(b.next_date))
    )
  }

  async function toggle(r: Reminder) {
    const { data, error } = await supabase
      .from('dog_reminders')
      .update({ enabled: !r.enabled })
      .eq('id', r.id)
      .select(
        'id, type, title, notes, next_date, recur_interval_days, last_done_date, enabled, created_at'
      )
      .single()
    if (error || !data) return
    setReminders((prev) =>
      prev.map((x) => (x.id === r.id ? (data as Reminder) : x))
    )
  }

  async function remove(id: string) {
    if (!confirm('이 리마인더를 삭제할까요?')) return
    const { error } = await supabase.from('dog_reminders').delete().eq('id', id)
    if (error) {
      toast.error('삭제 실패: ' + error.message)
      return
    }
    setReminders((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <main className="pb-10">
      <section className="px-5 pt-6 pb-2">
        <Link
          href={`/dogs/${dogId}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← {dogName}
        </Link>
        <span className="kicker mt-3 block">Care Reminders</span>
        <h1 className="font-serif mt-1.5" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          리마인더
        </h1>
        <p className="text-[11px] text-muted mt-1">
          예방접종, 투약, 검진 일정을 놓치지 않게 챙겨드려요
        </p>
      </section>

      {/* 요약 */}
      <section className="px-5 mt-4">
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            label="지연"
            value={overdue.length}
            color="var(--sale)"
            Icon={AlarmClock}
          />
          <SummaryCard
            label="다가옴"
            value={upcoming.length}
            color="var(--terracotta)"
            Icon={Calendar}
          />
          <SummaryCard
            label="일시중지"
            value={paused.length}
            color="var(--muted)"
            Icon={Pause}
          />
        </div>
      </section>

      {/* 추가 버튼 / 폼 */}
      <section className="px-5 mt-3">
        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-ink text-bg text-[13px] font-bold active:scale-[0.98] transition"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            리마인더 추가
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-rule p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-black text-text">
                새 리마인더
              </h2>
              <button
                onClick={() => {
                  setAdding(false)
                  reset()
                }}
                className="w-7 h-7 rounded-full hover:bg-bg flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-muted" strokeWidth={2} />
              </button>
            </div>

            {/* 타입 선택 */}
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
                유형
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(TYPE_META) as ReminderType[]).map((k) => {
                  const m = TYPE_META[k]
                  const active = type === k
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setType(k)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border transition ${
                        active
                          ? 'border-terracotta bg-terracotta/5'
                          : 'border-rule hover:border-muted'
                      }`}
                    >
                      <m.Icon
                        className={`w-4 h-4`}
                        style={{ color: m.color }}
                        strokeWidth={2}
                      />
                      <span className="text-[9px] font-bold text-text">
                        {m.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
                제목
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === 'vaccine'
                    ? '예: 종합백신 DHPPL'
                    : type === 'medication'
                    ? '예: 심장사상충 예방약'
                    : type === 'checkup'
                    ? '예: 1년차 건강검진'
                    : type === 'grooming'
                    ? '예: 목욕·발톱 관리'
                    : '예: 미끄럼 방지 패드 교체'
                }
                maxLength={60}
                className="w-full px-3 py-2.5 rounded-lg border border-rule bg-[#FDFDFD] text-[13px] focus:outline-none focus:border-terracotta transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
                다음 일정
              </label>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-rule bg-[#FDFDFD] text-[13px] focus:outline-none focus:border-terracotta transition"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
                반복 주기
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {RECUR_PRESETS.map((p) => {
                  const active = recurDays === p.days
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setRecurDays(p.days)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                        active
                          ? 'bg-text text-white border-transparent'
                          : 'bg-white text-text border-rule hover:border-muted'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted mt-1.5 leading-relaxed">
                반복을 선택하면 완료 처리 시 다음 일정이 자동으로 설정돼요.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
                메모
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 병원 이름, 약 용량"
                rows={2}
                maxLength={200}
                className="w-full px-3 py-2.5 rounded-lg border border-rule bg-[#FDFDFD] text-[12px] focus:outline-none focus:border-terracotta transition resize-none"
              />
            </div>

            {err && (
              <p className="text-[11px] font-bold text-sale">{err}</p>
            )}
            <button
              onClick={add}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-text text-white text-[13px] font-black active:scale-[0.98] transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin"
                    strokeWidth={2}
                  />
                  저장 중...
                </>
              ) : (
                '리마인더 저장'
              )}
            </button>
          </div>
        )}
      </section>

      {/* 리스트 */}
      <section className="px-5 mt-5">
        {overdue.length > 0 && (
          <Group title="지연된 일정" tint="var(--sale)">
            {overdue.map((r) => (
              <ReminderRow
                key={r.id}
                r={r}
                onDone={() => markDone(r)}
                onToggle={() => toggle(r)}
                onDelete={() => remove(r.id)}
              />
            ))}
          </Group>
        )}
        {upcoming.length > 0 && (
          <Group title="다가오는 일정" tint="var(--terracotta)">
            {upcoming.map((r) => (
              <ReminderRow
                key={r.id}
                r={r}
                onDone={() => markDone(r)}
                onToggle={() => toggle(r)}
                onDelete={() => remove(r.id)}
              />
            ))}
          </Group>
        )}
        {paused.length > 0 && (
          <Group title="일시 중지" tint="var(--muted)">
            {paused.map((r) => (
              <ReminderRow
                key={r.id}
                r={r}
                onDone={() => markDone(r)}
                onToggle={() => toggle(r)}
                onDelete={() => remove(r.id)}
              />
            ))}
          </Group>
        )}
        {reminders.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-rule-2 p-8 text-center">
            <Bell
              className="w-9 h-9 text-muted mx-auto mb-3"
              strokeWidth={1.3}
            />
            <p className="text-[12px] text-muted">
              아직 등록된 리마인더가 없어요.
            </p>
            <p className="text-[10px] text-muted/70 mt-1">
              첫 예방접종, 심장사상충 약 등을 등록해 보세요.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

function SummaryCard({
  label,
  value,
  color,
  Icon,
}: {
  label: string
  value: number
  color: string
  Icon: LucideIcon
}) {
  return (
    <div
      className="rounded-xl px-3 py-3 flex flex-col items-start"
      style={{ backgroundColor: `${color}10`, border: `1px solid ${color}25` }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3" strokeWidth={2} style={{ color }} />
        <span
          className="text-[9px] font-bold uppercase tracking-[0.15em]"
          style={{ color }}
        >
          {label}
        </span>
      </div>
      <div className="text-[18px] font-black mt-0.5" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function Group({
  title,
  tint,
  children,
}: {
  title: string
  tint: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-5 last:mb-0">
      <h3
        className="text-[10px] font-black uppercase tracking-[0.2em] mb-2"
        style={{ color: tint }}
      >
        {title}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

function ReminderRow({
  r,
  onDone,
  onToggle,
  onDelete,
}: {
  r: Reminder
  onDone: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const meta = TYPE_META[r.type]
  const Icon = meta.Icon
  const d = daysUntil(r.next_date)
  const when =
    d < 0
      ? `${Math.abs(d)}일 지남`
      : d === 0
      ? '오늘'
      : d === 1
      ? '내일'
      : `${d}일 후`

  return (
    <li className="bg-white rounded-xl border border-rule px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: meta.bg }}
        >
          <Icon className="w-4 h-4" style={{ color: meta.color }} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12.5px] font-black text-text leading-snug truncate">
                {r.title}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
                <span className="w-px h-2.5 bg-rule-2" />
                <span className="text-[10px] text-muted">
                  {formatNextDate(r.next_date)} · {when}
                </span>
                {r.recur_interval_days && (
                  <>
                    <span className="w-px h-2.5 bg-rule-2" />
                    <span className="text-[10px] text-muted">
                      {r.recur_interval_days}일 주기
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          {r.notes && (
            <p className="text-[11px] text-text mt-2 leading-relaxed">
              {r.notes}
            </p>
          )}
          {r.last_done_date && (
            <p className="text-[10px] text-muted mt-1">
              마지막 완료 · {formatNextDate(r.last_done_date)}
            </p>
          )}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {r.enabled && (
              <button
                onClick={onDone}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-moss text-white text-[10px] font-bold active:scale-[0.96] transition"
              >
                <Check className="w-3 h-3" strokeWidth={2.5} />
                완료
              </button>
            )}
            <button
              onClick={onToggle}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-text border border-rule text-[10px] font-bold hover:border-text transition"
            >
              {r.enabled ? (
                <>
                  <Pause className="w-3 h-3" strokeWidth={2} />
                  일시중지
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" strokeWidth={2} />
                  다시 시작
                </>
              )}
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white text-sale border border-rule text-[10px] font-bold hover:border-sale transition"
            >
              <Trash2 className="w-3 h-3" strokeWidth={2} />
              삭제
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}
