'use client'

/**
 * QuickHealthSheet — 건강(식사) 1~3탭 빠른 기록.
 *
 * 무거운 6필드 설문(/health) 대신, 식욕·배변·활동 칩만 탭해서 바로 저장.
 * 해당하는 것만 탭(미선택은 저장 안 됨), 최소 1개. health_logs 에 그대로 저장
 * (기존 폼과 동일 컬럼·값) → 기록 호환. 더 적고 싶으면 "자세히"로 풀 폼 이동.
 *
 * 2026-10-09 'A 포스터'(시안 T12): 머리줄(큰 제목 + 회색 한 줄 · '닫기') · 네모 선택지(고른 것 =
 * 먹색) · 먹색 꽉 찬 버튼 · 아래 밑줄 링크. 조각은 SheetParts. 고객 문구의 '탭'은 '누르'로.
 *
 * **앱(PWA) 전용.** 호출자(BottomTabBar 기록 탭)가 dogId 전달 + open/onClose 제어.
 */

import { useRef, useState } from 'react'
import BottomSheet from '@/components/ui/BottomSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import {
  SheetChoiceRow,
  SheetContent,
  SheetError,
  SheetHeader,
  SheetPrimaryButton,
  SheetTextLink,
  type SheetOption,
} from '@/components/v3/sheet/SheetParts'

// 기존 /health 폼과 동일한 값·라벨 (데이터 호환).
const APPETITE: SheetOption[] = [['good', '좋음'], ['normal', '보통'], ['low', '적음'], ['none', '거부']]
const POOP: SheetOption[] = [['good', '정상'], ['loose', '무름'], ['hard', '단단'], ['diarrhea', '설사']]
const ACTIVITY: SheetOption[] = [['high', '활발'], ['normal', '보통'], ['low', '적음']]

interface QuickHealthSheetProps {
  open: boolean
  onClose: () => void
  dogId: string
  dogName?: string
  /** 저장 성공 콜백 (토스트 등). */
  onSaved?: () => void
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
  // 동기 중복가드 — disabled(state)는 리렌더 후라 서브프레임 더블탭이 새 나가 중복
  // insert 된다(HealthLogClient savingRef 패턴, 2026-07-17).
  const submittingRef = useRef(false)
  const toast = useToast()

  const empty = !appetite && !poop && !activity

  async function save() {
    if (submittingRef.current || empty) return
    submittingRef.current = true
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
      submittingRef.current = false
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
        <SheetContent>
          <SheetHeader
            title={`${dogName ? `${dogName} ` : ''}오늘 어땠나요?`}
            sub="해당하는 것만 누르세요 · 1초면 끝나요"
            onClose={onClose}
          />

          <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
            <SheetChoiceRow label="식욕" options={APPETITE} value={appetite} onPick={setAppetite} />
            <SheetChoiceRow label="배변" options={POOP} value={poop} onPick={setPoop} />
            <SheetChoiceRow label="활동" options={ACTIVITY} value={activity} onPick={setActivity} />
          </div>

          <div style={{ marginTop: 20 }}>
            <SheetError msg={err} />
            <SheetPrimaryButton onClick={save} disabled={busy || empty} busy={busy}>
              {busy ? '저장 중...' : empty ? '하나 이상 눌러 주세요' : '기록 완료'}
            </SheetPrimaryButton>
          </div>

          <SheetTextLink href={`/dogs/${dogId}/health`} onClick={onClose}>
            기분·메모까지 자세히 기록 →
          </SheetTextLink>
        </SheetContent>
      </BottomSheet.Body>
    </BottomSheet>
  )
}
