'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, Lock, MessageCircle, CheckCircle2, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * /admin/qna — 상품 문의 답변 클라이언트.
 *
 * 미답변 → 답변 완료 순으로 보여주고, 각 행 inline expand 로 답변 작성.
 * "답변 저장" 클릭 시 answer + answered_by + answered_at 동시 set.
 */

export type AdminQnaRow = {
  id: string
  product_id: string
  user_id: string
  question: string
  answer: string | null
  answered_by: string | null
  answered_at: string | null
  is_private: boolean
  created_at: string
  updated_at: string
}

type ProductLite = {
  id: string
  name: string
  slug: string
  image_url: string | null
}

type ProfileLite = {
  id: string
  name: string | null
  email: string | null
}

export default function AdminQnaClient({
  initialQna,
  products,
  profiles,
}: {
  initialQna: AdminQnaRow[]
  products: ProductLite[]
  profiles: ProfileLite[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [filter, setFilter] = useState<'pending' | 'answered' | 'all'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const productById = useMemo(() => {
    const m = new Map<string, ProductLite>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  const profileById = useMemo(() => {
    const m = new Map<string, ProfileLite>()
    for (const p of profiles) m.set(p.id, p)
    return m
  }, [profiles])

  const visible = useMemo(() => {
    if (filter === 'pending') return initialQna.filter((q) => !q.answer)
    if (filter === 'answered') return initialQna.filter((q) => q.answer)
    return initialQna
  }, [initialQna, filter])

  const counts = useMemo(
    () => ({
      pending: initialQna.filter((q) => !q.answer).length,
      answered: initialQna.filter((q) => q.answer).length,
    }),
    [initialQna],
  )

  async function saveAnswer(q: AdminQnaRow) {
    const draft = (drafts[q.id] ?? q.answer ?? '').trim()
    if (!draft) {
      alert('답변 내용을 입력해주세요')
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setSaving(q.id)
    const { error } = await supabase
      .from('product_qna')
      .update({
        answer: draft,
        answered_by: user?.id ?? null,
        answered_at: new Date().toISOString(),
      })
      .eq('id', q.id)
    setSaving(null)
    if (error) {
      alert('답변 저장 실패: ' + error.message)
      return
    }
    setExpandedId(null)
    router.refresh()
  }

  async function clearAnswer(q: AdminQnaRow) {
    if (!confirm('이 답변을 삭제하고 미답변 상태로 되돌릴까요?')) return
    setSaving(q.id)
    const { error } = await supabase
      .from('product_qna')
      .update({
        answer: null,
        answered_by: null,
        answered_at: null,
      })
      .eq('id', q.id)
    setSaving(null)
    if (error) {
      alert('답변 삭제 실패: ' + error.message)
      return
    }
    router.refresh()
  }

  async function removeQna(q: AdminQnaRow) {
    if (!confirm('이 문의를 완전히 삭제할까요? 되돌릴 수 없습니다.')) return
    setDeleting(q.id)
    const { error } = await supabase.from('product_qna').delete().eq('id', q.id)
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
          <h1 className="font-['Archivo_Black'] text-3xl text-ink">PRODUCT Q&A</h1>
          <p className="text-sm text-muted mt-1">
            PDP 에 사용자가 남긴 상품 문의. 미답변{' '}
            <strong className="text-terracotta">{counts.pending}</strong>건 ·
            답변 완료 {counts.answered}건.
          </p>
        </div>
      </div>

      <div className="flex gap-1.5 mb-6">
        <FilterChip
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
          label={`미답변 (${counts.pending})`}
        />
        <FilterChip
          active={filter === 'answered'}
          onClick={() => setFilter('answered')}
          label={`답변 완료 (${counts.answered})`}
        />
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`전체 (${initialQna.length})`}
        />
      </div>

      {visible.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-rule text-center">
          <p className="text-sm text-muted">
            {filter === 'pending'
              ? '미답변 문의가 없어요. 모든 문의에 답변 완료!'
              : filter === 'answered'
              ? '아직 답변한 문의가 없어요.'
              : '등록된 문의가 없어요.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((q) => {
            const p = productById.get(q.product_id)
            const u = profileById.get(q.user_id)
            const expanded = expandedId === q.id
            const isAnswered = !!q.answer
            return (
              <div
                key={q.id}
                className="rounded-2xl bg-white border border-rule overflow-hidden"
              >
                <div className="p-4 flex gap-4">
                  {/* 제품 썸네일 */}
                  <Link
                    href={p ? `/products/${p.slug}` : '#'}
                    target="_blank"
                    className="w-16 h-16 rounded border border-rule shrink-0 overflow-hidden"
                  >
                    {p?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-bg" />
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isAnswered
                            ? 'bg-moss text-white'
                            : 'bg-gold/20 text-gold'
                        }`}
                      >
                        {isAnswered ? (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5" strokeWidth={2.5} />
                            답변 완료
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-2.5 h-2.5" strokeWidth={2.5} />
                            미답변
                          </>
                        )}
                      </span>
                      {q.is_private && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rule text-muted">
                          <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
                          비공개
                        </span>
                      )}
                      {p && (
                        <Link
                          href={`/products/${p.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-terracotta hover:underline"
                        >
                          {p.name}
                          <ExternalLink className="w-2.5 h-2.5" strokeWidth={2} />
                        </Link>
                      )}
                      <span className="text-[10px] text-muted">
                        {u?.name ?? u?.email ?? q.user_id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-muted font-mono">
                        {new Date(q.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    <p className="text-[13px] text-ink mt-1.5 leading-relaxed">{q.question}</p>

                    {q.answer && !expanded && (
                      <div className="mt-2 p-3 rounded bg-bg text-[12px] leading-relaxed">
                        <span className="font-bold text-moss text-[10px]">FT 운영팀:</span>{' '}
                        {q.answer}
                        {q.answered_at && (
                          <div className="text-[10px] text-muted mt-1 font-mono">
                            {new Date(q.answered_at).toLocaleString('ko-KR')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col gap-1">
                    <button
                      onClick={() => {
                        if (expanded) {
                          setExpandedId(null)
                        } else {
                          setExpandedId(q.id)
                          setDrafts((d) => ({ ...d, [q.id]: q.answer ?? '' }))
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-terracotta text-white text-[11px] font-semibold hover:bg-[#8A3822] transition"
                    >
                      {expanded ? '닫기' : isAnswered ? '답변 수정' : '답변하기'}
                    </button>
                    <button
                      onClick={() => removeQna(q)}
                      disabled={deleting === q.id}
                      className="px-3 py-1.5 rounded-lg border border-rule text-[10px] text-sale hover:bg-sale/10 transition disabled:opacity-40 inline-flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={2} />
                      삭제
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-rule bg-bg/40 p-4">
                    <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
                      답변 작성
                    </label>
                    <textarea
                      value={drafts[q.id] ?? ''}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [q.id]: e.target.value }))
                      }
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg border border-rule bg-white text-sm leading-relaxed resize-none"
                      placeholder="답변을 입력해주세요. 줄바꿈 가능."
                    />
                    <div className="mt-2 flex items-center gap-2 justify-end">
                      {isAnswered && (
                        <button
                          onClick={() => clearAnswer(q)}
                          disabled={saving === q.id}
                          className="px-3 py-1.5 rounded-lg text-[11px] text-sale hover:bg-sale/10 transition disabled:opacity-40"
                        >
                          답변 삭제 (미답변으로 되돌리기)
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(null)}
                        className="px-3 py-1.5 rounded-lg text-[11px] text-ink hover:bg-rule transition"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => saveAnswer(q)}
                        disabled={saving === q.id}
                        className="px-3 py-1.5 rounded-lg bg-terracotta text-white text-[11px] font-semibold hover:bg-[#8A3822] transition disabled:opacity-50"
                      >
                        {saving === q.id ? '저장 중…' : '답변 저장'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition ${
        active
          ? 'bg-ink text-white'
          : 'bg-white border border-rule text-ink hover:bg-bg'
      }`}
    >
      {label}
    </button>
  )
}
