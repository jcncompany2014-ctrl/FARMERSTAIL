'use client'

/**
 * QuickWeightSheet — 체중 1탭 빠른 기록.
 *
 * 무거운 페이지 이동 없이, 어디서든(대시보드 체중 카드 · 하단 탭 가운데 기록 버튼)
 * dogId 만 넘기면 그 자리에서 바텀시트로 체중 입력. 기존 WeightInputSheet(큰 숫자
 * UI)를 그대로 재사용하고, **저장 로직만 자체 보유**(weight_logs insert +
 * dogs.weight 마스터 갱신 → 분석·대시보드 반영). 호출자는 open/onClose 만 관리.
 *
 * dogName/initialKg 를 모르는 호출자(BottomTabBar 등)는 생략 → 열릴 때 dogs 에서 조회.
 *
 * 2026-10-09 'A 포스터'(시안 T13): 머리줄의 "마지막 기록 N일 전"을 위해 열릴 때마다
 * weight_logs 의 가장 최근 measured_at 을 조회한다(KST 달력 날짜 차이, 0 = 오늘).
 * 예전엔 이 값을 안 넘겨 기록이 있어도 늘 '첫 기록을 시작해요'라고 적었다.
 * 조회 중이거나 실패하면 undefined 로 두어 시트가 아무 말도 하지 않게 한다.
 *
 * **앱(PWA) 전용.**
 */

import { useEffect, useRef, useState } from 'react'
import WeightInputSheet from '@/components/v3/dog/WeightInputSheet'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

interface QuickWeightSheetProps {
  open: boolean
  onClose: () => void
  dogId: string
  /** 알면 전달 — 없으면 열릴 때 조회. */
  dogName?: string
  /** 알면 전달(현재 체중, kg) — 없으면 조회. delta/초기값 baseline. */
  initialKg?: number | null
  /** 저장 성공 콜백. */
  onSaved?: () => void
}

/** KST(UTC+9) 달력 날짜 'YYYY-MM-DD'. */
function kstDay(ms: number): string {
  return new Date(ms + 9 * 3600e3).toISOString().slice(0, 10)
}

/**
 * 마지막 기록일이 오늘(KST)로부터 며칠 전인지 — 달력 날짜 차이, 음수 없음.
 * 시각을 못 읽으면 undefined(모름) — 기록은 있으니 '첫 기록'이라고 말하면 안 된다.
 */
function daysSinceKst(iso: string): number | undefined {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return undefined
  // 'YYYY-MM-DD' 는 UTC 자정으로 읽힌다 — 두 자정의 차이는 하루의 정수배.
  const diff = Date.parse(kstDay(Date.now())) - Date.parse(kstDay(t))
  return Math.max(0, Math.round(diff / 86400000))
}

export default function QuickWeightSheet({
  open,
  onClose,
  dogId,
  dogName,
  initialKg,
  onSaved,
}: QuickWeightSheetProps) {
  // props 로 받은 값은 그대로 쓰고, 빠진 것만 dogs 에서 1회 조회 (fetched).
  const [fetched, setFetched] = useState<{
    name: string | null
    weight: number | null
  } | null>(null)

  useEffect(() => {
    if (!open) return
    if (dogName && initialKg != null) return // 다 받음 — 조회 불필요
    if (fetched) return // 이미 조회함
    let cancelled = false
    const supabase = createClient()
    void supabase
      .from('dogs')
      .select('name, weight')
      .eq('id', dogId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setFetched({ name: data.name, weight: data.weight })
      })
    return () => {
      cancelled = true
    }
  }, [open, dogId, dogName, initialKg, fetched])

  // 마지막 체중 기록이 며칠 전인지 — 열릴 때마다 조회(저장 직후 다시 열어도 새 값).
  // undefined = 아직 모름(조회 중·실패) → 시트가 아무 말도 안 한다. null = 기록 없음.
  const [daysSinceLast, setDaysSinceLast] = useState<number | null | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const supabase = createClient()
    void supabase
      .from('weight_logs')
      .select('measured_at')
      .eq('dog_id', dogId)
      .order('measured_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // 조회 실패 ≠ 기록 없음 — '첫 기록'이라고 말하지 않도록 모름(undefined)으로 둔다.
          console.error('[QuickWeightSheet] last weight log fetch failed', error)
          return
        }
        const iso = data?.[0]?.measured_at
        setDaysSinceLast(iso ? daysSinceKst(iso) : null)
      })
    return () => {
      cancelled = true
      // 닫히면 잊는다 — 다시 열 때 옛 값("3일 전")이 잠깐 보이지 않게.
      setDaysSinceLast(undefined)
    }
  }, [open, dogId])

  const name = dogName ?? fetched?.name ?? ''
  const kg = initialKg ?? fetched?.weight ?? null
  const toast = useToast()
  // 동기 중복가드 — 더블탭 중복 insert 방지. 에러는 그대로 throw 해 WeightInputSheet
  // 가 표시하게 두고, finally 로 ref 를 풀어 재시도 허용(2026-07-17).
  const submittingRef = useRef(false)

  async function save(value: number) {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요해요')
      const { error } = await supabase.from('weight_logs').insert({
        dog_id: dogId,
        user_id: user.id,
        weight: value,
      })
      if (error) throw new Error('저장하지 못했어요')
      // 마스터 체중도 최신값으로 (분석·대시보드·다음행동 엔진 반영).
      // weight_logs 엔 이미 기록됨(원본 안전) — dogs.weight 는 파생 캐시라 실패해도
      // 다음 체중 기록서 self-heal. 성공 토스트는 유지하되 운영 가시성 위해 로깅.
      const { error: masterErr } = await supabase
        .from('dogs')
        .update({ weight: value })
        .eq('id', dogId)
      if (masterErr) {
        console.error('[QuickWeightSheet] master weight update failed', masterErr)
      }
      toast.success('체중을 기록했어요')
      onSaved?.()
      onClose()
    } finally {
      submittingRef.current = false
    }
  }

  return (
    <WeightInputSheet
      open={open}
      onClose={onClose}
      dogName={name || '우리 아이'}
      lastKg={kg}
      daysSinceLast={daysSinceLast}
      initialKg={kg ?? 4.0}
      onSave={save}
    />
  )
}
