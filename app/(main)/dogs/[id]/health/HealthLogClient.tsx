'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  Heart,
  Leaf,
  Smile,
  UtensilsCrossed,
  CheckCircle2,
  ChevronDown,
  Trash2,
  Plus,
  Loader2,
  Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export type HealthLog = {
  id: string
  logged_at: string // YYYY-MM-DD
  poop_quality: 'good' | 'loose' | 'hard' | 'diarrhea' | null
  poop_count: number | null
  activity_level: 'low' | 'normal' | 'high' | null
  mood: 'happy' | 'normal' | 'tired' | 'sick' | null
  appetite: 'good' | 'normal' | 'low' | 'none' | null
  note: string | null
  created_at: string
}

const POOP_LABEL: Record<string, { label: string; color: string }> = {
  good: { label: '정상', color: 'var(--moss)' },
  loose: { label: '무름', color: 'var(--gold)' },
  hard: { label: '단단', color: 'var(--muted)' },
  diarrhea: { label: '설사', color: 'var(--sale)' },
}
const ACTIVITY_LABEL: Record<string, { label: string; color: string }> = {
  low: { label: '적음', color: 'var(--muted)' },
  normal: { label: '보통', color: 'var(--moss)' },
  high: { label: '활발', color: 'var(--terracotta)' },
}
const MOOD_LABEL: Record<string, { label: string; color: string }> = {
  happy: { label: '행복', color: 'var(--moss)' },
  normal: { label: '평온', color: 'var(--muted)' },
  tired: { label: '피곤', color: 'var(--gold)' },
  sick: { label: '아픔', color: 'var(--sale)' },
}
const APPETITE_LABEL: Record<string, { label: string; color: string }> = {
  good: { label: '좋음', color: 'var(--moss)' },
  normal: { label: '보통', color: 'var(--muted)' },
  low: { label: '적음', color: 'var(--gold)' },
  none: { label: '거부', color: 'var(--sale)' },
}

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function formatLoggedAt(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  })
}

export default function HealthLogClient({
  dogId,
  dogName,
  initialLogs,
}: {
  dogId: string
  dogName: string
  initialLogs: HealthLog[]
}) {
  const supabase = createClient()
  const [logs, setLogs] = useState<HealthLog[]>(initialLogs)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(initialLogs.length === 0)
  const [error, setError] = useState<string | null>(null)

  const [poopQuality, setPoopQuality] = useState<HealthLog['poop_quality']>(null)
  const [poopCount, setPoopCount] = useState<string>('')
  const [activityLevel, setActivityLevel] =
    useState<HealthLog['activity_level']>(null)
  const [mood, setMood] = useState<HealthLog['mood']>(null)
  const [appetite, setAppetite] = useState<HealthLog['appetite']>(null)
  const [note, setNote] = useState('')

  const weekSummary = useMemo(() => {
    const since = new Date()
    since.setDate(since.getDate() - 6)
    const sinceTs = since.setHours(0, 0, 0, 0)
    const recent = logs.filter(
      (l) => new Date(l.logged_at + 'T00:00:00').getTime() >= sinceTs
    )
    const total = recent.length
    const goodPoop = recent.filter((l) => l.poop_quality === 'good').length
    const activeDays = recent.filter(
      (l) => l.activity_level === 'high' || l.activity_level === 'normal'
    ).length
    const sickMood = recent.filter(
      (l) => l.mood === 'sick' || l.mood === 'tired'
    ).length
    return { total, goodPoop, activeDays, sickMood }
  }, [logs])

  async function saveLog() {
    setError(null)
    if (!poopQuality && !activityLevel && !mood && !appetite && !note.trim()) {
      setError('최소 한 항목 이상 기록해 주세요')
      return
    }
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 필요합니다')
        return
      }
      const payload = {
        dog_id: dogId,
        user_id: user.id,
        logged_at: todayIso(),
        poop_quality: poopQuality,
        poop_count: poopCount ? parseInt(poopCount, 10) : null,
        activity_level: activityLevel,
        mood,
        appetite,
        note: note.trim() || null,
      }
      const { data, error: insErr } = await supabase
        .from('health_logs')
        .insert(payload)
        .select(
          'id, logged_at, poop_quality, poop_count, activity_level, mood, appetite, note, created_at'
        )
        .single()
      if (insErr || !data) {
        setError(insErr?.message ?? '저장 실패')
        return
      }
      setLogs((prev) => [data as HealthLog, ...prev])
      setPoopQuality(null)
      setPoopCount('')
      setActivityLevel(null)
      setMood(null)
      setAppetite(null)
      setNote('')
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function deleteLog(id: string) {
    if (!confirm('이 기록을 삭제할까요?')) return
    const { error: delErr } = await supabase
      .from('health_logs')
      .delete()
      .eq('id', id)
    if (delErr) {
      alert('삭제 실패: ' + delErr.message)
      return
    }
    setLogs((prev) => prev.filter((l) => l.id !== id))
  }

  return (
    <main className="pb-10">
      {/* 헤더 */}
      <section className="px-5 pt-6 pb-2">
        <Link
          href={`/dogs/${dogId}`}
          className="text-[11px] text-muted hover:text-terracotta inline-flex items-center gap-1 font-semibold"
        >
          ← {dogName}
        </Link>
        <span className="kicker mt-3 block">Health Journal</span>
        <h1 className="font-serif mt-1.5" style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          건강 일지
        </h1>
        <p className="text-[11px] text-muted mt-1">
          하루 한 번 기록하면 {dogName}의 컨디션 변화를 눈으로 볼 수 있어요
        </p>
      </section>

      {/* 이번 주 요약 */}
      <section className="px-5 mt-4">
        <div
          className="rounded-2xl p-5 text-white"
          style={{ background: 'var(--ink)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-3.5 h-3.5 text-gold" strokeWidth={2} />
            <span className="kicker kicker-gold">Last 7 Days · 최근 7일</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <WeekStat
              label="기록"
              value={`${weekSummary.total}`}
              unit="회"
              tone="light"
            />
            <WeekStat
              label="활동"
              value={`${weekSummary.activeDays}`}
              unit="일"
              tone="light"
            />
            <WeekStat
              label="정상 변"
              value={`${weekSummary.goodPoop}`}
              unit="회"
              tone="light"
            />
          </div>
          {weekSummary.sickMood > 0 && (
            <p className="mt-3 text-[10px] text-[#FFB8A8] leading-relaxed">
              이번 주 컨디션이 저조한 날이 {weekSummary.sickMood}일 있었어요.
              증상이 지속되면 병원 상담을 추천해요.
            </p>
          )}
        </div>
      </section>

      {/* 오늘 기록 폼 */}
      <section className="px-5 mt-3">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-full bg-ink text-bg text-[13px] font-bold active:scale-[0.98] transition"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            오늘 건강 기록하기
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-rule p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-black text-text">
                오늘 기록 · {formatLoggedAt(todayIso())}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-[10px] font-bold text-muted hover:text-text"
              >
                접기
              </button>
            </div>

            <PickerRow
              Icon={Leaf}
              label="변 상태"
              options={POOP_LABEL}
              value={poopQuality}
              onChange={(v) =>
                setPoopQuality(v as HealthLog['poop_quality'])
              }
            />
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
                변 횟수 (오늘)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={poopCount}
                onChange={(e) => setPoopCount(e.target.value)}
                placeholder="예: 2"
                className="w-full px-3 py-2.5 rounded-lg border border-rule bg-[#FDFDFD] text-[13px] focus:outline-none focus:border-terracotta transition"
              />
            </div>
            <PickerRow
              Icon={Activity}
              label="활동량"
              options={ACTIVITY_LABEL}
              value={activityLevel}
              onChange={(v) =>
                setActivityLevel(v as HealthLog['activity_level'])
              }
            />
            <PickerRow
              Icon={Smile}
              label="기분"
              options={MOOD_LABEL}
              value={mood}
              onChange={(v) => setMood(v as HealthLog['mood'])}
            />
            <PickerRow
              Icon={UtensilsCrossed}
              label="식욕"
              options={APPETITE_LABEL}
              value={appetite}
              onChange={(v) => setAppetite(v as HealthLog['appetite'])}
            />

            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
                메모
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="특이사항, 산책 시간, 간식 등"
                rows={3}
                maxLength={200}
                className="w-full px-3 py-2.5 rounded-lg border border-rule bg-[#FDFDFD] text-[12px] focus:outline-none focus:border-terracotta transition resize-none"
              />
            </div>

            {error && (
              <p className="text-[11px] font-bold text-sale">{error}</p>
            )}

            <button
              onClick={saveLog}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-text text-white text-[13px] font-black active:scale-[0.98] transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                  저장 중...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                  기록 저장
                </>
              )}
            </button>
          </div>
        )}
      </section>

      {/* 기록 리스트 */}
      <section className="px-5 mt-5">
        <h2 className="text-[13px] font-black text-text mb-3">
          최근 30일 기록
        </h2>
        {logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-rule-2 p-8 text-center">
            <Heart
              className="w-9 h-9 text-muted mx-auto mb-3"
              strokeWidth={1.3}
            />
            <p className="text-[12px] text-muted">
              아직 기록이 없어요. 오늘부터 시작해볼까요?
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <LogRow key={l.id} log={l} onDelete={() => deleteLog(l.id)} />
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function WeekStat({
  label,
  value,
  unit,
  tone = 'dark',
}: {
  label: string
  value: string
  unit: string
  tone?: 'dark' | 'light'
}) {
  return (
    <div>
      <div
        className={`text-[9px] font-semibold uppercase tracking-[0.2em] ${
          tone === 'light' ? 'text-gold' : 'text-muted'
        }`}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-0.5 mt-1">
        <span
          className={`text-[22px] font-black ${
            tone === 'light' ? 'text-white' : 'text-text'
          }`}
        >
          {value}
        </span>
        <span
          className={`text-[10px] ${
            tone === 'light' ? 'text-white/70' : 'text-muted'
          }`}
        >
          {unit}
        </span>
      </div>
    </div>
  )
}

function PickerRow({
  Icon,
  label,
  options,
  value,
  onChange,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  options: Record<string, { label: string; color: string }>
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-[10px] font-bold text-muted uppercase tracking-[0.15em] mb-1.5">
        <Icon className="w-3 h-3" strokeWidth={2} />
        {label}
      </label>
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(options).map(([key, meta]) => {
          const active = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(active ? null : key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                active
                  ? 'text-white border-transparent'
                  : 'bg-white text-text border-rule hover:border-muted'
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              {meta.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LogRow({
  log,
  onDelete,
}: {
  log: HealthLog
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const chips: { key: string; color: string; label: string }[] = []
  if (log.poop_quality)
    chips.push({
      key: 'poop',
      color: POOP_LABEL[log.poop_quality].color,
      label: `변 ${POOP_LABEL[log.poop_quality].label}`,
    })
  if (log.activity_level)
    chips.push({
      key: 'activity',
      color: ACTIVITY_LABEL[log.activity_level].color,
      label: `활동 ${ACTIVITY_LABEL[log.activity_level].label}`,
    })
  if (log.mood)
    chips.push({
      key: 'mood',
      color: MOOD_LABEL[log.mood].color,
      label: `기분 ${MOOD_LABEL[log.mood].label}`,
    })
  if (log.appetite)
    chips.push({
      key: 'appetite',
      color: APPETITE_LABEL[log.appetite].color,
      label: `식욕 ${APPETITE_LABEL[log.appetite].label}`,
    })

  return (
    <li className="bg-white rounded-xl border border-rule px-4 py-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[11px] font-black text-text shrink-0">
            {formatLoggedAt(log.logged_at)}
          </span>
          <div className="flex flex-wrap gap-1 min-w-0">
            {chips.slice(0, 3).map((c) => (
              <span
                key={c.key}
                className="inline-block text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full whitespace-nowrap"
                style={{ backgroundColor: c.color }}
              >
                {c.label}
              </span>
            ))}
            {chips.length > 3 && (
              <span className="text-[9px] font-bold text-muted">
                +{chips.length - 3}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted shrink-0 transition ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-rule space-y-1.5 text-[11px]">
          {chips.length > 3 && (
            <div className="flex flex-wrap gap-1">
              {chips.map((c) => (
                <span
                  key={c.key}
                  className="inline-block text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: c.color }}
                >
                  {c.label}
                </span>
              ))}
            </div>
          )}
          {log.poop_count !== null && (
            <p className="text-text">
              <span className="text-muted">변 횟수 · </span>
              {log.poop_count}회
            </p>
          )}
          {log.note && (
            <p className="text-text leading-relaxed whitespace-pre-wrap">
              {log.note}
            </p>
          )}
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-sale hover:underline mt-1"
          >
            <Trash2 className="w-3 h-3" strokeWidth={2} />
            삭제
          </button>
        </div>
      )}
    </li>
  )
}
