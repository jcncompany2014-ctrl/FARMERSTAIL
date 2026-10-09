'use client'

import { useMemo, useState, useRef, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/v3'
import MedicalRecordOcr from '@/components/MedicalRecordOcr'
import MedicalRecordForm, { type MedicalRecordPreview } from '@/components/MedicalRecordForm'
import RecordSegments from '@/components/dogs/RecordSegments'
import { petName } from '@/lib/korean'
import { isAdvancedUiEnabled } from '@/lib/ui-flags'
import { V3, V3Radius, V3Shadow } from '@/lib/design/tokens'
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/v3/dog/DogIcons'
import {
  ChoiceButton,
  ChoiceGroup,
  Field,
  FormError,
  SectionTitle,
  TextArea,
  TextField,
  UnitText,
  primaryButtonStyle,
} from '@/components/v3/dog/DogFormParts'

/**
 * 건강 일지 — 오늘 기록(변·활동·기분·식욕·메모) + 최근 7일 요약 + 최근 30일 목록.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 D05 건강일지 · D06 오늘 기록 · D07 의료 기록 추가):
 *  · 도장 그림자는 한 화면에 한 곳 — 그때그때 손이 가는 카드가 가진다.
 *      아무것도 안 열림 = 최근 7일 요약(머스타드 + 먹선 2 + 도장 그림자),
 *      오늘 기록을 열면 = 그 입력 카드, 의료 기록을 열면 = 그 카드. 이때 요약은 회색 면 + 왼쪽 머스타드 띠로 작게.
 *  · 고르기 칸 = 네모(안 고름 흰 바탕 옅은 회색 테두리 · 고름 먹색). 예전 알약 칩은 쓰지 않는다.
 *  · 기록 줄 = 날짜(굵게) + 꺾쇠 · 상태 칩(모서리 4). 펼치면 회색 면 안 변 횟수·메모 + '이 기록 삭제'.
 * 저장·삭제·요약 계산은 그대로다.
 */

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

/**
 * 칩 색 — 배경과 **글자색** 을 쌍으로 둔다.
 *
 * ★왜 글자색이 따로 필요한가 (2026-08-07 앱 화면 감사)
 * 예전엔 전부 흰 글자였는데, 노랑(앱에서 #e6b942)에 흰 글자는 **1.86:1** 로
 * 사실상 안 보인다. 하필 그 색을 쓰는 게 **'무름'·'피곤'·'적음'** — 보호자가
 * 제일 먼저 읽어야 할 이상 신호들이었다. 밝은 배경엔 먹색 글자를 얹는다.
 *
 * 2026-10-09 'A 포스터'(시안 D05): 네 가지 결로 모았다 —
 *   괜찮음 = 먹색 바탕 흰 글자 · 눈여겨볼 것 = 머스타드 바탕 먹 글자 · 보통 = 옅은 회색 바탕 먹 글자 ·
 *   이상 = 빨강 바탕 흰 글자. (예전 초록 → 먹색, 회색 → 옅은 회색, 노랑 → 머스타드, 빨강 → 빨강, 활발의 주황 → 먹색)
 */
type ChipTone = 'good' | 'caution' | 'neutral' | 'bad'
const TONE: Record<ChipTone, { bg: string; fg: string }> = {
  good: { bg: V3.ink, fg: '#FFFFFF' },
  caution: { bg: V3.mustard, fg: V3.ink },
  neutral: { bg: '#EFEDEE', fg: V3.ink },
  bad: { bg: V3.sale, fg: '#FFFFFF' },
}
type ChipMeta = { label: string; tone: ChipTone }

const POOP_LABEL: Record<string, ChipMeta> = {
  good: { label: '정상', tone: 'good' },
  loose: { label: '무름', tone: 'caution' },
  hard: { label: '단단', tone: 'neutral' },
  diarrhea: { label: '설사', tone: 'bad' },
}
const ACTIVITY_LABEL: Record<string, ChipMeta> = {
  low: { label: '적음', tone: 'neutral' },
  normal: { label: '보통', tone: 'good' },
  high: { label: '활발', tone: 'good' },
}
const MOOD_LABEL: Record<string, ChipMeta> = {
  happy: { label: '행복', tone: 'good' },
  normal: { label: '평온', tone: 'neutral' },
  tired: { label: '피곤', tone: 'caution' },
  sick: { label: '아픔', tone: 'bad' },
}
const APPETITE_LABEL: Record<string, ChipMeta> = {
  good: { label: '좋음', tone: 'good' },
  normal: { label: '보통', tone: 'neutral' },
  low: { label: '적음', tone: 'caution' },
  none: { label: '거부', tone: 'bad' },
}

function todayIso() {
  // KST 고정 오늘 날짜 — 브라우저 로컬 날짜를 쓰면 해외 접속 시 앱의 KST 기준
  // 조회(QuickActionChips 등)와 어긋난다 (2026-07-03 감사, 하우스 패턴 통일).
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

function formatLoggedAt(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  })
}

/** 점검 화면(/design-check/dogs) 전용 — 열린 상태·채운 값으로 시작. 실제 화면은 넘기지 않는다. */
export type HealthLogPreview = {
  form?: {
    poop?: HealthLog['poop_quality']
    count?: string
    activity?: HealthLog['activity_level']
    mood?: HealthLog['mood']
    appetite?: HealthLog['appetite']
    note?: string
  }
  openLogId?: string
  medical?: MedicalRecordPreview
}

export default function HealthLogClient({
  dogId,
  dogName,
  initialLogs,
  preview,
}: {
  dogId: string
  dogName: string
  initialLogs: HealthLog[]
  preview?: HealthLogPreview
}) {
  const supabase = createClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [logs, setLogs] = useState<HealthLog[]>(initialLogs)
  const [saving, setSaving] = useState(false)
  // 동기 가드 — disabled={saving} 은 리렌더 후 적용되므로 서브프레임 더블탭이
  // 빠져나가 건강기록이 중복 insert 될 수 있다(체중/추세 오염→알고리즘 영향).
  // ref 는 동기라 중복을 막음 (dogs/new·AddressForm 패턴).
  const savingRef = useRef(false)
  const [showForm, setShowForm] = useState(initialLogs.length === 0 || preview?.form !== undefined)
  const [error, setError] = useState<string | null>(null)
  // 의료 기록 카드가 열렸는지 — 도장 그림자를 그 카드로 옮기고 요약을 작게 그린다(화면당 한 곳).
  const [medicalOpen, setMedicalOpen] = useState(preview?.medical !== undefined)

  const [poopQuality, setPoopQuality] = useState<HealthLog['poop_quality']>(preview?.form?.poop ?? null)
  const [poopCount, setPoopCount] = useState<string>(preview?.form?.count ?? '')
  const [activityLevel, setActivityLevel] =
    useState<HealthLog['activity_level']>(preview?.form?.activity ?? null)
  const [mood, setMood] = useState<HealthLog['mood']>(preview?.form?.mood ?? null)
  const [appetite, setAppetite] = useState<HealthLog['appetite']>(preview?.form?.appetite ?? null)
  const [note, setNote] = useState(preview?.form?.note ?? '')

  const weekSummary = useMemo(() => {
    const since = new Date()
    since.setDate(since.getDate() - 6)
    const sinceTs = since.setHours(0, 0, 0, 0)
    const recent = logs.filter(
      (l) => new Date(l.logged_at + 'T00:00:00').getTime() >= sinceTs
    )
    // 같은 날 여러 partial 행(식사·산책 빠른시트가 각각 별도 insert)을 하루로 합친다.
    // 행 수로 세면 하루가 2~3회로 과다계상됐다(2026-07-17). logged_at(날짜)로 그룹핑
    // 후 각 항목을 OR 병합해 '일 단위'로 센다.
    const byDay = new Map<
      string,
      { poopGood: boolean; active: boolean; sick: boolean }
    >()
    for (const l of recent) {
      const d = l.logged_at.slice(0, 10)
      const cur = byDay.get(d) ?? { poopGood: false, active: false, sick: false }
      if (l.poop_quality === 'good') cur.poopGood = true
      if (l.activity_level === 'high' || l.activity_level === 'normal')
        cur.active = true
      if (l.mood === 'sick' || l.mood === 'tired') cur.sick = true
      byDay.set(d, cur)
    }
    const days = [...byDay.values()]
    return {
      total: byDay.size,
      goodPoop: days.filter((d) => d.poopGood).length,
      activeDays: days.filter((d) => d.active).length,
      sickMood: days.filter((d) => d.sick).length,
    }
  }, [logs])

  async function saveLog() {
    setError(null)
    if (!poopQuality && !activityLevel && !mood && !appetite && !note.trim()) {
      setError('최소 한 항목 이상 기록해 주세요')
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
        setError('로그인이 필요해요')
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
        setError('저장하지 못했어요')
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
      savingRef.current = false
    }
  }

  async function deleteLog(id: string) {
    const ok = await confirm({
      title: '이 건강 기록을 삭제할까요?',
      body: '되돌릴 수 없어요.',
      confirmLabel: '삭제',
      tone: 'destructive',
    })
    if (!ok) return
    const { error: delErr } = await supabase
      .from('health_logs')
      .delete()
      .eq('id', id)
    if (delErr) {
      toast.error('삭제하지 못했어요')
      return
    }
    setLogs((prev) => prev.filter((l) => l.id !== id))
  }

  // 요약이 화면의 핵심 카드인가 — 오늘 기록·의료 기록이 다 닫혀 있을 때만.
  const summaryCore = !showForm && !medicalOpen

  return (
    // 줄 높이 normal — 시안은 줄 높이를 안 준 글자가 글꼴 기본값이다(앱 전역 1.5 로 두면 칸마다 커진다).
    <div style={{ paddingBottom: 32, lineHeight: 'normal' }}>
      {/* 기록 허브 토글 — 일상 ↔ 건강일지. 어디서 들어와도 한 허브처럼. */}
      <RecordSegments dogId={dogId} active="health" />

      {/* 헤더 */}
      <section style={{ padding: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1 }}>건강 일지</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: V3.inkSoft }}>
          하루 한 번 기록하면 {petName(dogName)}의 컨디션 변화를 눈으로 볼 수 있어요
        </p>
      </section>

      {/* 최근 7일 요약 */}
      {summaryCore ? (
        <section
          aria-label="최근 7일"
          style={{
            margin: '20px 20px 0',
            // 네 변을 따로 준다 — 아래 작은 요약(왼쪽 띠만)과 오갈 때 같은 칸이 다시 그려져 테두리가 지워지지 않게.
            borderTop: `2px solid ${V3.ink}`,
            borderRight: `2px solid ${V3.ink}`,
            borderBottom: `2px solid ${V3.ink}`,
            borderLeft: `2px solid ${V3.ink}`,
            boxShadow: V3Shadow.stamp,
            borderRadius: V3Radius.sm,
            background: V3.mustard,
            color: V3.ink,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarIcon size={18} color={V3.ink} />
            <span style={{ fontSize: 15, fontWeight: 800 }}>최근 7일</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', padding: '10px 0 14px' }}>
            <WeekStat label="기록" value={weekSummary.total} big divider="rgba(20, 20, 20, 0.2)" />
            <WeekStat label="활동" value={weekSummary.activeDays} big divider="rgba(20, 20, 20, 0.2)" first={false} />
            <WeekStat label="정상 변" value={weekSummary.goodPoop} big divider="rgba(20, 20, 20, 0.2)" first={false} />
          </div>
          {weekSummary.sickMood > 0 && (
            <p
              style={{
                margin: 0,
                padding: '12px 16px 14px',
                borderTop: '1px solid rgba(20, 20, 20, 0.2)',
                display: 'flex',
                gap: 8,
                fontSize: 15,
                lineHeight: 1.55,
              }}
            >
              <span aria-hidden style={{ flexShrink: 0, width: 8, height: 8, marginTop: 7, borderRadius: 4, background: '#FFFFFF' }} />
              이번 주 컨디션이 저조한 날이 {weekSummary.sickMood}일 있었어요. 증상이 계속되면 병원 상담을 권해요.
            </p>
          )}
        </section>
      ) : (
        <section
          aria-label="최근 7일"
          style={{
            margin: '20px 20px 0',
            borderRadius: V3Radius.sm,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            padding: '12px 0',
            background: V3.soft,
            borderTop: 0,
            borderRight: 0,
            borderBottom: 0,
            borderLeft: `6px solid ${V3.mustard}`,
            boxShadow: 'none',
          }}
        >
          <WeekStat label="최근 7일 기록" value={weekSummary.total} divider={V3.rule} />
          <WeekStat label="활동" value={weekSummary.activeDays} divider={V3.rule} first={false} />
          <WeekStat label="정상 변" value={weekSummary.goodPoop} divider={V3.rule} first={false} />
        </section>
      )}

      {/* 오늘 기록 폼 */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{ ...primaryButtonStyle(58), width: 'calc(100% - 40px)', margin: `${summaryCore ? 22 : 16}px 20px 0` }}
        >
          <PlusIcon size={20} />
          오늘 건강 기록하기
        </button>
      ) : (
        // form 이 아니라 section — 예전처럼 입력 칸에서 엔터를 눌러도 저장되지 않는다(버튼으로만 저장).
        <section
          aria-labelledby="health-today-title"
          style={{
            margin: '16px 20px 0',
            padding: '18px 16px 20px',
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
              id="health-today-title"
              style={{ margin: 0, fontFamily: 'inherit', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              오늘 기록 · {formatLoggedAt(todayIso())}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                height: 44,
                padding: '0 4px',
                border: 0,
                background: 'transparent',
                color: V3.inkSoft,
                fontFamily: 'inherit',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              접기
            </button>
          </div>

          <PickerRow
            label="변 상태"
            options={POOP_LABEL}
            value={poopQuality}
            onChange={(v) => setPoopQuality(v as HealthLog['poop_quality'])}
          />
          {/* UI audit J-3: iOS 키보드 숫자패드 표시 위해 inputMode="numeric". */}
          <Field label="변 횟수" hint="(오늘)">
            <TextField
              type="number"
              onWheel={(e) => e.currentTarget.blur()}
              aria-label="변 횟수 (오늘)"
              inputMode="numeric"
              min="0"
              max="10"
              value={poopCount}
              onChange={(e) => setPoopCount(e.target.value)}
              placeholder="예: 2"
              trailing={<UnitText>회</UnitText>}
            />
          </Field>
          <PickerRow
            label="활동량"
            options={ACTIVITY_LABEL}
            value={activityLevel}
            onChange={(v) => setActivityLevel(v as HealthLog['activity_level'])}
          />
          <PickerRow label="기분" options={MOOD_LABEL} value={mood} onChange={(v) => setMood(v as HealthLog['mood'])} />
          <PickerRow
            label="식욕"
            options={APPETITE_LABEL}
            value={appetite}
            onChange={(v) => setAppetite(v as HealthLog['appetite'])}
          />

          <Field label="메모">
            <TextArea
              aria-label="메모"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="특이사항, 산책 시간, 간식 등"
              rows={2}
              maxLength={200}
              minHeight={88}
            />
          </Field>

          {error && <FormError msg={error} style={{ marginBottom: -8 }} />}

          <button
            type="button"
            onClick={saveLog}
            disabled={saving}
            aria-busy={saving || undefined}
            style={{ ...primaryButtonStyle(58), opacity: saving ? 0.6 : 1 }}
          >
            {saving ? (
              '저장 중...'
            ) : (
              <>
                <CheckIcon size={20} />
                기록 저장
              </>
            )}
          </button>
        </section>
      )}

      {/* 진료 영수증 OCR — Claude Vision. 사용자 확인 후 POST /api/health/
          records 로 source='ocr' 저장 (P4). 자동 저장 X 정책 유지: 사용자가
          "이대로 저장" 클릭해야만 onConfirm 호출됨.
          배포 스위치가 꺼져 있으면 카드가 아무것도 안 그리므로 자리(여백)도 두지 않는다. */}
      {isAdvancedUiEnabled('ocr') && (
        <div style={{ margin: '16px 20px 0' }}>
          <MedicalRecordOcr
            dogId={dogId}
            onConfirm={async (extract) => {
              const res = await fetch('/api/health/records', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  dogId,
                  visitDate: extract.visitDate,
                  diagnosis: extract.diagnosis,
                  medications: extract.medications,
                  vetNotes: extract.vetNotes,
                  weightKg: extract.weightKg,
                  source: 'ocr',
                  ocrConfidence: extract.confidence,
                }),
              })
              if (!res.ok) {
                throw new Error('save failed')
              }
            }}
          />
        </div>
      )}

      {/* 수동 의료 기록 입력 — Phase P6 (B-67 마무리). expandable. */}
      <div style={{ margin: `${showForm ? 18 : 10}px 20px 0` }}>
        <MedicalRecordForm
          dogId={dogId}
          open={medicalOpen}
          onOpenChange={setMedicalOpen}
          preview={preview?.medical}
        />
      </div>

      {/* 기록 리스트 */}
      <section aria-labelledby="health-recent-title" style={{ margin: '30px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <SectionTitle>
          <span id="health-recent-title">최근 30일 기록</span>
        </SectionTitle>
        {logs.length === 0 ? (
          <div
            style={{
              padding: '28px 20px',
              border: '1.5px dashed #9A9A9A',
              borderRadius: V3Radius.sm,
              textAlign: 'center',
              fontSize: 16,
              lineHeight: 1.55,
              color: V3.inkMute,
            }}
          >
            아직 기록이 없어요. 오늘부터 시작해볼까요?
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', borderTop: `1.5px solid ${V3.ink}` }}>
            {logs.map((l) => (
              <LogRow key={l.id} log={l} onDelete={() => deleteLog(l.id)} defaultOpen={preview?.openLogId === l.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** 요약 한 칸 — 이름(13) + 큰 숫자(숫자 글꼴) + "일". */
function WeekStat({
  label,
  value,
  big = false,
  divider,
  first = true,
}: {
  label: string
  value: number
  /** 핵심 카드(머스타드)일 때 크게(36) — 작은 요약은 28. */
  big?: boolean
  divider: string
  first?: boolean
}) {
  return (
    <span
      style={{
        padding: '0 16px',
        borderLeft: first ? 0 : `1px solid ${divider}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 13, color: big ? V3.ink : V3.inkMute, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>
        <span className="ft-num" style={{ fontSize: big ? 36 : 28 }}>
          {value}
        </span>
        <span style={{ fontSize: big ? 15 : 14, fontWeight: 700 }}> 일</span>
      </span>
    </span>
  )
}

function PickerRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Record<string, ChipMeta>
  value: string | null
  onChange: (v: string | null) => void
}) {
  const entries = Object.entries(options)
  return (
    <ChoiceGroup legend={label} columns={entries.length}>
      {entries.map(([key, meta]) => {
        const active = value === key
        return (
          <ChoiceButton key={key} active={active} onClick={() => onChange(active ? null : key)}>
            {meta.label}
          </ChoiceButton>
        )
      })}
    </ChoiceGroup>
  )
}

const CHIP: CSSProperties = {
  height: 30,
  padding: '0 10px',
  borderRadius: V3Radius.sm,
  fontSize: 14,
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
}

function LogRow({
  log,
  onDelete,
  defaultOpen = false,
}: {
  log: HealthLog
  onDelete: () => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const chips: { key: string; tone: ChipTone; label: string }[] = []
  if (log.poop_quality) {
    const entry = POOP_LABEL[log.poop_quality]
    if (entry) chips.push({ key: 'poop', tone: entry.tone, label: `변 ${entry.label}` })
  }
  if (log.activity_level) {
    const entry = ACTIVITY_LABEL[log.activity_level]
    if (entry) chips.push({ key: 'activity', tone: entry.tone, label: `활동 ${entry.label}` })
  }
  if (log.mood) {
    const entry = MOOD_LABEL[log.mood]
    if (entry) chips.push({ key: 'mood', tone: entry.tone, label: `기분 ${entry.label}` })
  }
  if (log.appetite) {
    const entry = APPETITE_LABEL[log.appetite]
    if (entry) chips.push({ key: 'appetite', tone: entry.tone, label: `식욕 ${entry.label}` })
  }
  const shown = open ? chips : chips.slice(0, 3)

  return (
    <li
      style={{
        minHeight: 64,
        boxSizing: 'border-box',
        padding: '14px 0',
        borderBottom: `1px solid ${V3.rule}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          padding: 0,
          border: 0,
          background: 'transparent',
          color: V3.ink,
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 800 }}>{formatLoggedAt(log.logged_at)}</span>
        {open ? <ChevronUpIcon size={18} color={V3.ink} /> : <ChevronDownIcon size={18} color={V3.inkMute} />}
      </button>
      {shown.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {shown.map((c) => (
            <span key={c.key} style={{ ...CHIP, background: TONE[c.tone].bg, color: TONE[c.tone].fg }}>
              {c.label}
            </span>
          ))}
          {!open && chips.length > 3 && (
            <span style={{ height: 30, padding: '0 4px', fontSize: 14, fontWeight: 800, color: V3.inkMute, display: 'flex', alignItems: 'center' }}>
              +{chips.length - 3}
            </span>
          )}
        </div>
      )}
      {open && (
        <>
          {(log.poop_count !== null || log.note) && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: V3Radius.sm,
                background: V3.soft,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 16,
                lineHeight: 1.55,
              }}
            >
              {log.poop_count !== null && (
                <span>
                  <span style={{ color: V3.inkMute }}>변 횟수 · </span>
                  <strong style={{ fontWeight: 800 }}>{log.poop_count}회</strong>
                </span>
              )}
              {log.note && <span style={{ whiteSpace: 'pre-wrap' }}>{log.note}</span>}
            </div>
          )}
          <button
            type="button"
            onClick={onDelete}
            style={{
              alignSelf: 'flex-start',
              minHeight: 44,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: V3.sale,
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <TrashIcon size={17} />
            이 기록 삭제
          </button>
        </>
      )}
    </li>
  )
}
