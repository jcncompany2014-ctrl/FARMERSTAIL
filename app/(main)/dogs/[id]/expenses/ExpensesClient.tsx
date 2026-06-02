'use client'

// B13 — expenses DB 마이그 (R15-B). localStorage → Supabase.

import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  ShoppingBag,
  Stethoscope,
  Cookie,
  Sparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Modal, DatePicker, Select, useConfirm } from '@/components/v3'
import {
  listExpenses,
  insertExpense,
  deleteExpense,
  type ExpenseRow,
} from '@/lib/dog-records'

type ExpCategory = ExpenseRow['category']

const CATEGORY_META: Record<
  ExpCategory,
  {
    label: string
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
    tone: string
  }
> = {
  food: { label: '사료', Icon: ShoppingBag, tone: 'var(--terracotta)' },
  vet: { label: '병원', Icon: Stethoscope, tone: 'var(--sale)' },
  snack: { label: '간식', Icon: Cookie, tone: 'var(--gold)' },
  supplies: { label: '용품', Icon: Sparkles, tone: 'var(--moss)' },
  etc: { label: '기타', Icon: ShoppingBag, tone: 'var(--muted)' },
}

function formatKRW(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

export default function ExpensesClient({ dogId }: { dogId: string }) {
  const supabase = createClient()
  const [records, setRecords] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ExpCategory>('food')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const confirm = useConfirm()

  useEffect(() => {
    let mounted = true
    listExpenses(supabase, dogId)
      .then((rows) => {
        if (mounted) setRecords(rows)
      })
      .catch((e) => console.error('listExpenses', e))
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [supabase, dogId])

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

  async function handleAdd() {
    const n = parseInt(amount, 10)
    if (!Number.isFinite(n) || n <= 0 || saving) return
    setSaving(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('not-authed')
      const rec = await insertExpense(supabase, {
        dog_id: dogId,
        user_id: user.id,
        category,
        amount: n,
        date,
        memo: memo || null,
      })
      setRecords((rs) =>
        [rec, ...rs].sort((a, b) => b.date.localeCompare(a.date)),
      )
      setOpen(false)
      setAmount('')
      setMemo('')
    } catch (e) {
      console.error('insertExpense', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '이 지출을 삭제할까요?',
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'destructive',
    })
    if (!ok) return
    try {
      await deleteExpense(supabase, id)
      setRecords((rs) => rs.filter((r) => r.id !== id))
    } catch (e) {
      console.error('deleteExpense', e)
    }
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
                    <Icon className="w-3.5 h-3.5" strokeWidth={2} />
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
                          fontSize: 13.5,
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
          className="w-full rounded border border-rule bg-bg-3 py-3 inline-flex items-center justify-center gap-2 text-[13.5px] font-bold text-text active:scale-[0.99] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          지출 추가
        </button>
      </section>

      <section className="px-5 mt-4">
        <h2 className="kicker mb-2">최근 기록</h2>
        {loading ? (
          <p className="text-[12px] text-muted text-center py-8">
            불러오는 중…
          </p>
        ) : records.length === 0 ? (
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
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-sans"
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: 'var(--ink)',
                      }}
                    >
                      {formatKRW(r.amount)}
                    </p>
                    <p className="text-[10.5px] text-muted">
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
              <label className="block text-[10.5px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
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
              <label className="block text-[10.5px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                금액 (원) *
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="예: 35000"
                className="w-full px-4 py-3 rounded border border-rule bg-bg-3 text-[13.5px] text-text placeholder:text-muted focus:outline-none focus:border-terracotta transition"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                날짜 *
              </label>
              <DatePicker
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-muted mb-2 uppercase tracking-[0.2em]">
                메모
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 대형병원 정기검진"
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
            disabled={saving}
            className="px-4 py-2 rounded bg-text text-bg text-[12px] font-bold disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
