'use client'

/**
 * Phase 2 (2026-05-20): 첫 박스 7일 후 1문항 체크인.
 *
 * 30초 작업, 강제 X.
 * - 잘 먹어요 (palatability great)
 * - 조금 가렸어요 (palatability ok)
 * - 안 먹어요 (palatability poor) → 자동 CS 문의 옵션
 *
 * 응답 시 feeding_outcomes 에 첫 박스 체크인 row 1건 기록.
 * 동일 dog 의 first_box_checkin row 가 이미 있으면 UNIQUE 충돌 → 자동 dedup.
 *
 * 2026-10-09 앱 새 디자인('A 포스터', 시안 S27-first-checkin · S28-first-checkin-done) — 모양만 바꿨다(저장·중복
 * 처리 그대로). 보기의 이모지(👍😐👎)는 시안의 선 그림(엄지·무표정)으로, 안내·알림 끝의 🐾 는 뺐다(앱시안 결정
 * '첫 박스 체크인 이모지'). 고른 보기 = 먹색 칸 + 오른쪽 체크.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { petName } from '@/lib/korean'
import { V3, V3Radius } from '@/lib/design/tokens'
import { ArrowRightIcon, CheckIcon } from '@/components/v3/dog/DogIcons'

type Props = {
  dogId: string
  dogName: string
  userId: string
  /** 점검 화면(/design-check/box/checkin) 전용 — 고른 보기·끝난 화면으로 시작한다. 실제 화면은 넘기지 않는다. */
  preview?: { choice?: Choice; done?: boolean }
}

type Choice = 'great' | 'ok' | 'poor' | null

const OPTIONS = [
  { value: 'great', icon: 'up', label: '잘 먹어요', sub: '정량 다 먹어요' },
  { value: 'ok', icon: 'flat', label: '조금 가렸어요', sub: '절반 정도 먹어요' },
  { value: 'poor', icon: 'down', label: '잘 안 먹어요', sub: '거의 안 먹어요' },
] as const

export default function FirstCheckinClient({ dogId, dogName, userId, preview }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  const [choice, setChoice] = useState<Choice>(preview?.choice ?? null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(preview?.done ?? false)

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
        // 코드(23505=unique_violation) 우선 — 메시지 문자열은 포맷 변경에 취약(감사 2026-07-03).
        if ((error as { code?: string }).code === '23505' || error.message.includes('uq_first_box_checkin') || error.message.includes('duplicate')) {
          toast.info('이미 의견을 남겨주셨어요. 감사해요.')
          setDone(true)
          return
        }
        toast.error('잠시 후 다시 시도해 주세요')
        return
      }

      // 포인트 적립 제거 (2026-07-16 포인트 전면 폐기).

      toast.success('좋은 의견 고마워요. 다음 박스에 반영할게요.')
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  // 몰입 화면(윗줄·아래 탭 없음 — 시안) 한 장 높이. 아래 버튼이 짧은 화면에서도 맨 아래에 붙게.
  const pageStyle: React.CSSProperties = {
    minHeight: 'calc(100dvh - env(safe-area-inset-bottom, 0px))',
    display: 'flex',
    flexDirection: 'column',
    background: V3.paper,
    color: V3.ink,
    wordBreak: 'keep-all',
    // 시안 HTML 은 줄 높이를 따로 안 준 곳이 기본값(normal) — 앱 바탕(1.5)을 이어받으면 칸마다 길어진다.
    lineHeight: 'normal',
  }

  if (done) {
    return (
      <div style={pageStyle}>
        <section
          style={{
            flex: 1,
            // 아래 79px = 보낸 직후 뜨는 짧은 알림 자리(시안 S28 — 알림 위 공간의 가운데에 놓인다).
            padding: '0 20px 79px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              background: V3.ink,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckIcon size={40} color="#FFFFFF" />
          </span>
          <h1 style={{ margin: '24px 0 0', fontSize: 34, lineHeight: 1.15 }}>의견 감사드려요</h1>
          <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>
            {petName(dogName)}의 영양 관리에 큰 도움이 돼요.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/dogs/${dogId}`)}
            style={{
              marginTop: 32,
              alignSelf: 'stretch',
              height: 60,
              border: 0,
              borderRadius: V3Radius.sm,
              background: V3.ink,
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: 17,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
            }}
          >
            {petName(dogName)} 정보 보기
            <ArrowRightIcon size={20} strokeWidth={2.4} color="#FFFFFF" />
          </button>
        </section>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <section style={{ padding: '36px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 700,
            color: V3.inkMute,
          }}
        >
          <span aria-hidden style={{ width: 8, height: 8, flexShrink: 0, background: V3.mustard }} />
          첫 박스 · 7일차 체크인
        </span>
        <h1 style={{ margin: '14px 0 0', fontSize: 34, lineHeight: 1.15 }}>
          {petName(dogName)}는
          <br />
          잘 먹고 있나요?
        </h1>
        <p style={{ margin: '12px 0 0', fontSize: 17, lineHeight: 1.6, color: V3.inkSoft }}>
          30초만 시간 내주시면 {petName(dogName)}에게 더 잘 맞는 추천을 드릴 수 있어요.
        </p>
      </section>

      <div
        role="radiogroup"
        aria-label="먹는 모습"
        style={{ margin: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {OPTIONS.map((opt) => {
          const selected = choice === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(opt.value)}
              className="active:scale-[0.99] transition"
              style={{
                minHeight: 80,
                padding: '0 16px',
                borderRadius: V3Radius.sm,
                border: selected ? `2px solid ${V3.ink}` : '1.5px solid #D5D3D4',
                background: selected ? V3.ink : V3.paper,
                color: selected ? '#FFFFFF' : V3.ink,
                fontFamily: 'inherit',
                textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: '44px 1fr 24px',
                columnGap: 14,
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  background: selected ? '#FFFFFF' : V3.soft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FeelIcon kind={opt.icon} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{opt.label}</span>
                <span style={selected ? { fontSize: 15, opacity: 0.8 } : { fontSize: 15, color: V3.inkMute }}>
                  {opt.sub}
                </span>
              </span>
              {selected ? <CheckIcon size={22} strokeWidth={2.8} color="#FFFFFF" /> : <span />}
            </button>
          )
        })}
      </div>

      <div style={{ margin: '26px 20px 0', display: 'flex', flexDirection: 'column' }}>
        <label htmlFor="first-checkin-comment" style={{ fontSize: 16, fontWeight: 800 }}>
          더 알려주실 게 있나요?{' '}
          <span style={{ fontSize: 15, fontWeight: 700, color: V3.inkMute }}>선택</span>
        </label>
        <textarea
          id="first-checkin-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="예: 변 상태가 좋아졌어요 / 활동량이 늘었어요 / 가려움이 줄었어요…"
          className="placeholder:text-[#8A8A8A]"
          style={{
            marginTop: 10,
            width: '100%',
            minHeight: 92,
            boxSizing: 'border-box',
            padding: 14,
            borderRadius: V3Radius.sm,
            border: '1.5px solid #D5D3D4',
            background: V3.paper,
            color: V3.ink,
            fontFamily: 'inherit',
            fontSize: 16,
            lineHeight: 1.55,
            resize: 'none',
            outline: 'none',
          }}
        />
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: '26px 20px calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={!choice || submitting}
          style={{
            height: 60,
            border: 0,
            borderRadius: V3Radius.sm,
            background: !choice || submitting ? V3.inkMute : V3.ink,
            color: '#FFFFFF',
            fontFamily: 'inherit',
            fontSize: 17,
            fontWeight: 800,
            cursor: !choice || submitting ? 'default' : 'pointer',
          }}
        >
          {submitting ? '저장 중…' : '의견 보내기'}
        </button>
        <span style={{ textAlign: 'center', fontSize: 15, color: V3.inkMute }}>
          나중에 응답하시려면 그냥 닫으셔도 돼요
        </span>
      </div>
    </div>
  )
}

/** 보기 그림 — 시안 S27 의 선 그림(엄지 위·무표정·엄지 아래). 예전 이모지(👍😐👎) 대신. */
function FeelIcon({ kind }: { kind: 'up' | 'flat' | 'down' }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: V3.ink,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (kind === 'flat') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8.5 15h7" />
        <path d="M9 10h.01M15 10h.01" strokeWidth="3" />
      </svg>
    )
  }
  return (
    <svg {...common} style={kind === 'down' ? { transform: 'rotate(180deg)' } : undefined}>
      <path d="M7 11v9H4v-9z" />
      <path d="M7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H18a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7" />
    </svg>
  )
}
