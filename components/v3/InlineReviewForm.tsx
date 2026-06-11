'use client'

/**
 * InlineReviewForm — B2. 앱 내 인라인 리뷰 작성 폼.
 *
 * verified purchase (구매 이력 검증) 후 product detail surface 또는 dogs/[id]/diary
 * 인접 영역에서 한 줄짜리 리뷰 + 별점 빠르게 입력.
 *
 * 베타: 별점 + 한 줄 텍스트 + (옵션) 사진 1장. 본격 review 시스템 (DB 테이블 +
 * 모더레이션 + 사진 다중) 은 별도 마이그레이션.
 *
 * # API
 *
 *   <InlineReviewForm
 *     productName="브렉시 닭가슴살"
 *     onSubmit={async ({ rating, text }) => { ... }}
 *   />
 */

import { useState } from 'react'
import { Star, Send } from 'lucide-react'
import { V3, V3FontWeight, V3Radius } from '@/lib/design/tokens'

interface InlineReviewFormProps {
  productName: string
  /** 폼 submit. async — disable / loading state 처리. */
  onSubmit: (payload: { rating: number; text: string }) => Promise<void>
  /** 최대 글자수. 기본 140. */
  maxLength?: number
  /** placeholder. */
  placeholder?: string
}

export default function InlineReviewForm({
  productName,
  onSubmit,
  maxLength = 140,
  placeholder = '한 줄 평을 남겨주세요',
}: InlineReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit() {
    if (rating === 0 || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      await onSubmit({ rating, text: text.trim() })
      setSubmitted(true)
    } catch (err) {
      // R83-9: 이전엔 catch 누락 → submitting 만 풀리고 사용자는 아무 피드백 없음.
      // 같은 폼 다시 눌러서 중복 리뷰 발생 가능.
      const msg = err instanceof Error ? err.message : '리뷰 등록에 실패했어요'
      setErrorMsg(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div
        role="status"
        style={{
          background: `color-mix(in srgb, ${V3.sage} 10%, ${V3.paperHi})`,
          border: `1px solid color-mix(in srgb, ${V3.sage} 32%, transparent)`,
          borderRadius: V3Radius.sm,
          padding: '14px 16px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13.5,
            fontWeight: V3FontWeight.bold,
            color: V3.ink,
          }}
        >
          리뷰 등록 완료 — 고마워요
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: V3.paperHi,
        border: `1px solid ${V3.rule}`,
        borderRadius: V3Radius.sm,
        padding: '14px 16px',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          fontWeight: V3FontWeight.bold,
          color: V3.accent,
          letterSpacing: '0.16em',
          wordSpacing: '-0.12em',
          textTransform: 'uppercase',
        }}
      >
        구매 후기 · {productName}
      </p>

      <div
        style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`별 ${n}개`}
            style={{
              padding: 2,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Star
              size={22}
              fill={n <= rating ? V3.yellow : 'none'}
              color={n <= rating ? V3.yellow : V3.inkFaint}
              strokeWidth={n <= rating ? 1.6 : 1.8}
            />
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        rows={2}
        style={{
          marginTop: 10,
          width: '100%',
          padding: '8px 10px',
          fontFamily: 'var(--font-sans)',
          fontSize: 13.5,
          color: V3.ink,
          background: V3.paper,
          border: `1px solid ${V3.rule}`,
          borderRadius: V3Radius.xs,
          resize: 'none',
          letterSpacing: '-0.01em',
        }}
      />

      <div
        style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            color: V3.inkMute,
          }}
        >
          {text.length} / {maxLength}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          style={{
            padding: '7px 14px',
            background: V3.ink,
            color: V3.paperHi,
            border: 'none',
            borderRadius: V3Radius.sm,
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            fontWeight: V3FontWeight.bold,
            letterSpacing: '-0.01em',
            cursor:
              rating === 0 || submitting ? 'not-allowed' : 'pointer',
            opacity: rating === 0 || submitting ? 0.5 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Send size={12} strokeWidth={2.5} />
          {submitting ? '등록 중…' : '등록'}
        </button>
      </div>

      {errorMsg && (
        <p
          role="alert"
          style={{
            marginTop: 8,
            fontSize: 10.5,
            color: '#b03a2e',
            letterSpacing: '-0.01em',
          }}
        >
          {errorMsg}
        </p>
      )}
    </div>
  )
}
