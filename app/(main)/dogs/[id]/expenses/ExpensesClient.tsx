'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, ShoppingBag, Stethoscope, Cookie, Sparkles } from 'lucide-react'
import { Modal, DatePicker, Select, useConfirm } from '@/components/v3'

const STORAGE_KEY = (dogId: string) => `ft:exp:${dogId}`

type ExpCategory = 'food' | 'vet' | 'snack' | 'supplies' | 'etc'

interface ExpRecord {
  id: string
  category: ExpCategory
  amount: number
  date: string
  memo?: string
}

const CATEGORY_META: Record<
  ExpCategory,
  { label: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; tone: string }
> = {
  food: { label: '사료', Icon: ShoppingBag, tone: 'var(--terracotta)' },
  vet: { label: '병원', Icon: Stethoscope, tone: 'var(--sale)' },
  snack: { label: '간식', Icon: Cookie, tone: 'var(--gold)' },
  supplies: { label: '용품', Icon: Sparkles, tone: 'var(--moss)' },
  etc: { label: '기타', Icon: ShoppingBag, tone: 'var(--muted)' },
}

function load(dogId: string): ExpRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY(dogId))
    return raw ? (JSON.parse(raw) as ExpRecord[]) : []
  } catch {
    return []
  }
}

function save(dogId: string, records: ExpRecord[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY(dogId), JSON.stringify(records))
  } catch {
    /* noop */
  }
}

function formatKRW(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export default function ExpensesClient({ dogId }: { dogId: string }) {
  const [records, setRecords] = useState<ExpRecord[]>([])
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ExpCategory>('food')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('')
  const confirm = useConfirm()

  useEffect(() => {
    setRecords(load(dogId))
  }, [dogId])

  const monthTotal = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7)
    return records
      .filter((r) => r.date.startsWith(month))
      .reduce((sum, r) => sum + r.amount, 0)
  }, [records])

  const byCategory = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7)
    const map = new Map<ExpCategory, number>()
    for (const r of records) {
      if (!r.date.startsWith(month)) continue
      map.set(r.category, (map.get(r.category) ?? 0) + r.amount)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [records])

  function persist(updated: ExpRecord[]) {
    setRecords(updated)
    save(dogId, updated)
  }

  function handleAdd() {
    const n = parseInt(amount, 10)
    if (!Number.isFinite(n) || n <= 0) return
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`
    const rec: ExpRecord = { id, category, amount: n, date }
    if (memo) rec.memo = memo
    const updated = [rec, ...records].sort((a, b) =>
      b.date.localeCompare(a.date),
    )
    persist(updated)
    setOpen(false)
    setAmount('')
    setMemo('')
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '이 지출을 삭제할까요?',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'destructive',
    })
    if (!ok) return
    persist(records.filter((r) => r.id !== id))
  }

  return (
    <>
      <section className="px-5 mt-4">
        <div className="rounded border border-rule bg-bg-3 px-5 py-4">
          <span className="kicker">이번 달</span>
          <p
            className="font-sans mt-1"
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
            }}
          >
            {formatKRW(monthTotal)}
          </p>
          {byCategory.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {byCategory.map(([cat, sum]) => {
                const meta = CATEGORY_META[cat]
                const Icon = meta.Icon
                return (
                  <div
                    key={cat}
                    className="rounded border border-rule bg-bg px-3 py-2 flex items-center gap-2"
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      strokeWidth={2}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[10.5px] uppercase tracking-widest"
                        style={{ color: meta.tone }}
                      >
                        {meta.label}
                      </p>
                      <p
                        className="font-sans"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--ink)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {formatKRW(sum)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="px-5 mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded border border-rule bg-bg-3 py-3 inline-flex items-center justify-center gap-2 text-[13px] font-bold text-text active:scale-[0.99] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          지출 추가
        </button>
      </section>

      <section className="px-5 mt-4">
        <h2 className="kicker mb-2">최근 기록</h2>
        {records.length === 0 ? (
          <p className="text-[12px] text-muted text-center py-8">
            아직 기록이 없어요.
          </p>
        ) : (
          <div className="space-y-2">
            {records.slice(0, 20).map((r) => {
              const meta = CATEGORY_META[r.category]
              const Icon = meta.Icon
              return (
                <div
                  key={r.id}
                  className="rounded border border-rule bg-bg-3 px-4 py-3 flex items-center gap-3"
                >
                  <Icon
                    className="w-4 h-4 shrink-0"
                    strokeWidth={2}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-sans"
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--ink)',
                      }}
                    >
                      {formatKRW(r.amount)}
                    </p>
                    <p className="text-[11px] text-muted">
                      {meta.label} · {r.date}
                      {r.memo && ` · ${r.memo}`}
                    </p>
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
              )
            })}
          </div>
        )}
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="지출 추가">
        <Modal.Body>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                카테고리 *
              </label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpCategory)}
                options={Object.entries(CATEGORY_META).map(([k, v]) => ({
                  value: k,
                  label: v.label,
                }))}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                금액 (원) *
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="예: 35000"
                className="w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                날짜 *
              </label>
              <DatePicker
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                메모
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 대형병원 정기검진"
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
            className="px-4 py-2 rounded bg-text text-bg text-[12px] font-bold"
          >
            저장
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
