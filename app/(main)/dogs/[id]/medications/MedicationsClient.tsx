'use client'

// B12 — medications DB 마이그 (R15-B). localStorage → Supabase.

import { useEffect, useState } from 'react'
import { Plus, Pill, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Select, useConfirm, Toggle } from '@/components/v3'
import {
  listMedications,
  insertMedication,
  deleteMedication,
  setMedicationEnabled,
  type MedicationRow,
} from '@/lib/dog-records'

export default function MedicationsClient({ dogId }: { dogId: string }) {
  const supabase = createClient()
  const [records, setRecords] = useState<MedicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [schedule, setSchedule] =
    useState<MedicationRow['schedule']>('daily')
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const confirm = useConfirm()

  useEffect(() => {
    let mounted = true
    listMedications(supabase, dogId)
      .then((rows) => {
        if (mounted) setRecords(rows)
      })
      .catch((e) => console.error('listMedications', e))
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [supabase, dogId])

  async function handleAdd() {
    if (!name || saving) return
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('not-authed')
      const rec = await insertMedication(supabase, {
        dog_id: dogId,
        user_id: user.id,
        name,
        schedule,
        dose: dose || null,
        time: time || null,
        enabled: true,
        note: note || null,
      })
      setRecords((rs) => [rec, ...rs])
      setOpen(false)
      setName('')
      setDose('')
      setSchedule('daily')
      setTime('')
      setNote('')
    } catch (e) {
      console.error('insertMedication', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: string, next: boolean) {
    // optimistic
    setRecords((rs) =>
      rs.map((r) => (r.id === id ? { ...r, enabled: next } : r)),
    )
    try {
      await setMedicationEnabled(supabase, id, next)
    } catch (e) {
      console.error('setMedicationEnabled', e)
      // rollback
      setRecords((rs) =>
        rs.map((r) => (r.id === id ? { ...r, enabled: !next } : r)),
      )
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '복약 기록을 삭제할까요?',
      body: '삭제한 기록은 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'destructive',
    })
    if (!ok) return
    try {
      await deleteMedication(supabase, id)
      setRecords((rs) => rs.filter((r) => r.id !== id))
    } catch (e) {
      console.error('deleteMedication', e)
    }
  }

  const SCHED_LABEL: Record<MedicationRow['schedule'], string> = {
    daily: '매일',
    weekly: '매주',
    asneeded: '필요할 때',
  }

  return (
    <>
      <section className="px-5 mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded border border-rule bg-bg-3 py-3 inline-flex items-center justify-center gap-2 text-[13px] font-bold text-text active:scale-[0.99] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          약물 추가
        </button>
      </section>

      <section className="px-5 mt-4">
        {loading ? (
          <p className="text-[12px] text-muted text-center py-8">
            불러오는 중…
          </p>
        ) : records.length === 0 ? (
          <p className="text-[12px] text-muted text-center py-8">
            등록된 약물이 없어요. 정기 복약이 필요한 약을 추가해 보세요.
          </p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className="rounded border border-rule bg-bg-3 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Pill
                        className="w-3.5 h-3.5 text-terracotta"
                        strokeWidth={2}
                      />
                      <p
                        className="font-sans"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--ink)',
                        }}
                      >
                        {r.name}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted mt-1">
                      {SCHED_LABEL[r.schedule]}
                      {r.time && ` · ${r.time}`}
                      {r.dose && ` · ${r.dose}`}
                    </p>
                    {r.note && (
                      <p className="text-[12px] text-text mt-1">{r.note}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Toggle
                      checked={r.enabled}
                      onChange={(v) => handleToggle(r.id, v)}
                      size="sm"
                      ariaLabel="알림 on/off"
                    />
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      aria-label="삭제"
                      className="text-muted hover:text-sale transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="약물 추가">
        <Modal.Body>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                약물 이름 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 심장사상충 예방약"
                className="w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                용량
              </label>
              <input
                type="text"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                placeholder="예: 1/2 tab"
                className="w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                주기 *
              </label>
              <Select
                value={schedule}
                onChange={(e) =>
                  setSchedule(e.target.value as MedicationRow['schedule'])
                }
                options={[
                  { value: 'daily', label: '매일' },
                  { value: 'weekly', label: '매주' },
                  { value: 'asneeded', label: '필요할 때' },
                ]}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                시간
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[13px] text-text focus:outline-none focus:border-terracotta transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                메모
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 밥 직후 복용"
                className="w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded border border-rule bg-bg-3 text-[12px] font-semibold text-text"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!name || saving}
            className="px-4 py-2 rounded bg-text text-bg text-[12px] font-bold disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
