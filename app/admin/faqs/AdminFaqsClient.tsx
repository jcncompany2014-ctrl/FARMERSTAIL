'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * /admin/faqs — FAQ CRUD 클라이언트.
 *
 * 카테고리는 DB CHECK 제약으로 4개 고정. select 로만 입력받아 오타 방지.
 */

const CATEGORIES = ['식단·영양', '배송·환불', '결제', '정기배송'] as const
export type FaqCategory = (typeof CATEGORIES)[number]

export type AdminFaqRow = {
  id: string
  category: FaqCategory
  question: string
  answer: string
  is_published: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export default function AdminFaqsClient({
  initialFaqs,
}: {
  initialFaqs: AdminFaqRow[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminFaqRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [filterCategory, setFilterCategory] = useState<FaqCategory | 'all'>('all')

  const [category, setCategory] = useState<FaqCategory>('식단·영양')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [sortOrder, setSortOrder] = useState(0)

  const visible = useMemo(
    () =>
      filterCategory === 'all'
        ? initialFaqs
        : initialFaqs.filter((f) => f.category === filterCategory),
    [initialFaqs, filterCategory],
  )

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of initialFaqs) {
      map.set(f.category, (map.get(f.category) ?? 0) + 1)
    }
    return map
  }, [initialFaqs])

  function reset() {
    setCategory('식단·영양')
    setQuestion('')
    setAnswer('')
    setIsPublished(true)
    setSortOrder(0)
  }

  function openCreate() {
    setEditing(null)
    reset()
    setModalOpen(true)
  }

  function openEdit(f: AdminFaqRow) {
    setEditing(f)
    setCategory(f.category)
    setQuestion(f.question)
    setAnswer(f.answer)
    setIsPublished(f.is_published)
    setSortOrder(f.sort_order)
    setModalOpen(true)
  }

  async function save() {
    if (!question.trim() || !answer.trim()) {
      alert('question / answer 는 필수입니다')
      return
    }
    const payload = {
      category,
      question: question.trim(),
      answer: answer.trim(),
      is_published: isPublished,
      sort_order: sortOrder,
    }
    setSaving(true)
    const { error } = editing
      ? await supabase.from('faqs').update(payload).eq('id', editing.id)
      : await supabase.from('faqs').insert(payload)
    setSaving(false)
    if (error) {
      alert((editing ? '수정' : '생성') + ' 실패: ' + error.message)
      return
    }
    setModalOpen(false)
    setEditing(null)
    router.refresh()
  }

  async function togglePublished(f: AdminFaqRow) {
    const { error } = await supabase
      .from('faqs')
      .update({ is_published: !f.is_published })
      .eq('id', f.id)
    if (error) {
      alert('공개 상태 변경 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  async function remove(f: AdminFaqRow) {
    if (!confirm(`"${f.question}" 항목을 삭제할까요?`)) return
    setDeleting(f.id)
    const { error } = await supabase.from('faqs').delete().eq('id', f.id)
    setDeleting(null)
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-['Archivo_Black'] text-3xl text-ink">FAQ</h1>
          <p className="text-sm text-muted mt-1">
            /faq 페이지에 노출되는 자주 묻는 질문. 총 {initialFaqs.length}개 등록.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-terracotta text-white text-sm font-semibold hover:bg-[#8A3822] transition"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />새 항목
        </button>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
            filterCategory === 'all'
              ? 'bg-ink text-white'
              : 'bg-white border border-rule text-ink hover:bg-bg'
          }`}
        >
          전체 ({initialFaqs.length})
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
              filterCategory === cat
                ? 'bg-ink text-white'
                : 'bg-white border border-rule text-ink hover:bg-bg'
            }`}
          >
            {cat} ({counts.get(cat) ?? 0})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-rule text-center">
          <p className="text-sm text-muted">
            {filterCategory === 'all'
              ? '등록된 FAQ 가 없어요.'
              : '이 카테고리에 등록된 FAQ 가 없어요.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white border border-rule">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted border-b border-rule bg-bg">
                <th className="text-left py-3 px-4 font-medium">카테고리</th>
                <th className="text-left py-3 px-4 font-medium">질문 / 답변</th>
                <th className="text-right py-3 px-4 font-medium">정렬</th>
                <th className="text-right py-3 px-4 font-medium">상태</th>
                <th className="text-right py-3 px-4 font-medium">액션</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr
                  key={f.id}
                  className="border-b border-bg last:border-b-0 hover:bg-bg/60 transition"
                >
                  <td className="py-3 px-4 align-top">
                    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-terracotta/10 text-terracotta">
                      {f.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="font-semibold text-ink">{f.question}</div>
                    <p className="text-[11px] text-muted mt-1 line-clamp-2 leading-relaxed">
                      {f.answer}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-right text-[11px] font-mono tabular-nums text-ink align-top">
                    {f.sort_order}
                  </td>
                  <td className="py-3 px-4 text-right align-top">
                    <button
                      onClick={() => togglePublished(f)}
                      className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.is_published
                          ? 'bg-moss text-white'
                          : 'bg-rule text-text'
                      }`}
                    >
                      {f.is_published ? '공개' : '숨김'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right align-top">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => openEdit(f)}
                        className="p-1.5 rounded hover:bg-rule transition"
                      >
                        <Pencil className="w-3.5 h-3.5 text-ink" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => remove(f)}
                        disabled={deleting === f.id}
                        className="p-1.5 rounded hover:bg-sale/10 transition disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-sale" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/60 flex items-start justify-center p-6 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-bg rounded-2xl shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-rule sticky top-0 bg-bg rounded-t-2xl z-10">
              <h2 className="font-['Archivo_Black'] text-lg text-ink">
                {editing ? 'EDIT FAQ' : 'NEW FAQ'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded hover:bg-rule transition"
              >
                <X className="w-4 h-4 text-ink" strokeWidth={2} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <Field label="카테고리">
                <select
                  value={category}
                  onChange={(ev) => setCategory(ev.target.value as FaqCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="question (질문)">
                <input
                  type="text"
                  value={question}
                  onChange={(ev) => setQuestion(ev.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm"
                  placeholder="하루에 얼마나 먹여야 하나요?"
                />
              </Field>

              <Field label="answer (답변)">
                <textarea
                  value={answer}
                  onChange={(ev) => setAnswer(ev.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm resize-none leading-relaxed"
                  placeholder="체중과 활동량에 따라 다르며..."
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="sort_order" hint="낮을수록 먼저">
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(ev) => setSortOrder(parseInt(ev.target.value || '0', 10))}
                    className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm font-mono"
                  />
                </Field>
                <Field label="공개 여부">
                  <label className="flex items-center gap-3 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(ev) => setIsPublished(ev.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="text-sm text-ink">{isPublished ? '공개' : '숨김'}</span>
                  </label>
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-rule sticky bottom-0 bg-bg rounded-b-2xl">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-ink hover:bg-rule transition"
              >
                취소
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-terracotta text-white text-sm font-semibold hover:bg-[#8A3822] transition disabled:opacity-50"
              >
                {saving ? '저장 중…' : editing ? '수정 저장' : 'FAQ 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-muted">{hint}</p>}
    </div>
  )
}
