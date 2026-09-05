'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, X, MessageCircleQuestion } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { useModalA11y } from '@/lib/ui/useModalA11y'
import { Hl } from '@/components/admin/ui'
import NumberInput from '@/components/admin/NumberInput'

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
  const toast = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminFaqRow | null>(null)
  const [saving, setSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // 모달 a11y — focus trap / Esc / scroll lock.
  useModalA11y({
    open: modalOpen,
    onClose: () => !saving && setModalOpen(false),
    containerRef: modalRef,
    preventEscape: saving,
  })
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
      toast.error('질문과 답변은 필수예요')
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
      toast.error((editing ? '수정' : '생성') + ' 실패: ' + error.message)
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
      toast.error('공개 상태 변경 실패: ' + error.message)
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
      toast.error('삭제 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="size-5 text-primary" strokeWidth={2} />
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              자주 묻는 질문
            </h1>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">
            <Hl>고객이 보는 /faq 페이지의 질문·답변</Hl>을 관리하는 곳이에요.
            문의가 자주 들어오는 내용을 여기 넣어두면 CS를 줄일 수 있어요. — 총{' '}
            {initialFaqs.length}개
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
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
              ? 'bg-primary text-primary-foreground'
              : 'bg-card border border-border text-foreground hover:bg-secondary/50'
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
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-foreground hover:bg-secondary/50'
            }`}
          >
            {cat} ({counts.get(cat) ?? 0})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="p-12 rounded-xl bg-card border border-border shadow-sm text-center">
          <p className="text-sm text-muted-foreground">
            {filterCategory === 'all'
              ? '등록된 FAQ 가 없어요.'
              : '이 카테고리에 등록된 FAQ 가 없어요.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card border border-border shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground border-b border-border bg-secondary">
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
                  className="border-b border-border last:border-b-0 hover:bg-secondary/60 transition"
                >
                  <td className="py-3 px-4 align-top">
                    <span className="whitespace-nowrap inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {f.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="font-semibold text-foreground">{f.question}</div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {f.answer}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-right text-[11px] font-mono tabular-nums text-foreground align-top">
                    {f.sort_order}
                  </td>
                  <td className="py-3 px-4 text-right align-top">
                    <button
                      onClick={() => togglePublished(f)}
                      className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        f.is_published
                          ? 'bg-emerald-600 text-white'
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      {f.is_published ? '공개' : '숨김'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right align-top">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => openEdit(f)}
                        className="p-1.5 rounded hover:bg-secondary transition"
                      >
                        <Pencil className="w-3.5 h-3.5 text-foreground" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => remove(f)}
                        disabled={deleting === f.id}
                        className="p-1.5 rounded hover:bg-destructive/10 transition disabled:opacity-40"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" strokeWidth={2} />
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
          className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-6 overflow-y-auto"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="faq-modal-title"
            tabIndex={-1}
            className="w-full max-w-xl bg-secondary rounded-lg shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-secondary rounded-t-2xl z-10">
              <h2 id="faq-modal-title" className="font-bold tracking-tight text-lg text-foreground">
                {editing ? 'EDIT FAQ' : 'NEW FAQ'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded hover:bg-secondary transition"
              >
                <X className="w-4 h-4 text-foreground" strokeWidth={2} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <Field label="카테고리">
                <select
                  value={category}
                  onChange={(ev) => setCategory(ev.target.value as FaqCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="질문">
                <input
                  type="text"
                  value={question}
                  onChange={(ev) => setQuestion(ev.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
                  placeholder="하루에 얼마나 먹여야 하나요?"
                />
              </Field>

              <Field label="답변">
                <textarea
                  value={answer}
                  onChange={(ev) => setAnswer(ev.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none leading-relaxed"
                  placeholder="체중과 활동량에 따라 다르며..."
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="정렬 순서" hint="낮을수록 먼저">
                  <NumberInput
                    value={sortOrder}
                    onChange={(v) => setSortOrder(v ?? 0)}
                    emptyAs={0}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm font-mono"
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
                    <span className="text-sm text-foreground">{isPublished ? '공개' : '숨김'}</span>
                  </label>
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-secondary rounded-b-2xl">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-foreground hover:bg-secondary transition"
              >
                취소
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
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
      <label className="block text-[11px] font-bold text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
