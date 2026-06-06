'use client'

/**
 * DashboardDailyChecks — DailyCheckinStack 의 dashboard wiring (R15-C27).
 *
 * 카드 3장 (체중 / 기분 / 사진) 을 today 기준 완료 여부에 따라 노출.
 * tap 시 해당 입력 페이지로 라우팅.
 *
 * # completed 판정
 *
 * localStorage 기반 — 같은 날 (yyyy-mm-dd) 에 카드 id 누르면 cleared.
 * DB persistence 는 weight_logs / dog_diary 에 기록되면 자동 cleared.
 * 단순화: 오늘 한 번 tap 으로 mark, 다음날 reset.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DailyCheckinStack, type CheckinCard } from '@/components/v3'
import { todayKstIsoDate } from '@/lib/datetime-kst'

// KST 오늘(자정 기준). UTC 면 한국 자정~09시 사이에 '어제'로 잡혀 데일리
// 체크가 하루 일찍/늦게 리셋되는 버그.
const STORAGE_KEY = (dogId: string) =>
  `ft:dailycheckin:${dogId}:${todayKstIsoDate()}`

const DEFAULT_CARDS: CheckinCard[] = [
  {
    id: 'weight',
    title: '오늘의 체중 기록',
    subtitle: '한 번에 30초',
    tone: 'terracotta',
  },
  {
    id: 'mood',
    title: '기분 체크',
    subtitle: '오늘 컨디션 어땠나요?',
    tone: 'moss',
  },
  {
    id: 'photo',
    title: '오늘의 한 컷',
    subtitle: '추억은 기록될 때 남아요',
    tone: 'gold',
  },
]

// lazy initializer 외부 — react-hooks/set-state-in-effect 룰 회피.
function loadCompleted(dogId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY(dogId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

export default function DashboardDailyChecks({
  dogId,
}: {
  dogId: string
}) {
  const router = useRouter()
  // mount 시 1회만 localStorage 읽고 결정 — dogId 변경엔 컴포넌트 instance
  // 가 새로 마운트되므로 추가 effect 불필요 (NextActionCard 패턴 동일).
  const [completed, setCompleted] = useState<string[]>(() =>
    loadCompleted(dogId),
  )

  function handleTap(id: string) {
    const next = Array.from(new Set([...completed, id]))
    setCompleted(next)
    try {
      localStorage.setItem(STORAGE_KEY(dogId), JSON.stringify(next))
    } catch {
      /* noop */
    }
    if (id === 'weight') router.push(`/dogs/${dogId}/health`)
    else if (id === 'mood') router.push(`/dogs/${dogId}/diary`)
    else if (id === 'photo') router.push(`/dogs/${dogId}/photos`)
  }

  return (
    <DailyCheckinStack
      items={DEFAULT_CARDS}
      completedIds={completed}
      onTap={handleTap}
    />
  )
}
