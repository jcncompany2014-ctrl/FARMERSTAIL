'use client'

// B11 — vaccinations DB 마이그 (R15-B). localStorage → Supabase.
// 기존 localStorage 데이터는 마이그레이션 X (베타 단계, 사용자 거의 없음).

import { useEffect, useState } from 'react'
import { Plus, Syringe, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Modal, DatePicker, Select, useConfirm } from '@/components/v3'
import {
  listVaccinations,
  insertVaccination,
  deleteVaccination,
  type VaccinationRow,
} from '@/lib/dog-records'

// 한국 견 예방접종 표준 (DHPPL, 코로나, 켄넬코프, 광견병).
const VACCINE_OPTIONS = [
  { value: 'DHPPL', label: 'DHPPL (종합)' },
  { value: 'Corona', label: '코로나 장염' },
  { value: 'KennelCough', label: '켄넬코프' },
  { value: 'Rabies', label: '광견병' },
  { value: 'Heartworm', label: '심장사상충 예방약' },
  { value: 'Other', label: '기타' },
]

export default function VaccinationsClient({
  dogId,
  dogName,
}: {
  dogId: string
  dogName: string
}) {
  const supabase = createClient()
  const [records, setRecords] = useState<VaccinationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [vaccine, setVaccine] = useState('')
  const [date, setDate] = useState('')
  const [next, setNext] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const confirm = useConfirm()

  useEffect(() => {
    let mounted = true
    listVaccinations(supabase, dogId)
      .then((rows) => {
        if (!mounted) return
        setRecords(rows)
      })
      .catch((e) => {
        console.error('listVaccinations', e)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [supabase, dogId])

  async function handleAdd() {
    if (!vaccine || !date || saving) return
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('not-authed')
      const rec = await insertVaccination(supabase, {
        dog_id: dogId,
        user_id: user.id,
        vaccine,
        date,
        next_date: next || null,
        note: note || null,
      })
      setRecords((rs) =>
        [rec, ...rs].sort((a, b) => b.date.localeCompare(a.date)),
      )
      setOpen(false)
      setVaccine('')
      setDate('')
      setNext('')
      setNote('')
    } catch (e) {
      console.error('insertVaccination', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '예방접종 기록을 삭제할까요?',
      body: '삭제한 기록은 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'destructive',
    })
    if (!ok) return
    try {
      await deleteVaccination(supabase, id)
      setRecords((rs) => rs.filter((r) => r.id !== id))
    } catch (e) {
      console.error('deleteVaccination', e)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = records
    .filter((r) => r.next_date && r.next_date >= today)
    .sort((a, b) => (a.next_date ?? '').localeCompare(b.next_date ?? ''))

  return (
    <>
      <section className="px-5 mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded border border-rule bg-bg-3 py-3 inline-flex items-center justify-center gap-2 text-[13.5px] font-bold text-text active:scale-[0.99] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          새 기록 추가
        </button>
      </section>

      {upcoming.length > 0 && (
        <section className="px-5 mt-4">
          <h2 className="kicker mb-2">Upcoming</h2>
          <div className="space-y-2">
            {upcoming.map((r) => (
              <div
                key={r.id}
                className="rounded border border-rule bg-bg-3 px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p
                    className="font-sans"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--ink)',
                    }}
                  >
                    {VACCINE_OPTIONS.find((v) => v.value === r.vaccine)?.label ??
                      r.vaccine}
                  </p>
                  <p className="text-[10.5px] text-muted mt-0.5">
                    다음 일정 {r.next_date}
                  </p>
                </div>
                <Syringe className="w-4 h-4 text-terracotta" strokeWidth={2} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 mt-4">
        <h2 className="kicker mb-2">기록</h2>
        {loading ? (
          <p className="text-[12px] text-muted text-center py-8">불러오는 중…</p>
        ) : records.length === 0 ? (
          <p className="text-[12px] text-muted text-center py-8">
            아직 기록이 없어요. {dogName}의 첫 접종 기록을 추가해 보세요.
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
                    <p
                      className="font-sans"
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: 'var(--ink)',
                      }}
                    >
                      {VACCINE_OPTIONS.find((v) => v.value === r.vaccine)
                        ?.label ?? r.vaccine}
                    </p>
                    <p className="text-[10.5px] text-muted mt-0.5">
                      접종일 {r.date}
                      {r.next_date && ` · 다음 ${r.next_date}`}
                    </p>
                    {r.note && (
                      <p className="text-[12px] text-text mt-1">{r.note}</p>
                    )}
                  </div>
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
            ))}
          </div>
        )}
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="새 예방접종 기록"
      >
        <Modal.Body>
          <div className="space-y-3">
            <div>
              <label className="block text-[10.5px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                백신 *
              </label>
              <Select
                value={vaccine}
                onChange={(e) => setVaccine(e.target.value)}
                options={[
                  { value: '', label: '선택하세요' },
                  ...VACCINE_OPTIONS,
                ]}
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                접종일 *
              </label>
              <DatePicker
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={today}
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                다음 일정
              </label>
              <DatePicker
                value={next}
                onChange={(e) => setNext(e.target.value)}
                min={date || today}
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                메모
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: 동물병원, 이상반응 없음"
                className="w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[13.5px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition"
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
            disabled={!vaccine || !date || saving}
            className="px-4 py-2 rounded bg-text text-bg text-[12px] font-bold disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
