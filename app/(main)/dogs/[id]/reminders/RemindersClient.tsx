'use client'

import { useMemo, useState, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/v3'
import { V3, V3Radius, V3Shadow } from '@/lib/design/tokens'
import {
  BellIcon,
  CheckIcon,
  PillIcon,
  PlayIcon,
  PlusIcon,
  ScissorsIcon,
  StethoscopeIcon,
  SyringeIcon,
  XIcon,
  type DogIconProps,
} from '@/components/v3/dog/DogIcons'
import {
  ChoiceButton,
  ChoiceGroup,
  Field,
  FormError,
  IDLE_BORDER,
  PickerField,
  SectionTitle,
  TextArea,
  TextField,
  primaryButtonStyle,
} from '@/components/v3/dog/DogFormParts'

/**
 * 리마인더 — 예방접종·투약·검진·미용 일정 알림.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 D18 리마인더 · D19 리마인더 추가):
 *  · 요약(지연·다가옴·일시중지) = 이 화면의 핵심 카드(머스타드 + 먹선 2 + 도장 그림자, 큰 숫자 글꼴).
 *    추가 칸을 펴면 도장 그림자가 그 칸으로 옮겨 가고 요약은 회색 면 + 왼쪽 머스타드 띠로 작게(화면당 한 곳).
 *  · 일정 줄 = 회색 동그라미 안 종류 그림 · 제목(18) · "종류 · 날짜 · N일 후 · 주기" · 메모 · 마지막 완료
 *    · 버튼(완료 = 먹색, 일시중지/다시 시작 = 먹선, 삭제 = 오른쪽 끝 빨간 글자). 삭제를 반대쪽 끝에 두는 이유는 그대로.
 *  · 추가 칸 = 종류 다섯 칸(고른 칸 = 회색 면 + 위 6px 머스타드 띠) · 제목 · 다음 일정 · 반복 주기(네모 칩) · 메모.
 *  · 문구: "반복을 선택하면 완료 처리 시 다음 일정이 자동으로 설정돼요." → "반복을 고르면 완료를 누를 때
 *    다음 일정이 자동으로 잡혀요."(시안).
 * 저장·완료·일시중지·삭제 로직은 그대로다.
 */

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
    Icon: (p: DogIconProps) => ReactNode
  }
> = {
  vaccine: { label: '예방접종', Icon: SyringeIcon },
  medication: { label: '투약', Icon: PillIcon },
  checkup: { label: '건강검진', Icon: StethoscopeIcon },
  grooming: { label: '미용/목욕', Icon: ScissorsIcon },
  custom: { label: '기타', Icon: BellIcon },
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
  initial,
  embedded,
  previewAdding = false,
}: {
  dogId: string
  dogName?: string
  initial: Reminder[]
  /** 통합 건강관리 페이지의 탭 안에서 렌더될 때 true — 자체 헤더를 숨긴다. */
  embedded?: boolean
  /** 점검 화면(/design-check/dogs) 전용 — 추가 칸을 편 채로(예시 값을 채워) 시작. 실제 화면은 넘기지 않는다. */
  previewAdding?: boolean
}) {
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [reminders, setReminders] = useState<Reminder[]>(initial)
  const [adding, setAdding] = useState(previewAdding)
  const [saving, setSaving] = useState(false)
  // 동기 가드 — disabled={saving} 은 리렌더 후 적용이라 서브프레임 더블탭이
  // 빠져나가 중복 리마인더가 insert 될 수 있다(알림 스팸). ref 는 동기라 차단
  // (dogs/new·AddressForm·HealthLog 패턴).
  const savingRef = useRef(false)
  const [err, setErr] = useState<string | null>(null)

  const [type, setType] = useState<ReminderType>('vaccine')
  const [title, setTitle] = useState(previewAdding ? '광견병 예방접종' : '')
  const [nextDate, setNextDate] = useState(todayIso())
  const [recurDays, setRecurDays] = useState<number | null>(previewAdding ? 365 : null)
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
    if (savingRef.current) return // 더블탭 중복 insert 방지
    savingRef.current = true
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setErr('로그인이 필요해요')
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
        setErr('저장하지 못했어요')
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
      savingRef.current = false
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
      toast.error('업데이트하지 못했어요')
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
    const ok = await confirm({
      title: '이 리마인더를 삭제할까요?',
      body: '예약된 알림이 더 이상 오지 않아요.',
      confirmLabel: '삭제',
      tone: 'destructive',
    })
    if (!ok) return
    const { error } = await supabase.from('dog_reminders').delete().eq('id', id)
    if (error) {
      toast.error('삭제하지 못했어요')
      return
    }
    setReminders((prev) => prev.filter((r) => r.id !== id))
  }

  // 요약이 화면의 핵심 카드인가 — 추가 칸을 펴면 도장 그림자가 그 칸으로 간다.
  const summaryCore = !adding

  return (
    // 줄 높이 normal — 시안은 줄 높이를 안 준 글자가 글꼴 기본값이다(앱 전역 1.5 로 두면 칸마다 커진다).
    <div style={{ lineHeight: 'normal', paddingBottom: embedded ? 0 : 32 }}>
      {!embedded && (
        <section style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: V3.inkMute }}>케어 알림</span>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>리마인더</h1>
          <p style={{ margin: 0, fontSize: 16, color: V3.inkSoft }}>
            예방접종, 투약, 검진 일정을 놓치지 않게 챙겨드려요
          </p>
        </section>
      )}

      {/* 요약 */}
      <section
        aria-label="리마인더 요약"
        style={{
          margin: '18px 20px 0',
          borderRadius: V3Radius.sm,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          color: V3.ink,
          // 네 변을 따로 준다 — 핵심 카드(먹선 2) ↔ 작은 요약(왼쪽 띠 6)을 오갈 때 테두리가 지워지지 않게.
          ...(summaryCore
            ? {
                borderTop: `2px solid ${V3.ink}`,
                borderRight: `2px solid ${V3.ink}`,
                borderBottom: `2px solid ${V3.ink}`,
                borderLeft: `2px solid ${V3.ink}`,
                boxShadow: V3Shadow.stamp,
                padding: '12px 0',
                background: V3.mustard,
              }
            : {
                borderTop: 0,
                borderRight: 0,
                borderBottom: 0,
                borderLeft: `6px solid ${V3.mustard}`,
                boxShadow: 'none',
                padding: '10px 0',
                background: V3.soft,
              }),
        }}
      >
        <SummaryCell label="지연" value={overdue.length} dot={V3.sale} core={summaryCore} first />
        <SummaryCell label="다가옴" value={upcoming.length} dot={summaryCore ? '#FFFFFF' : V3.mustard} core={summaryCore} />
        <SummaryCell label="일시중지" value={paused.length} dot="#9A9A9A" core={summaryCore} />
      </section>

      {/* 추가 버튼 / 폼 */}
      {!adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ ...primaryButtonStyle(58), width: 'calc(100% - 40px)', margin: '20px 20px 0' }}
        >
          <PlusIcon size={20} />
          리마인더 추가
        </button>
      ) : (
        <section
          aria-labelledby="new-reminder-title"
          style={{
            margin: '16px 20px 0',
            padding: '16px 16px 20px',
            border: `2px solid ${V3.ink}`,
            boxShadow: V3Shadow.stamp,
            borderRadius: V3Radius.sm,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* 본문 글꼴 굵게(시안 19px 800) — 앱 틀의 h2 기본(제목 글꼴)을 되돌린다. */}
            <h2
              id="new-reminder-title"
              style={{ margin: 0, fontFamily: 'inherit', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              새 리마인더
            </h2>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => {
                setAdding(false)
                reset()
              }}
              style={{
                width: 44,
                height: 44,
                marginRight: -8,
                border: 0,
                background: 'transparent',
                color: V3.ink,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <XIcon size={20} strokeWidth={2.4} />
            </button>
          </div>

          {/* 타입 선택 — 5칸을 3열로(320px 에서도 라벨이 안 접히게, 각 칸 ~92px). */}
          <ChoiceGroup legend="유형" columns={3}>
            {(Object.keys(TYPE_META) as ReminderType[]).map((k) => {
              const m = TYPE_META[k]
              const active = type === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setType(k)}
                  aria-pressed={active}
                  style={{
                    height: 64,
                    boxSizing: 'border-box',
                    // 네 변을 따로 준다 — 한 줄짜리 border 와 섞으면 고를 때마다 테두리가 지워질 수 있다.
                    borderTop: active ? `6px solid ${V3.mustard}` : `1.5px solid ${IDLE_BORDER}`,
                    borderRight: active ? 0 : `1.5px solid ${IDLE_BORDER}`,
                    borderBottom: active ? 0 : `1.5px solid ${IDLE_BORDER}`,
                    borderLeft: active ? 0 : `1.5px solid ${IDLE_BORDER}`,
                    borderRadius: V3Radius.sm,
                    background: active ? V3.soft : '#FFFFFF',
                    color: V3.ink,
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    cursor: 'pointer',
                  }}
                >
                  <m.Icon size={20} />
                  <span style={{ fontSize: 15, fontWeight: active ? 800 : 700 }}>{m.label}</span>
                </button>
              )
            })}
          </ChoiceGroup>

          <Field label="제목">
            <TextField
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="리마인더 제목"
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
            />
          </Field>

          <Field label="다음 일정">
            <PickerField value={nextDate} onChange={(e) => setNextDate(e.target.value)} aria-label="다음 일정 날짜" />
          </Field>

          <ChoiceGroup
            legend="반복 주기"
            after={
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5, color: V3.inkMute }}>
                반복을 고르면 완료를 누를 때 다음 일정이 자동으로 잡혀요.
              </p>
            }
          >
            {RECUR_PRESETS.map((p) => (
              <ChoiceButton
                key={p.label}
                active={recurDays === p.days}
                onClick={() => setRecurDays(p.days)}
                height={44}
                fontSize={15}
                padding="0 14px"
              >
                {p.label}
              </ChoiceButton>
            ))}
          </ChoiceGroup>

          <Field label="메모">
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label="메모"
              placeholder="예: 병원 이름, 약 용량"
              rows={2}
              maxLength={200}
              minHeight={72}
            />
          </Field>

          {err && <FormError msg={err} style={{ marginBottom: -8 }} />}
          <button
            type="button"
            onClick={add}
            disabled={saving}
            aria-busy={saving || undefined}
            style={{ ...primaryButtonStyle(58), opacity: saving ? 0.6 : 1 }}
          >
            {saving ? '저장 중...' : '리마인더 저장'}
          </button>
        </section>
      )}

      {/* 리스트 */}
      {overdue.length > 0 && (
        <Group title="지연된 일정" color={V3.sale} first adding={adding}>
          {overdue.map((r) => (
            <ReminderRow key={r.id} r={r} onDone={() => markDone(r)} onToggle={() => toggle(r)} onDelete={() => remove(r.id)} />
          ))}
        </Group>
      )}
      {upcoming.length > 0 && (
        <Group title="다가오는 일정" first={overdue.length === 0} adding={adding}>
          {upcoming.map((r) => (
            <ReminderRow key={r.id} r={r} onDone={() => markDone(r)} onToggle={() => toggle(r)} onDelete={() => remove(r.id)} />
          ))}
        </Group>
      )}
      {paused.length > 0 && (
        <Group title="일시 중지" color={V3.inkMute} first={overdue.length === 0 && upcoming.length === 0} adding={adding}>
          {paused.map((r) => (
            <ReminderRow key={r.id} r={r} onDone={() => markDone(r)} onToggle={() => toggle(r)} onDelete={() => remove(r.id)} />
          ))}
        </Group>
      )}
      {reminders.length === 0 && (
        <div
          style={{
            margin: '28px 20px 0',
            padding: '28px 20px',
            border: '1.5px dashed #9A9A9A',
            borderRadius: V3Radius.sm,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BellIcon size={30} color={V3.inkMute} />
          <p style={{ margin: '6px 0 0', fontSize: 16, fontWeight: 700 }}>아직 등록된 리마인더가 없어요.</p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: V3.inkMute }}>
            첫 예방접종, 심장사상충 약 등을 등록해 보세요.
          </p>
        </div>
      )}
    </div>
  )
}

/** 요약 한 칸 — 점 + 이름 · 큰 숫자. */
function SummaryCell({
  label,
  value,
  dot,
  core,
  first = false,
}: {
  label: string
  value: number
  dot: string
  core: boolean
  first?: boolean
}) {
  return (
    <span
      style={{
        padding: '0 16px',
        borderLeft: first ? 0 : `1px solid ${core ? 'rgba(20, 20, 20, 0.2)' : V3.rule}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: core ? V3.ink : V3.inkMute }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: dot, flexShrink: 0 }} />
        {label}
      </span>
      <span className="ft-num" style={{ fontSize: core ? 32 : 26 }}>
        {value}
      </span>
    </span>
  )
}

function Group({
  title,
  color,
  first,
  adding,
  children,
}: {
  title: string
  color?: string
  /** 목록 중 첫 묶음 — 위 여백이 버튼(28)·추가 칸(30) 다음 자리. 뒤 묶음은 28. */
  first?: boolean
  adding: boolean
  children: ReactNode
}) {
  return (
    <section style={{ margin: `${first && adding ? 30 : 28}px 20px 0`, display: 'flex', flexDirection: 'column' }}>
      <SectionTitle color={color}>{title}</SectionTitle>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: `1.5px solid ${V3.ink}` }}>{children}</ul>
    </section>
  )
}

const ACTION_BUTTON = {
  height: 48,
  boxSizing: 'border-box',
  borderRadius: V3Radius.sm,
  fontFamily: 'inherit',
  fontSize: 16,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
} as const

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
  const live = r.enabled
  const strong = live ? V3.ink : V3.inkSoft

  return (
    <li
      style={{
        padding: '16px 0',
        borderBottom: `1px solid ${V3.rule}`,
        display: 'grid',
        gridTemplateColumns: '40px 1fr',
        columnGap: 12,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: V3.soft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: live ? V3.ink : V3.inkMute,
        }}
      >
        <Icon size={20} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: live ? V3.ink : V3.inkSoft, wordBreak: 'keep-all' }}>{r.title}</span>
        <span style={{ fontSize: 15, color: V3.inkMute }}>
          <strong style={{ fontWeight: 800, color: strong }}>{meta.label}</strong> · {formatNextDate(r.next_date)} ·{' '}
          {live ? <strong style={{ fontWeight: 800, color: d < 0 ? V3.sale : V3.ink }}>{when}</strong> : when}
          {r.recur_interval_days && ` · ${r.recur_interval_days}일 주기`}
        </span>
        {r.notes && <span style={{ fontSize: 16, color: V3.inkSoft }}>{r.notes}</span>}
        {r.last_done_date && (
          <span style={{ fontSize: 14, color: V3.inkMute }}>마지막 완료 · {formatNextDate(r.last_done_date)}</span>
        )}
        {/* ★터치 타깃 44px + 파괴적 액션 분리 (2026-08-07 앱 화면 감사).
            예전엔 완료·일시중지·삭제 세 버튼이 전부 ~28px 높이에 6px 간격으로
            붙어 있었다 — 일시중지를 누르려다 삭제를 누르기 쉬웠다.
            삭제는 margin-left: auto 로 반대쪽에 둔다. */}
        <span style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {live && (
            <button type="button" onClick={onDone} style={{ ...ACTION_BUTTON, padding: '0 16px', border: 0, background: V3.ink, color: '#FFFFFF' }}>
              <CheckIcon size={16} strokeWidth={3} />
              완료
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            style={{ ...ACTION_BUTTON, padding: '0 14px', border: `1.5px solid ${V3.ink}`, background: '#FFFFFF', color: V3.ink }}
          >
            {live ? (
              '일시중지'
            ) : (
              <>
                <PlayIcon size={14} />
                다시 시작
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={{
              ...ACTION_BUTTON,
              marginLeft: 'auto',
              padding: '0 12px',
              border: `1.5px solid ${V3.rule}`,
              background: '#FFFFFF',
              color: V3.sale,
            }}
          >
            삭제
          </button>
        </span>
      </span>
    </li>
  )
}
