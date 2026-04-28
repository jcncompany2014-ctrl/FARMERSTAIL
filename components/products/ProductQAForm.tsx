'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, Lock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * ProductQAForm — PDP 의 상품 문의 작성 폼.
 *
 * RLS 가 (auth.uid() = user_id) 만 insert 허용 — 클라이언트 supabase 가
 * authenticated 세션을 들고 있으면 insert 가 통과한다. user_id 는 자동으로
 * 세션 사용자로 채워야 하므로 명시적으로 getUser() 후 user.id 로 set.
 */
export default function ProductQAForm({
  productId,
  productSlug,
}: {
  productId: string
  productSlug: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = question.trim()
    if (trimmed.length < 5) {
      setError('5자 이상 입력해 주세요')
      return
    }

    setSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('로그인이 만료되었어요. 다시 로그인해 주세요.')
        return
      }

      const { error: insErr } = await supabase.from('product_qna').insert({
        product_id: productId,
        user_id: user.id,
        question: trimmed,
        is_private: isPrivate,
      })

      if (insErr) {
        setError('문의 등록 실패: ' + insErr.message)
        return
      }

      // 성공 → 폼 reset + 리스트 갱신
      setQuestion('')
      setIsPrivate(false)
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(
        '오류가 발생했어요: ' +
          (err instanceof Error ? err.message : '알 수 없는 오류'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] md:text-[13px] font-bold transition active:scale-[0.97] mb-4"
        style={{
          background: 'var(--terracotta)',
          color: 'var(--bg)',
          letterSpacing: '-0.01em',
        }}
      >
        <Send className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.25} />
        문의 작성하기
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="mb-5 rounded-xl p-4 md:p-5"
      style={{
        background: 'var(--bg)',
        boxShadow: 'inset 0 0 0 1px var(--rule-2)',
      }}
    >
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={4}
        maxLength={1000}
        placeholder={`이 제품에 대해 궁금한 점을 적어주세요. (예: 알레르기 / 보관 / 정기배송 등)\n슬러그: ${productSlug}`}
        className="w-full px-3 py-2 rounded-lg text-[13px] md:text-[14px] resize-none focus:outline-none"
        style={{
          background: 'var(--bg-2)',
          color: 'var(--ink)',
          border: '1px solid var(--rule)',
        }}
      />

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <label
          className="flex items-center gap-2 cursor-pointer text-[11.5px] md:text-[12.5px]"
          style={{ color: 'var(--muted)' }}
        >
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="w-4 h-4"
            style={{ accentColor: 'var(--terracotta)' }}
          />
          <Lock className="w-3 h-3" strokeWidth={2.25} />
          비공개 문의 (작성자와 운영팀만 열람)
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setQuestion('')
              setError(null)
            }}
            disabled={submitting}
            className="px-3 py-2 rounded-full text-[12px] font-bold disabled:opacity-50"
            style={{ color: 'var(--muted)' }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] md:text-[13px] font-bold transition active:scale-[0.97] disabled:opacity-60"
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              letterSpacing: '-0.01em',
            }}
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.25} />
            ) : (
              <Send className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={2.25} />
            )}
            {submitting ? '등록 중…' : '문의 등록'}
          </button>
        </div>
      </div>

      {error && (
        <p
          className="mt-2 inline-flex items-start gap-1.5 text-[11.5px] md:text-[12.5px] font-bold"
          style={{ color: 'var(--terracotta)' }}
        >
          <AlertCircle
            className="w-3.5 h-3.5 shrink-0 mt-0.5"
            strokeWidth={2.25}
          />
          <span>{error}</span>
        </p>
      )}
    </form>
  )
}
