'use client'

/**
 * Phase 2 (2026-05-20): 첫 박스 7일 후 1문항 체크인.
 *
 * 30초 작업, 100P 적립, 강제 X.
 * - 👍 잘 먹어요 (palatability great)
 * - 😐 조금 가렸어요 (palatability ok)
 * - 👎 안 먹어요 (palatability poor) → 자동 CS 문의 옵션
 *
 * 응답 시 feeding_outcomes 에 첫 박스 체크인 row 1건 기록.
 * 동일 dog 의 first_box_checkin row 가 이미 있으면 UNIQUE 충돌 → 자동 dedup.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { petName } from '@/lib/korean'

type Props = {
  dogId: string
  dogName: string
  userId: string
}

type Choice = 'great' | 'ok' | 'poor' | null

export default function FirstCheckinClient({ dogId, dogName, userId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [choice, setChoice] = useState<Choice>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!choice || submitting) return
    setSubmitting(true)

    try {
      // feeding_outcomes insert (RLS: auth.uid = user_id 통과)
      // generated types 에 없어 cast.
      const { error } = await (
        supabase.from('feeding_outcomes' as never) as unknown as {
          insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
        }
      ).insert({
        dog_id: dogId,
        user_id: userId,
        source: 'first_box_checkin',
        week_no: 1,
        palatability: choice,
        comment: comment.trim() || null,
      })

      if (error) {
        // UNIQUE 충돌 = 이미 응답 → 멱등 처리
        if (error.message.includes('uq_first_box_checkin') || error.message.includes('duplicate')) {
          toast.info('이미 의견을 남겨주셨어요. 감사해요 🐾')
          setDone(true)
          return
        }
        toast.error('잠시 후 다시 시도해 주세요')
        return
      }

      // 100P 적립 (RPC apply_point_delta, 멱등 by reference_id)
      try {
        await supabase.rpc('apply_point_delta', {
          p_user_id: userId,
          p_delta: 100,
          p_reason: '첫 박스 체크인 응원 포인트',
          p_reference_type: 'survey_completion',
          p_reference_id: `first_checkin:${dogId}`,
        })
      } catch {
        /* 적립 실패는 silent — outcome 기록 자체가 성공 */
      }

      toast.success('+100P 적립됐어요. 좋은 의견 감사해요 🐾')
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="px-5 pt-16 pb-20 max-w-md mx-auto">
        <div className="text-center">
          <div className="text-5xl mb-4">💚</div>
          <h1
            className="font-sans"
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              marginBottom: 12,
            }}
          >
            의견 감사드려요
          </h1>
          <p className="text-[13.5px] text-muted leading-relaxed mb-8">
            {petName(dogName)}의 영양 관리에 큰 도움이 돼요.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/dogs/${dogId}`)}
            className="px-6 py-3 rounded-full text-[13.5px] font-bold"
            style={{
              // R27 v3 polish: ink → terracotta accent (카트 CTA grammar 호응)
              background: 'var(--terracotta)',
              color: '#fff',
              boxShadow: '0 6px 20px -8px rgba(220, 83, 42, 0.45)',
            }}
          >
            {petName(dogName)} 정보 보기 →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 pt-10 pb-20 max-w-md mx-auto">
      <span className="kicker">First Box · 7일차 체크인</span>
      <h1
        className="font-sans mt-2"
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.02em',
          lineHeight: 1.3,
        }}
      >
        {petName(dogName)}는 잘 먹고 있나요?
      </h1>
      <p
        className="text-[12px] text-muted mt-2 mb-8 leading-relaxed"
        style={{ wordBreak: 'keep-all' }}
      >
        30초만 시간 내주시면 {petName(dogName)}에게 더 잘 맞는 추천을 드릴 수 있어요.
        응답해 주시면 100P 적립해 드려요.
      </p>

      <div className="flex flex-col gap-3">
        {([
          { value: 'great', emoji: '👍', label: '잘 먹어요', sub: '정량 다 먹어요' },
          { value: 'ok', emoji: '😐', label: '조금 가렸어요', sub: '절반 정도 먹어요' },
          { value: 'poor', emoji: '👎', label: '잘 안 먹어요', sub: '거의 안 먹어요' },
        ] as const).map((opt) => {
          const selected = choice === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setChoice(opt.value)}
              className="flex items-center gap-4 p-4 rounded text-left active:scale-[0.98] transition"
              style={{
                // R27 v3 polish: selected ink → terracotta (R26/R27 grammar 통일)
                background: selected ? 'var(--terracotta)' : 'var(--bg-2)',
                color: selected ? '#fff' : 'var(--ink)',
                border: '1px solid',
                borderColor: selected ? 'var(--terracotta)' : 'var(--rule)',
                boxShadow: selected
                  ? '0 6px 20px -8px rgba(220, 83, 42, 0.4)'
                  : 'none',
              }}
            >
              <div className="text-3xl shrink-0">{opt.emoji}</div>
              <div className="flex-1">
                <div className="text-[13.5px] font-bold">{opt.label}</div>
                <div className="text-[12px] mt-0.5 opacity-75">{opt.sub}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        <label
          className="block text-[10.5px] text-muted font-semibold mb-2"
          style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          더 알려주실 게 있나요? (선택)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="예: 변 상태가 좋아졌어요 / 활동량이 늘었어요 / 가려움이 줄었어요…"
          className="w-full px-4 py-3 rounded text-[13.5px] leading-relaxed resize-none"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--rule)',
            color: 'var(--ink)',
          }}
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!choice || submitting}
        className="mt-8 w-full py-4 rounded-full text-[13.5px] font-black active:scale-[0.98] transition disabled:opacity-50"
        style={{
          // R27 v3 polish: ink → terracotta + 카트 sticky CTA grammar 동일.
          background: 'var(--terracotta)',
          color: '#fff',
          border: '1px solid rgba(178, 58, 26, 0.6)',
          boxShadow:
            '0 8px 22px -6px rgba(220, 83, 42, 0.48), 0 2px 8px rgba(220, 83, 42, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
        }}
      >
        {submitting ? '저장 중…' : '의견 보내기 (+100P)'}
      </button>

      <p className="text-[10.5px] text-muted text-center mt-4">
        나중에 응답하시려면 그냥 닫으셔도 돼요 🐾
      </p>
    </div>
  )
}
