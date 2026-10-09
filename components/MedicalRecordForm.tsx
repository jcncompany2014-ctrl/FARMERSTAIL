'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { V3, V3Radius, V3Shadow } from '@/lib/design/tokens'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  StethoscopeIcon,
  XIcon,
} from '@/components/v3/dog/DogIcons'
import {
  Field,
  FieldLabel,
  PickerField,
  TextArea,
  TextField,
  UnitText,
  primaryButtonStyle,
} from '@/components/v3/dog/DogFormParts'

/**
 * MedicalRecordForm — 의료 기록 수동 입력 폼.
 *
 * 동물병원 방문 / 처방 / 진단을 수동으로 추가. POST /api/health/records
 * source='manual'.
 *
 * # voice-guidelines §11
 * 옵션. 강제 X. default 접힘 — 사용자 자발적 진입.
 *
 * # 2026-10-09 앱 새 디자인('A 포스터', 시안 D05 접힘 · D07 펼침) — 건강일지(앱) 전용
 *  · 접힘 = 회색 면 + 왼쪽 6px 머스타드 띠 한 줄(청진기 · "의료 기록 수동으로 추가" · 꺾쇠).
 *  · 펼침 = 그 화면의 핵심 카드(먹선 2 + 도장 그림자). 머리줄 아래 방문일 · 진단(적고 + 를 누르면 칩) ·
 *    받은 약(이름·용량·횟수) · 체중(선택) · 메모(선택) · 먹색 '저장하기'.
 *  · 문구: "처방 약" → "받은 약"(고객 화면에 '처방' 금지), "진단 (Enter 로 추가)" → "진단 · 적고 + 를 눌러요"
 *    (영어 키 이름 대신, 휴대폰엔 Enter 가 없다 — 실제로 + 단추로 넣는다. 엔터로 넣는 것도 그대로 된다).
 *  · 펼침 여부는 건강일지가 같이 알아야 한다(도장 그림자를 이 카드로 옮기고 요약을 작게) — open/onOpenChange.
 *    안 넘기면 예전처럼 혼자 접고 편다.
 */

type Medication = {
  name: string
  dosage: string
  frequency: string
}

/** 점검 화면(/design-check/dogs) 전용 — 채운 값으로 시작. 실제 화면은 넘기지 않는다. */
export type MedicalRecordPreview = {
  diagnosis?: string[]
  meds?: Medication[]
  weightKg?: string
  vetNotes?: string
}

export default function MedicalRecordForm({
  dogId,
  onAdded,
  open: openProp,
  onOpenChange,
  preview,
}: {
  dogId: string
  /** 추가 성공 시 호출 — 호출처가 list refetch 등 */
  onAdded?: () => void
  /** 펼침 여부를 호출처가 쥘 때(건강일지). 안 넘기면 혼자 관리. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  preview?: MedicalRecordPreview
}) {
  const toast = useToast()
  const [openState, setOpenState] = useState(preview !== undefined)
  const open = openProp ?? openState
  function setOpen(next: boolean) {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const [busy, setBusy] = useState(false)

  const [visitDate, setVisitDate] = useState(todayIso())
  const [diagnosis, setDiagnosis] = useState<string[]>(preview?.diagnosis ?? [])
  const [diagnosisInput, setDiagnosisInput] = useState('')
  const [meds, setMeds] = useState<Medication[]>(preview?.meds ?? [])
  const [vetNotes, setVetNotes] = useState(preview?.vetNotes ?? '')
  const [weightKg, setWeightKg] = useState(preview?.weightKg ?? '')

  function reset() {
    setVisitDate(todayIso())
    setDiagnosis([])
    setDiagnosisInput('')
    setMeds([])
    setVetNotes('')
    setWeightKg('')
  }

  function addDiagnosis() {
    const v = diagnosisInput.trim()
    if (!v) return
    if (diagnosis.includes(v)) {
      setDiagnosisInput('')
      return
    }
    setDiagnosis((prev) => [...prev, v])
    setDiagnosisInput('')
  }
  function removeDiagnosis(idx: number) {
    setDiagnosis((prev) => prev.filter((_, i) => i !== idx))
  }

  function addMed() {
    setMeds((prev) => [...prev, { name: '', dosage: '', frequency: '' }])
  }
  function updateMed(idx: number, patch: Partial<Medication>) {
    setMeds((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    )
  }
  function removeMed(idx: number) {
    setMeds((prev) => prev.filter((_, i) => i !== idx))
  }

  async function submit() {
    if (busy) return
    if (diagnosis.length === 0 && meds.length === 0 && !vetNotes.trim()) {
      // 칸 이름이 '받은 약'으로 바뀌어(고객 화면에 '처방' 금지) 안내도 같은 말로.
      toast.error('진단, 받은 약, 메모 중 하나 이상 입력해 주세요')
      return
    }
    const w = weightKg.trim() ? parseFloat(weightKg) : null
    if (w !== null && (Number.isNaN(w) || w <= 0 || w > 200)) {
      toast.error('체중을 올바르게 입력해주세요')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/health/records', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dogId,
          visitDate: visitDate || null,
          diagnosis,
          medications: meds
            .filter((m) => m.name.trim())
            .map((m) => ({
              name: m.name.trim(),
              dosage: m.dosage.trim() || null,
              frequency: m.frequency.trim() || null,
            })),
          vetNotes: vetNotes.trim() || null,
          weightKg: w,
          source: 'manual',
        }),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        toast.error(data.message ?? '저장에 실패했어요')
        return
      }
      toast.success('의료 기록을 추가했어요')
      reset()
      setOpen(false)
      onAdded?.()
    } catch {
      toast.error('잠시 네트워크가 불안정한 것 같아요. 다시 시도해 주세요')
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <StethoscopeIcon size={22} />
        <span id={`med-title-${dogId}`} style={{ fontSize: 16, fontWeight: 800 }}>
          의료 기록 수동으로 추가
        </span>
      </span>
      {open ? <ChevronUpIcon size={18} /> : <ChevronDownIcon size={18} />}
    </>
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        style={{
          width: '100%',
          minHeight: 60,
          padding: '0 14px',
          boxSizing: 'border-box',
          borderTop: 0,
          borderRight: 0,
          borderBottom: 0,
          borderLeft: `6px solid ${V3.mustard}`,
          borderRadius: V3Radius.sm,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          color: V3.ink,
          background: V3.soft,
          fontFamily: 'inherit',
          lineHeight: 'normal',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {header}
      </button>
    )
  }

  return (
    <section
      aria-labelledby={`med-title-${dogId}`}
      style={{
        border: `2px solid ${V3.ink}`,
        boxShadow: V3Shadow.stamp,
        borderRadius: V3Radius.sm,
        background: '#FFFFFF',
        color: V3.ink,
        display: 'flex',
        flexDirection: 'column',
        lineHeight: 'normal',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded
        style={{
          minHeight: 60,
          padding: '0 14px',
          border: 0,
          borderBottom: `1px solid ${V3.rule}`,
          background: '#FFFFFF',
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
        {header}
      </button>

      <div style={{ padding: '16px 14px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* 방문일 */}
        <Field label="방문일">
          <PickerField value={visitDate} onChange={(e) => setVisitDate(e.target.value)} iconColor={V3.inkSoft} />
        </Field>

        {/* 진단 칩 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <FieldLabel hint="· 적고 + 를 눌러요">진단</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px', gap: 6 }}>
            <TextField
              type="text"
              aria-label="진단"
              value={diagnosisInput}
              onChange={(e) => setDiagnosisInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDiagnosis()
                }
              }}
              placeholder="예: 아토피 피부염"
            />
            <button
              type="button"
              onClick={addDiagnosis}
              aria-label="진단 추가"
              style={{
                height: 52,
                boxSizing: 'border-box',
                border: `1.5px solid ${V3.ink}`,
                borderRadius: V3Radius.sm,
                background: '#FFFFFF',
                color: V3.ink,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <PlusIcon size={20} />
            </button>
          </div>
          {diagnosis.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {diagnosis.map((d, i) => (
                <span
                  key={i}
                  style={{
                    height: 36,
                    padding: '0 6px 0 12px',
                    borderRadius: V3Radius.sm,
                    background: V3.soft,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 15,
                    fontWeight: 800,
                  }}
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => removeDiagnosis(i)}
                    aria-label={`${d} 빼기`}
                    style={{
                      width: 30,
                      height: 30,
                      border: 0,
                      background: 'transparent',
                      color: V3.inkMute,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <XIcon size={14} strokeWidth={3} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 받은 약 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <FieldLabel>받은 약</FieldLabel>
          {meds.map((m, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 72px 84px 36px', gap: 6, alignItems: 'center' }}>
              <TextField
                type="text"
                aria-label="약 이름"
                placeholder="약 이름"
                value={m.name}
                onChange={(e) => updateMed(i, { name: e.target.value })}
                fontSize={16}
                padX={10}
              />
              <TextField
                type="text"
                aria-label="용량"
                placeholder="용량"
                value={m.dosage}
                onChange={(e) => updateMed(i, { dosage: e.target.value })}
                fontSize={16}
                padX={8}
              />
              <TextField
                type="text"
                aria-label="횟수"
                placeholder="횟수"
                value={m.frequency}
                onChange={(e) => updateMed(i, { frequency: e.target.value })}
                fontSize={16}
                padX={8}
              />
              <button
                type="button"
                onClick={() => removeMed(i)}
                aria-label="약 빼기"
                style={{
                  width: 36,
                  height: 48,
                  border: 0,
                  background: 'transparent',
                  color: V3.inkMute,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <XIcon size={16} strokeWidth={2.8} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMed}
            style={{
              alignSelf: 'flex-start',
              minHeight: 44,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: V3.ink,
              fontFamily: 'inherit',
              fontSize: 16,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <PlusIcon size={18} />약 추가
          </button>
        </div>

        {/* 체중 */}
        <Field label="체중" hint="(선택)">
          <TextField
            type="number"
            min="0"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="예: 5.2"
            inputMode="decimal"
            trailing={<UnitText>kg</UnitText>}
          />
        </Field>

        {/* 메모 */}
        <Field label="메모" hint="(선택)">
          <TextArea
            value={vetNotes}
            onChange={(e) => setVetNotes(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder="예: 2주 후 재진 예정"
            minHeight={76}
          />
        </Field>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          aria-busy={busy || undefined}
          style={{ ...primaryButtonStyle(58), opacity: busy ? 0.6 : 1 }}
        >
          {busy ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </section>
  )
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
