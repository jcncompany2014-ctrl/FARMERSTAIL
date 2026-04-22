'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Category = {
  id: string
  slug: string
  name: string
  sort_order: number
}

type Props = {
  initial: Category[]
  postCounts: Record<string, number>
}

export default function CategoriesManager({ initial, postCounts }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [items, setItems] = useState<Category[]>(initial)
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [loading, setLoading] = useState(false)

  function updateItem(id: string, patch: Partial<Category>) {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !newSlug.trim()) return
    setLoading(true)
    const nextOrder = Math.max(...items.map((i) => i.sort_order), -1) + 1
    const { data, error } = await supabase
      .from('blog_categories')
      .insert({
        name: newName.trim(),
        slug: newSlug.trim(),
        sort_order: nextOrder,
      })
      .select('id, slug, name, sort_order')
      .single()
    setLoading(false)
    if (error) {
      alert('추가 실패: ' + error.message)
      return
    }
    setItems((prev) => [...prev, data as Category])
    setNewName('')
    setNewSlug('')
    router.refresh()
  }

  async function saveOne(c: Category) {
    setLoading(true)
    const { error } = await supabase
      .from('blog_categories')
      .update({ name: c.name, slug: c.slug, sort_order: c.sort_order })
      .eq('id', c.id)
    setLoading(false)
    if (error) {
      alert('저장 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  async function remove(c: Category) {
    const count = postCounts[c.id] ?? 0
    if (count > 0) {
      alert(`${count}개의 글에서 이 카테고리를 사용 중이에요. 먼저 이전해 주세요.`)
      return
    }
    if (!confirm(`"${c.name}" 카테고리를 삭제할까요?`)) return
    setLoading(true)
    const { error } = await supabase
      .from('blog_categories')
      .delete()
      .eq('id', c.id)
    setLoading(false)
    if (error) {
      alert('삭제 실패: ' + error.message)
      return
    }
    setItems((prev) => prev.filter((i) => i.id !== c.id))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* 목록 */}
      <div className="p-6 rounded-2xl bg-white border border-rule">
        {items.length === 0 ? (
          <p className="text-center text-sm text-muted py-6">
            카테고리가 없어요
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((c) => {
              const count = postCounts[c.id] ?? 0
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 p-3 rounded-lg bg-bg"
                >
                  <input
                    type="number"
                    value={c.sort_order}
                    onChange={(e) =>
                      updateItem(c.id, { sort_order: Number(e.target.value) })
                    }
                    className="w-14 px-2 py-1.5 rounded bg-white text-xs text-center text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                    aria-label="정렬 순서"
                  />
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) => updateItem(c.id, { name: e.target.value })}
                    className="flex-1 px-3 py-1.5 rounded bg-white text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                    placeholder="이름"
                  />
                  <input
                    type="text"
                    value={c.slug}
                    onChange={(e) => updateItem(c.id, { slug: e.target.value })}
                    className="w-40 px-3 py-1.5 rounded bg-white text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                    placeholder="slug"
                  />
                  <span className="text-[10px] text-muted w-14 text-right">
                    {count}개 글
                  </span>
                  <button
                    type="button"
                    onClick={() => saveOne(c)}
                    disabled={loading}
                    className="p-2 rounded bg-text text-white hover:bg-[#5C4130] transition disabled:opacity-50"
                    aria-label="저장"
                  >
                    <Save className="w-3.5 h-3.5" strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    disabled={loading || count > 0}
                    className="p-2 rounded bg-white border border-sale/40 text-sale hover:border-sale transition disabled:opacity-30"
                    aria-label="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2.25} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 새 카테고리 */}
      <form
        onSubmit={addCategory}
        className="p-6 rounded-2xl bg-white border border-rule"
      >
        <h3 className="text-sm font-bold text-ink mb-3">
          새 카테고리 추가
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="이름 (예: 훈련 팁)"
            className="flex-1 px-3 py-2 rounded-lg bg-bg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
          />
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="slug (예: training-tips)"
            className="w-48 px-3 py-2 rounded-lg bg-bg text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
          />
          <button
            type="submit"
            disabled={loading || !newName.trim() || !newSlug.trim()}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-terracotta text-white text-xs font-bold hover:bg-[#8A3822] transition disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            추가
          </button>
        </div>
      </form>
    </div>
  )
}
