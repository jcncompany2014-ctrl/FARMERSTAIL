'use client'

/**
 * QuickWeightSheet — 체중 1탭 빠른 기록.
 *
 * 무거운 페이지 이동 없이, 어디서든(대시보드 체중 카드 · PawFab 체중 발가락)
 * dogId 만 넘기면 그 자리에서 바텀시트로 체중 입력. 기존 WeightInputSheet(96px
 * 숫자 UI)를 그대로 재사용하고, **저장 로직만 자체 보유**(weight_logs insert +
 * dogs.weight 마스터 갱신 → 분석·대시보드 반영). 호출자는 open/onClose 만 관리.
 *
 * dogName/initialKg 를 모르는 호출자(PawFab 등)는 생략 → 열릴 때 dogs 에서 조회.
 *
 * **앱(PWA) 전용.**
 */

import { useEffect, useState } from 'react'
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

  const name = dogName ?? fetched?.name ?? ''
  const kg = initialKg ?? fetched?.weight ?? null
  const toast = useToast()

  async function save(value: number) {
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
  }

  return (
    <WeightInputSheet
      open={open}
      onClose={onClose}
      dogName={name || '우리 아이'}
      lastKg={kg}
      initialKg={kg ?? 4.0}
      onSave={save}
    />
  )
}
