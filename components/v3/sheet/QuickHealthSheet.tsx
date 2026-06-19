'use client'

/**
 * QuickHealthSheet — 건강(식사) 1~3탭 빠른 기록.
 *
 * 무거운 6필드 설문(/health) 대신, 식욕·배변·활동 칩만 탭해서 바로 저장.
 * 해당하는 것만 탭(미선택은 저장 안 됨), 최소 1개. health_logs 에 그대로 저장
 * (기존 폼과 동일 컬럼·값) → 기록 호환. 더 적고 싶으면 "자세히"로 풀 폼 이동.
 *
 * **앱(PWA) 전용.** 호출자(PawFab)가 dogId 전달 + open/onClose 제어.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { V3, V3FontWeight } from '@/lib/design/tokens'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

type Opt = readonly [value: string, label: string]
// 기존 /health 폼과 동일한 값·라벨 (데이터 호환).
const APPETITE: Opt[] = [['good', '좋음'], ['normal', '보통'], ['low', '적음'], ['none', '거부']]
const POOP: Opt[] = [['good', '정상'], ['loose', '무름'], ['hard', '단단'], ['diarrhea', '설사']]
const ACTIVITY: Opt[] = [['high', '활발'], ['normal', '보통'], ['low', '적음']]

interface QuickHealthSheetProps {
  open: boolean
  onClose: () => void
  dogId: string
  dogName?: string
  /** 저장 성공 콜백 (토스트 등). */
  onSaved?: () => void
}

function ChipRow({
  title,
  opts,
  value,
  onPick,
}: {
  title: string
  opts: Opt[]
  value: string | null
  onPick: (v: string | null) => void
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: V3FontWeight.bold,
          color: V3.inkSoft,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div className="flex" style={{ gap: 8 }}>
        {opts.map(([v, label]) => {
          const active = value === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => onPick(active ? null : v)}
              aria-pressed={active}
              className="transition active:scale-95 ft-no-press"
              style={{
                flex: 1,
                padding: '12px 4px',
                borderRadius: 999,
                background: active ? V3.ink : V3.paperHi,
                color: active ? V3.paper : V3.ink,
                border: `1px solid ${active ? V3.ink : V3.rule}`,
                fontFamily: 'var(--font-sans)',
                fontWeight: V3FontWeight.bold,
                fontSize: 13.5,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function QuickHealthSheet({
  open,
  onClose,
  dogId,
  dogName,
  onSaved,
}: QuickHealthSheetProps) {
  const [appetite, setAppetite] = useState<string | null>(null)
  const [poop, setPoop] = useState<string | null>(null)
  const [activity, setActivity] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const toast = useToast()

  const empty = !appetite && !poop && !activity

  async function save() {
    if (busy || empty) return
    setBusy(true)
    setErr(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setErr('로그인이 필요해요')
        return
      }
      // KST 오늘 날짜 (YYYY-MM-DD).
      const todayIso = new Date(Date.now() + 9 * 3600 * 1000)
        .toISOString()
        .slice(0, 10)
      const { error } = await supabase.from('health_logs').insert({
        dog_id: dogId,
        user_id: user.id,
        logged_at: todayIso,
        appetite,
        poop_quality: poop,
        poop_count: null,
        activity_level: activity,
        mood: null,
        note: null,
      })
      if (error) {
        setErr('저장하지 못했어요')
        return
      }
      setAppetite(null)
      setPoop(null)
      setActivity(null)
      toast.success('오늘 건강을 기록했어요')
      onSaved?.()
      onClose()
    } catch {
      setErr('저장하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      ariaLabel="건강 빠른 기록"
      dismissOnBackdrop={!busy}
    >
      <BottomSheet.Body>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.black,
            fontSize: 24,
            color: V3.ink,
            letterSpacing: '-0.02em',
            wordBreak: 'keep-all',
          }}
        >
          {dogName ? `${dogName} ` : ''}오늘 어땠나요?
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: V3.inkMute }}>
          해당하는 것만 탭하세요 · 1초면 끝나요
        </p>

        <ChipRow title="식욕" opts={APPETITE} value={appetite} onPick={setAppetite} />
        <ChipRow title="배변" opts={POOP} value={poop} onPick={setPoop} />
        <ChipRow title="활동" opts={ACTIVITY} value={activity} onPick={setActivity} />

        <Link
          href={`/dogs/${dogId}/health`}
          onClick={onClose}
          style={{
            display: 'inline-block',
            marginTop: 18,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.06em',
            color: V3.accentDeep,
            fontWeight: 600,
          }}
        >
          기분·메모까지 자세히 기록 →
        </Link>
      </BottomSheet.Body>

      <BottomSheet.Footer>
        {err && (
          <p
            role="alert"
            style={{ margin: '0 0 10px', fontSize: 12, color: V3.sale }}
          >
            {err}
          </p>
        )}
        <button
          onClick={save}
          disabled={busy || empty}
          className="flex items-center justify-center transition active:scale-[0.98]"
          style={{
            width: '100%',
            height: 52,
            borderRadius: 4,
            background: busy || empty ? V3.inkMute : V3.ink,
            color: V3.paper,
            border: 'none',
            cursor: busy ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sans)',
            fontWeight: V3FontWeight.bold,
            fontSize: 16,
            gap: 8,
          }}
        >
          <Check size={18} color={V3.paper} strokeWidth={2.2} />
          {busy ? '저장 중...' : empty ? '하나 이상 탭해주세요' : '기록 완료'}
        </button>
      </BottomSheet.Footer>
    </BottomSheet>
  )
}
