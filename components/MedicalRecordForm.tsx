'use client'

import { useState } from 'react'
import {
  Stethoscope,
  Plus,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Pill,
  Scale,
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

/**
 * MedicalRecordForm — 의료 기록 수동 입력 폼.
 *
 * 동물병원 방문 / 처방 / 진단을 수동으로 추가. POST /api/health/records
 * source='manual'.
 *
 * # voice-guidelines §11
 * 옵션. 강제 X. default 접힘 — 사용자 자발적 진입.
 */

type Medication = {
  name: string
  dosage: string
  frequency: string
}

export default function MedicalRecordForm({
  dogId,
  onAdded,
}: {
  dogId: string
  /** 추가 성공 시 호출 — 호출처가 list refetch 등 */
  onAdded?: () => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [visitDate, setVisitDate] = useState(todayIso())
  const [diagnosis, setDiagnosis] = useState<string[]>([])
  const [diagnosisInput, setDiagnosisInput] = useState('')
  const [meds, setMeds] = useState<Medication[]>([])
  const [vetNotes, setVetNotes] = useState('')
  const [weightKg, setWeightKg] = useState('')

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
      toast.error('진단, 처방, 메모 중 하나 이상 입력해주세요')
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
      toast.error('네트워크 오류가 발생했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-white" style={{ borderColor: 'var(--rule)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4" strokeWidth={2} style={{ color: 'var(--terracotta)' }} />
          <span className="text-[12.5px] font-bold" style={{ color: 'var(--ink)' }}>
            의료 기록 수동으로 추가
          </span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted" strokeWidth={2.2} />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted" strokeWidth={2.2} />
        )}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          {/* 방문일 */}
          <div>
            <label className="text-[10.5px] uppercase tracking-wider font-bold text-muted flex items-center gap-1">
              <Calendar className="w-3 h-3" strokeWidth={2.2} />
              방문일
            </label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-rule text-[12.5px] focus:outline-none focus:border-terracotta"
            />
          </div>

          {/* 진단 chips */}
          <div>
            <label className="text-[10.5px] uppercase tracking-wider font-bold text-muted">
              진단 (Enter 로 추가)
            </label>
            <div className="mt-1 flex gap-1.5">
              <input
                type="text"
                value={diagnosisInput}
                onChange={(e) => setDiagnosisInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addDiagnosis()
                  }
                }}
                placeholder="예: 아토피 피부염"
                className="flex-1 px-3 py-2 rounded-lg border border-rule text-[12.5px] focus:outline-none focus:border-terracotta"
              />
              <button
                type="button"
                onClick={addDiagnosis}
                className="px-3 py-2 rounded-lg border border-rule bg-white text-[11px] font-bold text-text hover:border-terracotta hover:text-terracotta"
              >
                +
              </button>
            </div>
            {diagnosis.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {diagnosis.map((d, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px]"
                    style={{ borderColor: 'var(--rule)', color: 'var(--ink)' }}
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => removeDiagnosis(i)}
                      aria-label="제거"
                      className="text-muted hover:text-sale"
                    >
                      <X className="w-3 h-3" strokeWidth={2.2} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 처방 약 */}
          <div>
            <label className="text-[10.5px] uppercase tracking-wider font-bold text-muted flex items-center gap-1">
              <Pill className="w-3 h-3" strokeWidth={2.2} />
              처방 약
            </label>
            <div className="mt-1 space-y-2">
              {meds.map((m, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="약 이름"
                    value={m.name}
                    onChange={(e) => updateMed(i, { name: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-rule text-[12px]"
                  />
                  <input
                    type="text"
                    placeholder="용량"
                    value={m.dosage}
                    onChange={(e) => updateMed(i, { dosage: e.target.value })}
                    className="w-20 px-2 py-2 rounded-lg border border-rule text-[12px]"
                  />
                  <input
                    type="text"
                    placeholder="횟수"
                    value={m.frequency}
                    onChange={(e) =>
                      updateMed(i, { frequency: e.target.value })
                    }
                    className="w-20 px-2 py-2 rounded-lg border border-rule text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={() => removeMed(i)}
                    aria-label="제거"
                    className="px-2 text-muted hover:text-sale"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addMed}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-terracotta hover:underline"
              >
                <Plus className="w-3 h-3" strokeWidth={2.2} />약 추가
              </button>
            </div>
          </div>

          {/* 체중 */}
          <div>
            <label className="text-[10.5px] uppercase tracking-wider font-bold text-muted flex items-center gap-1">
              <Scale className="w-3 h-3" strokeWidth={2.2} />
              체중 (kg, 선택)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="예: 5.2"
              inputMode="decimal"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-rule text-[12.5px]"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="text-[10.5px] uppercase tracking-wider font-bold text-muted">
              메모 (선택)
            </label>
            <textarea
              value={vetNotes}
              onChange={(e) => setVetNotes(e.target.value.slice(0, 1000))}
              rows={2}
              placeholder="예: 2주 후 재진 예정"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-rule text-[12.5px] focus:outline-none focus:border-terracotta resize-none"
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[12.5px] font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: 'var(--terracotta)' }}
          >
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                저장 중...
              </>
            ) : (
              '저장하기'
            )}
          </button>
        </div>
      )}
    </section>
  )
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
