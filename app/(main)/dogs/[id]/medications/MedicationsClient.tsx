'use client'

// B12 — medications DB 마이그 (R15-B). localStorage → Supabase.

import { useEffect, useState } from 'react'
import { Plus, Pill, Trash2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Select, useConfirm, Toggle } from '@/components/v3'
import BottomSheet from '@/components/ui/BottomSheet'
import { SheetField, SheetInput } from '@/components/v3/sheet/SheetField'
import {
  listMedications,
  insertMedication,
  deleteMedication,
  setMedicationEnabled,
  type MedicationRow,
} from '@/lib/dog-records'
import { useToast } from '@/components/ui/Toast'

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
  const toast = useToast()

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
      toast.error('저장하지 못했어요. 잠시 후 다시 시도해 주세요')
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
      toast.error('삭제하지 못했어요')
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
          className="w-full rounded border border-rule bg-bg-3 py-3 inline-flex items-center justify-center gap-2 text-[13.5px] font-bold text-text active:scale-[0.99] transition"
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
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: 'var(--ink)',
                        }}
                      >
                        {r.name}
                      </p>
                    </div>
                    <p className="text-[10.5px] text-muted mt-1">
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

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="약물 추가"
        dismissOnBackdrop={!saving}
      >
        <BottomSheet.Body>
          <h2
            className="font-sans"
            style={{
              margin: 0,
              fontWeight: 800,
              fontSize: 22,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            약물 추가
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            정기 복약·영양제 시간과 용량을 기록해요
          </p>

          <SheetField label="약물 이름" required>
            <SheetInput
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="약물 이름"
              placeholder="예: 심장사상충 예방약"
            />
          </SheetField>
          <SheetField label="용량">
            <SheetInput
              type="text"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              aria-label="용량"
              placeholder="예: 1/2 tab"
            />
          </SheetField>
          <SheetField label="주기" required>
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
          </SheetField>
          <SheetField label="시간">
            <SheetInput
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="복약 시간"
            />
          </SheetField>
          <SheetField label="메모">
            <SheetInput
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="메모"
              placeholder="예: 밥 직후 복용"
            />
          </SheetField>
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!name || saving}
            className="flex items-center justify-center gap-2 w-full h-[52px] rounded bg-text text-bg text-[15px] font-bold disabled:opacity-50 active:scale-[0.98] transition"
          >
            <Check className="w-4 h-4" strokeWidth={2.2} />
            {saving ? '저장 중…' : '저장'}
          </button>
        </BottomSheet.Footer>
      </BottomSheet>
    </>
  )
}
