'use client'

import { useEffect, useState } from 'react'
import { Plus, Syringe, Trash2 } from 'lucide-react'
import { Modal, DatePicker, Select, useConfirm } from '@/components/v3'

const STORAGE_KEY = (dogId: string) => `ft:vax:${dogId}`

interface VaxRecord {
  id: string
  vaccine: string
  date: string // ISO yyyy-mm-dd
  next?: string
  note?: string
}

// 한국 견 예방접종 표준 (DHPPL, 코로나, 켄넬코프, 광견병).
const VACCINE_OPTIONS = [
  { value: 'DHPPL', label: 'DHPPL (종합)' },
  { value: 'Corona', label: '코로나 장염' },
  { value: 'KennelCough', label: '켄넬코프' },
  { value: 'Rabies', label: '광견병' },
  { value: 'Heartworm', label: '심장사상충 예방약' },
  { value: 'Other', label: '기타' },
]

function load(dogId: string): VaxRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY(dogId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(dogId: string, records: VaxRecord[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY(dogId), JSON.stringify(records))
  } catch {
    /* noop */
  }
}

export default function VaccinationsClient({
  dogId,
  dogName,
}: {
  dogId: string
  dogName: string
}) {
  const [records, setRecords] = useState<VaxRecord[]>([])
  const [open, setOpen] = useState(false)
  const [vaccine, setVaccine] = useState('')
  const [date, setDate] = useState('')
  const [next, setNext] = useState('')
  const [note, setNote] = useState('')
  const confirm = useConfirm()

  useEffect(() => {
    setRecords(load(dogId))
  }, [dogId])

  function handleAdd() {
    if (!vaccine || !date) return
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    const rec: VaxRecord = { id, vaccine, date }
    if (next) rec.next = next
    if (note) rec.note = note
    const updated = [rec, ...records].sort((a, b) =>
      b.date.localeCompare(a.date),
    )
    setRecords(updated)
    save(dogId, updated)
    setOpen(false)
    setVaccine('')
    setDate('')
    setNext('')
    setNote('')
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
    const updated = records.filter((r) => r.id !== id)
    setRecords(updated)
    save(dogId, updated)
  }

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = records
    .filter((r) => r.next && r.next >= today)
    .sort((a, b) => (a.next ?? '').localeCompare(b.next ?? ''))

  return (
    <>
      <section className="px-5 mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded border border-rule bg-bg-3 py-3 inline-flex items-center justify-center gap-2 text-[13px] font-bold text-text active:scale-[0.99] transition"
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
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--ink)',
                    }}
                  >
                    {VACCINE_OPTIONS.find((v) => v.value === r.vaccine)?.label ??
                      r.vaccine}
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    다음 일정 {r.next}
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
        {records.length === 0 ? (
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
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--ink)',
                      }}
                    >
                      {VACCINE_OPTIONS.find((v) => v.value === r.vaccine)
                        ?.label ?? r.vaccine}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      접종일 {r.date}
                      {r.next && ` · 다음 ${r.next}`}
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
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
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
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                접종일 *
              </label>
              <DatePicker
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={today}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                다음 일정
              </label>
              <DatePicker
                value={next}
                onChange={(e) => setNext(e.target.value)}
                min={date || today}
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
                placeholder="예: 동물병원, 이상반응 없음"
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
            disabled={!vaccine || !date}
            className="px-4 py-2 rounded bg-text text-bg text-[12px] font-bold disabled:opacity-50"
          >
            저장
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
